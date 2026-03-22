"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TtsService = void 0;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const electron_store_1 = __importDefault(require("electron-store"));
const https = __importStar(require("https"));
const adm_zip_1 = __importDefault(require("adm-zip"));
const store = new electron_store_1.default();
/**
 * TTS Service for Project Prism
 * Handles Piper (Local) and ElevenLabs (Cloud)
 */
class TtsService {
    static init() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
        // Register Handlers
        electron_1.ipcMain.handle('tts:generate', async (event, request) => {
            return await this.generate(request, event);
        });
        electron_1.ipcMain.handle('tts:getSettings', () => {
            return {
                elevenLabsKey: store.get('elevenLabsKey', ''),
                piperPath: store.get('piperPath', ''),
            };
        });
        electron_1.ipcMain.handle('tts:updateSettings', (event, settings) => {
            if (settings.elevenLabsKey !== undefined)
                store.set('elevenLabsKey', settings.elevenLabsKey);
            if (settings.piperPath !== undefined)
                store.set('piperPath', settings.piperPath);
            return true;
        });
        electron_1.ipcMain.handle('tts:getVoices', async (event, provider) => {
            if (provider === 'elevenlabs-cloud') {
                return await this.getElevenLabsVoices();
            }
            else {
                return await this.getLocalVoices();
            }
        });
        electron_1.ipcMain.handle('tts:testConnection', async () => {
            return await this.testElevenLabsConnection();
        });
        electron_1.ipcMain.handle('tts:downloadPiper', async (event, voiceId) => {
            return await this.downloadPiperWithProgress(event, voiceId);
        });
    }
    // ─── Engine Download ──────────────────────────────
    /**
     * Auto-download piper-tts engine.
     * macOS/Linux: Uses `pipx install piper-tts` which bundles all C++ libs
     *              statically inside the Python wheel. This avoids the broken
     *              official GitHub release that ships without .dylib files.
     * Windows:     Uses the GitHub binary release (which works on Windows).
     */
    static async downloadPiperWithProgress(event, voiceId) {
        const platform = process.platform;
        const destDir = path.join(electron_1.app.getPath('userData'), 'piper');
        try {
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            if (platform === 'win32') {
                await this.downloadPiperBinary(event, destDir, voiceId);
            }
            else {
                await this.downloadPiperViaVenv(event, destDir, voiceId);
            }
            return { success: true };
        }
        catch (error) {
            console.error('[TTS Service] Auto-download failed', error);
            throw new Error(`Failed to download Voice Engine: ${error.message}`);
        }
    }
    /**
     * macOS / Linux: install piper via a self-contained Python venv.
     * Only requires `python3` which ships with macOS (Xcode Command Line Tools).
     * No Homebrew, no pipx, no system-level installs needed.
     */
    static async downloadPiperViaVenv(event, destDir, voiceId = 'en_US-lessac-medium.onnx') {
        const venvDir = path.join(electron_1.app.getPath('userData'), 'piper-venv');
        const isWin = process.platform === 'win32';
        const pipBin = isWin ? path.join(venvDir, 'Scripts', 'pip.exe') : path.join(venvDir, 'bin', 'pip');
        const piperBin = isWin ? path.join(venvDir, 'Scripts', 'piper.exe') : path.join(venvDir, 'bin', 'piper');
        try {
            // Step 1 – Create venv
            event.sender.send('tts:downloadProgress', { status: '[1/3] Setting up environment...', progress: 5 });
            console.log(`[TTS] Creating venv at ${venvDir}`);
            if (!fs.existsSync(venvDir)) {
                await this.runShell(`python3 -m venv "${venvDir}"`);
            }
            // Step 2 – Install piper-tts + pathvalidate
            event.sender.send('tts:downloadProgress', { status: '[2/3] Installing Prism Voice Engine...', progress: 15 });
            console.log(`[TTS] Installing piper-tts into venv`);
            await this.runShell(`"${pipBin}" install piper-tts pathvalidate`);
            // Verify installation
            if (!fs.existsSync(piperBin)) {
                throw new Error('piper-tts installed but the piper binary was not found in the venv.');
            }
            console.log(`[TTS] ✔ Piper binary found at: ${piperBin}`);
            // Step 3 – Download the voice model (with retries for flaky networks)
            const targetVoice = voiceId || 'en_US-lessac-medium.onnx';
            event.sender.send('tts:downloadProgress', { status: `[3/3] Downloading Voice (${targetVoice})...`, progress: 55 });
            // Parse voice ID to build HuggingFace URL
            // Format: lang_Region-name-quality.onnx
            const match = targetVoice.match(/^([a-z]{2})_([A-Z]{2})-([a-z\_]+)-([a-z]+)\.onnx$/);
            if (!match)
                throw new Error(`Invalid voice ID format: ${targetVoice}`);
            const [, lang, langRegion, name, quality] = match;
            const baseUrl = `https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/${lang}/${lang}_${langRegion}/${name}/${quality}`;
            const modelUrl = `${baseUrl}/${targetVoice}`;
            const configUrl = `${baseUrl}/${targetVoice}.json`;
            const downloadWithRetry = async (url, dest, onProgress, retries = 3) => {
                for (let attempt = 1; attempt <= retries; attempt++) {
                    try {
                        if (fs.existsSync(dest))
                            fs.unlinkSync(dest);
                        console.log(`[TTS] Downloading ${path.basename(dest)} (attempt ${attempt}/${retries})`);
                        await this.downloadFile(url, dest, onProgress);
                        if (!fs.existsSync(dest)) {
                            throw new Error(`File not created: ${path.basename(dest)}`);
                        }
                        const size = fs.statSync(dest).size;
                        if (size < 100) {
                            throw new Error(`File too small (${size} bytes), likely corrupt: ${path.basename(dest)}`);
                        }
                        console.log(`[TTS] ✔ Downloaded ${path.basename(dest)} (${(size / 1024 / 1024).toFixed(1)}MB)`);
                        return;
                    }
                    catch (err) {
                        console.error(`[TTS] Download attempt ${attempt} failed: ${err.message}`);
                        if (fs.existsSync(dest))
                            fs.unlinkSync(dest);
                        if (attempt === retries)
                            throw err;
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            };
            const modelDest = path.join(destDir, targetVoice);
            const configDest = path.join(destDir, `${targetVoice}.json`);
            await downloadWithRetry(modelUrl, modelDest, (p) => {
                event.sender.send('tts:downloadProgress', { status: `[3/3] Downloading Voice (${targetVoice})...`, progress: 55 + (p * 0.40) });
            });
            event.sender.send('tts:downloadProgress', { status: '[3/3] Finalizing...', progress: 96 });
            await downloadWithRetry(configUrl, configDest, () => { });
            // Save the verified binary path
            store.set('piperPath', piperBin);
            event.sender.send('tts:downloadProgress', { status: 'Prism Engine Ready', progress: 100 });
            console.log(`[TTS] ✔ Download complete. piperPath=${piperBin}`);
        }
        catch (error) {
            // ─── FULL CLEANUP on any failure ───
            // Nuke everything so the next attempt starts completely fresh.
            console.error(`[TTS] ✘ Download failed, cleaning up ALL artifacts...`);
            // Remove venv
            try {
                fs.rmSync(venvDir, { recursive: true, force: true });
            }
            catch { }
            // Remove voice model files
            try {
                const files = fs.readdirSync(destDir);
                for (const f of files) {
                    fs.unlinkSync(path.join(destDir, f));
                }
            }
            catch { }
            // Clear stored path
            store.delete('piperPath');
            console.log(`[TTS] Cleanup done. Next attempt will start fresh.`);
            throw error; // Re-throw so the caller sees the failure
        }
    }
    /**
     * Windows-only: download the official GitHub release binary.
     */
    static async downloadPiperBinary(event, destDir, voiceId) {
        const binaryUrl = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip';
        event.sender.send('tts:downloadProgress', { status: '[1/3] Downloading Voice Engine...', progress: 0 });
        const archivePath = path.join(destDir, 'piper_archive');
        await this.downloadFile(binaryUrl, archivePath, (p) => {
            event.sender.send('tts:downloadProgress', { status: '[1/3] Downloading Voice Engine...', progress: p * 0.5 });
        });
        event.sender.send('tts:downloadProgress', { status: '[2/3] Extracting Voice Engine...', progress: 50 });
        const zip = new adm_zip_1.default(archivePath);
        zip.extractAllTo(destDir, true);
        fs.unlinkSync(archivePath);
        const piperBin = path.join(destDir, 'piper.exe');
        const targetVoice = voiceId || 'en_US-lessac-medium.onnx';
        event.sender.send('tts:downloadProgress', { status: `[3/3] Downloading Voice (${targetVoice})...`, progress: 60 });
        const match = targetVoice.match(/^([a-z]{2})_([A-Z]{2})-([a-z\_]+)-([a-z]+)\.onnx$/);
        if (!match)
            throw new Error(`Invalid voice ID format: ${targetVoice}`);
        const [, lang, langRegion, name, quality] = match;
        const baseUrl = `https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/${lang}/${lang}_${langRegion}/${name}/${quality}`;
        const modelUrl = `${baseUrl}/${targetVoice}`;
        const configUrl = `${baseUrl}/${targetVoice}.json`;
        await this.downloadFile(modelUrl, path.join(destDir, targetVoice), (p) => {
            event.sender.send('tts:downloadProgress', { status: `[3/3] Downloading Voice (${targetVoice})...`, progress: 60 + (p * 0.35) });
        });
        event.sender.send('tts:downloadProgress', { status: '[3/3] Finalizing...', progress: 96 });
        await this.downloadFile(configUrl, path.join(destDir, `${targetVoice}.json`), () => { });
        store.set('piperPath', piperBin);
        event.sender.send('tts:downloadProgress', { status: 'Prism Engine Ready', progress: 100 });
    }
    // ─── Utility Helpers ──────────────────────────────
    /** Check if current hardware is Apple Silicon (even under Rosetta). */
    static isAppleSilicon() {
        try {
            const translated = (0, child_process_1.execSync)('sysctl -in sysctl.proc_translated').toString().trim();
            if (translated === '1')
                return true;
            const hwArm64 = (0, child_process_1.execSync)('sysctl -in hw.optional.arm64').toString().trim();
            return hwArm64 === '1';
        }
        catch {
            return false;
        }
    }
    /** Find a binary by name using `which`. Returns null if not found. */
    static async findBinary(name) {
        return new Promise((resolve) => {
            (0, child_process_1.exec)(`which ${name}`, (err, stdout) => {
                if (err || !stdout.trim()) {
                    resolve(null);
                }
                else {
                    resolve(stdout.trim());
                }
            });
        });
    }
    /** Run a shell command and resolve on completion. */
    static runShell(cmd) {
        return new Promise((resolve, reject) => {
            (0, child_process_1.exec)(cmd, { timeout: 300000 }, (err, stdout, stderr) => {
                if (err) {
                    console.error(`[TTS Service] Shell failed: ${cmd}`, stderr);
                    reject(err);
                }
                else {
                    resolve(stdout);
                }
            });
        });
    }
    /** Search for the piper binary across common install locations. */
    static async findPiperBinary() {
        const home = process.env.HOME || '~';
        const venvBin = path.join(electron_1.app.getPath('userData'), 'piper-venv', 'bin', 'piper');
        const candidates = [
            venvBin, // Our self-contained venv (primary)
            path.join(home, '.local/bin/piper'), // pipx legacy
            '/opt/homebrew/bin/piper',
            '/usr/local/bin/piper',
        ];
        for (const c of candidates) {
            if (fs.existsSync(c))
                return c;
        }
        return await this.findBinary('piper');
    }
    /** Validate that a piper binary can actually start (catches missing dylibs). */
    static validateBinary(binaryPath) {
        return new Promise((resolve) => {
            const proc = (0, child_process_1.spawn)(binaryPath, ['--help']);
            const timer = setTimeout(() => {
                proc.kill();
                resolve(true); // If it hasn't crashed in 3s, it's probably fine
            }, 3000);
            proc.on('error', () => {
                clearTimeout(timer);
                resolve(false);
            });
            proc.on('close', (code) => {
                clearTimeout(timer);
                // code 0 = success, code null = killed by signal (dyld crash)
                resolve(code === 0);
            });
        });
    }
    /** HTTP file downloader with redirect support (301/302/307/308 + relative URLs). */
    static downloadFile(url, dest, onProgress) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            https.get(url, (response) => {
                if ([301, 302, 307, 308].includes(response.statusCode || 0)) {
                    let redirectUrl = response.headers.location;
                    if (redirectUrl.startsWith('/')) {
                        const urlObj = new URL(url);
                        redirectUrl = `${urlObj.protocol}//${urlObj.host}${redirectUrl}`;
                    }
                    file.close();
                    return this.downloadFile(redirectUrl, dest, onProgress).then(resolve).catch(reject);
                }
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                    return;
                }
                const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
                let receivedBytes = 0;
                response.on('data', (chunk) => {
                    receivedBytes += chunk.length;
                    if (totalBytes > 0) {
                        onProgress((receivedBytes / totalBytes) * 100);
                    }
                });
                response.pipe(file);
                file.on('finish', () => {
                    file.close(() => resolve());
                });
                file.on('error', (err) => reject(err));
            }).on('error', (err) => reject(err));
        });
    }
    // ─── Generation ──────────────────────────────────
    static async generate(request, event) {
        const { text, voiceId, provider } = request;
        console.log(`[TTS] ▶ generate() called | provider=${provider} | voiceId=${voiceId} | text="${text.substring(0, 50)}..."`);
        const outputPath = path.join(this.tempDir, `tts_${Date.now()}.wav`);
        console.log(`[TTS]   outputPath=${outputPath}`);
        if (provider === 'elevenlabs-cloud') {
            return await this.generateElevenLabs(text, voiceId, outputPath);
        }
        else {
            return await this.generatePiper(text, voiceId, outputPath, event);
        }
    }
    /**
     * Local Piper TTS Generation with heavy logging and timeout.
     */
    static async generatePiper(text, voiceId, outputPath, event) {
        console.log(`[TTS] ── generatePiper START ──`);
        console.log(`[TTS]   voiceId="${voiceId}"`);
        console.log(`[TTS]   outputPath="${outputPath}"`);
        // ── Step 1: Find piper binary ──
        // Priority: pipx binary > store value > auto-downloaded > bundled
        // We check pipx FIRST because the store may contain a stale path to a broken binary.
        let piperBin = '';
        // 1a. Try pipx-installed path first (macOS/Linux) — this is the most reliable
        const pipxBin = await this.findPiperBinary();
        console.log(`[TTS]   [1a] findPiperBinary (pipx)="${pipxBin}" exists=${pipxBin ? fs.existsSync(pipxBin) : false}`);
        if (pipxBin && fs.existsSync(pipxBin)) {
            piperBin = pipxBin;
        }
        // 1b. If pipx not found, try store value but VALIDATE it's not broken
        if (!piperBin) {
            const storePath = store.get('piperPath');
            console.log(`[TTS]   [1b] Store piperPath="${storePath}" exists=${storePath ? fs.existsSync(storePath) : false}`);
            if (storePath && fs.existsSync(storePath)) {
                // Quick validation: try running --help and see if it crashes
                const isWorking = await this.validateBinary(storePath);
                console.log(`[TTS]   [1b] Store binary validation=${isWorking}`);
                if (isWorking) {
                    piperBin = storePath;
                }
                else {
                    console.log(`[TTS]   [1b] Store binary is broken, skipping`);
                }
            }
        }
        if (!piperBin || !fs.existsSync(piperBin)) {
            const autoPath = process.platform === 'win32'
                ? path.join(electron_1.app.getPath('userData'), 'piper', 'piper.exe')
                : path.join(electron_1.app.getPath('userData'), 'piper', 'piper');
            console.log(`[TTS]   [3] autoPath="${autoPath}" exists=${fs.existsSync(autoPath)}`);
            if (fs.existsSync(autoPath)) {
                piperBin = autoPath;
            }
        }
        if (!piperBin || !fs.existsSync(piperBin)) {
            const possiblePath = path.join(electron_1.app.getAppPath(), 'resources', 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
            console.log(`[TTS]   [4a] bundledPath="${possiblePath}" exists=${fs.existsSync(possiblePath)}`);
            if (fs.existsSync(possiblePath)) {
                piperBin = possiblePath;
            }
            else {
                const prodPath = path.join(process.resourcesPath, 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
                console.log(`[TTS]   [4b] prodPath="${prodPath}" exists=${fs.existsSync(prodPath)}`);
                if (fs.existsSync(prodPath)) {
                    piperBin = prodPath;
                }
            }
        }
        // ── Step 2: Check for Model ──
        let modelPath = voiceId;
        const piperDataDir = path.join(electron_1.app.getPath('userData'), 'piper');
        const localVoice = path.join(piperDataDir, path.basename(voiceId));
        let foundModel = false;
        if (fs.existsSync(localVoice)) {
            modelPath = localVoice;
            foundModel = true;
        }
        else if (piperBin) {
            const binaryDirVoice = path.join(path.dirname(piperBin), path.basename(voiceId));
            if (fs.existsSync(binaryDirVoice)) {
                modelPath = binaryDirVoice;
                foundModel = true;
            }
        }
        if (!foundModel && fs.existsSync(modelPath)) {
            foundModel = true;
        }
        // ── Step 3: Auto-Install if Engine or Model is Missing ──
        if (!piperBin || !fs.existsSync(piperBin) || !foundModel) {
            console.log(`[TTS]   ⚠ Engine (${!!piperBin}) or Model (${foundModel}) missing — auto-installing...`);
            if (event) {
                // Auto-download the engine + model, emitting progress to the UI
                await this.downloadPiperWithProgress(event, voiceId);
                // Re-search for the binary after download
                const freshBin = await this.findPiperBinary();
                const storeBin = store.get('piperPath');
                piperBin = freshBin || storeBin || '';
                if (!piperBin || !fs.existsSync(piperBin)) {
                    throw new Error('Prism Voice Engine install succeeded but the binary was not found.');
                }
                // Re-resolve model
                if (fs.existsSync(localVoice)) {
                    modelPath = localVoice;
                    foundModel = true;
                }
                if (!foundModel) {
                    throw new Error(`Voice model install succeeded but the file was not found: ${modelPath}`);
                }
                console.log(`[TTS]   ✔ After auto-install, using: "${piperBin}"`);
            }
            else {
                throw new Error("Prism Voice Engine or Voice Model is missing.");
            }
        }
        console.log(`[TTS]   ✔ Final piperBin="${piperBin}"`);
        console.log(`[TTS]   ✔ Final modelPath="${modelPath}"`);
        // ── Step 3: Spawn piper with timeout ──
        const TIMEOUT_MS = 30000; // 30 seconds max
        console.log(`[TTS]   Spawning: "${piperBin}" --model "${modelPath}" --output_file "${outputPath}"`);
        return new Promise((resolve, reject) => {
            let settled = false;
            const settle = (fn) => {
                if (!settled) {
                    settled = true;
                    fn();
                }
            };
            const piper = (0, child_process_1.spawn)(piperBin, [
                '--model', modelPath,
                '--output_file', outputPath
            ]);
            console.log(`[TTS]   Piper PID=${piper.pid}`);
            let stderrOutput = '';
            let stdoutOutput = '';
            piper.stdout.on('data', (data) => {
                const text = data.toString();
                stdoutOutput += text;
                console.log(`[TTS]   [stdout] ${text.trim()}`);
            });
            piper.stderr.on('data', (data) => {
                const text = data.toString();
                stderrOutput += text;
                console.log(`[TTS]   [stderr] ${text.trim()}`);
            });
            piper.stdin.write(text);
            piper.stdin.end();
            console.log(`[TTS]   Text written to stdin and closed.`);
            // Timeout guard
            const timer = setTimeout(() => {
                console.error(`[TTS]   ✘ TIMEOUT after ${TIMEOUT_MS}ms! Killing piper PID=${piper.pid}`);
                console.error(`[TTS]   stderr so far: ${stderrOutput}`);
                console.error(`[TTS]   stdout so far: ${stdoutOutput}`);
                piper.kill('SIGKILL');
                settle(() => reject(new Error(`Prism Engine timed out after ${TIMEOUT_MS / 1000}s. stderr: ${stderrOutput}`)));
            }, TIMEOUT_MS);
            piper.on('close', (code) => {
                clearTimeout(timer);
                console.log(`[TTS]   Piper exited with code=${code}`);
                if (stderrOutput)
                    console.log(`[TTS]   stderr: ${stderrOutput.trim()}`);
                if (code === 0) {
                    const exists = fs.existsSync(outputPath);
                    const size = exists ? fs.statSync(outputPath).size : 0;
                    console.log(`[TTS]   ✔ Output file exists=${exists} size=${size} bytes`);
                    settle(() => resolve(outputPath));
                }
                else {
                    console.error(`[TTS]   ✘ Piper failed with code ${code}`);
                    settle(() => reject(new Error(`Prism Engine exited with code ${code}. ${stderrOutput}`)));
                }
            });
            piper.on('error', (err) => {
                clearTimeout(timer);
                console.error(`[TTS]   ✘ Spawn error: ${err.message}`);
                settle(() => reject(err));
            });
        });
    }
    // ─── Local Voices ─────────────────────────────────
    static async getLocalVoices() {
        const voices = [
            { id: 'en_US-lessac-medium.onnx', name: 'English (US) Female - Lessac' },
            { id: 'en_US-amy-medium.onnx', name: 'English (US) Female - Amy' },
            { id: 'en_US-ryan-medium.onnx', name: 'English (US) Male - Ryan (Clear)' },
            { id: 'en_US-joe-medium.onnx', name: 'English (US) Male - Joe' },
            { id: 'en_GB-alba-medium.onnx', name: 'English (UK) Female - Alba' },
            { id: 'en_GB-alan-medium.onnx', name: 'English (UK) Male - Alan' }
        ];
        const piperDataDir = path.join(electron_1.app.getPath('userData'), 'piper');
        return voices.map(v => {
            const isDownloaded = fs.existsSync(path.join(piperDataDir, v.id));
            return {
                ...v,
                isDownloaded
            };
        });
    }
    // ─── ElevenLabs Cloud ─────────────────────────────
    static async getElevenLabsVoices() {
        const apiKey = store.get('elevenLabsKey', '');
        if (!apiKey)
            return [];
        try {
            const response = await fetch('https://api.elevenlabs.io/v2/voices', {
                headers: { 'xi-api-key': apiKey }
            });
            if (!response.ok) {
                console.error(`[ElevenLabs] Voices API returned ${response.status}`);
                return [];
            }
            const data = await response.json();
            const voices = data.voices || [];
            return voices.map((v) => ({ id: v.voice_id, name: v.name }));
        }
        catch (err) {
            console.error('[ElevenLabs] Failed to fetch voices:', err);
            return [];
        }
    }
    static async testElevenLabsConnection() {
        const apiKey = store.get('elevenLabsKey', '');
        if (!apiKey)
            throw new Error('No API Key set');
        const response = await fetch('https://api.elevenlabs.io/v1/user/subscription', {
            headers: { 'xi-api-key': apiKey }
        });
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`ElevenLabs API Error (${response.status}): ${errText}`);
        }
        const data = await response.json();
        return { user: data };
    }
    static async generateElevenLabs(text, voiceId, outputPath) {
        const apiKey = store.get('elevenLabsKey', '');
        if (!apiKey)
            throw new Error('No ElevenLabs API key set. Go to Settings to configure.');
        if (!voiceId)
            throw new Error('No voice selected. Please select a voice before generating.');
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
                text,
                model_id: "eleven_turbo_v2_5",
                voice_settings: {
                    stability: 0.5,
                    similarity_boost: 0.5,
                }
            })
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`ElevenLabs API Error: ${err}`);
        }
        const buffer = await response.arrayBuffer();
        await fs.promises.writeFile(outputPath, new Uint8Array(buffer));
        return outputPath;
    }
}
exports.TtsService = TtsService;
TtsService.tempDir = path.join(electron_1.app.getPath('userData'), 'tts-temp');
