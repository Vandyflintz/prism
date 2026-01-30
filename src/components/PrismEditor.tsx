'use client';

import React, { useEffect } from 'react';
import { Player, PlayerRef } from '@remotion/player';
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
    const { project, setProject, currentTime, isPlaying, setCurrentTime } = usePrismStore();
    // Use state instead of ref to ensure we react when the player is mounted/ready
    const [player, setPlayer] = React.useState<PlayerRef | null>(null);

    useEffect(() => {
        if (!project) setProject(MOCK_PROJECT);
    }, [setProject, project]);

    // Sync Playback State
    useEffect(() => {
        if (player) {
            if (isPlaying) {
                if (!player.isPlaying()) {
                    player.play();
                }
            } else {
                if (player.isPlaying()) {
                    player.pause();
                }
            }
        }
    }, [isPlaying, player]);

    // Sync Seek / Scrub (One-way: Store -> Player)
    useEffect(() => {
        if (player) {
            const currentFrame = player.getCurrentFrame();
            if (Math.abs(currentFrame - currentTime) > 1) {
                player.seekTo(currentTime);
            }
        }
    }, [currentTime, player]);

    // Sync Frame Updates (Player -> Store)
    useEffect(() => {
        if (!player) return;

        const onFrame = (e: { detail: { frame: number } }) => {
            // console.log('frameupdate', e.detail.frame);
            setCurrentTime(e.detail.frame);
        };

        console.log('Adding frameupdate listener to player');
        player.addEventListener('frameupdate', onFrame);
        return () => {
            player.removeEventListener('frameupdate', onFrame);
        };
    }, [player, setCurrentTime]);

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

    if (!project) return <div className="text-zinc-500 flex items-center justify-center h-screen bg-[#09090b] text-xs font-mono">INITIALIZING PRISM ENGINE...</div>;

    return (
        <div className="flex flex-col h-screen bg-[#09090b] text-zinc-200 overflow-hidden font-sans selection:bg-indigo-500/30">

            {/* Application Header */}
            <header className="h-10 grow-0 shrink-0 flex items-center justify-between px-3 border-b border-zinc-900 bg-[#09090b] select-none">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-zinc-100 font-bold tracking-tight">
                        <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 19h20L12 2zm0 3.8l6.8 11.2H5.2L12 5.8z" /></svg>
                        <span className="text-sm">Prism</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium ml-1">BETA</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".psd" />

                    <div className="flex items-center bg-zinc-900 rounded-md p-0.5 border border-zinc-800">
                        <button onClick={openFile} className="px-3 py-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors">
                            Open PSD
                        </button>
                        <div className="w-[1px] h-3 bg-zinc-800 mx-1"></div>
                        <button onClick={loadSample} className="px-3 py-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded transition-colors">
                            Load Sample
                        </button>
                    </div>

                    <button className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow-sm shadow-indigo-500/20 transition-all active:scale-95 ml-2">
                        <span>Export</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </button>
                </div>
            </header>

            {/* Workspace Grid */}
            <div className="flex-1 flex overflow-hidden">

                {/* Left/Center Column */}
                <div className="flex-1 flex flex-col min-w-0">

                    {/* Canvas / Stage Area */}
                    <div className="flex-1 bg-[#09090b] relative flex items-center justify-center overflow-hidden">
                        {/* Dot Grid Background (Using CSS class or inline SVG) */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
                            backgroundImage: 'radial-gradient(circle, #3f3f46 1px, transparent 1px)',
                            backgroundSize: '24px 24px'
                        }}></div>

                        {/* Player Container */}
                        <div className="relative shadow-2xl shadow-black rounded-sm overflow-hidden ring-1 ring-zinc-800 bg-black">
                            <Player
                                ref={setPlayer}
                                component={PrismComposition}
                                inputProps={{ project }}
                                durationInFrames={Math.max(1, project.durationInFrames)}
                                fps={project.fps}
                                compositionWidth={project.width}
                                compositionHeight={project.height}
                                style={{
                                    width: '360px',
                                    height: '640px',
                                }}
                                loop
                                doubleClickToFullscreen
                            />
                        </div>

                        {/* Stage Info Overlay */}
                        <div className="absolute bottom-2 right-3 text-[10px] text-zinc-600 font-mono flex gap-2 pointer-events-none select-none">
                            <span>{project.width}x{project.height}</span>
                            <span className="text-zinc-700">|</span>
                            <span>{project.fps} FPS</span>
                        </div>
                    </div>

                    {/* Timeline Panel */}
                    <div className="h-[320px] shrink-0 border-t border-zinc-800 bg-[#09090b] flex flex-col z-10">
                        {/* Top Accent Line */}
                        <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-zinc-800 to-transparent opacity-50"></div>
                        <PrismTimeline />
                    </div>

                </div>

                {/* Right Column: Inspector */}
                <PropertySidebar />

            </div>
        </div>
    );
}
