import React from 'react';
import { usePrismStore } from '../store/usePrismStore';
import { PrismTrack } from '../../types/prism';

interface TransitionEditorProps {
    trackId: string;
    onClose: () => void;
}

export const TransitionEditor: React.FC<TransitionEditorProps> = ({ trackId, onClose }) => {
    const { project, updateTrack, setCurrentTime, setIsPlaying } = usePrismStore();
    const track = project?.tracks.find(t => t.id === trackId);

    // Initial state for Revert
    const [initialState, setInitialState] = React.useState<{ entrance?: string, motion?: string, duration?: number } | null>(null);

    const [previewAnimation, setPreviewAnimation] = React.useState<string>('');
    const [previewKey, setPreviewKey] = React.useState(0);

    React.useEffect(() => {
        if (track && !initialState) {
            setInitialState({
                entrance: track.entrance,
                motion: track.motion,
                duration: track.entranceDuration || 30
            });
            // If it has motion 'ken_burns', treat that as the active "Effect" in this UI?
            // The UI mixes Entrances and Ken Burns.
            if (track.motion === 'ken_burns') {
                setPreviewAnimation('ken_burns');
            } else {
                setPreviewAnimation(track.entrance || '');
            }
        }
    }, [track]);

    if (!track) return null;

    const transitionOptions = [
        { label: 'None', value: '' },
        { label: 'Fade In', value: 'fade_in' },
        { label: 'Zoom In', value: 'zoom_in' },
        { label: 'Zoom Out', value: 'zoom_out' },
        // Use correct keys matching PrismComposition
        { label: 'Slide Up', value: 'slide_in_bottom' }, // Comes FROM bottom
        { label: 'Slide Down', value: 'slide_in_top' }, // Comes FROM top
        { label: 'Slide Left', value: 'slide_in_right' }, // Comes FROM right
        { label: 'Slide Right', value: 'slide_in_left' }, // Comes FROM left
        { label: 'Wipe Left', value: 'wipe_left' },
        { label: 'Wipe Right', value: 'wipe_right' },
        { label: 'Ken Burns', value: 'ken_burns' },
    ];

    const currentSelection = track.motion === 'ken_burns' ? 'ken_burns' : (track.entrance || '');

    const handleSelect = (anim: string) => {
        // Update Store
        if (anim === 'ken_burns') {
            updateTrack(trackId, {
                motion: 'ken_burns',
                entrance: undefined,
                animation: undefined // Clear legacy
            });
        } else {
            updateTrack(trackId, {
                entrance: anim as any,
                motion: track.motion === 'ken_burns' ? undefined : track.motion, // Remove Ken Burns if setting an entrance, but keep other motions? 
                // Actually, this simple editor assumes one main effect. Removing KB is safer for clarity.
                animation: undefined
            });
        }

        // Update Preview
        setPreviewAnimation(anim);
        setPreviewKey(k => k + 1);

        // Simple Play trigger
        if (project) {
            setCurrentTime(track.startFrame);
            setIsPlaying(true);
            setTimeout(() => setIsPlaying(false), 2000);
        }
    };

    const handleApply = () => {
        onClose();
    };

    const handleCancel = () => {
        if (initialState) {
            updateTrack(trackId, {
                entrance: initialState.entrance as any,
                motion: initialState.motion as any,
                entranceDuration: initialState.duration
            });
        }
        onClose();
    };

    // Helper for CSS PREVIEW only
    const getPreviewStyle = (anim: string): React.CSSProperties => {
        const durationFrames = track.entranceDuration || 30;
        const durationSec = durationFrames / 30; // UI uses 30fps assumption
        const durationStr = `${durationSec}s`;
        const easing = 'cubic-bezier(0.33, 1, 0.68, 1)';

        let animRule = '';
        switch (anim) {
            case 'fade_in': animRule = `fadeIn ${durationStr} ${easing} forwards`; break;
            case 'zoom_in': animRule = `zoomIn ${durationStr} ${easing} forwards`; break;
            case 'zoom_out': animRule = `zoomOut ${durationStr} ${easing} forwards`; break;
            case 'slide_in_bottom': animRule = `slideInBottom ${durationStr} ${easing} forwards`; break;
            case 'slide_in_top': animRule = `slideInTop ${durationStr} ${easing} forwards`; break;
            case 'slide_in_right': animRule = `slideInRight ${durationStr} ${easing} forwards`; break;
            case 'slide_in_left': animRule = `slideInLeft ${durationStr} ${easing} forwards`; break;
            case 'wipe_left': animRule = `wipeLeft ${durationStr} ${easing} forwards`; break;
            case 'wipe_right': animRule = `wipeRight ${durationStr} ${easing} forwards`; break;
            case 'ken_burns': animRule = `kenBurns 3s linear alternate infinite`; break;
            default: return {};
        }

        return { animation: animRule };
    };

    const renderPreviewContent = () => {
        const style = getPreviewStyle(previewAnimation);
        const commonClasses = "w-full h-full object-contain shadow-lg bg-transparent";

        if (track.type === 'image' || track.type === 'video') {
            const assetId = track.props.assetId;
            const asset = assetId && project?.assets[assetId];
            if (asset) {
                let finalSrc = asset.src;
                if (finalSrc && !finalSrc.startsWith('http') && !finalSrc.startsWith('file:') && !finalSrc.startsWith('blob:')) {
                    finalSrc = `file://${finalSrc.startsWith('/') ? '' : '/'}${finalSrc}`;
                }
                return (
                    <img
                        key={previewKey}
                        src={finalSrc}
                        className={commonClasses}
                        style={{ ...style, objectFit: 'contain' }}
                        alt="Preview"
                        onError={(e) => e.currentTarget.src = 'https://placehold.co/400x300?text=Asset+Error'}
                    />
                );
            }
        }

        if (track.type === 'text') {
            return (
                <div
                    key={previewKey}
                    className="flex items-center justify-center w-full h-full p-4 text-center"
                    style={{
                        ...style,
                        backgroundColor: 'transparent',
                        color: track.props.color || 'white',
                        fontFamily: track.props.fontFamily || 'sans-serif',
                        fontSize: (track.props.fontSize || 40) * 0.5,
                        textShadow: track.props.textShadow
                    }}
                >
                    {track.props.content || "Text Preview"}
                </div>
            );
        }

        return (
            <div
                key={previewKey}
                className="w-3/4 h-3/4 bg-gradient-to-br from-purple-500 to-blue-600 rounded shadow-lg flex items-center justify-center text-white font-bold tracking-widest text-lg"
                style={style}
            >
                SAMPLE
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes zoomIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                @keyframes zoomOut { from { transform: scale(1.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                @keyframes slideInBottom { from { transform: translateY(100%); } to { transform: translateY(0); } }
                @keyframes slideInTop { from { transform: translateY(-100%); } to { transform: translateY(0); } }
                @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
                @keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
                @keyframes wipeLeft { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }
                @keyframes wipeRight { from { clip-path: inset(0 0 0 100%); } to { clip-path: inset(0 0 0 0); } }
                @keyframes kenBurns { from { transform: scale(1.1); } to { transform: scale(1.3); } }
            `}</style>

            <div className="w-[600px] h-[450px] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
                <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-950">
                    <h3 className="font-bold text-zinc-200">Transition Editor</h3>
                    <button onClick={handleCancel} className="text-zinc-500 hover:text-zinc-300">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    <div className="w-1/2 p-4 flex flex-col gap-4 border-r border-zinc-800 overflow-y-auto">
                        <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Effect Type</div>
                        <div className="grid grid-cols-1 gap-1">
                            {transitionOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => handleSelect(opt.value)}
                                    className={`px-3 py-2 rounded text-sm text-left transition-all flex items-center justify-between group ${currentSelection === opt.value
                                            ? 'bg-purple-900/30 border border-purple-500/50 text-purple-300'
                                            : 'border border-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                                        }`}
                                >
                                    <span>{opt.label}</span>
                                    {currentSelection === opt.value && <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="w-1/2 p-4 flex flex-col gap-6 bg-zinc-950/30">
                        <div>
                            <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Sample Preview</div>
                            <div className="w-full aspect-video bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden relative flex items-center justify-center shadow-inner">
                                <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle, #555 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                                <div className="absolute inset-2 flex items-center justify-center overflow-hidden">
                                    {renderPreviewContent()}
                                </div>
                                <button
                                    onClick={() => setPreviewKey(k => k + 1)}
                                    className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/50 text-white/50 hover:bg-black hover:text-white transition-colors z-10"
                                    title="Replay Preview"
                                >
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="flex justify-between items-end">
                                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Duration</span>
                                <span className="text-xs text-purple-400 font-mono bg-purple-500/10 px-2 py-0.5 rounded">
                                    {((track.entranceDuration || 30) / 30).toFixed(1)}s
                                </span>
                            </div>
                            <div className="relative h-6 flex items-center">
                                <input
                                    type="range"
                                    min={5} max={150} step={1}
                                    value={track.entranceDuration || 30}
                                    onChange={(e) => {
                                        updateTrack(trackId, { entranceDuration: Number(e.target.value) });
                                        setPreviewKey(k => k + 1);
                                    }}
                                    className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-zinc-600 font-mono">
                                <span>0.2s</span>
                                <span>5s</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-14 border-t border-zinc-800 flex items-center justify-end px-4 gap-2 bg-zinc-950">
                    <button onClick={handleCancel} className="px-4 py-1.5 rounded text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
                    <button onClick={handleApply} className="px-4 py-1.5 rounded text-sm bg-purple-600 text-white font-medium hover:bg-purple-500 shadow-lg shadow-purple-900/20 transition-all active:scale-95">Apply Transition</button>
                </div>
            </div>
        </div>
    );
};
