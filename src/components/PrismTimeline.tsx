import React from 'react';
import { Timeline, TimelineState } from '@xzdarcy/react-timeline-editor';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';
import { useStore } from 'zustand';
import { usePrismStore } from '../store/usePrismStore';

import { TimelineActionItem } from './TimelineActionItem';
import { TransitionEditor } from './TransitionEditor';


// Helper: Format timecode (HH:MM:SS:FF)
const formatTimecode = (frame: number, fps: number) => {
    const totalSeconds = frame / fps;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const frames = Math.round((totalSeconds % 1) * fps);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
};

// Toolbar Icon Helper
const IconBtn = ({ onClick, children, title, className = '' }: { onClick?: () => void, children: React.ReactNode, title?: string, className?: string }) => (
    <button
        onClick={onClick}
        title={title}
        className={`w-8 h-8 flex items-center justify-center rounded-md bg-transparent border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-white hover:border-zinc-700 transition-all active:scale-95 shadow-sm ${className}`}
    >
        {children}
    </button>
);



interface PrismTimelineProps {
    onOpenSettings?: () => void;
}

export const PrismTimeline: React.FC<PrismTimelineProps> = ({ onOpenSettings }) => {
    const {
        project, updateTrack, currentTime, setCurrentTime, isPlaying, setIsPlaying, reorderTracks,
        toggleTrackLock, toggleTrackVisibility, toggleTrackMute, splitTrack, deleteTrack, selectedTrackId, setSelectedTrackId,
        isMagnetEnabled, toggleMagnet
    } = usePrismStore();

    const [editingTransitionTrackId, setEditingTransitionTrackId] = React.useState<string | null>(null);

    // Old transitionOptions are now in the Editor component


    // Zundo Temporal Store
    const { undo, redo, pastStates, futureStates } = useStore(usePrismStore.temporal, (state) => state);

    const timelineRef = React.useRef<TimelineState>(null);
    const sidebarRef = React.useRef<HTMLDivElement>(null);

    // Sync Timeline Cursor (Store -> Timeline)
    React.useEffect(() => {
        if (timelineRef.current && project) {
            // console.log('Syncing timeline to time:', currentTime);
            timelineRef.current.setTime(currentTime / (project.fps || 30));
            timelineRef.current.reRender();
        }
    }, [currentTime, project]);

    if (!project) return <div className="p-4 text-zinc-500">No Project Loaded</div>;

    const fps = project.fps || 30;

    // Memoize to prevent re-renders breaking drag/zoom state
    const timelineData: any[] = React.useMemo(() => project.tracks.map((track) => ({
        id: track.id,
        type: track.type, // Pass type for row header
        actions: [
            {
                id: track.id,
                start: track.startFrame / fps,
                end: (track.startFrame + track.durationInFrames) / fps,
                effectId: track.type === 'audio' ? 'audio' : 'visual',
                data: {
                    label: track.props.content || track.id,
                    type: track.type,
                    // Resolve asset src for thumbnails
                    src: track.props.assetId ? project.assets[track.props.assetId]?.src : undefined,
                    // Pass color for generic tracks
                    color: track.props.backgroundColor
                },
                movable: !track.locked,
                resizable: !track.locked,
                flexible: !track.locked,
            }
        ],
    })), [project.tracks, project.assets, fps]);

    // Helper for Row Header Icons
    const getIcon = (type: string) => {
        switch (type) {
            case 'audio': return <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>;
            case 'text': return <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>;
            case 'image': return <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
            case 'shape': return <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" /></svg>; // Square
            default: return <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
        }
    }

    const getTrackBackground = (type: string, isSelected: boolean) => {
        const base = isSelected ? "bg-opacity-40" : "bg-opacity-20";
        switch (type) {
            case 'audio': return `${base} bg-emerald-900 border-emerald-900/50`;
            case 'text': return `${base} bg-violet-900 border-violet-900/50`;
            case 'image': return `${base} bg-blue-900 border-blue-900/50`;
            case 'shape': return `${base} bg-zinc-700 border-zinc-700/50`;
            default: return isSelected ? 'bg-zinc-700 border-white/5' : 'bg-zinc-800 border-white/5 hover:bg-zinc-700';
        }
    };

    const [zoom, setZoom] = React.useState(160); // Default pixels per scale unit

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 20, 500));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 20, 20));
    const togglePlay = React.useCallback(() => setIsPlaying(!isPlaying), [isPlaying, setIsPlaying]);

    // Global Key Shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if active element is an input or textarea
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                return;
            }

            if (e.code === 'Space') {
                e.preventDefault(); // Prevent scrolling
                togglePlay();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [togglePlay]);

    // One scale unit = 1 second
    const scale = 1;
    const scaleWidth = zoom;



    return (
        <div className="w-full h-full flex flex-col bg-zinc-950 border-t border-zinc-800 select-none">
            <style>{`
                .timeline-editor-edit-row-drag-handle {
                    width: 100% !important;
                    height: 100% !important;
                    left: 0 !important;
                    top: 0 !important;
                    transform: none !important;
                    opacity: 0 !important;
                    z-index: 1 !important;
                    cursor: grab !important;
                    font-size: 0 !important; /* Hide potential text */
                    color: transparent !important;
                }
                .timeline-editor-edit-row-drag-handle::after,
                .timeline-editor-edit-row-drag-handle::before {
                    content: none !important;
                    display: none !important;
                }
                .timeline-editor-edit-row-drag-handle:active {
                    cursor: grabbing !important;
                }
                /* Hide any default text in drag guide lines */
                .timeline-editor-drag-line,
                .timeline-editor-drag-line-container {
                     font-size: 0 !important;
                     color: transparent !important;
                }
                .timeline-editor-drag-line::after,
                .timeline-editor-drag-line::before {
                    content: none !important;
                }
                .timeline-editor-action {
                    z-index: 20 !important;
                }
            `}</style>
            {/* COMPACT TOOLBAR */}
            <div className="h-10 shrink-0 border-b border-zinc-900 flex items-center justify-between px-3 bg-[#09090b]">
                {/* Transport Controls */}
                <div className="flex items-center gap-1">
                    <IconBtn title="Jump to Start" onClick={() => setCurrentTime(0)}>
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
                    </IconBtn>
                    <IconBtn onClick={togglePlay} title={isPlaying ? "Pause (Space)" : "Play (Space)"}>
                        {isPlaying ? (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        )}
                    </IconBtn>

                    {/* Separator */}
                    <div className="w-[1px] h-4 bg-zinc-800 mx-1"></div>

                    {/* Undo / Redo */}
                    <IconBtn
                        onClick={() => undo()}
                        title="Undo (Meta+Z)"
                        className={pastStates.length === 0 ? 'opacity-25 cursor-not-allowed' : ''}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    </IconBtn>
                    <IconBtn
                        onClick={() => redo()}
                        title="Redo (Meta+Shift+Z)"
                        className={futureStates.length === 0 ? 'opacity-25 cursor-not-allowed' : ''}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>
                    </IconBtn>

                    {/* Separator */}
                    <div className="w-[1px] h-4 bg-zinc-800 mx-1"></div>

                    {/* Magnet Snap */}
                    <IconBtn
                        onClick={toggleMagnet}
                        title={`Magnet Snap (${isMagnetEnabled ? "On" : "Off"})`}
                        className={isMagnetEnabled ? 'text-blue-400 bg-blue-500/20 border-blue-500/50 hover:bg-blue-500/30' : 'text-zinc-500 hover:text-zinc-300'}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </IconBtn>

                    {/* Edit Tools */}
                    <IconBtn
                        onClick={() => selectedTrackId && splitTrack(selectedTrackId)}
                        title="Split (S)"
                        className={!selectedTrackId ? 'opacity-50 cursor-not-allowed' : ''}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg>
                    </IconBtn>

                    {/* Separator */}
                    <div className="w-[1px] h-4 bg-zinc-800 mx-1"></div>

                    {/* Edit Tools */}
                    <IconBtn
                        onClick={() => selectedTrackId && deleteTrack(selectedTrackId)}
                        title="Delete (Del)"
                        className={!selectedTrackId ? 'opacity-50 cursor-not-allowed hover:bg-transparent hover:text-zinc-600' : 'hover:bg-red-900/50 hover:text-red-400'}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </IconBtn>

                    {/* Time Display */}
                    <div className="ml-3 px-3 py-1 bg-zinc-900 rounded border border-zinc-800 font-mono text-xs text-blue-400 tracking-wider shadow-inner">
                        {formatTimecode(currentTime, fps)}
                    </div>
                </div>

                {/* Zoom Controls */}
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-bold mr-1">Timeline Scale</span>
                    <div className="flex items-center bg-zinc-900 rounded-lg p-0.5 border border-zinc-800">
                        <IconBtn onClick={handleZoomOut} title="Zoom Out">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                        </IconBtn>
                        <div className="w-[1px] h-4 bg-zinc-800"></div>
                        <IconBtn onClick={handleZoomIn} title="Zoom In">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        </IconBtn>
                    </div>
                </div>
            </div>

            {/* TIMELINE SURFACE */}
            <div className="flex-1 relative overflow-hidden bg-[#09090b] flex">

                {/* LEFT SIDEBAR (Track Headers) */}
                <div
                    ref={sidebarRef}
                    className="w-28 shrink-0 bg-zinc-900 border-r border-zinc-800 overflow-hidden overflow-y-auto no-scrollbar"
                    onScroll={(e) => {
                        if (timelineRef.current) {
                            timelineRef.current.setScrollTop(e.currentTarget.scrollTop);
                        }
                    }}
                >
                    {/* Header Spacer to match Ruler (Height approximated to 40px) */}
                    <div className="h-[40px] w-full bg-zinc-950 border-b border-zinc-900 sticky top-0 z-20 flex items-center justify-center border-r border-zinc-800">
                        {/* Settings / Gear Icon to indicate "Track Options" */}
                        <button
                            onClick={onOpenSettings}
                            className="w-6 h-6 flex items-center justify-center rounded bg-transparent border border-zinc-800 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors"
                            title="Project Settings"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </button>
                    </div>

                    {/* Track Headers List */}
                    <div className="flex flex-col">
                        {project.tracks.map((track, index) => (
                            <div
                                key={track.id}
                                draggable
                                onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', index.toString());
                                    e.dataTransfer.effectAllowed = 'move';
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault(); // Allow drop
                                    e.dataTransfer.dropEffect = 'move';
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
                                    const toIndex = index;
                                    if (fromIndex !== toIndex) {
                                        const newOrder = [...project.tracks];
                                        const [moved] = newOrder.splice(fromIndex, 1);
                                        newOrder.splice(toIndex, 0, moved);
                                        reorderTracks(newOrder.map(t => t.id));
                                    }
                                }}
                                className={`h-[32px] flex items-center px-1 cursor-move outline-none`}
                                onClick={() => setSelectedTrackId(track.id)}
                            >
                                {/* Inner "Floating" Card */}
                                <div className={`w-full h-[28px] flex items-center justify-between px-2 rounded-md border transition-colors ${getTrackBackground(track.type, selectedTrackId === track.id)}`}>

                                    {/* Track Controls (Left Aligned) - Individual Buttons */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {/* Lock */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleTrackLock(track.id); }}
                                            className={`w-5 h-5 flex items-center justify-center rounded bg-transparent border border-zinc-800 hover:bg-zinc-700 transition-colors ${track.locked ? 'text-amber-500 border-amber-500/30' : 'text-zinc-500 hover:text-zinc-200'}`}
                                            title={track.locked ? "Unlock" : "Lock"}
                                        >
                                            {track.locked ? (
                                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                            ) : (
                                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                                            )}
                                        </button>

                                        {/* Visibility */}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleTrackVisibility(track.id); }}
                                            className={`w-5 h-5 flex items-center justify-center rounded bg-transparent border border-zinc-800 hover:bg-zinc-700 transition-colors ${track.visible === false ? 'text-zinc-600' : 'text-zinc-500 hover:text-zinc-200'}`}
                                            title={track.visible === false ? "Show" : "Hide"}
                                        >
                                            {track.visible === false ? (
                                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                            ) : (
                                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                            )}
                                        </button>

                                        {/* Mute (Audio) OR Transition/FX (Video/Image) */}
                                        {track.type === 'audio' ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleTrackMute(track.id);
                                                }}
                                                className={`w-5 h-5 flex items-center justify-center rounded bg-transparent border border-zinc-800 hover:bg-zinc-700 transition-colors ${track.muted ? 'text-red-400 border-red-500/30' : 'text-zinc-500 hover:text-zinc-200'}`}
                                                title={track.muted ? "Unmute" : "Mute"}
                                            >
                                                {track.muted ? (
                                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                                                ) : (
                                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                                )}
                                            </button>
                                        ) : (track.type === 'image' || track.type === 'video' || track.type === 'text') ? (
                                            <div className="flex items-center gap-1 relative">
                                                {/* Transition Button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingTransitionTrackId(track.id);
                                                    }}
                                                    className={`w-5 h-5 flex items-center justify-center rounded bg-transparent border border-zinc-800 transition-all ${track.animation ? 'text-purple-400 border-purple-500/50 bg-purple-900/20' : 'text-zinc-500 hover:text-purple-300'}`}
                                                    title={track.animation ? `Transition: ${track.animation}` : "Edit Transition"}
                                                >
                                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>

                                    {/* Drag Grip (Vertical Dots) */}
                                    <div className="text-zinc-700 cursor-move flex items-center justify-center h-full px-1 hover:text-zinc-400">
                                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M8 6a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm0 6a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm0 6a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm6-12a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm0 6a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm0 6a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT TIMELINE */}
                <div className="flex-1 overflow-hidden relative">
                    <Timeline
                        ref={timelineRef}
                        style={{ width: '100%', height: '100%' }}
                        scale={scale}
                        scaleWidth={scaleWidth}
                        startLeft={10}
                        autoScroll={true}
                        enableRowDrag={true}
                        rowHeight={32} // Explicit height Sync with Sidebar

                        gridSnap={isMagnetEnabled}
                        dragLine={isMagnetEnabled}

                        // Sync Props
                        onClickTimeArea={(time: number) => {
                            const frame = Math.round(time * fps);
                            setCurrentTime(frame);
                            setSelectedTrackId(null);
                            return true;
                        }}
                        onCursorDrag={(time: number) => {
                            const frame = Math.round(time * fps);
                            setCurrentTime(frame);
                        }}
                        onClickAction={(e, { action }) => {
                            setSelectedTrackId(action.id);
                        }}
                        // Sync Scroll (Timeline -> Sidebar)
                        onScroll={({ scrollTop }) => {
                            if (sidebarRef.current) {
                                sidebarRef.current.scrollTop = scrollTop;
                            }
                        }}

                        editorData={timelineData}
                        effects={{
                            visual: { id: 'visual', name: 'Visual Layer' },
                            audio: { id: 'audio', name: 'Audio Layer' }
                        }}
                        getActionRender={(action, row) => <TimelineActionItem action={action} row={row} />}
                        // Clean row render purely for background lines
                        // @ts-ignore
                        getRowRender={(row: any) => {
                            return (
                                <div className="h-full w-full flex items-center bg-transparent">
                                    <div className={`w-full h-[28px] rounded-md border shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] ${getTrackBackground(row.type, false)}`}>
                                        {/* Optional: Grid lines or patterns here */}
                                    </div>
                                </div>
                            );
                        }}
                        onActionMoveEnd={(event: any) => {
                            const { action, row } = event;

                            // Check if moved to a different row (Reorder Intent)
                            if (row && row.id !== action.id) {
                                const fromIndex = project.tracks.findIndex(t => t.id === action.id);
                                const toIndex = project.tracks.findIndex(t => t.id === row.id);

                                if (fromIndex !== -1 && toIndex !== -1) {
                                    const newOrder = [...project.tracks];
                                    const [moved] = newOrder.splice(fromIndex, 1);
                                    newOrder.splice(toIndex, 0, moved);
                                    reorderTracks(newOrder.map(t => t.id));
                                }
                            } else {
                                // Same row, just update time
                                const startFrame = Math.round(action.start * fps);
                                const durationInFrames = Math.round((action.end - action.start) * fps);
                                updateTrack(action.id, { startFrame, durationInFrames });
                            }
                        }}
                        onActionResizeEnd={(event: any) => {
                            const action = event.action;
                            const startFrame = Math.round(action.start * fps);
                            const durationInFrames = Math.round((action.end - action.start) * fps);
                            updateTrack(action.id, { startFrame, durationInFrames });
                        }}
                        onRowDragEnd={(params: any) => {
                            const newOrderIds = params.editorData.map((row: any) => row.id);
                            reorderTracks(newOrderIds);
                        }}

                    />
                </div>
            </div>

            {/* TIMELINE FOOTER */}
            <div className="h-7 shrink-0 bg-[#09090b] border-t border-zinc-900 flex items-center justify-end px-4 gap-4 z-20">
                <div className="flex items-center gap-2">
                    <svg className="w-3 h-3 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                    <input
                        type="range"
                        min={20}
                        max={500}
                        step={10}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-32 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500"
                        title="Zoom Level"
                    />
                    <svg className="w-3 h-3 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </div>
            </div>
            {/* Transition Editor Modal */}
            {editingTransitionTrackId && (
                <TransitionEditor
                    trackId={editingTransitionTrackId}
                    onClose={() => setEditingTransitionTrackId(null)}
                />
            )}
        </div>
    );
};
