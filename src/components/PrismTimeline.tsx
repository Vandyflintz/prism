import React from 'react';
import { Timeline, TimelineState } from '@xzdarcy/react-timeline-editor';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';
import { useStore } from 'zustand';
import { usePrismStore } from '../store/usePrismStore';

import { TimelineActionItem } from './TimelineActionItem';

export const PrismTimeline: React.FC = () => {
    const {
        project, updateTrack, currentTime, setCurrentTime, isPlaying, setIsPlaying, reorderTracks,
        toggleTrackLock, toggleTrackVisibility, toggleTrackMute, splitTrack, deleteTrack, selectedTrackId, setSelectedTrackId,
        isMagnetEnabled, toggleMagnet
    } = usePrismStore();

    // Zundo Temporal Store
    const { undo, redo, pastStates, futureStates } = useStore(usePrismStore.temporal, (state) => state);

    const timelineRef = React.useRef<TimelineState>(null);

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
                    type: track.type
                },
            }
        ],
    })), [project.tracks, fps]);

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

    const [zoom, setZoom] = React.useState(160); // Default pixels per scale unit

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 20, 500));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 20, 20));
    const togglePlay = () => setIsPlaying(!isPlaying);

    // One scale unit = 1 second
    const scale = 1;
    const scaleWidth = zoom;

    // Format timecode (HH:MM:SS:FF)
    const formatTimecode = (frame: number) => {
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
            className={`w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all active:scale-95 ${className}`}
        >
            {children}
        </button>
    );

    return (
        <div className="w-full h-full flex flex-col bg-zinc-950 border-t border-zinc-800 select-none">
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
                        className={isMagnetEnabled ? 'text-blue-400 bg-blue-900/20 hover:bg-blue-900/40 hover:text-blue-300' : ''}
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
                        {formatTimecode(currentTime)}
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
            <div className="flex-1 relative overflow-hidden bg-[#09090b]">
                <Timeline
                    ref={timelineRef}
                    style={{ width: '100%', height: '100%' }}
                    scale={scale}
                    scaleWidth={scaleWidth}
                    startLeft={20}
                    autoScroll={true}
                    enableRowDrag={true}

                    gridSnap={isMagnetEnabled}
                    dragLine={isMagnetEnabled}

                    // Sync Props
                    onClickTimeArea={(time: number) => {
                        const frame = Math.round(time * fps);
                        setCurrentTime(frame);
                        setSelectedTrackId(null); // Deselect on click empty area
                        return true;
                    }}
                    onCursorDrag={(time: number) => {
                        const frame = Math.round(time * fps);
                        setCurrentTime(frame);
                    }}
                    onClickAction={(e, { action }) => {
                        setSelectedTrackId(action.id);
                    }}

                    editorData={timelineData}
                    effects={{
                        visual: { id: 'visual', name: 'Visual Layer' },
                        audio: { id: 'audio', name: 'Audio Layer' }
                    }}
                    getActionRender={(action, row) => <TimelineActionItem action={action} row={row} />}
                    // @ts-ignore
                    getRowRender={(row: any) => {
                        const track = project.tracks.find(t => t.id === row.id);
                        if (!track) return null;

                        return (
                            <div className="h-full w-full flex items-center px-4 text-xs font-medium text-zinc-400 border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors group relative">
                                {/* Track Colored Indicator */}
                                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${row.type === 'audio' ? 'bg-emerald-500/50' :
                                    row.type === 'text' ? 'bg-violet-500/50' :
                                        row.type === 'image' ? 'bg-blue-500/50' : 'bg-zinc-500/50'
                                    }`} />

                                {/* Icon */}
                                <div className="w-6 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                                    {getIcon(row.type)}
                                </div>

                                {/* Name */}
                                <span className="truncate flex-1 font-medium text-zinc-300 group-hover:text-white transition-colors select-none mr-2" title={row.id}>
                                    {row.id}
                                </span>

                                {/* Track Controls (Hover or Active) */}
                                <div className={`flex items-center space-x-1 ${track.locked || track.visible === false || track.muted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                    {/* Mute (Audio Only) */}
                                    {track.type === 'audio' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); toggleTrackMute(track.id); }}
                                            className={`p-1 rounded hover:bg-zinc-800 ${track.muted ? 'text-red-400' : 'text-zinc-500 hover:text-white'}`}
                                            title={track.muted ? "Unmute" : "Mute"}
                                        >
                                            {track.muted ? (
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                                            ) : (
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                            )}
                                        </button>
                                    )}

                                    {/* Visibility */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleTrackVisibility(track.id); }}
                                        className={`p-1 rounded hover:bg-zinc-800 ${track.visible === false ? 'text-zinc-600' : 'text-zinc-500 hover:text-white'}`}
                                        title={track.visible === false ? "Show" : "Hide"}
                                    >
                                        {track.visible === false ? (
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                                        ) : (
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        )}
                                    </button>

                                    {/* Lock */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleTrackLock(track.id); }}
                                        className={`p-1 rounded hover:bg-zinc-800 ${track.locked ? 'text-amber-500' : 'text-zinc-500 hover:text-white'}`}
                                        title={track.locked ? "Unlock" : "Lock"}
                                    >
                                        {track.locked ? (
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                        ) : (
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    }}
                    onActionMoveEnd={(event: any) => {
                        const action = event.action;
                        const startFrame = Math.round(action.start * fps);
                        const durationInFrames = Math.round((action.end - action.start) * fps);
                        updateTrack(action.id, { startFrame, durationInFrames });
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
    );
};
