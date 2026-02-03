import React, { useEffect, useState } from 'react';

interface VideoThumbnailProps {
    src: string;
    width?: number; // Container width in px
    duration?: number; // Video duration in seconds
    className?: string;
}

const THUMBNAIL_WIDTH = 45; // px per thumbnail (approx 16:9 for 24px height)
const CACHE_KEY_PREFIX = 'prism_vthumb_';

// Global cache to avoid re-generating thumbnails for the same video/timestamp
// Key: src_timestamp -> DataURL
const THUMBNAIL_CACHE = new Map<string, string>();

export const VideoThumbnail: React.FC<VideoThumbnailProps> = ({ src, width = 0, duration = 10, className }) => {
    const [thumbnails, setThumbnails] = useState<string[]>([]);

    useEffect(() => {
        if (!src || width <= 0) return;

        const numThumbs = Math.max(1, Math.ceil(width / THUMBNAIL_WIDTH));

        let isCancelled = false;

        const generateFilmstrip = async () => {
            const video = document.createElement('video');
            video.src = src;
            video.crossOrigin = 'anonymous';
            video.muted = true;
            video.preload = 'metadata';

            // Wait for metadata
            await new Promise<void>((resolve, reject) => {
                if (video.readyState >= 1) resolve();
                video.onloadedmetadata = () => resolve();
                video.onerror = () => reject('Video load error');
            });

            if (isCancelled) return;

            const vidDuration = duration || video.duration || 10;
            const generatedThumbs: string[] = [];

            // Reuse canvas for performance
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Calculate timestamp step
            // If duration is 10s and we need 5 thumbs: 0, 2, 4, 6, 8
            const step = vidDuration / numThumbs;

            for (let i = 0; i < numThumbs; i++) {
                if (isCancelled) break;

                const time = i * step;
                // Cache key includes src and timestamp (rounded to 1 decimal place)
                const cacheKey = `${CACHE_KEY_PREFIX}${src}_${time.toFixed(1)}`;

                if (THUMBNAIL_CACHE.has(cacheKey)) {
                    generatedThumbs.push(THUMBNAIL_CACHE.get(cacheKey)!);
                    continue;
                }

                // Seek
                video.currentTime = time;

                // Wait for seek
                await new Promise<void>(resolve => {
                    const onSeeked = () => {
                        video.removeEventListener('seeked', onSeeked);
                        resolve();
                    };
                    video.addEventListener('seeked', onSeeked);
                });

                if (isCancelled) break;

                // Capture
                // Keep resolution low (height ~60-80px is enough for timeline)
                const captureHeight = 80;
                const scale = Math.min(1, captureHeight / video.videoHeight);
                canvas.width = video.videoWidth * scale;
                canvas.height = video.videoHeight * scale;

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                // Low quality jpeg is fine for thumbnails
                const dataUrl = canvas.toDataURL('image/jpeg', 0.5);

                THUMBNAIL_CACHE.set(cacheKey, dataUrl);
                generatedThumbs.push(dataUrl);
            }

            if (!isCancelled) {
                setThumbnails(generatedThumbs);
            }

            // Cleanup
            video.removeAttribute('src');
            video.load();
        };

        generateFilmstrip().catch(() => {
            // console.warn('Filmstrip generation interrupted or failed', err);
        });

        return () => {
            isCancelled = true;
        };
    }, [src, width, duration]); // Re-run if dims change significantly (though React handles numbers well)

    if (thumbnails.length === 0) return null;

    return (
        <div className={`flex w-full h-full overflow-hidden ${className}`}>
            {thumbnails.map((thumb, i) => (
                <div
                    key={i}
                    className="h-full flex-shrink-0 bg-cover bg-center border-r border-white/10"
                    style={{
                        backgroundImage: `url(${thumb})`,
                        // Distribute width equally
                        width: `${100 / thumbnails.length}%`
                    }}
                />
            ))}
        </div>
    );
};
