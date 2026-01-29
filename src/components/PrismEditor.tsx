'use client';

import React, { useEffect } from 'react';
import { Player } from '@remotion/player';
import { PrismComposition } from './PrismComposition';
import { PrismTimeline } from './PrismTimeline';
import { usePrismStore } from '../store/usePrismStore';
import { PrismProject } from '../../types/prism';

const MOCK_PROJECT: PrismProject = {
    id: 'mock-1',
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 300,
    assets: {},
    tracks: [
        {
            id: 'track-bg',
            type: 'shape', // Fallback
            startFrame: 0,
            durationInFrames: 300,
            props: {
                x: 0, y: 0, width: 1080, height: 1920,
                opacity: 1, rotation: 0, scale: 1,
                backgroundColor: '#f0f0f0'
            }
        },
        {
            id: 'track-1',
            type: 'text',
            startFrame: 0,
            durationInFrames: 150,
            props: {
                x: 100, y: 300, width: 880, height: 200,
                opacity: 1, rotation: 0, scale: 1,
                content: 'Hello Prism', fontSize: 100, color: '#000000',
                textAlign: 'center'
            }
        },
        {
            id: 'track-2',
            type: 'text',
            startFrame: 45,
            durationInFrames: 200,
            props: {
                x: 100, y: 600, width: 880, height: 200,
                opacity: 1, rotation: -5, scale: 1,
                content: 'Edit Me in Browser', fontSize: 70, color: '#ff0055',
                textAlign: 'center'
            }
        }
    ]
};

import { PropertySidebar } from './PropertySidebar';

// ... (keep default function signature)

export default function PrismEditor() {
    const { project, setProject } = usePrismStore();

    useEffect(() => {
        if (!project) {
            setProject(MOCK_PROJECT);
        }
    }, [setProject]); // Only run on mount/project missing

    const loadSample = async () => {
        try {
            const res = await fetch('/sample-project.json');
            const data = await res.json();
            setProject(data);
        } catch (e) {
            console.error(e);
            alert('Failed to load sample project');
        }
    };

    if (!project) return <div className="text-white p-10">Loading Editor...</div>;

    return (
        <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Top Half: Player */}
                <div className="flex-1 flex flex-col justify-center items-center p-4 bg-gray-800 border-b border-gray-700 relative">
                    <div className="absolute top-4 left-4 flex gap-2">
                        <h1 className="text-xl font-bold">Prism Video Editor</h1>
                        <button
                            onClick={loadSample}
                            className="bg-blue-600 px-3 py-1 rounded text-xs hover:bg-blue-500"
                        >
                            Load Sample
                        </button>
                    </div>

                    <div className="shadow-2xl border-4 border-gray-900 rounded-lg overflow-hidden">
                        <Player
                            component={PrismComposition}
                            inputProps={{ project }}
                            durationInFrames={project.durationInFrames}
                            fps={project.fps}
                            compositionWidth={project.width}
                            compositionHeight={project.height}
                            style={{
                                width: '360px',
                                height: '640px',
                            }}
                            controls
                            autoPlay
                            loop
                        />
                    </div>
                </div>

                {/* Bottom Half: Timeline */}
                <div className="h-80 bg-gray-900 border-t border-gray-700 flex flex-col">
                    <div className="p-2 text-sm text-gray-400 bg-gray-900 border-b border-gray-800">Timeline</div>
                    <div className="flex-1 overflow-y-auto">
                        <PrismTimeline />
                    </div>
                </div>
            </div>

            {/* Sidebar */}
            <PropertySidebar />
        </div>
    );
}
