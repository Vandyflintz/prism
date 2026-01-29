import React from 'react';
import { Timeline } from '@xzdarcy/react-timeline-editor';
import { usePrismStore } from '../store/usePrismStore';

export const PrismTimeline: React.FC = () => {
    const { project, updateTrack } = usePrismStore();

    if (!project) return <div className="p-4 text-white">No Project Loaded</div>;

    const fps = project.fps || 30;

    // Transform Prism Tracks to Timeline Rows
    // Use any cast if types are not found (due to install issues or library version)
    const timelineData: any[] = project.tracks.map((track) => ({
        id: track.id,
        actions: [
            {
                id: track.id,
                start: track.startFrame / fps,
                end: (track.startFrame + track.durationInFrames) / fps,
                effectId: track.type === 'audio' ? 'audio' : 'visual',
                data: { label: track.type + ' ' + (track.props.content || '') }
            }
        ],
    }));

    return (
        <div className="w-full h-64 bg-gray-900 border-t border-gray-700">
            <Timeline
                editorData={timelineData}
                effects={{
                    visual: {
                        id: 'visual', // id must match effectId
                        name: 'Visual Layer',
                    },
                    audio: {
                        id: 'audio',
                        name: 'Audio Layer',
                    }
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
                // onClickAction prop might differ, removing for now and relying on sidebar interaction or finding correct prop
                // onActionClick={(_e: any, action: any) => setSelectedTrackId(action.id)}
                autoScroll={true}
            />
        </div>
    );
};
