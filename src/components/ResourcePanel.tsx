import React, { useRef, useState, useMemo, useEffect } from 'react';
import { usePrismStore } from '../store/usePrismStore';
import { PrismAsset, PsdLayerSummary } from '../../types/prism';
import { getLayersFromPsd, getPsdPreview, parsePsd } from '../../lib/psd-to-json';
import { getAvailableFonts } from '@remotion/google-fonts';
import { AssetStorage } from '../lib/AssetStorage';
import { generateId } from '../../lib/id';

const SYSTEM_FONTS = [
    'Arial',
    'Verdana',
    'Helvetica',
    'Tahoma',
    'Trebuchet MS',
    'Times New Roman',
    'Georgia',
    'Garamond',
    'Courier New',
    'Brush Script MT'
];

export const ResourcePanel: React.FC<{ isLoading?: boolean }> = ({ isLoading }) => {
    const { 
        assets, addAsset, deleteAsset, addTrack, project, updateProjectSettings, hasModifiedCanvas,
        toggleTtsModal
    } = usePrismStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'media' | 'text' | 'record'>('media');
    const [searchQuery, setSearchQuery] = useState('');

    const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);

    // PSD Navigation State
    const [currentPsdId, setCurrentPsdId] = useState<string | null>(null);
    const [currentPsdStack, setCurrentPsdStack] = useState<PsdLayerSummary[] | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [googleFonts, setGoogleFonts] = useState<any[]>([]);

    useEffect(() => {
        setGoogleFonts(getAvailableFonts());
    }, []);

    // Text Editor State
    const [textContent, setTextContent] = useState('New Text');
    const [textColor, setTextColor] = useState('#ffffff');
    const [inputFontSize, setInputFontSize] = useState(60);
    const [textFont, setTextFont] = useState('Inter');

    // Voice Record State
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [pendingRecording, setPendingRecording] = useState<{
        blob: Blob,
        objectUrl: string,
        duration: number,
        originalName: string
    } | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<BlobPart[]>([]);
    const timerIntervalRef = useRef<number | null>(null);
    
    // Audio Extraction State
    const [isExtracting, setIsExtracting] = useState<string | null>(null);

    const extractAudioFromVideo = async (asset: PrismAsset) => {
        setIsExtracting(asset.id);
        try {
            const res = await fetch(asset.src);
            const arrayBuffer = await res.arrayBuffer();
            
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            
            const wavBlob = audioBufferToWav(decodedBuffer);
            
            const newAssetId = generateId();
            const originalNameParts = (asset.metadata?.originalName || 'video.mp4').split('.');
            originalNameParts.pop();
            const newName = `${originalNameParts.join('.')}_audio.wav`;

            const objectUrl = URL.createObjectURL(wavBlob);
            
            const newAsset: PrismAsset = {
                id: newAssetId,
                type: 'audio',
                src: objectUrl,
                metadata: {
                    originalName: newName,
                    mimeType: 'audio/wav',
                    duration: decodedBuffer.duration,
                    createdAt: Date.now()
                }
            };
            
            const file = new File([wavBlob], newName, { type: 'audio/wav' });
            await AssetStorage.saveAsset(newAsset, file);
            
            addAsset(newAsset);
            setPreviewAssetId(null);
        } catch (err) {
            console.error("Audio Extraction Failed", err);
            alert("Could not extract audio from this video.");
        } finally {
            setIsExtracting(null);
        }
    };

    // Cleanup recording on unmount
    useEffect(() => {
        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
            if (pendingRecording) {
                URL.revokeObjectURL(pendingRecording.objectUrl);
            }
        };
    }, [pendingRecording]);

    // Load Fonts when selected
    useEffect(() => {
        // Only try to load if it's a Google Font
        const isGoogle = googleFonts.some(f => f.fontFamily === textFont);
        if (isGoogle) {
            const font = googleFonts.find((f) => f.fontFamily === textFont);
            if (font) {
                font.load()
                    .then(() => console.log(`Font loaded: ${textFont}`))
                    .catch((err: unknown) => console.error(`Failed to load font ${textFont}`, err));
            }
        }
    }, [textFont, googleFonts]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                
                const objectUrl = URL.createObjectURL(audioBlob);
                let duration = 0;
                await new Promise<void>((resolve) => {
                    const audio = document.createElement('audio');
                    audio.preload = 'metadata';
                    audio.onloadedmetadata = () => {
                        // Infinity check fallback
                        if (audio.duration === Infinity) {
                            audio.currentTime = 1e101;
                            audio.ontimeupdate = () => {
                                audio.ontimeupdate = () => {};
                                audio.currentTime = 0;
                                duration = audio.duration || 5;
                                resolve();
                            }
                        } else {
                            duration = audio.duration;
                            resolve();
                        }
                    };
                    audio.onerror = () => resolve();
                    audio.src = objectUrl;
                });

                if (duration <= 0) duration = Math.max(0.1, recordingTime); // fallback

                const originalName = `Recording_${new Date().toLocaleTimeString().replace(/:/g, '-')}.webm`;
                
                // Set to pending state instead of saving immediately
                setPendingRecording({
                    blob: audioBlob,
                    objectUrl,
                    duration,
                    originalName
                });
                
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
            setRecordingTime(0);
            timerIntervalRef.current = window.setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error("Microphone access denied:", err);
            alert("Microphone access is required to record audio.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        }
    };

    const handleConfirmRecording = async () => {
        if (!pendingRecording) return;
        
        try {
            // CRITICAL: audio/webm blobs from MediaRecorder cannot be seeked by the browser.
            // Remotion must seek audio to keep it in sync with the timeline.         
            // We must transcode to WAV (PCM) which is always seekable.
            const rawArrayBuffer = await pendingRecording.blob.arrayBuffer();
            const audioCtx = new AudioContext();
            const decodedBuffer = await audioCtx.decodeAudioData(rawArrayBuffer);

            // Re-encode as WAV
            const wavBlob = audioBufferToWav(decodedBuffer);
            const wavName = pendingRecording.originalName.replace('.webm', '.wav');
            const wavUrl = URL.createObjectURL(wavBlob);
            
            // Revoke the old webm URL since we no longer need it
            URL.revokeObjectURL(pendingRecording.objectUrl);

            const assetId = generateId();
            const newAsset: PrismAsset = {
                id: assetId,
                type: 'audio',
                src: wavUrl,
                metadata: {
                    originalName: wavName,
                    mimeType: 'audio/wav',
                    duration: pendingRecording.duration,
                    createdAt: Date.now()
                }
            };
            
            const file = new File([wavBlob], wavName, { type: 'audio/wav' });
            await AssetStorage.saveAsset(newAsset, file);
            addAsset(newAsset);
            
            setPendingRecording(null);
            setActiveTab('media');
        } catch (err) {
            console.error("Failed to save recording:", err);
            alert("Failed to save recording.");
        }
    };

    const handleDiscardRecording = () => {
        if (pendingRecording) {
            URL.revokeObjectURL(pendingRecording.objectUrl);
            setPendingRecording(null);
        }
    };

    const processFiles = async (files: FileList | File[]) => {
        setIsImporting(true);
        // Small delay to ensure UI updates
        await new Promise(r => setTimeout(r, 100));

        for (const file of Array.from(files)) {
            const isImage = file.type.startsWith('image/');
            const isVideo = file.type.startsWith('video/');
            const isAudio = file.type.startsWith('audio/');
            const isPsd = file.name.toLowerCase().endsWith('.psd');

            if (!isImage && !isVideo && !isAudio && !isPsd) continue;

            const assetId = generateId();
            let objectUrl = URL.createObjectURL(file);

            let type: any = 'image';
            if (isVideo) type = 'video';
            if (isAudio) type = 'audio';
            if (isPsd) type = 'psd';

            let layers: PsdLayerSummary[] | undefined = undefined;
            let startProjectData: any = undefined;

            if (isPsd) {
                try {
                    const buffer = await file.arrayBuffer();
                    // Get Preview
                    const previewUrl = await getPsdPreview(buffer);
                    if (previewUrl) objectUrl = previewUrl;

                    // Get Layers (for UI navigation)
                    layers = await getLayersFromPsd(buffer);

                    // Full Parse (for Drag & Drop "Open PSD" fidelity)
                    startProjectData = await parsePsd(buffer);
                } catch (e) {
                    console.error("Failed to parse PSD for asset", e);
                }
            }

            // Metadata Extraction
            let duration = 0;
            let width = 0;
            let height = 0;

            if (isVideo) {
                await new Promise<void>((resolve) => {
                    const video = document.createElement('video');
                    video.preload = 'metadata';
                    video.onloadedmetadata = () => {
                        duration = video.duration;
                        width = video.videoWidth;
                        height = video.videoHeight;
                        resolve();
                    };
                    video.onerror = () => resolve();
                    video.src = objectUrl;
                });
            } else if (isAudio) {
                await new Promise<void>((resolve) => {
                    const audio = document.createElement('audio');
                    audio.preload = 'metadata';
                    audio.onloadedmetadata = () => {
                        duration = audio.duration;
                        resolve();
                    };
                    audio.onerror = () => resolve();
                    audio.src = objectUrl;
                });
            } else if (isImage) {
                await new Promise<void>((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        width = img.width;
                        height = img.height;
                        resolve();
                    };
                    img.onerror = () => resolve();
                    img.src = objectUrl;
                });
            }

            const newAsset: PrismAsset = {
                id: assetId,
                type: type,
                src: objectUrl,
                metadata: {
                    originalName: file.name,
                    mimeType: file.type,
                    layers: layers,
                    psdProject: startProjectData,
                    duration,
                    width,
                    height,
                    createdAt: Date.now()
                }
            };

            // Persist to IndexedDB
            AssetStorage.saveAsset(newAsset, file).catch((err: any) => console.error("Failed to save asset persistence:", err));

            addAsset(newAsset);
        }
        setIsImporting(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            processFiles(files);
        }
        // Don't clear immediately, let the processFiles finish or rely on re-render.
        // Actually, to allow re-selecting same file, we should clear, but let's do it after a tick.
        setTimeout(() => {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }, 1000);
    };

    // Filter Assets
    const filteredAssets = useMemo(() => {
        if (!assets) return [];
        return Object.values(assets)
            .filter(asset => {
                // Hide internal assets (generated from PSD layers)
                if (asset.metadata?.isInternal) return false;

                if (searchQuery) {
                    return asset.metadata?.originalName?.toLowerCase().includes(searchQuery.toLowerCase());
                }
                return true;
            })
            .sort((a, b) => { // Sort by createdAt Descending
                const timeA = a.metadata?.createdAt || 0;
                const timeB = b.metadata?.createdAt || 0;
                return timeB - timeA;
            });
    }, [assets, searchQuery]);

    // Render Grid Items with Denser Layout
    const renderAssetItem = (asset: PrismAsset) => {
        const dragData = {
            type: 'asset',
            assetId: asset.id,
            assetType: asset.type
        };

        const handleDelete = async (e: React.MouseEvent) => {
            e.stopPropagation();
            if (confirm('Delete this asset?')) {
                try {
                    await AssetStorage.deleteAsset(asset.id);
                    deleteAsset(asset.id);
                } catch (err) {
                    console.error("Failed to delete asset:", err);
                }
            }
        };

        return (
            <div
                key={asset.id}
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                    e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => setPreviewAssetId(asset.id)}
                onMouseEnter={(e) => {
                    const video = e.currentTarget.querySelector('video');
                    if (video) video.play().catch(() => {});
                    const audio = e.currentTarget.querySelector('audio');
                    if (audio) audio.play().catch(() => {});
                }}
                onMouseLeave={(e) => {
                    const video = e.currentTarget.querySelector('video');
                    if (video) {
                        video.pause();
                        video.currentTime = 0;
                    }
                    const audio = e.currentTarget.querySelector('audio');
                    if (audio) {
                        audio.pause();
                        audio.currentTime = 0;
                    }
                }}
                className={`group relative aspect-square bg-zinc-900 rounded border ${previewAssetId === asset.id ? 'border-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.2)]' : 'border-zinc-800'} overflow-hidden cursor-grab active:cursor-grabbing hover:border-indigo-500/50 transition-all shadow-sm`}
                onDoubleClick={() => {
                    if (asset.type === 'psd' && asset.metadata?.layers) {
                        setCurrentPsdId(asset.id);
                        setCurrentPsdStack(asset.metadata.layers);
                    }
                }}
            >
                {/* Delete Button (Visible on Hover) */}
                <button
                    onClick={handleDelete}
                    className="absolute top-1 right-1 z-20 p-1 bg-black/60 hover:bg-red-500/80 rounded text-zinc-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete Asset"
                >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>

                {asset.type === 'video' && (
                    <>
                        <video src={asset.src} muted loop playsInline className="w-full h-full object-cover pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute top-1 left-1 bg-black/60 backdrop-blur-md px-1 py-[1px] rounded-[2px] text-[8px] font-mono text-zinc-300 pointer-events-none border border-white/10">VID</div>
                    </>
                )}
                {asset.type === 'image' && (
                    <img src={asset.src} alt="asset" className="w-full h-full object-cover pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity" />
                )}
                {asset.type === 'psd' && (
                    <div className="w-full h-full relative pointer-events-none">
                        {/* If we have a thumb (which is stored in asset.src for PSDs now), show it. Else fallback */}
                        <img src={asset.src} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />

                        {/* Badge */}
                        <div className="absolute top-1 left-1 bg-[#31a8ff]/80 backdrop-blur-md px-1 py-[1px] rounded-[2px] text-[8px] font-bold text-white shadow-sm">PSD</div>
                    </div>
                )}
                {asset.type === 'audio' && (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900 pointer-events-none">
                        <audio src={asset.src} loop className="hidden" />
                        <svg className="w-6 h-6 text-emerald-500 opacity-80 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                        <div className="absolute top-1 left-1 bg-emerald-900/60 backdrop-blur-md px-1 py-[1px] rounded-[2px] text-[8px] font-mono text-emerald-400 border border-emerald-500/20">AUD</div>
                    </div>
                )}

                {/* Overlay Name */}
                <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <p className="text-[9px] text-zinc-300 truncate leading-tight">{asset.metadata?.originalName || 'Asset'}</p>
                </div>
            </div>
        );
    };

    const renderPsdLayer = (layer: PsdLayerSummary) => {
        return (
            <div
                key={layer.id}
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({
                        type: layer.type === 'text' ? 'text' : 'asset',
                        src: layer.src,
                        // If it's a layer group with no src, we can't drag it yet unless we bake it?
                        // Assuming psd-to-json handles leaves.
                        content: layer.text,
                        fontSize: 40,
                        fontWeight: 'normal',
                        assetType: 'image'
                    }));
                    e.dataTransfer.effectAllowed = 'copy';
                }}
                className="group flex items-center gap-2 p-1.5 rounded-md bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 cursor-grab active:cursor-grabbing transition-all"
            >
                <div className="w-8 h-8 shrink-0 bg-zinc-950 rounded flex items-center justify-center overflow-hidden border border-zinc-800/50">
                    {layer.src ? (
                        <img src={layer.src} className="w-full h-full object-contain" />
                    ) : (
                        <span className="text-[8px] text-zinc-600 font-mono">{layer.type[0].toUpperCase()}</span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-zinc-300 truncate font-medium leading-tight">{layer.name}</p>
                    <p className="text-[9px] text-zinc-500">{layer.type}</p>
                </div>
                <div className="opacity-0 group-hover:opacity-100 text-zinc-500">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" /></svg>
                </div>
            </div>
        )
    };

    return (
        <div className="w-full flex flex-col border-r border-zinc-800 bg-[#09090b] h-full shrink-0">
            {/* COMPACT TABS */}
            <div className="flex items-center border-b border-zinc-800 bg-[#09090b] px-1 shrink-0">
                <button onClick={() => setActiveTab('media')} className={`flex-1 py-2.5 flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'media' ? 'border-indigo-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-[11px] font-medium">Media</span>
                </button>
                <button onClick={() => setActiveTab('text')} className={`flex-1 py-2.5 flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'text' ? 'border-indigo-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                    <span className="text-[11px] font-medium">Text</span>
                </button>
                <button onClick={() => setActiveTab('record')} className={`flex-1 py-2.5 flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'record' ? 'border-red-500 text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    <span className="text-[11px] font-medium">Record</span>
                </button>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-hidden relative flex flex-col">

                {/* SEARCH BAR */}
                {activeTab === 'media' && !currentPsdId && (
                    <div className="p-2 border-b border-zinc-800 shrink-0 flex gap-2">
                        <div className="relative flex-1">
                            <svg className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded pl-7 pr-2 py-1 text-[10px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
                            />
                        </div>
                    </div>
                )}

                {/* PREVIEW AREA */}
                {activeTab === 'media' && !currentPsdStack && previewAssetId && (
                    <div className="p-3 border-b border-zinc-800 shrink-0 bg-indigo-500/5 backdrop-blur-sm relative shadow-xl z-20 animate-in fade-in slide-in-from-top-2 duration-300">
                        {(() => {
                            const asset = Object.values(assets).find(a => a.id === previewAssetId);
                            if (!asset) return null;

                            const handleAddToTimeline = () => {
                                if (!asset) return;
                                
                                let canvasW = project?.width || 1080;
                                let canvasH = project?.height || 1920;

                                // SMART RESIZE PROMPT
                                if (!hasModifiedCanvas && asset.metadata?.width && asset.metadata?.height && project) {
                                    if (asset.metadata.width !== canvasW || asset.metadata.height !== canvasH) {
                                        if (confirm(`Your project is currently ${canvasW}x${canvasH}. Would you like to update the canvas to match the dimensions of this asset (${asset.metadata.width}x${asset.metadata.height})?`)) {
                                            canvasW = asset.metadata.width;
                                            canvasH = asset.metadata.height;
                                            updateProjectSettings({ width: canvasW, height: canvasH });
                                        }
                                    }
                                }

                                const trackId = generateId();
                                const duration = asset.metadata?.duration || 150 ; // Default to 5s if unknown
                                
                                // Calculate centering if asset smaller than canvas
                                let x = 0;
                                let y = 0;
                                if (asset.metadata?.width && asset.metadata?.height) {
                                    if (asset.metadata.width < canvasW || asset.metadata.height < canvasH) {
                                        x = (canvasW - asset.metadata.width) / 2;
                                        y = (canvasH - asset.metadata.height) / 2;
                                    }
                                }

                                const newTrack = {
                                    id: trackId,
                                    type: asset.type as any,
                                    startFrame: 0,
                                    durationInFrames: Math.ceil(duration * 30), // Assume 30fps
                                    props: {
                                        x, y,
                                        width: asset.metadata?.width || canvasW,
                                        height: asset.metadata?.height || canvasH,
                                        opacity: 1, rotation: 0, scale: 1,
                                        src: asset.src,
                                        assetId: asset.id
                                    }
                                };
                                addTrack(newTrack);
                            };

                            return (
                                <div className="flex flex-col gap-3 relative">
                                    <button 
                                        onClick={() => setPreviewAssetId(null)}
                                        className="absolute -top-1 -right-1 z-30 p-1 bg-zinc-900 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-all shadow-md border border-zinc-800"
                                        title="Close Preview"
                                    >
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                    
                                    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center border border-zinc-800 shadow-2xl group relative ring-1 ring-white/5">
                                        {asset.type === 'video' && <video src={asset.src} controls autoPlay className="w-full h-full object-contain" />}
                                        {asset.type === 'image' && <img src={asset.src} className="w-full h-full object-contain" />}
                                        {asset.type === 'psd' && <img src={asset.src} className="w-full h-full object-contain" />}
                                        {asset.type === 'audio' && (
                                            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-zinc-900/50 p-4">
                                                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                                    <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                                                </div>
                                                <audio src={asset.src} controls autoPlay className="w-full h-8 opacity-90 accent-emerald-500" />
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex flex-col px-0.5 gap-1.5">
                                        <div className="flex justify-between items-start">
                                            <span className="text-[11px] text-zinc-100 font-semibold truncate leading-tight flex-1 mr-2">{asset.metadata?.originalName}</span>
                                            <span className="text-[9px] text-zinc-500 uppercase tracking-widest bg-zinc-800 px-1.5 py-0.5 rounded-sm font-bold border border-zinc-700/50 leading-none">{asset.type}</span>
                                        </div>
                                        
                                        <div className="flex justify-between items-center">
                                            <div className="flex gap-2 text-[9px] text-zinc-500 font-medium">
                                                {asset.metadata?.width && asset.metadata?.height && <span>{asset.metadata.width}×{asset.metadata.height}</span>}
                                                {asset.metadata?.duration && <span>{asset.metadata.duration.toFixed(1)}s</span>}
                                            </div>
                                            
                                            <div className="flex items-center gap-2">
                                                {asset.type === 'video' && (
                                                    <button 
                                                        onClick={() => extractAudioFromVideo(asset)}
                                                        disabled={isExtracting === asset.id}
                                                        className={`px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-white text-[9px] font-bold rounded shadow-lg transition-all active:scale-95 flex items-center gap-1 ${isExtracting === asset.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                    >
                                                        {isExtracting === asset.id ? (
                                                            <div className="w-2.5 h-2.5 border-2 border-white/30 border-t-white rounded-full animate-spin cursor-wait"></div>
                                                        ) : (
                                                            <svg className="w-2.5 h-2.5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                                        )}
                                                        <span>EXTRACT AUDIO</span>
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={handleAddToTimeline}
                                                    className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-bold rounded shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center gap-1"
                                                >
                                                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                                    <span>ADD TO TIMELINE</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* PSD HEADER */}
                {currentPsdStack && (
                    <div className="p-2 border-b border-zinc-800 shrink-0 flex items-center gap-2 bg-[#0d1624]">
                        <button
                            onClick={() => {
                                setCurrentPsdId(null);
                                setCurrentPsdStack(null);
                            }}
                            className="p-1 hover:bg-[#31a8ff]/20 rounded text-[#31a8ff] transition-colors"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-[#31a8ff] font-bold tracking-wide uppercase">PSD Layers</span>
                        </div>
                    </div>
                )}

                {/* LIST */}
                <div
                    className="flex-1 overflow-y-auto p-2 custom-scrollbar"
                    onDragOver={(e) => {
                        e.preventDefault();
                        if (activeTab === 'media') e.currentTarget.classList.add('bg-indigo-900/10');
                    }}
                    onDragLeave={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('bg-indigo-900/10');
                    }}
                    onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove('bg-indigo-900/10');
                        if (activeTab === 'media' && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                            processFiles(e.dataTransfer.files);
                        }
                    }}
                >
                    {isLoading && (
                        <div className="absolute inset-0 z-50 bg-[#09090b]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                            <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                            <span className="text-[9px] font-mono text-zinc-400 animate-pulse">RESTORING...</span>
                        </div>
                    )}
                    {activeTab === 'media' && !currentPsdStack && (
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*,video/*,audio/*,.psd"
                                multiple
                                onChange={handleFileUpload}
                            />

                            <div className="grid grid-cols-3 gap-2">
                                {/* IMPORT BTN */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="aspect-square rounded border border-dashed border-zinc-700 bg-zinc-900/30 hover:bg-zinc-900 hover:border-zinc-500 transition-all flex flex-col items-center justify-center gap-1 group"
                                >
                                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                                        <svg className="w-3 h-3 text-zinc-400 group-hover:text-zinc-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    </div>
                                    <span className="text-[9px] font-medium text-zinc-500 group-hover:text-zinc-300">Import</span>
                                </button>

                                {/* VOICE OVER BTN */}
                                <button
                                    onClick={toggleTtsModal}
                                    className="aspect-square rounded border border-dashed border-emerald-900/50 bg-emerald-950/10 hover:bg-emerald-900/20 hover:border-emerald-500/50 transition-all flex flex-col items-center justify-center gap-1 group"
                                >
                                    <div className="w-6 h-6 rounded-full bg-emerald-900/40 flex items-center justify-center group-hover:bg-emerald-800 transition-colors border border-emerald-500/20">
                                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                    </div>
                                    <span className="text-[9px] font-medium text-emerald-500 group-hover:text-emerald-400">Voiceover</span>
                                </button>

                                {/* LOADING SKELETON */}
                                {isImporting && (
                                    <div className="aspect-square rounded bg-zinc-900 border border-zinc-800 overflow-hidden relative">
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-800/50 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }}></div>
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                                        </div>
                                    </div>
                                )}

                                {filteredAssets.map(renderAssetItem)}
                            </div>
                        </>
                    )}

                    {activeTab === 'media' && currentPsdStack && (
                        <div className="flex flex-col gap-1.5">
                            {currentPsdStack.map((layer) => renderPsdLayer(layer))}
                        </div>
                    )}

                    {activeTab === 'text' && (
                        <div className="flex flex-col gap-4 p-1">
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[9px] font-medium text-zinc-500 uppercase mb-1 block">Content</label>
                                    <textarea
                                        value={textContent}
                                        onChange={(e) => setTextContent(e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500/50 min-h-[60px]"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[9px] font-medium text-zinc-500 uppercase mb-1 block">Size</label>
                                        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded px-2">
                                            <input
                                                type="number"
                                                value={inputFontSize}
                                                onChange={(e) => setInputFontSize(Number(e.target.value))}
                                                className="w-full bg-transparent p-1.5 text-xs text-zinc-200 focus:outline-none"
                                            />
                                            <span className="text-[9px] text-zinc-600">px</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[9px] font-medium text-zinc-500 uppercase mb-1 block">Color</label>
                                        <div className="flex items-center gap-2 h-[28px]">
                                            <input
                                                type="color"
                                                value={textColor}
                                                onChange={(e) => setTextColor(e.target.value)}
                                                className="h-full w-full bg-transparent cursor-pointer rounded overflow-hidden p-0 border border-zinc-800"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[9px] font-medium text-zinc-500 uppercase mb-1 block">Font</label>
                                    <CustomFontSelect
                                        value={textFont}
                                        onChange={setTextFont}
                                        systemFonts={SYSTEM_FONTS}
                                        googleFonts={googleFonts}
                                    />
                                </div>
                            </div>

                            <div className="pt-3 border-t border-zinc-800">
                                <label className="text-[9px] font-medium text-zinc-500 uppercase mb-2 block text-center">Preview & Drag</label>

                                <div
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('application/json', JSON.stringify({
                                            type: 'text',
                                            content: textContent,
                                            fontSize: inputFontSize,
                                            fontWeight: 'normal',
                                            color: textColor,
                                            fontFamily: textFont
                                        }));
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    className="w-full aspect-video bg-[#18181b] border border-zinc-700 border-dashed rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing hover:border-indigo-500 transition-colors overflow-hidden relative group"
                                >
                                    <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
                                        backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)',
                                        backgroundSize: '10px 10px'
                                    }}></div>

                                    <div
                                        style={{
                                            color: textColor,
                                            fontSize: `${Math.min(inputFontSize, 40)}px`,
                                            fontFamily: textFont,
                                            textAlign: 'center',
                                            lineHeight: 1.2
                                        }}
                                        className="pointer-events-none select-none px-4"
                                    >
                                        {textContent || 'Type something...'}
                                    </div>
                                    <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                        <span className="bg-indigo-600 text-white text-[9px] px-2 py-1 rounded shadow-sm">Drag</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'record' && (
                        <div className="flex flex-col items-center justify-center p-6 h-full text-zinc-200">
                            {pendingRecording ? (
                                <div className="w-full flex justify-center items-center h-full"> 
                                    <div className="w-full max-w-sm flex flex-col items-center justify-center gap-6 p-6 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">
                                        
                                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-inner">
                                            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                                        </div>
                                        
                                        <div className="text-center w-full px-2">
                                            <div 
                                                className="text-xs font-semibold truncate leading-snug mx-auto mb-3 text-zinc-300 w-full"
                                                title={pendingRecording.originalName}
                                            >
                                                {pendingRecording.originalName}
                                            </div>
                                        </div>
                                        
                                        <div className="w-full px-2 mb-2">
                                            <ReviewAudioPlayer src={pendingRecording.objectUrl} duration={pendingRecording.duration} />
                                        </div>
                                        
                                        <div className="flex w-full gap-2 mt-2">
                                            <button 
                                                onClick={handleDiscardRecording}
                                                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-bold rounded-md shadow transition-colors"
                                            >
                                                Discard
                                            </button>
                                            <button 
                                                onClick={handleConfirmRecording}
                                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-md shadow-lg shadow-emerald-600/20 transition-all hover:shadow-emerald-500/30"
                                            >
                                                Save to Media
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="relative flex items-center justify-center mb-8">
                                        {/* Pulsing rings when recording */}
                                        {isRecording && (
                                            <>
                                                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20" style={{ transform: 'scale(1.5)' }}></div>
                                                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-10" style={{ transform: 'scale(2)', animationDelay: '0.2s' }}></div>
                                            </>
                                        )}
                                        <button
                                            onClick={isRecording ? stopRecording : startRecording}
                                            className={`relative z-10 flex flex-col items-center justify-center w-24 h-24 rounded-full transition-all duration-300 shadow-2xl ${
                                                isRecording 
                                                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/50' 
                                                : 'bg-zinc-800 hover:bg-zinc-700 shadow-transparent hover:shadow-zinc-700/50 border border-zinc-700'
                                            }`}
                                        >
                                            {isRecording ? (
                                                <div className="w-8 h-8 bg-white rounded-sm"></div>
                                            ) : (
                                                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>

                                    <div className="text-center font-mono">
                                        <div className={`text-4xl font-bold transition-colors ${isRecording ? 'text-red-400' : 'text-zinc-500'}`}>
                                            {Math.floor(recordingTime / 60).toString().padStart(2, '0')}:{(recordingTime % 60).toString().padStart(2, '0')}
                                        </div>
                                        <div className={`text-[10px] mt-2 tracking-widest uppercase transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-zinc-600'}`}>
                                            {isRecording ? 'Recording Live...' : 'Ready to record'}
                                        </div>
                                    </div>
                                    
                                    {!isRecording && recordingTime === 0 && (
                                        <p className="text-center text-[10px] text-zinc-500 mt-12 max-w-[80%] leading-relaxed">
                                            Click the microphone to start recording your voice.
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const CustomFontSelect = ({ value, onChange, systemFonts, googleFonts }: { value: string, onChange: (v: string) => void, systemFonts: string[], googleFonts: any[] }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded p-1.5 text-xs text-zinc-200 focus:outline-none flex items-center justify-between"
            >
                <span style={{ fontFamily: value }} className="truncate">{value}</span>
                <svg className="w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute top-full left-0 right-0 mt-1 max-h-[300px] bg-zinc-900 border border-zinc-800 rounded shadow-xl overflow-y-auto z-50 custom-scrollbar">
                        <div className="p-1">
                            <div className="text-[9px] font-bold text-zinc-500 px-2 py-1 uppercase">System Fonts</div>
                            {systemFonts.map(font => (
                                <button
                                    key={font}
                                    onClick={() => { onChange(font); setIsOpen(false); }}
                                    className="w-full text-left px-2 py-1.5 text-xs text-zinc-300 hover:bg-indigo-500/20 hover:text-indigo-400 rounded flex items-center justify-between"
                                >
                                    <span style={{ fontFamily: font }}>{font}</span>
                                    {value === font && <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                </button>
                            ))}

                            <div className="text-[9px] font-bold text-zinc-500 px-2 py-1 uppercase mt-2">Google Fonts</div>
                            {googleFonts.map(font => (
                                <button
                                    key={font.fontFamily}
                                    onClick={() => { onChange(font.fontFamily); setIsOpen(false); }}
                                    className="w-full text-left px-2 py-1.5 text-xs text-zinc-300 hover:bg-indigo-500/20 hover:text-indigo-400 rounded flex items-center justify-between"
                                >
                                    <span style={{ fontFamily: font.fontFamily }}>{font.fontFamily}</span>
                                    {value === font.fontFamily && <svg className="w-3 h-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const ReviewAudioPlayer = ({ src, duration }: { src: string, duration: number }) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            setCurrentTime(0);
        }
    };

    return (
        <div className="w-full flex flex-col gap-2 bg-zinc-950/50 p-3 rounded-lg border border-zinc-800/80 shadow-inner">
            <audio 
                ref={audioRef} 
                src={src} 
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                className="hidden"
            />
            
            <div className="flex items-center gap-3 w-full">
                <button 
                    onClick={togglePlay}
                    className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white transition-colors shadow-lg shadow-emerald-500/20"
                >
                    {isPlaying ? (
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
                    ) : (
                        <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    )}
                </button>
                
                <div className="flex-1 flex items-center gap-2">
                    <div className="text-[9px] font-mono text-zinc-400 w-6 text-right">
                        {currentTime.toFixed(1)}
                    </div>
                    
                    <div 
                        className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer group"
                        onClick={(e) => {
                            if (audioRef.current) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                                audioRef.current.currentTime = pos * duration;
                                setCurrentTime(pos * duration);
                            }
                        }}
                    >
                        <div 
                            className="absolute top-0 left-0 bottom-0 bg-emerald-500 rounded-full group-hover:bg-emerald-400 transition-colors"
                            style={{ width: `${Math.min(100, (currentTime / (duration || 1)) * 100)}%` }}
                        />
                    </div>
                    
                    <div className="text-[9px] font-mono text-zinc-500 w-6">
                        {duration.toFixed(1)}
                    </div>
                </div>
            </div>
        </div>
    );
};

function audioBufferToWav(buffer: AudioBuffer) {
    let numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferArray = new ArrayBuffer(length),
        view = new DataView(bufferArray),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    const setUint16 = (data: number) => {
        view.setUint16(offset, data, true);
        offset += 2;
    };

    const setUint32 = (data: number) => {
        view.setUint32(offset, data, true);
        offset += 4;
    };

    setUint32(0x46464952);
    setUint32(length - 8);
    setUint32(0x45564157);
    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164); // "data"
    setUint32(length - 44);

    for(i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while(pos < buffer.length) {
        for(i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][pos]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
            view.setInt16(offset, sample, true);
            offset += 2;
        }
        pos++;
    }

    return new Blob([bufferArray], {type: "audio/wav"});
}
