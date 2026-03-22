import React, { useEffect, useRef, useState } from 'react';

interface AudioWaveformProps {
    src: string;
    width: number;
    height: number;
    color?: string;
    onDurationLoaded?: (duration: number) => void;
}

// Global cache for peaks to avoid redundant worker runs
const PEAKS_CACHE = new Map<string, Float32Array>();
const PENDING_REQUESTS = new Map<string, Promise<Float32Array>>();

export const AudioWaveform: React.FC<AudioWaveformProps> = ({ src, width, height, color = '#10b981' }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [peaks, setPeaks] = useState<Float32Array | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!src) return;

        let isCancelled = false;

        const getPeaks = async () => {
            // 1. Check Cache
            if (PEAKS_CACHE.has(src)) {
                setPeaks(PEAKS_CACHE.get(src)!);
                return;
            }

            // 2. Check for pending request to avoid parallel decoding of same file
            if (PENDING_REQUESTS.has(src)) {
                setIsLoading(true);
                const result = await PENDING_REQUESTS.get(src);
                if (!isCancelled) {
                    setPeaks(result!);
                    setIsLoading(false);
                }
                return;
            }

            // 3. Start New Request
            const fetchAndDecode = async (): Promise<Float32Array> => {
                const response = await fetch(src);
                const arrayBuffer = await response.arrayBuffer();
                const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                
                try {
                    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    const channelData = audioBuffer.getChannelData(0);
                    
                    // High resolution for zoom: 100 points per second
                    const pointsPerSecond = 100;
                    const totalPoints = Math.ceil(audioBuffer.duration * pointsPerSecond);

                    return new Promise((resolve) => {
                        const worker = new Worker(new URL('../utils/waveformWorker.ts', import.meta.url));
                        worker.onmessage = (e) => {
                            const { peaks: computedPeaks } = e.data;
                            PEAKS_CACHE.set(src, computedPeaks);
                            worker.terminate();
                            resolve(computedPeaks);
                        };
                        worker.postMessage({ channelData, totalPoints });
                    });
                } finally {
                    audioContext.close();
                }
            };

            const request = fetchAndDecode();
            PENDING_REQUESTS.set(src, request);
            
            setIsLoading(true);
            try {
                const result = await request;
                if (!isCancelled) {
                    setPeaks(result);
                }
            } catch (err) {
                console.error("Failed to generate waveform", err);
            } finally {
                PENDING_REQUESTS.delete(src);
                if (!isCancelled) setIsLoading(false);
            }
        };

        getPeaks();

        return () => {
            isCancelled = true;
        };
    }, [src]);

    // Render Canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !peaks) return;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = color;

        const barWidth = 2;
        const gap = 1;
        const totalBars = Math.floor(width / (barWidth + gap));

        for (let i = 0; i < totalBars; i++) {
            const x = i * (barWidth + gap);
            const peakIndex = Math.floor((i / totalBars) * peaks.length);
            const val = peaks[peakIndex] || 0;

            const h = Math.max(1, val * height * 0.8);
            ctx.fillRect(x, (height - h) / 2, barWidth, h);
        }

    }, [peaks, width, height, color]);

    return (
        <div className="relative w-full h-full">
            {isLoading && !peaks && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/20 backdrop-blur-[1px]">
                    <div className="w-4 h-4 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                </div>
            )}
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="w-full h-full pointer-events-none opacity-60 mix-blend-screen"
            />
        </div>
    );
};
