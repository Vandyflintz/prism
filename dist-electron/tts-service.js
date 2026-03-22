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
const tar = __importStar(require("tar"));
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
            return await this.generate(request);
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
                return [
                    { id: 'en_US-lessac-medium.onnx', name: 'English (US) - Lessac' },
                    { id: 'en_GB-southern_english_female-low.onnx', name: 'English (UK) - Female' },
                ];
            }
        });
        electron_1.ipcMain.handle('tts:testConnection', async () => {
            return await this.testElevenLabsConnection();
        });
        electron_1.ipcMain.handle('tts:downloadPiper', async (event) => {
            return await this.downloadPiperWithProgress(event);
        });
    }
    static async downloadPiperWithProgress(event) {
        const destDir = path.join(electron_1.app.getPath('userData'), 'piper');
        // Define URLs based on platform
        let binaryUrl = '';
        const platform = process.platform;
        const arch = process.arch;
        if (platform === 'darwin') {
            binaryUrl = arch === 'arm64'
                ? 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_aarch64.tar.gz'
                : 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_x64.tar.gz';
        }
        else if (platform === 'win32') {
            binaryUrl = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip';
        }
        else {
            binaryUrl = arch === 'arm64'
                ? 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_aarch64.tar.gz'
                : 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz';
        }
        const modelUrl = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx';
        const configUrl = 'https://huggingface.co/rhasspy/piper-voices/resolve/v1.0.0/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json';
        try {
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            event.sender.send('tts:downloadProgress', { status: 'Downloading Engine...', progress: 0 });
            const archivePath = path.join(destDir, 'piper_archive');
            await this.downloadFile(binaryUrl, archivePath, (p) => {
                event.sender.send('tts:downloadProgress', { status: 'Downloading Engine...', progress: p * 0.5 });
            });
            event.sender.send('tts:downloadProgress', { status: 'Extracting Engine...', progress: 50 });
            if (binaryUrl.endsWith('.zip')) {
                const zip = new adm_zip_1.default(archivePath);
                zip.extractAllTo(destDir, true);
            }
            else {
                await tar.x({
                    file: archivePath,
                    cwd: destDir,
                    strip: 1 // Piper bundles are wrapped in a 'piper' folder
                });
            }
            fs.unlinkSync(archivePath);
            // Set executable permissions on Mac/Linux
            const piperBin = platform === 'win32' ? path.join(destDir, 'piper.exe') : path.join(destDir, 'piper');
            if (platform !== 'win32' && fs.existsSync(piperBin)) {
                fs.chmodSync(piperBin, '755');
            }
            event.sender.send('tts:downloadProgress', { status: 'Downloading Default Voice...', progress: 60 });
            await this.downloadFile(modelUrl, path.join(destDir, 'en_US-lessac-medium.onnx'), (p) => {
                event.sender.send('tts:downloadProgress', { status: 'Downloading Default Voice...', progress: 60 + (p * 0.35) });
            });
            event.sender.send('tts:downloadProgress', { status: 'Downloading Config...', progress: 95 });
            await this.downloadFile(configUrl, path.join(destDir, 'en_US-lessac-medium.onnx.json'), () => { });
            // Auto-configure path in store
            store.set('piperPath', piperBin);
            event.sender.send('tts:downloadProgress', { status: 'Complete', progress: 100 });
            return { success: true, path: piperBin };
        }
        catch (error) {
            console.error('[TTS Service] Auto-download failed', error);
            throw new Error(`Failed to download Piper: ${error.message}`);
        }
    }
    static downloadFile(url, dest, onProgress) {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            https.get(url, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    return this.downloadFile(response.headers.location, dest, onProgress).then(resolve).catch(reject);
                }
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                    return;
                }
                const total = parseInt(response.headers['content-length'] || '0', 10);
                let current = 0;
                response.on('data', (chunk) => {
                    current += chunk.length;
                    if (total > 0)
                        onProgress(current / total);
                });
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => reject(err));
            });
        });
    }
    static async testElevenLabsConnection() {
        const apiKey = store.get('elevenLabsKey');
        if (!apiKey)
            throw new Error("API Key is missing.");
        const response = await fetch('https://api.elevenlabs.io/v1/user', {
            headers: { 'xi-api-key': apiKey }
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Connection failed (${response.status}): ${err}`);
        }
        const data = await response.json();
        return { success: true, user: data.subscription };
    }
    static async getElevenLabsVoices() {
        const apiKey = store.get('elevenLabsKey');
        if (!apiKey)
            return [];
        try {
            const response = await fetch('https://api.elevenlabs.io/v2/voices', {
                headers: { 'xi-api-key': apiKey }
            });
            if (!response.ok)
                return [];
            const data = await response.json();
            return data.voices.map((v) => ({
                id: v.voice_id,
                name: v.name,
                category: v.category,
                previewUrl: v.preview_url
            }));
        }
        catch (error) {
            console.error('[TTS Service] Failed to fetch ElevenLabs voices:', error);
            return [];
        }
    }
    static async generate(request) {
        const { text, voiceId, provider } = request;
        const filename = `tts-${Date.now()}.wav`;
        const outputPath = path.join(this.tempDir, filename);
        try {
            if (provider === 'elevenlabs-cloud') {
                return await this.generateElevenLabs(text, voiceId, outputPath);
            }
            else {
                return await this.generatePiper(text, voiceId, outputPath);
            }
        }
        catch (error) {
            console.error('[TTS Service] Generation failed:', error);
            throw error;
        }
    }
    static async generateElevenLabs(text, voiceId, outputPath) {
        if (!voiceId)
            throw new Error("No voice selected. Please select a voice first.");
        const apiKey = store.get('elevenLabsKey');
        if (!apiKey)
            throw new Error("ElevenLabs API Key missing in settings.");
        // Use the v1 endpoint for text-to-speech (V2 is primarily for voice discovery)
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
            method: 'POST',
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json',
                'accept': 'audio/mpeg',
            },
            body: JSON.stringify({
                text,
                model_id: "eleven_turbo_v2_5", // Using the latest high-performance model
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
    static async generatePiper(text, voiceId, outputPath) {
        // User pointed path or default resources/piper
        let piperBin = store.get('piperPath');
        // Fallback to auto-downloaded path
        if (!piperBin) {
            const autoPath = process.platform === 'win32'
                ? path.join(electron_1.app.getPath('userData'), 'piper', 'piper.exe')
                : path.join(electron_1.app.getPath('userData'), 'piper', 'piper');
            if (fs.existsSync(autoPath)) {
                piperBin = autoPath;
            }
        }
        // Fallback to project root assets/piper if not set
        if (!piperBin) {
            const possiblePath = path.join(electron_1.app.getAppPath(), 'resources', 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
            if (fs.existsSync(possiblePath)) {
                piperBin = possiblePath;
            }
            else {
                // Try production path
                const prodPath = path.join(process.resourcesPath, 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
                if (fs.existsSync(prodPath)) {
                    piperBin = prodPath;
                }
            }
        }
        if (!piperBin || !fs.existsSync(piperBin)) {
            throw new Error("Local TTS Engine (Piper) is missing. Click 'Download Local Engine' in the settings.");
        }
        // Voice model path 
        // If Piper is auto-downloaded, the default voice is in the same folder
        let modelPath = voiceId;
        if (voiceId === 'en_US-lessac-medium.onnx' && !fs.existsSync(modelPath)) {
            // Look in the same directory as the binary
            const localVoice = path.join(path.dirname(piperBin), voiceId);
            if (fs.existsSync(localVoice)) {
                modelPath = localVoice;
            }
        }
        if (!fs.existsSync(modelPath)) {
            throw new Error(`Piper voice model not found: ${modelPath}`);
        }
        return new Promise((resolve, reject) => {
            const piper = (0, child_process_1.spawn)(piperBin, [
                '--model', modelPath,
                '--output_file', outputPath
            ]);
            piper.stdin.write(text);
            piper.stdin.end();
            piper.on('close', (code) => {
                if (code === 0) {
                    resolve(outputPath);
                }
                else {
                    reject(new Error(`Piper exited with code ${code}`));
                }
            });
            piper.on('error', (err) => {
                reject(err);
            });
        });
    }
}
exports.TtsService = TtsService;
TtsService.tempDir = path.join(electron_1.app.getPath('userData'), 'tts-temp');
