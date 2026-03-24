'use client';

import React, { useEffect } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { PrismComposition } from './PrismComposition';
import { PrismTimeline } from './PrismTimeline';
import { usePrismStore } from '../store/usePrismStore';
import { PrismProject } from '../../types/prism';
import { PropertySidebar } from './PropertySidebar';
import { parsePsd, getLayersFromPsd, getPsdPreview } from '../../lib/psd-to-json';
import { TimelineSettingsModal } from './TimelineSettingsModal';
import { ResourcePanel } from './ResourcePanel';
import { ExportModal } from './ExportModal';
import { AssetStorage } from '../lib/AssetStorage';
import { TtsGenerator } from './TtsGenerator';
import { AutoCaptionsModal } from './AutoCaptionsModal';


// Removed MOCK_PROJECT boilerplate
const BLANK_PROJECT: PrismProject = {
    id: 'default-project',
    width: 1080,
    height: 1920,
    fps: 30,
    durationInFrames: 300,
    assets: {},
    tracks: []
};

export const PrismEditor: React.FC = () => {
    const {
        project, assets, setProject, isPlaying, setIsPlaying, setCurrentTime,
        isLoopingEnabled, hydrateAssets
    } = usePrismStore();

    const [isRestoring, setIsRestoring] = React.useState(true);

    // Hydrate Assets on Mount
    useEffect(() => {
        const loadAssets = async () => {
            try {
                await AssetStorage.init();
                const stored = await AssetStorage.getAllAssets();

                const hydratedAssets = await Promise.all(stored.map(async (s) => {
                    const asset = { ...s.asset };

                    // Create URL for the main asset file
                    if (s.blob) {
                        asset.src = URL.createObjectURL(s.blob);

                        // Re-parse PSDs to get fresh Layer Blob URLs
                        if (asset.type === 'psd') {
                            try {
                                const buffer = await s.blob.arrayBuffer();
                                const [layers, psdProject, previewUrl] = await Promise.all([
                                    getLayersFromPsd(buffer),
                                    parsePsd(buffer),
                                    getPsdPreview(buffer)
                                ]);

                                // Update metadata with fresh URLs
                                asset.metadata = {
                                    ...asset.metadata,
                                    layers,
                                    psdProject,
                                };
                                // Update Preview URL if available
                                if (previewUrl) asset.src = previewUrl;

                            } catch (err) {
                                console.error("Failed to re-hydrate PSD:", asset.id, err);
                            }
                        }
                    }
                    return asset;
                }));

                if (hydratedAssets.length > 0) {
                    hydrateAssets(hydratedAssets);
                }
            } catch (e) {
                console.error("Failed to load persistent assets:", e);
            } finally {
                // Minimum splash time to prevent flicker
                setTimeout(() => setIsRestoring(false), 800);
            }
        };
        loadAssets();
    }, []);

    // Use state instead of ref to ensure we react when the player is mounted/ready
    const [player, setPlayer] = React.useState<PlayerRef | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
    const [showLeftPanel, setShowLeftPanel] = React.useState(true);
    const [showRightPanel, setShowRightPanel] = React.useState(true);
    const [showTimeline, setShowTimeline] = React.useState(true);

    const [leftPanelWidth, setLeftPanelWidth] = React.useState(280);
    const [rightPanelWidth, setRightPanelWidth] = React.useState(320);
    const [timelineHeight, setTimelineHeight] = React.useState(320);

    const handleOpenSettings = React.useCallback(() => {
        setIsSettingsOpen(true);
    }, []);
    
    // Resize states
    const [isDraggingLeft, setIsDraggingLeft] = React.useState(false);
    const [isDraggingRight, setIsDraggingRight] = React.useState(false);
    const [isDraggingBottom, setIsDraggingBottom] = React.useState(false);

    const handleLeftResizeDown = (e: React.PointerEvent) => {
        e.preventDefault();
        setIsDraggingLeft(true);
        const startX = e.clientX;
        const startWidth = leftPanelWidth;
        const onMove = (me: PointerEvent) => {
            setLeftPanelWidth(Math.max(200, Math.min(600, startWidth + (me.clientX - startX))));
        };
        const onUp = () => {
            setIsDraggingLeft(false);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            // Save after drag finishes
            setLeftPanelWidth(val => { localStorage.setItem('prism:leftWidth', val.toString()); return val; });
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    const handleRightResizeDown = (e: React.PointerEvent) => {
        e.preventDefault();
        setIsDraggingRight(true);
        const startX = e.clientX;
        const startWidth = rightPanelWidth;
        const onMove = (me: PointerEvent) => {
            setRightPanelWidth(Math.max(240, Math.min(800, startWidth - (me.clientX - startX))));
        };
        const onUp = () => {
            setIsDraggingRight(false);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            // Save after drag finishes
            setRightPanelWidth(val => { localStorage.setItem('prism:rightWidth', val.toString()); return val; });
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    const handleBottomResizeDown = (e: React.PointerEvent) => {
        e.preventDefault();
        setIsDraggingBottom(true);
        const startY = e.clientY;
        const startHeight = timelineHeight;
        const onMove = (me: PointerEvent) => {
            setTimelineHeight(Math.max(100, Math.min(800, startHeight + (startY - me.clientY))));
        };
        const onUp = () => {
            setIsDraggingBottom(false);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            // Save after drag finishes
            setTimelineHeight(val => { localStorage.setItem('prism:timelineHeight', val.toString()); return val; });
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    // Restore widths on mount
    React.useEffect(() => {
        const savedLeft = localStorage.getItem('prism:leftWidth');
        if (savedLeft) setLeftPanelWidth(parseInt(savedLeft, 10));
        const savedRight = localStorage.getItem('prism:rightWidth');
        if (savedRight) setRightPanelWidth(parseInt(savedRight, 10));
        const savedBottom = localStorage.getItem('prism:timelineHeight');
        if (savedBottom) setTimelineHeight(parseInt(savedBottom, 10));

        const savedShowLeft = localStorage.getItem('prism:showLeft');
        if (savedShowLeft) setShowLeftPanel(savedShowLeft === 'true');
        const savedShowRight = localStorage.getItem('prism:showRight');
        if (savedShowRight) setShowRightPanel(savedShowRight === 'true');
        const savedShowTimeline = localStorage.getItem('prism:showTimeline');
        if (savedShowTimeline) setShowTimeline(savedShowTimeline === 'true');
    }, []);

    // Export State
    const [isExportModalOpen, setIsExportModalOpen] = React.useState(false);
    const [exportProgress, setExportProgress] = React.useState(0);
    const [exportStatus, setExportStatus] = React.useState<'idle' | 'rendering' | 'done' | 'error'>('idle');
    const [exportOutput, setExportOutput] = React.useState('');

    // STT State
    const [isAutoCaptionsModalOpen, setIsAutoCaptionsModalOpen] = React.useState(false);

    // Persistence State
    const [currentFilePath, setCurrentFilePath] = React.useState<string | null>(null);

    const stageAssetsForPersistence = async (currentAssets: Record<string, any>) => {
        const stagedAssets: Record<string, any> = {};
        const assetIds = Object.keys(currentAssets);

        for (const id of assetIds) {
            const asset = currentAssets[id];
            const stagedAsset = { ...asset };

            if (asset.src.startsWith('blob:') || asset.src.startsWith('http')) {
                try {
                    const response = await fetch(asset.src);
                    const blob = await response.blob();
                    const buffer = await blob.arrayBuffer();
                    const ext = asset.type === 'video' ? 'mp4' : asset.type === 'audio' ? 'mp3' : 'png';
                    const filename = `${id}.${ext}`;
                    const tempPath = await window.electron.saveTempFile(filename, buffer);
                    stagedAsset.src = `file://${tempPath}`;
                } catch (err) {
                    console.error(`[Persistence] Failed to stage asset ${id}`, err);
                }
            }
            stagedAssets[id] = stagedAsset;
        }
        return stagedAssets;
    };

    const handleSaveProject = React.useCallback(async (saveAs: boolean) => {
        if (!window.electron) return;
        try {
            const state = usePrismStore.getState();
            const stagedAssets = await stageAssetsForPersistence(state.assets);

            // Use the ref-tracked currentFilePath or pass it in? 
            // We can't access 'currentFilePath' state inside useCallback easily without dep.
            // Actually we can use a ref for currentFilePath or just let it depend on it.
            // If we depend on currentFilePath, it updates when path changes (rare).
            // But 'project' and 'assets' change often. Using getState() solves that.

            // Wait, we need the CURRENT file path state.
            // Let's rely on the arguments or state.
            // Since we need to read 'currentFilePath' which is local state, we should add it to deps
            // OR use a ref for it.

            const savedPath = await window.electron.saveProject(
                { project: state.project, assets: stagedAssets },
                saveAs ? null : currentFilePathRef.current
            );

            if (savedPath) {
                setCurrentFilePath(savedPath);
                currentFilePathRef.current = savedPath; // Update ref
                alert('Project saved!');
            }
        } catch (e) {
            console.error(e);
            alert('Failed to save project.');
        }
    }, []); // Empty deps because we use getState() and refs

    // We need a ref for currentFilePath to avoid re-creating handleSaveProject
    const currentFilePathRef = React.useRef<string | null>(null);
    useEffect(() => { currentFilePathRef.current = currentFilePath; }, [currentFilePath]);

    const handleOpenProject = React.useCallback(async () => {
        if (!window.electron) return;
        try {
            const result = await window.electron.openProject();
            if (result) {
                const { filePath, data } = result;
                setProject(data.project);
                // @ts-ignore
                if (data.assets) hydrateAssets(Object.values(data.assets));
                setCurrentFilePath(filePath);
                currentFilePathRef.current = filePath;
            }
        } catch (e) {
            console.error(e);
            alert('Failed to open project.');
        }
    }, [setProject, hydrateAssets]);

    // Export Handler
    const handleExport = React.useCallback(async () => {
        if (!window.electron) {
            alert("Export is only available in the desktop app.");
            return;
        }

        setIsExportModalOpen(true);
        setExportStatus('rendering');
        setExportProgress(0);
        setExportOutput('');

        try {
            // 1. STAGE ASSETS (Fixes Blob URL issue in Render Process)
            // We need to convert all Blob URL assets to physical temp files that the Node.js renderer can access.
            const stagedAssets: Record<string, any> = {};

            console.log("Preparing export assets (Debug Mode)...");

            // Process all assets in the project
            // Use current state assets
            const currentAssets = usePrismStore.getState().assets;
            const assetIds = Object.keys(currentAssets);

            for (const id of assetIds) {
                const asset = currentAssets[id];
                const stagedAsset = { ...asset };

                // If it's a blob URL
                if (asset.src.startsWith('blob:') || asset.src.startsWith('http')) {
                    console.log(`Staging asset: ${id} (${asset.type})`);
                    try {
                        // FETCH BLOB DIRECTLY
                        const response = await fetch(asset.src);
                        const blob = await response.blob();
                        const buffer = await blob.arrayBuffer();

                        const ext = asset.type === 'video' ? 'mp4' : asset.type === 'audio' ? 'mp3' : 'png';
                        const filename = `${id}.${ext}`;

                        // Save to Temp via IPC
                        const tempPath = await window.electron.saveTempFile(filename, buffer);

                        // Update asset src to file:// path
                        stagedAsset.src = `file://${tempPath}`;
                        console.log(`-> Saved to: ${tempPath}`);
                    } catch (err) {
                        console.error(`[Export] Failed to stage asset ${id}`, err);
                    }
                }

                stagedAssets[id] = stagedAsset;
            }

            // 2. RENDER
            // Pass the modified assets map
            const currentProject = usePrismStore.getState().project;
            const output = await window.electron.renderComposition({
                project: currentProject,
                assets: stagedAssets
            });

            setExportStatus('done');
            setExportOutput(output);
        } catch (error: any) {
            console.error("Export failed:", error);
            setExportStatus('error');
            setExportOutput(error.message || "Unknown error");
        }
    }, []);



    // Listen for Progress
    useEffect(() => {
        if (!window.electron) return;

        // Assuming preload exposes 'on' which returns a cleanup function or we wrap it
        // Check preload.ts if unsure, but standard pattern is:
        const removeListener = window.electron.onRenderProgress((progress: number) => {
            setExportProgress(progress);
        });

        // If 'on' doesn't return cleanup, we might need a specific 'off'
        // For now assuming the standard custom preload I usually see in these projects.
        return () => {
            removeListener();
        };
    }, []);

    // Auto-initialize a blank project if none exists after restoration
    useEffect(() => {
        if (!project && !isRestoring) {
            setProject(BLANK_PROJECT);
        }
    }, [project, isRestoring, setProject]);

    // Sync Playback State (Manual -> Player)
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

    // Track Player Events (Player -> Store)
    useEffect(() => {
        if (!player) return;
        
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        
        player.addEventListener('play', onPlay);
        player.addEventListener('pause', onPause);
        
        return () => {
            player.removeEventListener('play', onPlay);
            player.removeEventListener('pause', onPause);
        };
    }, [player, setIsPlaying]);

    // Sync Seek / Scrub (Store -> Player)
    const lastPlayerFrame = React.useRef<number>(-1);
    const lastSeekTime = React.useRef<number>(0);

    useEffect(() => {
        const unsubscribe = usePrismStore.subscribe((state) => {
            if (player) {
                const time = state.currentTime;
                
                // 1. If we are playing, the Player is the source of truth.
                // We should ONLY seek if there's a MASSIVE discrepancy (e.g. user clicked the timeline far away),
                // or if we are paused and dragging.
                if (time === lastPlayerFrame.current) return;

                const currentPlayerFrame = player.getCurrentFrame();
                const diff = Math.abs(currentPlayerFrame - time);

                // Throttling: Don't seek more than once every 50ms to avoid overloading the media engine
                const now = Date.now();
                if (now - lastSeekTime.current < 50) return;

                if (state.isPlaying) {
                    // During playback, only seek if the jump is > 1.5 seconds (45 frames @ 30fps)
                    // This allows manual timeline clicks to still work while playing,
                    // but prevents minor store lag from snapping the player backward.
                    if (diff > 45) {
                        lastSeekTime.current = now;
                        player.seekTo(time);
                    }
                } else {
                    // When paused (Scrubbing), be much more responsive (2 frame threshold)
                    if (diff > 2) {
                        lastSeekTime.current = now;
                        player.seekTo(time);
                    }
                }
            }
        });
        return unsubscribe;
    }, [player]);

    // Sync Frame Updates from Player (Player -> Store)
    useEffect(() => {
        if (!player) return;

        const onFrame = (e: { detail: { frame: number } }) => {
            const frame = e.detail.frame;
            lastPlayerFrame.current = frame; 
            setCurrentTime(frame);
        };

        player.addEventListener('frameupdate', onFrame);
        return () => {
            player.removeEventListener('frameupdate', onFrame);
        };
    }, [player, setCurrentTime]);

    // Memoize inputProps at top level to avoid Rules of Hooks violation in conditional block
    const memoizedInputProps = React.useMemo(() => ({ 
        project: project as PrismProject, // Cast because Player is only rendered when project exists
        assets 
    }), [project, assets]);

    const [zoomLevel, setZoomLevel] = React.useState<number>(0); // 0 = Fit

    // Responsive Player Scaling Hooks
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 });

    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerSize({
                    width: entry.contentRect.width,
                    height: entry.contentRect.height
                });
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [project]); // Re-run when project loads to catch the mount event after loading screen is gone

    const playerStyle = React.useMemo(() => {
        if (!project) return { width: 1920, height: 1080, scale: 1, fitScale: 1 };

        let finalScale = 1;
        let fitScale = 1;

        if (containerSize.width > 0 && containerSize.height > 0) {
            const padding = 68; // CSS uses p-8 = 64px total padding (32px each side) + 4px mathematical buffer
            const availableW = Math.max(10, containerSize.width - padding);
            const availableH = Math.max(10, containerSize.height - padding);
            const scaleW = availableW / project.width;
            const scaleH = availableH / project.height;
            fitScale = Math.min(scaleW, scaleH);
        } else {
            fitScale = 0.1; // Default to a tiny scale if no dimensions yet, to prevent sudden huge overflow
        }

        if (zoomLevel > 0) {
            finalScale = zoomLevel;
        } else {
            finalScale = fitScale;
        }

        return {
            width: project.width * finalScale,
            height: project.height * finalScale,
            scale: finalScale,
            fitScale
        };
    }, [project, containerSize, zoomLevel]);

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const importPsd = async () => {
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



    useEffect(() => {
        if (window.electron) {
            const unsub = window.electron.onMenuAction((action) => {
                console.log(`[Menu] ${action}`);
                switch (action) {
                    case 'menu:open-project':
                        handleOpenProject();
                        break;
                    case 'menu:save-project':
                        handleSaveProject(false);
                        break;
                    case 'menu:save-project-as':
                        handleSaveProject(true);
                        break;
                    case 'menu:import-psd':
                        importPsd();
                        break;
                    case 'menu:toggle-left-panel':
                        setShowLeftPanel(prev => !prev);
                        break;
                    case 'menu:toggle-right-panel':
                        setShowRightPanel(prev => !prev);
                        break;
                    case 'menu:export-video':
                        handleExport();
                        break;
                    case 'menu:undo':
                        // @ts-ignore
                        usePrismStore.temporal?.getState().undo();
                        break;
                    case 'menu:redo':
                        // @ts-ignore
                        usePrismStore.temporal?.getState().redo();
                        break;
                    case 'menu:split-track':
                        const selectedId = usePrismStore.getState().selectedTrackId;
                        if (selectedId) usePrismStore.getState().splitTrack(selectedId);
                        break;
                    case 'menu:align-tracks':
                        usePrismStore.getState().alignTracksToStart();
                        break;
                    case 'menu:clear-timeline':
                        if (confirm('Clear entire timeline?')) {
                            usePrismStore.getState().clearTimeline();
                        }
                        break;
                    case 'menu:reset-project':
                        if (confirm('Reset project settings and timeline?')) {
                            usePrismStore.getState().resetProject();
                        }
                        break;
                    // case 'menu:shortcuts': Handled in page.tsx now
                    //    break;
                }
            });
            return () => unsub();
        }
    }, [handleExport, importPsd, handleSaveProject, handleOpenProject]);
    const [isFullscreen, setIsFullscreen] = React.useState(false);

    React.useEffect(() => {
        if (window.electron?.onFullscreenChange) {
            return window.electron.onFullscreenChange(setIsFullscreen);
        }
    }, []);

    const [showZoomOverlay, setShowZoomOverlay] = React.useState(true);
    const zoomTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleCanvasPointerMove = React.useCallback(() => {
        setShowZoomOverlay(true);
        if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
        zoomTimeoutRef.current = setTimeout(() => {
            setShowZoomOverlay(false);
        }, 1500);
    }, []);

    React.useEffect(() => {
        return () => {
             if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
        };
    }, []);

    if (!project || isRestoring) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#09090b] text-zinc-400 font-mono gap-4">
                <div className="w-8 h-8 pointer-events-none border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                <div className="text-xs animate-pulse tracking-widest uppercase">{isRestoring ? 'RESTORING ASSETS...' : 'INITIALIZING PRISM...'}</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-[#09090b] text-zinc-200 overflow-hidden font-sans selection:bg-indigo-500/30">

            {/* Application Header */}
            <header 
                className={`h-10 grow-0 shrink-0 flex items-center justify-between px-3 ${isFullscreen ? 'pl-3' : 'pl-[90px]'} border-b border-zinc-900 bg-[#09090b] select-none transition-all duration-300`}
                style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            >
                <div className="flex items-center gap-2 text-zinc-100 font-bold tracking-tight">
                    <svg className="w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 19h20L12 2zm0 3.8l6.8 11.2H5.2L12 5.8z" /></svg>
                    <span className="text-sm">Prism</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-medium ml-1">BETA</span>
                </div>

                <div className="flex items-center gap-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".psd" />

                    <button
                        onClick={handleExport}
                        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                        className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded shadow-sm shadow-indigo-500/20 transition-all active:scale-95 ml-2"
                    >
                        <span>Export</span>
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </button>
                </div>
            </header>

            {/* Workspace Grid */}
            <div className="flex-1 flex flex-col min-h-0">

                {/* TOP AREA: Assets, Player, Inspector */}
                <div className="flex-1 flex min-h-0 overflow-hidden relative">

                    {/* Left: Resources */}
                    <div style={{ display: showLeftPanel ? 'block' : 'none', width: leftPanelWidth }} className="shrink-0 h-full relative overflow-hidden flex flex-col">
                        <ResourcePanel isLoading={isRestoring} />
                        {/* RESIZER */}
                        <div 
                            onPointerDown={handleLeftResizeDown}
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-500/20 active:bg-indigo-500/40 transition-colors z-40 translate-x-1/2"
                        />
                    </div>

                    {/* Left Panel Floating Toggle */}
                    <div className="relative z-50 flex items-center h-full w-0">
                        <button 
                            onClick={() => { setShowLeftPanel(!showLeftPanel); localStorage.setItem('prism:showLeft', (!showLeftPanel).toString()); }}
                            className="absolute left-0 -translate-x-1/2 w-6 h-6 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white shadow-xl border border-zinc-700 transition-all pointer-events-auto"
                            title="Toggle Resources"
                        >
                            {showLeftPanel ? (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg> // Double Left Arrow
                            ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg> // Double Right Arrow
            )}
                        </button>
                    </div>

                    {/* Center: Stage */}
                    <div 
                        className="flex-1 bg-[#09090b] relative overflow-hidden border-x border-zinc-900 min-h-0 min-w-0" 
                        ref={containerRef}
                        onPointerMove={handleCanvasPointerMove}
                        onPointerLeave={() => {
                            if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
                            setShowZoomOverlay(false);
                        }}
                    >
                        
                        {/* Dot Grid Background */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{
                            backgroundImage: 'radial-gradient(circle, #3f3f46 1px, transparent 1px)',
                            backgroundSize: '24px 24px'
                        }}></div>

                        {/* Scrollable Canvas Area */}
                        <div className="absolute inset-0 overflow-auto custom-scrollbar">
                            <div className="w-max h-max min-w-full min-h-full flex p-8">
                                {/* Player Container */}
                                <div
                                    className="m-auto relative shadow-2xl shadow-black rounded-sm overflow-hidden ring-1 ring-zinc-800 bg-black transition-all duration-200 ease-out shrink-0"
                                    style={{
                                        width: `${playerStyle.width}px`,
                                        height: `${playerStyle.height}px`
                                    }}
                                >
                                    <Player
                                        ref={setPlayer}
                                        component={PrismComposition}
                                        inputProps={memoizedInputProps}
                                        durationInFrames={Math.max(1, project.durationInFrames)}
                                        fps={project.fps}
                                        compositionWidth={project.width}
                                        compositionHeight={project.height}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                        }}
                                        loop={isLoopingEnabled}
                                        doubleClickToFullscreen
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Pointer Events Shield during structural resize */}
                        {(isDraggingLeft || isDraggingRight || isDraggingBottom) && (
                            <div className={`absolute inset-0 z-50 ${isDraggingBottom ? 'cursor-row-resize' : 'cursor-col-resize'}`} />
                        )}

                        {/* Stage Info Overlay */}
                        <div 
                            className={`absolute bottom-4 right-4 flex gap-3 select-none items-center bg-[#1c1c1f] border border-zinc-800/80 px-2 py-1.5 rounded-lg shadow-xl shadow-black/50 transition-opacity duration-500 ${showZoomOverlay ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                            onPointerEnter={() => {
                                if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
                                setShowZoomOverlay(true);
                            }}
                            onPointerLeave={handleCanvasPointerMove}
                        >
                            <div className="text-[10px] text-zinc-500 font-mono flex gap-2 border-r border-zinc-700/50 pr-3 items-center">
                                <span>{project.width}x{project.height}</span>
                                <span>|</span>
                                <span>{project.fps} FPS</span>
                            </div>

                            {/* Scale Slider Control */}
                            <div className="flex items-center gap-2 pr-1">
                                <button 
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-medium tracking-wide transition-all ${zoomLevel === 0 ? 'text-zinc-200 bg-zinc-800' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                                    onClick={() => setZoomLevel(0)}
                                >
                                    FIT
                                </button>
                                <input 
                                    type="range" 
                                    min="0.1" 
                                    max="4" 
                                    step="0.05" 
                                    value={zoomLevel === 0 ? playerStyle.fitScale : zoomLevel} 
                                    onChange={(e) => setZoomLevel(parseFloat(e.target.value))} 
                                    className="w-16 h-1 bg-zinc-800 rounded-lg cursor-pointer accent-zinc-500 hover:accent-zinc-400 transition-all focus:outline-none" 
                                />
                                <span className="font-mono text-[10px] w-8 text-right select-none text-zinc-500">
                                    {Math.round(playerStyle.scale * 100)}%
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel Floating Toggle */}
                    <div className="relative z-50 flex items-center h-full w-0">
                        <button 
                            onClick={() => { setShowRightPanel(!showRightPanel); localStorage.setItem('prism:showRight', (!showRightPanel).toString()); }}
                            className="absolute right-0 translate-x-1/2 w-6 h-6 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white shadow-xl border border-zinc-700 transition-all pointer-events-auto"
                            title="Toggle Inspector"
                        >
                            {showRightPanel ? (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7m-8-14l7 7-7 7" /></svg> // Double Right Arrow
                            ) : (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7M19 19l-7-7 7-7" /></svg> // Double Left Arrow
                            )}
                        </button>
                    </div>

                    {/* Right: Inspector */}
                    <div style={{ display: showRightPanel ? 'block' : 'none', width: rightPanelWidth }} className="shrink-0 h-full relative overflow-hidden flex flex-col">
                        {/* RESIZER */}
                        <div 
                            onPointerDown={handleRightResizeDown}
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-indigo-500/20 active:bg-indigo-500/40 transition-colors z-40 -translate-x-1/2"
                        />
                        <PropertySidebar />
                    </div>
                </div>

                {/* Bottom Toggle */}
                <div className="relative z-50 flex justify-center w-full h-0">
                    <button 
                        onClick={() => { setShowTimeline(!showTimeline); localStorage.setItem('prism:showTimeline', (!showTimeline).toString()); }}
                        className="absolute bottom-0 translate-y-1/2 w-10 h-5 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white shadow-xl border border-zinc-700 transition-all pointer-events-auto z-50"
                        title="Toggle Timeline"
                    >
                        {showTimeline ? (
                             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg> // Down
                        ) : (
                             <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" /></svg> // Up
                        )}
                    </button>
                </div>

                {/* BOTTOM AREA: Timeline */}
                <div style={{ display: showTimeline ? 'flex' : 'none', height: timelineHeight }} className="w-full shrink-0 border-t border-zinc-800 bg-[#09090b] flex-col relative z-40">
                    {/* RESIZER */}
                    <div 
                        onPointerDown={handleBottomResizeDown}
                        className="absolute top-0 left-0 right-0 h-2 cursor-row-resize hover:bg-indigo-500/20 active:bg-indigo-500/40 transition-colors z-50 -translate-y-1/2"
                    />
                    
                    {/* Top Accent Line */}
                    <div className="w-full shrink-0 h-[1px] bg-gradient-to-r from-transparent via-zinc-800 to-transparent opacity-50"></div>
                    
                    <div className="flex-1 overflow-hidden">
                        <PrismTimeline 
                            onOpenSettings={handleOpenSettings} 
                            onOpenAutoCaptions={() => setIsAutoCaptionsModalOpen(true)}
                        />
                    </div>
                </div>

            </div>

            {/* Settings Modal */}
            {isSettingsOpen && <TimelineSettingsModal onClose={() => setIsSettingsOpen(false)} />}

            {/* Export Modal */}
            <ExportModal
                isOpen={isExportModalOpen}
                onClose={() => setIsExportModalOpen(false)}
                progress={exportProgress}
                status={exportStatus}
                outputValue={exportOutput}
            />

            {/* TTS Generator Modal */}
            <TtsGenerator />

            {/* Auto Captions Modal */}
            {isAutoCaptionsModalOpen && <AutoCaptionsModal onClose={() => setIsAutoCaptionsModalOpen(false)} />}
        </div>
    );
}
