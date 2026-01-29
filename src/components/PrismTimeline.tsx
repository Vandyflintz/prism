import React from 'react';
import { Timeline } from '@xzdarcy/react-timeline-editor';
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css';
import '../app/timeline.css';
import { usePrismStore } from '../store/usePrismStore';

import { TimelineActionItem } from './TimelineActionItem';

export const PrismTimeline: React.FC = () => {
    const { project, updateTrack } = usePrismStore();

    if (!project) return <div className="p-4 text-zinc-500">No Project Loaded</div>;

    const fps = project.fps || 30;

    const timelineData: any[] = project.tracks.map((track) => ({
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
    }));

    // Helper for Row Header Icons
    const getIcon = (type: string) => {
        switch (type) {
            case 'audio': return <span className="text-emerald-400 mr-2">🎵</span>;
            case 'text': return <span className="text-violet-400 mr-2">T</span>;
            case 'image': return <span className="text-blue-400 mr-2">🖼️</span>;
            case 'shape': return <span className="text-gray-400 mr-2">⏹️</span>;
            default: return <span className="text-gray-400 mr-2">📄</span>;
        }
    }

    return (
        <div className="w-full h-full bg-zinc-950">
            <Timeline
                editorData={timelineData}
                effects={{
                    visual: { id: 'visual', name: 'Visual Layer' },
                    audio: { id: 'audio', name: 'Audio Layer' }
                }}
                getActionRender={(action, row) => <TimelineActionItem action={action} row={row} />}
                // @ts-ignore
                getRowRender={(row: any) => (
                    <div className="h-full w-full flex items-center px-4 text-xs font-medium text-zinc-300 border-b border-zinc-800/50 hover:bg-zinc-900/50 transition-colors">
                        {getIcon(row.type)}
                        <span className="truncate" title={row.id}>{row.id}</span>
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
                autoScroll={true}
            />
        </div>
    );
};
