'use client';

import React, { useEffect } from 'react';
import { Player } from '@remotion/player';
import { PrismComposition } from './PrismComposition';
import { PrismTimeline } from './PrismTimeline';
import { usePrismStore } from '../store/usePrismStore';
import { PrismProject } from '../../types/prism';
import { PropertySidebar } from './PropertySidebar';
import { parsePsd } from '../../lib/psd-to-json';

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

export default function PrismEditor() {
    const { project, setProject } = usePrismStore();

    useEffect(() => {
        if (!project) setProject(MOCK_PROJECT);
    }, [setProject, project]);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const openFile = async () => {
        if (window.electron) {
            try {
                const filePath = await window.electron.openFile();
                if (!filePath) return;

                const buffer = await window.electron.readFile(filePath);
                const projectData = await parsePsd(buffer);
                setProject(projectData);
            } catch (e) {
                console.error(e);
                alert('Failed to parse PSD file.');
            }
        } else {
            // Browser Fallback
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = new Uint8Array(arrayBuffer);
            const projectData = await parsePsd(buffer);
            setProject(projectData);
        } catch (err) {
            console.error(err);
            alert('Failed to parse PSD file.');
        }

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

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

    if (!project) return <div className="text-zinc-400 p-10 flex items-center justify-center h-screen bg-zinc-950">Loading Prism...</div>;

    return (
        <div className="flex flex-col h-screen bg-zinc-950 text-zinc-200 overflow-hidden font-sans">

            {/* Header / Toolbar */}
            <header className="h-14 flex items-center justify-between px-6 border-b border-zinc-800 glass z-50">
                <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    </div>
                    <span className="font-bold text-lg tracking-tight text-white">Prism</span>
                </div>

                <div className="flex items-center gap-3">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept=".psd"
                    />
                    <button
                        onClick={openFile}
                        className="text-xs font-medium px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700 text-zinc-300"
                    >
                        Open PSD
                    </button>
                    <button
                        onClick={loadSample}
                        className="text-xs font-medium px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors border border-zinc-700 text-zinc-300"
                    >
                        Load Sample
                    </button>
                    <button className="text-xs font-medium px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500 transition-colors text-white shadow-lg shadow-indigo-500/20">
                        Export Video
                    </button>
                </div>
            </header>

            {/* Main Content Grid */}
            <div className="flex flex-1 overflow-hidden">

                {/* Left/Center: Canvas & Timeline */}
                <div className="flex-1 flex flex-col min-w-0 relative">

                    {/* Viewport Area */}
                    <div className="flex-1 bg-grid-dots relative flex flex-col items-center justify-center p-8 overflow-hidden">
                        <div className="relative shadow-2xl shadow-black/50 rounded-lg overflow-hidden ring-1 ring-zinc-800/50">
                            <Player
                                component={PrismComposition}
                                inputProps={{ project }}
                                durationInFrames={project.durationInFrames}
                                fps={project.fps}
                                compositionWidth={project.width}
                                compositionHeight={project.height}
                                style={{
                                    width: '360px', // Scaling could be dynamic later
                                    height: '640px',
                                }}
                                controls
                                autoPlay
                                loop
                            />
                        </div>
                        <div className="absolute bottom-4 right-4 text-xs text-zinc-500 font-mono">
                            {project.width}x{project.height} @ {project.fps}fps
                        </div>
                    </div>

                    {/* Timeline Area (Bottom) */}
                    <div className="h-[45vh] bg-zinc-950 border-t border-zinc-800 flex flex-col z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
                        <div className="h-9 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Timeline</span>
                                <div className="h-4 w-[1px] bg-zinc-700"></div>
                                <div className="flex gap-2">
                                    <button className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition">Split</button>
                                    <button className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded transition">Snap</button>
                                </div>
                            </div>
                            <span className="text-[10px] text-zinc-600 font-mono">00:00:00:00</span>
                        </div>
                        <div className="flex-1 w-full overflow-hidden relative">
                            <PrismTimeline />
                        </div>
                    </div>

                </div>

                {/* Right: Property Inspector */}
                <PropertySidebar />

            </div>
        </div>
    );
}
