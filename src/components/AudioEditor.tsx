import React, { useState, useEffect, useRef } from 'react';
import { usePrismStore } from '../store/usePrismStore';
import { AudioWaveform } from './AudioWaveform';

interface AudioEditorProps {
    trackId: string;
    onClose: () => void;
}

export const AudioEditor: React.FC<AudioEditorProps> = ({ trackId, onClose }) => {
    const { project, updateTrack } = usePrismStore();
    const track = project?.tracks.find(t => t.id === trackId);
    const asset = track?.props.assetId ? project?.assets[track.props.assetId] : null;

    // Local State for Preview
    const [volume, setVolume] = useState(track?.props.volume ?? 1);

    // Trimming State (in Frames relative to media source)
    // track.durationInFrames is the VISIBLE duration.
    // track.props.mediaOffset is the START offset.
    // Total Media Duration? We might need metadata or just trust user.
    // For now, let's assume infinite or let user scrub freely? 
    // Ideally we know asset duration.

    // Since we don't strictly have asset duration in metadata always, let's allow editing "Window"
    // "Offset" = Start Point.
    // "Duration" = Length.

    // Visualization:
    // [ ...... | <--- Offset ---> [ Visible ] <--- ... ---> | ...... ]

    // Simplification: We only show the "Trim" controls as number inputs + Slider?
    // Slider for "Start Offset".

    const [offset, setOffset] = useState(track?.props.mediaOffset || 0);
    const [duration, setDuration] = useState(track?.durationInFrames || 100);

    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Duration of the full source file in seconds
    const [audioDuration, setAudioDuration] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef<'start' | 'end' | null>(null);

    const fps = project?.fps || 30;

    // Convert Frames <-> Pixels
    // Width = 550px
    // Total Duration = audioDuration (s)
    // Scale = 550 / audioDuration

    // BUT we work in Frames.
    // Total Frames = audioDuration * fps
    // pxPerFrame = 550 / (audioDuration * fps)

    const totalFrames = audioDuration * fps;

    const handleMouseDown = (e: React.MouseEvent, type: 'start' | 'end') => {
        isDraggingRef.current = type;
        e.preventDefault();
        e.stopPropagation();
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current || !containerRef.current || totalFrames === 0) return;

            const rect = containerRef.current.getBoundingClientRect();
            const relativeX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
            const percent = relativeX / rect.width;
            const frameAtPos = Math.round(percent * totalFrames);

            if (isDraggingRef.current === 'start') {
                // Changing Offset
                // Max offset is where the track ends (offset + duration = file end? No)
                // Max offset is such that (offset + min_duration) <= old_end_point?
                // Actually usually: Dragging start handle moves the processing start point.
                // It stays pinned to the left visually? No, usually handles move on a fixed waveform.

                // New Offset = frameAtPos
                // Constraint: New Offset < (Offset + Duration) (keep some length)
                // Actually: FrameAtPos is the absolute position in the file.
                // Current Start = offset.
                // Current End = offset + duration.

                // If I drag start handle, I am changing `offset`.
                // Limit: offset must be < current_end_absolute.
                const currentEndAbsolute = offset + duration;
                const newOffset = Math.min(frameAtPos, currentEndAbsolute - 10); // Min 10 frames duration

                setOffset(newOffset);
                // Should duration change?
                // If I trim the start (move right), the valid content becomes shorter?
                // Usually "Slip" trimming:
                // If I move start handle right -> Offset increases, Duration decreases (if end handle is fixed).
                // Let's assume End Handle represents (Offset + Duration).

                setDuration(currentEndAbsolute - newOffset);

            } else {
                // Dragging End Handle
                // Changing Duration primarily.
                // Valid End Point = frameAtPos.
                // New Duration = frameAtPos - offset.
                const newDuration = frameAtPos - offset;
                setDuration(Math.max(10, newDuration));
            }
        };

        const handleMouseUp = () => {
            isDraggingRef.current = null;
        };

        if (audioDuration > 0) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [audioDuration, totalFrames, offset, duration]);

    if (!track || !asset) return null;

    const handleSave = () => {
        updateTrack(trackId, {
            durationInFrames: duration,
            props: {
                ...track.props,
                volume,
                mediaOffset: offset
            }
        });
        onClose();
    };

    const togglePreview = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                // Set start time based on offset (frames -> seconds)
                const fps = project?.fps || 30;
                audioRef.current.currentTime = offset / fps;
                audioRef.current.play();

                // Stop after duration
                setTimeout(() => {
                    if (audioRef.current) {
                        audioRef.current.pause();
                        setIsPlaying(false);
                    }
                }, (duration / fps) * 1000);
            }
            setIsPlaying(!isPlaying);
        }
    };

    // Sync Volume
    useEffect(() => {
        if (audioRef.current) {
            // HTMLMediaElement volume is 0.0 to 1.0
            // Remotion supports > 1 (amplification), but native preview cannot.
            audioRef.current.volume = Math.min(1, Math.max(0, volume));
        }
    }, [volume]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-[600px] bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950">
                    <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                        Audio Editor
                    </h2>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-6">

                    {/* Big Waveform Preview */}
                    <div
                        ref={containerRef}
                        className="h-32 bg-zinc-950 rounded border border-zinc-800 relative overflow-hidden flex items-center justify-center select-none"
                    >
                        {/* Waveform Layer */}
                        <AudioWaveform
                            src={asset.src}
                            width={550}
                            height={128}
                            color="#34d399"
                            onDurationLoaded={(d) => setAudioDuration(d)}
                        />

                        {/* Overlay Handles */}
                        {audioDuration > 0 && (
                            <>
                                {/* Dimmed Areas */}
                                <div
                                    className="absolute left-0 top-0 bottom-0 bg-black/60 pointer-events-none"
                                    style={{ width: `${(offset / totalFrames) * 100}%` }}
                                />
                                <div
                                    className="absolute right-0 top-0 bottom-0 bg-black/60 pointer-events-none"
                                    style={{ left: `${((offset + duration) / totalFrames) * 100}%` }}
                                />

                                {/* Start Handle */}
                                <div
                                    className="absolute top-0 bottom-0 w-4 cursor-ew-resize group z-10 flex flex-col items-center"
                                    style={{ left: `calc(${(offset / totalFrames) * 100}% - 2px)` }}
                                    onMouseDown={(e) => handleMouseDown(e, 'start')}
                                >
                                    <div className="h-full w-0.5 bg-white group-hover:bg-emerald-400 shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
                                    <div className="absolute top-1/2 -translate-y-1/2 bg-white text-zinc-900 rounded-sm px-1 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                        START
                                    </div>
                                </div>

                                {/* End Handle */}
                                <div
                                    className="absolute top-0 bottom-0 w-4 cursor-ew-resize group z-10 flex flex-col items-center"
                                    style={{ left: `calc(${((offset + duration) / totalFrames) * 100}% - 2px)` }}
                                    onMouseDown={(e) => handleMouseDown(e, 'end')}
                                >
                                    <div className="h-full w-0.5 bg-white group-hover:bg-red-400 shadow-[0_0_10px_rgba(255,255,255,0.5)]"></div>
                                    <div className="absolute top-1/2 -translate-y-1/2 bg-white text-zinc-900 rounded-sm px-1 text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                        END
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        {/* Timing Controls */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Timing</h3>

                            <div>
                                <label className="text-xs text-zinc-400 mb-1 block">Start Offset (frames)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={offset}
                                        onChange={(e) => setOffset(Math.max(0, Number(e.target.value)))}
                                        className="bg-zinc-800 border border-zinc-700 rounded p-2 text-sm text-zinc-200 w-full focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                                <p className="text-[10px] text-zinc-600 mt-1">Skips the beginning of the file.</p>
                            </div>

                            <div>
                                <label className="text-xs text-zinc-400 mb-1 block">Duration (frames)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={duration}
                                        onChange={(e) => setDuration(Math.max(1, Number(e.target.value)))}
                                        className="bg-zinc-800 border border-zinc-700 rounded p-2 text-sm text-zinc-200 w-full focus:outline-none focus:border-emerald-500"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Audio Controls */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Audio</h3>

                            <div>
                                <label className="text-xs text-zinc-400 mb-1 block">Volume ({Math.round(volume * 100)}%)</label>
                                <input
                                    type="range"
                                    min="0" max="2" step="0.05"
                                    value={volume}
                                    onChange={(e) => setVolume(Number(e.target.value))}
                                    className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                />
                            </div>

                            {/* Preview Button */}
                            <div className="pt-4">
                                <button
                                    onClick={togglePreview}
                                    className={`w-full py-2 rounded font-semibold text-xs flex items-center justify-center gap-2 transition-colors ${isPlaying ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-800 hover:bg-zinc-700 text-emerald-400'}`}
                                >
                                    {isPlaying ? (
                                        <>
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                                            Stop Preview
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                            Play Clip
                                        </>
                                    )}
                                </button>
                                {/* Invisible Audio Element */}
                                <audio ref={audioRef} src={asset.src} onEnded={() => setIsPlaying(false)} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors">Cancel</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-95">
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};
