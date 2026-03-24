import { pipeline, env } from '@xenova/transformers';
import * as fs from 'fs';

// Configure for Electron main process (Node.js — no AudioContext)
env.useBrowserCache = false;
env.allowLocalModels = false;

let transcriber: any = null;

/**
 * Parse raw 16kHz mono WAV buffer → Float32Array of PCM samples.
 * WAV header is 44 bytes; everything after is Int16 LE PCM.
 */
function wavToFloat32(wavBuffer: Buffer): { samples: Float32Array, peak: number, avg: number } {
    const view = new DataView(wavBuffer.buffer, wavBuffer.byteOffset, wavBuffer.byteLength);

    // Validate RIFF magic
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (riff !== 'RIFF') throw new Error(`Expected RIFF header, got "${riff}"`);

    const sampleRate = view.getUint32(24, true);
    console.log(`[STT] WAV sample rate: ${sampleRate} Hz, file size: ${wavBuffer.byteLength} bytes`);

    // Standard 44-byte PCM header
    const dataOffset = 44;
    const numSamples = Math.floor((wavBuffer.byteLength - dataOffset) / 2);
    console.log(`[STT] PCM samples: ${numSamples} (${(numSamples / 16000).toFixed(2)}s of audio)`);

    const samples = new Float32Array(numSamples);
    let peak = 0;
    let sum = 0;
    for (let i = 0; i < numSamples; i++) {
        const int16 = view.getInt16(dataOffset + i * 2, true);
        const floatValue = int16 / 32768.0;
        samples[i] = floatValue;
        const abs = Math.abs(floatValue);
        if (abs > peak) peak = abs;
        sum += abs;
    }
    const avg = sum / numSamples;
    console.log(`[STT] Audio peak: ${peak.toFixed(5)}, avg: ${avg.toFixed(5)}`);

    return { samples, peak, avg };
}

/**
 * Given a sentence chunk with timestamps, distribute words evenly within that window.
 * Returns individual word-level chunks with proportional timestamps.
 */
function splitChunkIntoWords(chunk: { text: string; timestamp: [number, number] }): Array<{ text: string; timestamp: [number, number] }> {
    const words = chunk.text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    if (words.length === 1) return [{ text: words[0], timestamp: chunk.timestamp }];

    const [start, end] = chunk.timestamp;
    const totalDuration = (end || start + 3) - start;
    const wordDuration = totalDuration / words.length;

    return words.map((word, i) => ({
        text: word,
        timestamp: [
            parseFloat((start + i * wordDuration).toFixed(3)),
            parseFloat((start + (i + 1) * wordDuration).toFixed(3)),
        ] as [number, number],
    }));
}

export async function generateCaptions(audioFilePath: string): Promise<{ chunks: any[], diagnostics: any }> {
    const wavBuffer = fs.readFileSync(audioFilePath);
    console.log(`[STT] Read temp WAV: ${audioFilePath} (${wavBuffer.byteLength} bytes)`);

    if (wavBuffer.byteLength < 64) {
        throw new Error(`WAV file too small (${wavBuffer.byteLength} bytes) — encoding likely failed.`);
    }

    let audioData: { samples: Float32Array, peak: number, avg: number };
    try {
        audioData = wavToFloat32(wavBuffer);
    } catch (parseErr) {
        throw new Error(`Failed to parse WAV: ${parseErr}`);
    }

    const { samples, peak, avg } = audioData;

    if (samples.length < 1600) {
        throw new Error(`Audio too short: only ${samples.length} samples (${(samples.length / 16000).toFixed(2)}s). Need at least 0.1s.`);
    }

    if (!transcriber) {
        console.log('[STT] Loading Xenova/whisper-tiny (Multilingual/Full)...');
        transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
            quantized: false,
        });
        console.log('[STT] Whisper model ready.');
    }

    console.log('[STT] Running transcription (Auto-detect + Gains)...');
    
    // Explicitly amplify signal slightly for Whisper's benefit
    const boostedSamples = new Float32Array(samples.length);
    for(let i=0; i<samples.length; i++) boostedSamples[i] = Math.max(-1, Math.min(1, samples[i] * 2.0));

    const output = await transcriber(boostedSamples, {
        return_timestamps: true,
    });

    console.log('[STT] Raw output:', JSON.stringify({
        hasText: !!output.text,
        textLength: output.text?.length || 0,
        numChunks: output.chunks?.length || 0,
        keys: Object.keys(output)
    }));

    let sentenceChunks: Array<{ text: string; timestamp: [number, number] }> = [];

    // Handle different output structures from Transformers.js
    if (Array.isArray(output.chunks)) {
        sentenceChunks = output.chunks;
    } else if (Array.isArray(output)) {
        // Some pipeline versions return the result array directly
        sentenceChunks = output as any;
    }

    console.log(`[STT] Got ${sentenceChunks.length} sentence chunks.`);

    if (sentenceChunks.length === 0) {
        if (output.text && output.text.trim()) {
            console.log('[STT] No chunks returned but text exists. Using full-text fallback.');
            sentenceChunks.push({ text: output.text, timestamp: [0, samples.length / 16000] });
        } else {
            console.log('[STT] WARNING: No transcription text or chunks were generated.');
        }
    }

    // Expand sentence chunks → word-level chunks
    const wordChunks: Array<{ text: string; timestamp: [number, number] }> = [];
    for (const chunk of sentenceChunks) {
        // Ensure timestamp exists and is valid
        const ts = chunk.timestamp || [0, 0];
        const words = splitChunkIntoWords({ 
            text: chunk.text || '', 
            timestamp: [ts[0] ?? 0, ts[1] ?? (ts[0] + 1)] 
        });
        wordChunks.push(...words);
    }

    console.log(`[STT] Expanded to ${wordChunks.length} word-level chunks.`);
    return { 
        chunks: wordChunks, 
        diagnostics: {
            peak,
            avg,
            duration: samples.length / 16000,
            originalText: output.text || ''
        }
    };
}
