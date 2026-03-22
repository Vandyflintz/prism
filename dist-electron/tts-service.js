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
        // Fallback to project root assets/piper if not set
        if (!piperBin) {
            const possiblePath = path.join(electron_1.app.getAppPath(), 'resources', 'piper', 'piper');
            if (fs.existsSync(possiblePath)) {
                piperBin = possiblePath;
            }
            else {
                // Try production path
                const prodPath = path.join(process.resourcesPath, 'piper', 'piper');
                if (fs.existsSync(prodPath)) {
                    piperBin = prodPath;
                }
            }
        }
        if (!piperBin || !fs.existsSync(piperBin)) {
            throw new Error("Piper binary not found. Please configure it in TTS settings.");
        }
        // Voice model path should be in the same directory as piper usually, or specified
        // For simplicity, we assume voiceId is the path to the .onnx file
        const modelPath = voiceId;
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
