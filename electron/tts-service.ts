import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import Store from 'electron-store';

const store = new Store();

// Types for IPC
interface TtsRequest {
    text: string;
    voiceId: string;
    provider: 'piper-local' | 'elevenlabs-cloud';
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
            return await this.generate(request);
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
                return [
                    { id: 'en_US-lessac-medium.onnx', name: 'English (US) - Lessac' },
                    { id: 'en_GB-southern_english_female-low.onnx', name: 'English (UK) - Female' },
                ];
            }
        });

        ipcMain.handle('tts:testConnection', async () => {
            return await this.testElevenLabsConnection();
        });
    }

    private static async testElevenLabsConnection() {
        const apiKey = (store as any).get('elevenLabsKey') as string;
        if (!apiKey) throw new Error("API Key is missing.");

        const response = await fetch('https://api.elevenlabs.io/v1/user', {
            headers: { 'xi-api-key': apiKey }
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Connection failed (${response.status}): ${err}`);
        }

        const data = await response.json();
        return { success: true, user: (data as any).subscription };
    }

    private static async getElevenLabsVoices() {
        const apiKey = (store as any).get('elevenLabsKey') as string;
        if (!apiKey) return [];

        try {
            const response = await fetch('https://api.elevenlabs.io/v2/voices', {
                headers: { 'xi-api-key': apiKey }
            });
            if (!response.ok) return [];
            const data = await response.json();
            return (data as any).voices.map((v: any) => ({
                id: v.voice_id,
                name: v.name,
                category: v.category,
                previewUrl: v.preview_url
            }));
        } catch (error) {
            console.error('[TTS Service] Failed to fetch ElevenLabs voices:', error);
            return [];
        }
    }

    private static async generate(request: TtsRequest): Promise<string> {
        const { text, voiceId, provider } = request;
        const filename = `tts-${Date.now()}.wav`;
        const outputPath = path.join(this.tempDir, filename);

        try {
            if (provider === 'elevenlabs-cloud') {
                return await this.generateElevenLabs(text, voiceId, outputPath);
            } else {
                return await this.generatePiper(text, voiceId, outputPath);
            }
        } catch (error) {
            console.error('[TTS Service] Generation failed:', error);
            throw error;
        }
    }

    private static async generateElevenLabs(text: string, voiceId: string, outputPath: string): Promise<string> {
        if (!voiceId) throw new Error("No voice selected. Please select a voice first.");

        const apiKey = (store as any).get('elevenLabsKey') as string;
        if (!apiKey) throw new Error("ElevenLabs API Key missing in settings.");

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

    private static async generatePiper(text: string, voiceId: string, outputPath: string): Promise<string> {
        // User pointed path or default resources/piper
        let piperBin = (store as any).get('piperPath') as string;
        
        // Fallback to project root assets/piper if not set
        if (!piperBin) {
            const possiblePath = path.join(app.getAppPath(), 'resources', 'piper', 'piper');
            if (fs.existsSync(possiblePath)) {
                piperBin = possiblePath;
            } else {
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
            const piper = spawn(piperBin, [
                '--model', modelPath,
                '--output_file', outputPath
            ]);

            piper.stdin.write(text);
            piper.stdin.end();

            piper.on('close', (code) => {
                if (code === 0) {
                    resolve(outputPath);
                } else {
                    reject(new Error(`Piper exited with code ${code}`));
                }
            });

            piper.on('error', (err) => {
                reject(err);
            });
        });
    }
}
