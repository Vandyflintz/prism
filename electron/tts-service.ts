import { app, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import Store from 'electron-store';
import * as https from 'https';
import * as tar from 'tar';
import AdmZip from 'adm-zip';

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

        ipcMain.handle('tts:downloadPiper', async (event) => {
            return await this.downloadPiperWithProgress(event);
        });
    }

    private static async downloadPiperWithProgress(event: any) {
        const destDir = path.join(app.getPath('userData'), 'piper');
        
        // Define URLs based on platform
        let binaryUrl = '';
        const platform = process.platform;
        const arch = process.arch;

        if (platform === 'darwin') {
            binaryUrl = arch === 'arm64' 
                ? 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_aarch64.tar.gz'
                : 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_macos_x64.tar.gz';
        } else if (platform === 'win32') {
            binaryUrl = 'https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_windows_amd64.zip';
        } else {
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
                const zip = new AdmZip(archivePath);
                zip.extractAllTo(destDir, true);
            } else {
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
            await this.downloadFile(configUrl, path.join(destDir, 'en_US-lessac-medium.onnx.json'), () => {});

            // Auto-configure path in store
            (store as any).set('piperPath', piperBin);

            event.sender.send('tts:downloadProgress', { status: 'Complete', progress: 100 });
            return { success: true, path: piperBin };

        } catch (error: any) {
            console.error('[TTS Service] Auto-download failed', error);
            throw new Error(`Failed to download Piper: ${error.message}`);
        }
    }

    private static downloadFile(url: string, dest: string, onProgress: (progress: number) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            https.get(url, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    return this.downloadFile(response.headers.location!, dest, onProgress).then(resolve).catch(reject);
                }
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
                    return;
                }

                const total = parseInt(response.headers['content-length'] || '0', 10);
                let current = 0;

                response.on('data', (chunk) => {
                    current += chunk.length;
                    if (total > 0) onProgress(current / total);
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
        
        // Fallback to auto-downloaded path
        if (!piperBin) {
            const autoPath = process.platform === 'win32' 
                ? path.join(app.getPath('userData'), 'piper', 'piper.exe')
                : path.join(app.getPath('userData'), 'piper', 'piper');
            if (fs.existsSync(autoPath)) {
                piperBin = autoPath;
            }
        }

        // Fallback to project root assets/piper if not set
        if (!piperBin) {
            const possiblePath = path.join(app.getAppPath(), 'resources', 'piper', process.platform === 'win32' ? 'piper.exe' : 'piper');
            if (fs.existsSync(possiblePath)) {
                piperBin = possiblePath;
            } else {
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
