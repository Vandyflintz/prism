import React from 'react';
import { usePrismStore } from '../store/usePrismStore';
import { PrismTrack } from '../types/prism';

interface TransitionEditorProps {
    trackId: string;
    onClose: () => void;
}

export const TransitionEditor: React.FC<TransitionEditorProps> = ({ trackId, onClose }) => {
    const { project, updateTrack, setCurrentTime, setIsPlaying } = usePrismStore();
    const track = project?.tracks.find(t => t.id === trackId);

    // Local state for "Draft" changes? 
    // Actually, for "Realtime Preview", we want to update the REAL store, but maybe revert if Cancelled.
    // Let's store the INITIAL state on mount.
    const [initialState, setInitialState] = React.useState<{ animation?: string, duration?: number } | null>(null);

    React.useEffect(() => {
        if (track && !initialState) {
            setInitialState({
                animation: track.animation,
                duration: track.props.transitionDuration || 15
            });
        }
    }, [track]);

    if (!track) return null;

    const transitionOptions = [
        { label: 'None', value: '' },
        { label: 'Fade In', value: 'fade_in' },
        { label: 'Zoom In', value: 'zoom_in' },
        { label: 'Zoom Out', value: 'zoom_out' },
        { label: 'Slide Up', value: 'slide_in_bottom' },
        { label: 'Slide Down', value: 'slide_in_top' },
        { label: 'Slide Left', value: 'slide_in_right' },
        { label: 'Slide Right', value: 'slide_in_left' },
        { label: 'Wipe Left', value: 'wipe_left' },
        { label: 'Wipe Right', value: 'wipe_right' },
        { label: 'Ken Burns', value: 'ken_burns' },
    ];

    const handlePreview = (animation: string) => {
        // 1. Update Track
        updateTrack(trackId, { animation: animation as any });

        // 2. Seek to Start
        const fps = project?.fps || 30;
        setCurrentTime(track.startFrame);

        // 3. Play for a bit?
        setIsPlaying(true);
        setTimeout(() => setIsPlaying(false), 1500); // Stop after 1.5s
    };

    const handleApply = () => {
        onClose();
    };

    const handleCancel = () => {
        if (initialState) {
            updateTrack(trackId, {
                animation: initialState.animation as any,
                props: { ...track.props, transitionDuration: initialState.duration }
            });
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-[400px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950">
                    <h3 className="font-bold text-zinc-200">Transition Editor</h3>
                    <button onClick={handleCancel} className="text-zinc-500 hover:text-zinc-300">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col gap-4">
                    {/* Preview Area (Instructions) */}
                    <div className="p-3 bg-zinc-800/50 rounded border border-zinc-700/50 text-xs text-zinc-400 text-center">
                        Select an effect to preview it on the main player.
                    </div>

                    {/* Grid of Options */}
                    <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                        {transitionOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => handlePreview(opt.value)}
                                className={`px-3 py-2 rounded border text-sm text-left transition-all ${track.animation === opt.value
                                        ? 'bg-purple-900/30 border-purple-500 text-purple-300'
                                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Duration Slider (Future Proofing) */}
                    {/* We need to properly wire this later, for now just UI */}
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs text-zinc-500">
                            <span>Duration</span>
                            <span>{(track.props.transitionDuration || 15) / 30}s</span>
                        </div>
                        <input
                            type="range"
                            min={5} max={60} step={1}
                            value={track.props.transitionDuration || 15}
                            onChange={(e) => updateTrack(trackId, { props: { ...track.props, transitionDuration: Number(e.target.value) } })}
                            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                    </div>

                </div>

                {/* Footer */}
                <div className="h-14 border-t border-zinc-800 flex items-center justify-end px-4 gap-2 bg-zinc-950">
                    <button onClick={handleCancel} className="px-4 py-1.5 rounded text-sm text-zinc-400 hover:text-white">Cancel</button>
                    <button onClick={handleApply} className="px-4 py-1.5 rounded text-sm bg-purple-600 text-white font-medium hover:bg-purple-500 shadow-lg shadow-purple-900/20">Apply</button>
                </div>
            </div>
        </div>
    );
};
