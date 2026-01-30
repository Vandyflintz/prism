import React from 'react';
import { Timeline, TimelineState } from '@xzdarcy/react-timeline-editor';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';
import { usePrismStore } from '../store/usePrismStore';

import { TimelineActionItem } from './TimelineActionItem';

export const PrismTimeline: React.FC = () => {
    const { project, updateTrack, currentTime, setCurrentTime, isPlaying, setIsPlaying } = usePrismStore();
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
                data: { label: track.type + ' ' + (track.props.content || '') },
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
    const IconBtn = ({ onClick, children, title }: { onClick?: () => void, children: React.ReactNode, title?: string }) => (
        <button
            onClick={onClick}
            title={title}
            className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all active:scale-95"
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

                    // Sync Props
                    onClickTimeArea={(time: number) => {
                        const frame = Math.round(time * fps);
                        setCurrentTime(frame);
                        return true;
                    }}
                    onCursorDrag={(time: number) => {
                        const frame = Math.round(time * fps);
                        setCurrentTime(frame);
                    }}

                    editorData={timelineData}
                    effects={{
                        visual: { id: 'visual', name: 'Visual Layer' },
                        audio: { id: 'audio', name: 'Audio Layer' }
                    }}
                    getActionRender={(action, row) => <TimelineActionItem action={action} row={row} />}
                    // @ts-ignore
                    getRowRender={(row: any) => (
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
                            <span className="truncate flex-1 font-medium text-zinc-300 group-hover:text-white transition-colors select-none" title={row.id}>
                                {row.id}
                            </span>

                            {/* Hover Actions */}
                            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-1 hover:text-white hover:bg-zinc-800 rounded"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg></button>
                                <button className="p-1 hover:text-white hover:bg-zinc-800 rounded"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                            </div>
                        </div>
                    )}
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

                />
            </div>
        </div>
    );
};
