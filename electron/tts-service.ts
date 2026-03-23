import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, exec } from 'child_process';
import Store from 'electron-store';
import * as https from 'https';
import AdmZip from 'adm-zip';

const store = new Store();

// Types for IPC
interface TtsRequest {
    text: string;
    voiceId: string;
    provider: 'piper-local' | 'elevenlabs-cloud';
}

interface TtsChunk {
    text: string;
    speed: number;
    pitch: number;
    pauseAfter: number; // in seconds
    emphasis: string;
}

/**
 * TTS Service for Project Prism
 * Handles Piper (Local) and ElevenLabs (Cloud)
 */
export class TtsService {
    private static tempDir = path.join(app.getPath('userData'), 'tts-temp');

    static init() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }

        // Register Handlers
        ipcMain.handle('tts:generate', async (event, request: TtsRequest) => {
            return await this.generate(request, event);
        });

        ipcMain.handle('tts:getSettings', () => {
            return {
                elevenLabsKey: (store as any).get('elevenLabsKey', ''),
                piperPath: (store as any).get('piperPath', ''),
            };
        });

        ipcMain.handle('tts:updateSettings', (event, settings: { elevenLabsKey?: string, piperPath?: string }) => {
            if (settings.elevenLabsKey !== undefined) (store as any).set('elevenLabsKey', settings.elevenLabsKey);
            if (settings.piperPath !== undefined) (store as any).set('piperPath', settings.piperPath);
            return true;
        });

        ipcMain.handle('tts:getVoices', async (event, provider: 'piper-local' | 'elevenlabs-cloud') => {
            if (provider === 'elevenlabs-cloud') {
                return await this.getElevenLabsVoices();
            } else {
                return await this.getLocalVoices();
            }
        });

        ipcMain.handle('tts:testConnection', async () => {
            return await this.testElevenLabsConnection();
        });

        ipcMain.handle('tts:downloadPiper', async (event, voiceId?: string) => {
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
    private static async downloadPiperWithProgress(event: any, voiceId?: string) {
        const platform = process.platform;
        const destDir = path.join(app.getPath('userData'), 'piper');

        try {
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            if (platform === 'win32') {
                await this.downloadPiperBinary(event, destDir, voiceId);
            } else {
                await this.downloadPiperViaVenv(event, destDir, voiceId);
            }

            return { success: true };
        } catch (error: any) {
            console.error('[TTS Service] Auto-download failed', error);
            throw new Error(`Failed to download Voice Engine: ${error.message}`);
        }
    }

    /**
     * macOS / Linux: install piper via a self-contained Python venv.
     * Only requires `python3` which ships with macOS (Xcode Command Line Tools).
     * No Homebrew, no pipx, no system-level installs needed.
     */
    private static async downloadPiperViaVenv(event: any, destDir: string, voiceId: string = 'en_US-lessac-medium.onnx') {
        const venvDir = path.join(app.getPath('userData'), 'piper-venv');
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
            if (!match) throw new Error(`Invalid voice ID format: ${targetVoice}`);
            const [, lang, langRegion, name, quality] = match;
            const baseUrl = `https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/${lang}/${lang}_${langRegion}/${name}/${quality}`;
            
            const modelUrl = `${baseUrl}/${targetVoice}`;
            const configUrl = `${baseUrl}/${targetVoice}.json`;

            const downloadWithRetry = async (url: string, dest: string, onProgress: (p: number) => void, retries = 3) => {
                for (let attempt = 1; attempt <= retries; attempt++) {
                    try {
                        if (fs.existsSync(dest)) fs.unlinkSync(dest);
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
                    } catch (err: any) {
                        console.error(`[TTS] Download attempt ${attempt} failed: ${err.message}`);
                        if (fs.existsSync(dest)) fs.unlinkSync(dest);
                        if (attempt === retries) throw err;
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
            await downloadWithRetry(configUrl, configDest, () => {});

            // Save the verified binary path
            (store as any).set('piperPath', piperBin);

            event.sender.send('tts:downloadProgress', { status: 'Prism Engine Ready', progress: 100 });
            console.log(`[TTS] ✔ Download complete. piperPath=${piperBin}`);

        } catch (error: any) {
            // ─── FULL CLEANUP on any failure ───
            // Nuke everything so the next attempt starts completely fresh.
            console.error(`[TTS] ✘ Download failed, cleaning up ALL artifacts...`);

            // Remove venv
            try { fs.rmSync(venvDir, { recursive: true, force: true }); } catch {}
            // Remove voice model files
            try {
                const files = fs.readdirSync(destDir);
                for (const f of files) {
                    fs.unlinkSync(path.join(destDir, f));
                }
            } catch {}
            // Clear stored path
            (store as any).delete('piperPath');

            console.log(`[TTS] Cleanup done. Next attempt will start fresh.`);
            throw error; // Re-throw so the caller sees the failure
        }
    }

    /**
     * Windows-only: download the official GitHub release binary.
     */
    private static async downloadPiperBinary(event: any, destDir: string, voiceId?: string) {
        const binaryUrl = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip';

        event.sender.send('tts:downloadProgress', { status: '[1/3] Downloading Voice Engine...', progress: 0 });
        const archivePath = path.join(destDir, 'piper_archive');
        await this.downloadFile(binaryUrl, archivePath, (p) => {
            event.sender.send('tts:downloadProgress', { status: '[1/3] Downloading Voice Engine...', progress: p * 0.5 });
        });

        event.sender.send('tts:downloadProgress', { status: '[2/3] Extracting Voice Engine...', progress: 50 });
        const zip = new AdmZip(archivePath);
        zip.extractAllTo(destDir, true);
        fs.unlinkSync(archivePath);

        const piperBin = path.join(destDir, 'piper.exe');

        const targetVoice = voiceId || 'en_US-lessac-medium.onnx';
        event.sender.send('tts:downloadProgress', { status: `[3/3] Downloading Voice (${targetVoice})...`, progress: 60 });

        const match = targetVoice.match(/^([a-z]{2})_([A-Z]{2})-([a-z\_]+)-([a-z]+)\.onnx$/);
        if (!match) throw new Error(`Invalid voice ID format: ${targetVoice}`);
        const [, lang, langRegion, name, quality] = match;
        const baseUrl = `https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/${lang}/${lang}_${langRegion}/${name}/${quality}`;
        
        const modelUrl = `${baseUrl}/${targetVoice}`;
        const configUrl = `${baseUrl}/${targetVoice}.json`;

        await this.downloadFile(modelUrl, path.join(destDir, targetVoice), (p) => {
            event.sender.send('tts:downloadProgress', { status: `[3/3] Downloading Voice (${targetVoice})...`, progress: 60 + (p * 0.35) });
        });

        event.sender.send('tts:downloadProgress', { status: '[3/3] Finalizing...', progress: 96 });
        await this.downloadFile(configUrl, path.join(destDir, `${targetVoice}.json`), () => {});

        (store as any).set('piperPath', piperBin);
        event.sender.send('tts:downloadProgress', { status: 'Prism Engine Ready', progress: 100 });
    }

    // ─── Utility Helpers ──────────────────────────────

    // ─── Utility Helpers ──────────────────────────────

    /** Find a binary by name using `which`. Returns null if not found. */
    private static async findBinary(name: string): Promise<string | null> {
        return new Promise((resolve) => {
            exec(`which ${name}`, (err: Error | null, stdout: string) => {
                if (err || !stdout.trim()) {
                    resolve(null);
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    }

    /** Run a shell command and resolve on completion. */
    private static runShell(cmd: string): Promise<string> {
        return new Promise((resolve, reject) => {
            exec(cmd, { timeout: 300000 }, (err: Error | null, stdout: string, stderr: string) => {
                if (err) {
                    console.error(`[TTS Service] Shell failed: ${cmd}`, stderr);
                    reject(err);
                } else {
                    resolve(stdout);
                }
            });
        });
    }

    /** Search for the piper binary across common install locations. */
    private static async findPiperBinary(): Promise<string | null> {
        const home = process.env.HOME || '~';
        const venvBin = path.join(app.getPath('userData'), 'piper-venv', 'bin', 'piper');
        const candidates = [
            venvBin,  // Our self-contained venv (primary)
            path.join(home, '.local/bin/piper'),  // pipx legacy
            '/opt/homebrew/bin/piper',
            '/usr/local/bin/piper',
        ];
        for (const c of candidates) {
            if (fs.existsSync(c)) return c;
        }
        return await this.findBinary('piper');
    }

    /** Validate that a piper binary can actually start (catches missing dylibs). */
    private static validateBinary(binaryPath: string): Promise<boolean> {
        return new Promise((resolve) => {
            const proc = spawn(binaryPath, ['--help']);
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
    private static downloadFile(url: string, dest: string, onProgress: (progress: number) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            https.get(url, (response) => {
                if ([301, 302, 307, 308].includes(response.statusCode || 0)) {
                    let redirectUrl = response.headers.location!;
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

                response.on('data', (chunk: Buffer) => {
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

    private static parseProsodyChunks(input: string): TtsChunk[] {
        const regex = /(\[speed:[\d.]+\]|\[\/speed\]|\[pitch:[\-\d]+\]|\[\/pitch\]|\[emphasis:[a-z]+\]|\[\/emphasis\]|\[pause:(?:short|medium|long)\])/g;
        const tokens = input.split(regex);
        
        const chunks: TtsChunk[] = [];
        let currentSpeed = 1.0;
        let currentPitch = 0;
        let currentEmphasis = 'moderate';
        let currentText = '';
        
        for (const token of tokens) {
            if (!token) continue;
            
            if (token.startsWith('[')) {
                // If there's pending text, flush it to a chunk FIRST before changing state
                if (currentText.trim()) {
                    chunks.push({ text: currentText.trim(), speed: currentSpeed, pitch: currentPitch, emphasis: currentEmphasis, pauseAfter: 0 });
                    currentText = '';
                }
                
                if (token.startsWith('[speed:')) {
                    const val = token.match(/\[speed:([\d.]+)\]/)?.[1];
                    if (val) currentSpeed = parseFloat(val);
                } else if (token === '[/speed]') {
                    currentSpeed = 1.0;
                } else if (token.startsWith('[pitch:')) {
                    const val = token.match(/\[pitch:([\-\d]+)\]/)?.[1];
                    if (val) currentPitch = parseInt(val, 10);
                } else if (token === '[/pitch]') {
                    currentPitch = 0;
                } else if (token.startsWith('[pause:')) {
                    const val = token.match(/\[pause:(short|medium|long)\]/)?.[1];
                    const pauseTime = val === 'short' ? 0.5 : val === 'medium' ? 1.0 : 2.0;
                    
                    // If the literal previous chunk was just pushed, we can append a pause to it
                    if (chunks.length > 0) {
                        chunks[chunks.length - 1].pauseAfter += pauseTime;
                    } else {
                        chunks.push({ text: '', speed: currentSpeed, pitch: currentPitch, emphasis: currentEmphasis, pauseAfter: pauseTime });
                    }
                } else if (token.startsWith('[emphasis:')) {
                    const val = token.match(/\[emphasis:([a-z]+)\]/)?.[1];
                    if (val) currentEmphasis = val;
                } else if (token === '[/emphasis]') {
                    currentEmphasis = 'moderate';
                }
            } else {
                currentText += token;
            }
        }
        
        if (currentText.trim()) {
            chunks.push({ text: currentText.trim(), speed: currentSpeed, pitch: currentPitch, emphasis: currentEmphasis, pauseAfter: 0 });
        }
        
        return chunks;
    }

    private static concatWavsAndSilences(items: { file?: string, silenceS?: number }[], outputPath: string) {
        let finalFormatHeader: Buffer | null = null;
        const dataBuffers: Buffer[] = [];
        let sampleRate = 22050; // Piper default
        let blockAlign = 2; // Piper default 16-bit mono
        
        for (const item of items) {
            if (item.file) {
                if (!fs.existsSync(item.file)) continue;
                const buf = fs.readFileSync(item.file);
                if (buf.toString('ascii', 0, 4) !== 'RIFF') continue;
                
                let offset = 12; 
                let dataChunkOffset = -1;
                let dataChunkSize = 0;
                
                while (offset < buf.length) {
                    const chunkId = buf.toString('ascii', offset, offset + 4);
                    const chunkSize = buf.readUInt32LE(offset + 4);
                    
                    if (chunkId === 'fmt ') {
                        if (!finalFormatHeader) {
                            sampleRate = buf.readUInt32LE(offset + 12);
                            blockAlign = buf.readUInt16LE(offset + 20);
                        }
                    } else if (chunkId === 'data') {
                        dataChunkOffset = offset + 8;
                        dataChunkSize = chunkSize;
                        break;
                    }
                    offset += 8 + chunkSize;
                }
                
                if (dataChunkOffset !== -1) {
                    if (!finalFormatHeader) {
                        finalFormatHeader = buf.subarray(0, dataChunkOffset - 8); 
                    }
                    dataBuffers.push(buf.subarray(dataChunkOffset, dataChunkOffset + dataChunkSize));
                }
            } else if (item.silenceS && item.silenceS > 0) {
                const numSamples = Math.floor(item.silenceS * sampleRate);
                const silenceBytes = numSamples * blockAlign;
                dataBuffers.push(Buffer.alloc(silenceBytes)); // Buffer.alloc fills with 0 (silence PCM)
            }
        }
        
        if (dataBuffers.length === 0 || !finalFormatHeader) {
            throw new Error("No valid WAV data to concatenate");
        }
        
        const totalDataLength = dataBuffers.reduce((acc, b) => acc + b.length, 0);
        const totalFileSize = finalFormatHeader.length + 8 + totalDataLength;
        const outHeader = Buffer.alloc(finalFormatHeader.length + 8);
        (finalFormatHeader as any).copy(outHeader, 0);
        
        outHeader.writeUInt32LE(totalFileSize - 8, 4); // RIFF Size
        outHeader.write('data', finalFormatHeader.length); // Data Header
        outHeader.writeUInt32LE(totalDataLength, finalFormatHeader.length + 4); // Data Size
        
        const finalArray: any[] = [outHeader, ...dataBuffers];
        fs.writeFileSync(outputPath, (Buffer.concat(finalArray) as any));
    }

    private static async generate(request: TtsRequest, event: any): Promise<string> {
        const { text, voiceId, provider } = request;
        console.log(`[TTS] ▶ generate() called | provider=${provider} | voiceId=${voiceId} | text="${text.substring(0, 50)}..."`);
        const outputPath = path.join(this.tempDir, `tts_${Date.now()}.wav`);
        
        const chunks = this.parseProsodyChunks(text);

        if (provider === 'elevenlabs-cloud') {
            // For ElevenLabs, compile all chunks back into a single SSML string to save API costs
            let ssml = chunks.map(c => {
                let part = c.text;
                if (c.pauseAfter > 0) part += ` <break time="${c.pauseAfter}s"/>`;
                return part;
            }).join(' ');
            if (ssml.includes('<break')) ssml = `<speak>${ssml}</speak>`;
            
            return await this.generateElevenLabs(ssml, voiceId, outputPath);
        } else {
            // For Piper, generate each chunk specifically and then precisely stitch them mathematically
            return await this.generatePiper(chunks, voiceId, outputPath, event);
        }
    }

    /**
     * Local Piper TTS Generation with heavy logging and chunk management.
     */
    private static async generatePiper(chunks: TtsChunk[], voiceId: string, outputPath: string, event?: any): Promise<string> {
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
            const storePath = (store as any).get('piperPath') as string;
            console.log(`[TTS]   [1b] Store piperPath="${storePath}" exists=${storePath ? fs.existsSync(storePath) : false}`);
            if (storePath && fs.existsSync(storePath)) {
                // Quick validation: try running --help and see if it crashes
                const isWorking = await this.validateBinary(storePath);
                console.log(`[TTS]   [1b] Store binary validation=${isWorking}`);
                if (isWorking) {
                    piperBin = storePath;
                } else {
                    console.log(`[TTS]   [1b] Store binary is broken, skipping`);
                }
            }
        }

        if (!piperBin || !fs.existsSync(piperBin)) {
            const autoPath = process.platform === 'win32'
                ? path.join(app.getPath('userData'), 'piper', 'piper.exe')
                : path.join(app.getPath('userData'), 'piper', 'piper');
            console.log(`[TTS]   [3] autoPath="${autoPath}" exists=${fs.existsSync(autoPath)}`);
            if (fs.existsSync(autoPath)) {
                piperBin = autoPath;
            }
        }

        if (!piperBin || !fs.existsSync(piperBin)) {
            const possiblePath = path.join(app.getAppPath(), 'resources', 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
            console.log(`[TTS]   [4a] bundledPath="${possiblePath}" exists=${fs.existsSync(possiblePath)}`);
            if (fs.existsSync(possiblePath)) {
                piperBin = possiblePath;
            } else {
                const prodPath = path.join(process.resourcesPath, 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
                console.log(`[TTS]   [4b] prodPath="${prodPath}" exists=${fs.existsSync(prodPath)}`);
                if (fs.existsSync(prodPath)) {
                    piperBin = prodPath;
                }
            }
        }

        // ── Step 2: Check for Model ──
        let modelPath = voiceId;
        const piperDataDir = path.join(app.getPath('userData'), 'piper');
        const localVoice = path.join(piperDataDir, path.basename(voiceId));
        let foundModel = false;

        if (fs.existsSync(localVoice)) {
            modelPath = localVoice;
            foundModel = true;
        } else if (piperBin) {
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
                const storeBin = (store as any).get('piperPath') as string;
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
            } else {
                throw new Error("Prism Voice Engine or Voice Model is missing.");
            }
        }

        console.log(`[TTS]   ✔ Final piperBin="${piperBin}"`);
        console.log(`[TTS]   ✔ Final modelPath="${modelPath}"`);

        const tempFiles: { file?: string, silenceS?: number }[] = [];
        
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            
            if (chunk.text.trim()) {
                const chunkPath = path.join(this.tempDir, `tts_chunk_${Date.now()}_${i}.wav`);
                await this.runPiperProcess(piperBin, modelPath, chunk.text, chunkPath, chunk.speed);
                tempFiles.push({ file: chunkPath });
            }
            if (chunk.pauseAfter > 0) {
                tempFiles.push({ silenceS: chunk.pauseAfter });
            }
        }
        
        this.concatWavsAndSilences(tempFiles, outputPath);
        
        for (const t of tempFiles) {
            if (t.file && fs.existsSync(t.file)) {
                fs.unlinkSync(t.file);
            }
        }
        
        return outputPath;
    }

    private static runPiperProcess(piperBin: string, modelPath: string, text: string, outputPath: string, speed: number): Promise<void> {
        const TIMEOUT_MS = 30000;
        return new Promise((resolve, reject) => {
            let settled = false;
            const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };
            
            const lengthScale = Number((1.0 / Math.max(0.1, speed)).toFixed(3)); // --length_scale (smaller is faster in piper)
            
            const piperArgs = [
                '--model', modelPath,
                '--output_file', outputPath,
                '--length_scale', lengthScale.toString(),
                '--noise_scale', '0.667',
                '--noise_w', '0.8'
            ];
            
            const piper = spawn(piperBin, piperArgs);
            
            let stderrOutput = '';
            piper.stderr.on('data', (data: Buffer) => { stderrOutput += data.toString(); });
            
            piper.stdin.write(text);
            piper.stdin.end();
            
            const timer = setTimeout(() => {
                piper.kill('SIGKILL');
                settle(() => reject(new Error(`Prism Engine timed out. stderr: ${stderrOutput}`)));
            }, TIMEOUT_MS);
            
            piper.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0 && fs.existsSync(outputPath)) {
                    settle(() => resolve());
                } else {
                    settle(() => reject(new Error(`Piper failed with code ${code}. err: ${stderrOutput}`)));
                }
            });
            
            piper.on('error', (err) => {
                clearTimeout(timer);
                settle(() => reject(err));
            });
        });
    }

    // ─── Local Voices ─────────────────────────────────

    private static cachedLocalVoices: any[] | null = null;

    private static async getLocalVoices() {
        const piperDataDir = path.join(app.getPath('userData'), 'piper');

        if (!this.cachedLocalVoices) {
            try {
                const response = await fetch('https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/voices.json');
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const data: any = await response.json();
                
                const voices = [];
                for (const key in data) {
                    const v = data[key];
                    // We filter for English voices to keep the UI clean
                    if (v.language && v.language.family === 'en') {
                        const region = v.language.region || 'Unknown';
                        const quality = v.quality || 'unknown';
                        const name = v.name || key;
                        
                        // e.g., "English (US) - Ryan (medium)"
                        const displayName = `English (${region}) - ${name.charAt(0).toUpperCase() + name.slice(1)} (${quality})`;
                        
                        voices.push({
                            id: `${key}.onnx`,
                            name: displayName
                        });
                    }
                }
                
                // Sort by name (grouping regions together)
                voices.sort((a, b) => a.name.localeCompare(b.name));
                this.cachedLocalVoices = voices;
                console.log(`[TTS] Loaded ${voices.length} local voices from official manifest.`);
            } catch (err) {
                console.error('[TTS] Failed to fetch Piper voices manifest, falling back to local defaults', err);
                // Fallback hardcoded list if offline or HF is down
                this.cachedLocalVoices = [
                    { id: 'en_US-lessac-medium.onnx', name: 'English (US) Female - Lessac (medium)' },
                    { id: 'en_US-amy-medium.onnx', name: 'English (US) Female - Amy (medium)' },
                    { id: 'en_US-ryan-medium.onnx', name: 'English (US) Male - Ryan (medium)' },
                    { id: 'en_US-joe-medium.onnx', name: 'English (US) Male - Joe (medium)' },
                    { id: 'en_GB-alba-medium.onnx', name: 'English (UK) Female - Alba (medium)' },
                    { id: 'en_GB-alan-medium.onnx', name: 'English (UK) Male - Alan (medium)' }
                ];
            }
        }

        return this.cachedLocalVoices.map(v => {
            const isDownloaded = fs.existsSync(path.join(piperDataDir, v.id));
            return {
                ...v,
                isDownloaded
            };
        });
    }

    // ─── ElevenLabs Cloud ─────────────────────────────

    private static async getElevenLabsVoices(): Promise<{ id: string, name: string }[]> {
        const apiKey = (store as any).get('elevenLabsKey', '');
        if (!apiKey) return [];

        try {
            const response = await fetch('https://api.elevenlabs.io/v2/voices', {
                headers: { 'xi-api-key': apiKey }
            });

            if (!response.ok) {
                console.error(`[ElevenLabs] Voices API returned ${response.status}`);
                return [];
            }

            const data: any = await response.json();
            const voices = data.voices || [];
            return voices.map((v: any) => ({ id: v.voice_id, name: v.name }));
        } catch (err) {
            console.error('[ElevenLabs] Failed to fetch voices:', err);
            return [];
        }
    }

    private static async testElevenLabsConnection(): Promise<any> {
        const apiKey = (store as any).get('elevenLabsKey', '');
        if (!apiKey) throw new Error('No API Key set');

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

    private static async generateElevenLabs(text: string, voiceId: string, outputPath: string): Promise<string> {
        const apiKey = (store as any).get('elevenLabsKey', '');
        if (!apiKey) throw new Error('No ElevenLabs API key set. Go to Settings to configure.');
        if (!voiceId) throw new Error('No voice selected. Please select a voice before generating.');

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
