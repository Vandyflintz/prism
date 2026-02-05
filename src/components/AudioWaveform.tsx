import React, { useEffect, useRef, useState } from 'react';

interface AudioWaveformProps {
    src: string;
    width: number;
    height: number;
    color?: string; // Hex color for the waveform
    onDurationLoaded?: (duration: number) => void;
}

const AUDIO_CACHE = new Map<string, Float32Array>();

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ src, width, height, color = '#10b981', onDurationLoaded }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [peaks, setPeaks] = useState<Float32Array | null>(null);

    useEffect(() => {
        // Debounce or check cache
        if (!src) return;

        let isCancelled = false;

        const loadAudio = async () => {
            if (AUDIO_CACHE.has(src)) {
                setPeaks(AUDIO_CACHE.get(src)!);
                return;
            }

            try {
                const response = await fetch(src);
                const arrayBuffer = await response.arrayBuffer();
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

                // Decode can be CPU intensive, maybe offload to worker later if needed
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                // Downsample for visualization
                // We don't need every sample. We need roughly one peak per pixel width?
                // Actually, let's store a decent resolution and scale deeply draw time.
                // 100 samples per second is decent for zoom.

                const channelData = audioBuffer.getChannelData(0); // Left channel
                // const samples = 1000; // Fixed resolution for now? Or depends on duration?
                // Let's create a fixed size buffer for the visualizer, e.g., 200 points per second of audio
                const pointsPerSecond = 50;
                const totalPoints = Math.ceil(audioBuffer.duration * pointsPerSecond);

                const step = Math.ceil(channelData.length / totalPoints);
                const computedPeaks = new Float32Array(totalPoints);

                for (let i = 0; i < totalPoints; i++) {
                    const start = i * step;
                    const end = start + step;
                    let max = 0;
                    for (let j = start; j < end; j++) {
                        const val = Math.abs(channelData[j]);
                        if (val > max) max = val;
                    }
                    computedPeaks[i] = max;
                }

                if (!isCancelled) {
                    AUDIO_CACHE.set(src, computedPeaks);
                    setPeaks(computedPeaks);
                }

                // Close context to free resources
                audioContext.close();

            } catch (err) {
                console.error("Failed to generate waveform", err);
            }
        };

        loadAudio();

        return () => {
            isCancelled = true;
        };
    }, [src]);

    // Render Canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !peaks) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, width, height);

        // Draw
        ctx.fillStyle = color;

        // Determine bar width and gap
        // We want to stretch 'peaks' to 'width'
        // If peaks.length > width, we skip.
        // If peaks.length < width, we extend.

        // Simple approach: Iterate pixels 0..width
        // Map pixel x to peaks index

        // const centerY = height / 2;
        // const scaleY = height / 2 * 0.9; // Leave 10% margin

        ctx.beginPath();

        // Bar style
        const barWidth = 2;
        const gap = 1;
        const totalBars = Math.floor(width / (barWidth + gap));

        for (let i = 0; i < totalBars; i++) {
            const x = i * (barWidth + gap);
            // Map i (0..totalBars) to peaks index (0..peaks.length)
            const peakIndex = Math.floor((i / totalBars) * peaks.length);
            const val = peaks[peakIndex] || 0;

            const h = Math.max(2, val * height); // Min height 2px

            // Rounded bar?
            ctx.fillRect(x, (height - h) / 2, barWidth, h);
        }

        // ctx.fill();

    }, [peaks, width, height, color]);

    return (
        <canvas
            ref={canvasRef}
            width={width}
            height={height}
            className="w-full h-full pointer-events-none opacity-80"
        />
    );
};
