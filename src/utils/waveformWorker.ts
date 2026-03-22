/**
 * Waveform Web Worker
 * Handles heavy audio decoding and downsampling in the background to prevent UI jank.
 */

// We can't easily use 'window.AudioContext' in a worker, 
// so we'll fetch the file and send the ArrayBuffer back to main thread for decoding, 
// OR use an OffscreenCanvas if we were drawing here.
// Actually, 'decodeAudioData' requires an AudioContext which is only available on the main thread safely in some browsers.
// However, we can perform the peak calculation loop here once we have the Float32Array.

self.onmessage = async (e) => {
    const { channelData, totalPoints } = e.data;
    
    if (!channelData || !totalPoints) return;

    const step = Math.ceil(channelData.length / totalPoints);
    const peaks = new Float32Array(totalPoints);

    for (let i = 0; i < totalPoints; i++) {
        const start = i * step;
        const end = Math.min(start + step, channelData.length);
        let max = 0;
        for (let j = start; j < end; j++) {
            const val = Math.abs(channelData[j]);
            if (val > max) max = val;
        }
        peaks[i] = max;
    }

    self.postMessage({ peaks }, [peaks.buffer] as any);
};
