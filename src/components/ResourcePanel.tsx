import React, { useRef, useState, useMemo, useEffect } from 'react';
import { usePrismStore } from '../store/usePrismStore';
import { PrismAsset, PsdLayerSummary } from '../../types/prism';
import { getLayersFromPsd, getPsdPreview, parsePsd } from '../../lib/psd-to-json';
import { getAvailableFonts } from '@remotion/google-fonts';

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

export const ResourcePanel: React.FC = () => {
    const { project, addAsset } = usePrismStore();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<'media' | 'text'>('media');
    const [searchQuery, setSearchQuery] = useState('');

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

            const assetId = crypto.randomUUID();
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

            const newAsset: PrismAsset = {
                id: assetId,
                type: type,
                src: objectUrl,
                metadata: {
                    originalName: file.name,
                    mimeType: file.type,
                    layers: layers,
                    psdProject: startProjectData
                }
            };
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
        if (!project) return [];
        return Object.values(project.assets).reverse().filter(asset => {
            // Hide internal assets (generated from PSD layers)
            if (asset.metadata?.isInternal) return false;

            if (searchQuery) {
                return asset.metadata?.originalName?.toLowerCase().includes(searchQuery.toLowerCase());
            }
            return true;
        });
    }, [project, searchQuery]);

    // Render Grid Items with Denser Layout
    const renderAssetItem = (asset: PrismAsset) => {
        const dragData = {
            type: 'asset',
            assetId: asset.id,
            assetType: asset.type
        };

        return (
            <div
                key={asset.id}
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                    e.dataTransfer.effectAllowed = 'copy';
                }}
                className="group relative aspect-square bg-zinc-900 rounded border border-zinc-800 overflow-hidden cursor-grab active:cursor-grabbing hover:border-indigo-500/50 transition-all shadow-sm"
                onDoubleClick={() => {
                    if (asset.type === 'psd' && asset.metadata?.layers) {
                        setCurrentPsdId(asset.id);
                        setCurrentPsdStack(asset.metadata.layers);
                    }
                }}
            >
                {asset.type === 'video' && (
                    <>
                        <video src={asset.src} className="w-full h-full object-cover pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute top-1 right-1 bg-black/60 backdrop-blur-md px-1 py-[1px] rounded-[2px] text-[8px] font-mono text-zinc-300 pointer-events-none border border-white/10">VID</div>
                    </>
                )}
                {asset.type === 'image' && (
                    <img src={asset.src} alt="asset" className="w-full h-full object-cover pointer-events-none opacity-90 group-hover:opacity-100 transition-opacity" />
                )}
                {asset.type === 'psd' && (
                    <div className="w-full h-full relative">
                        {/* If we have a thumb (which is stored in asset.src for PSDs now), show it. Else fallback */}
                        <img src={asset.src} className="w-full h-full object-cover opacity-80 group-hover:opacity-100" />

                        {/* Badge */}
                        <div className="absolute top-1 right-1 bg-[#31a8ff]/80 backdrop-blur-md px-1 py-[1px] rounded-[2px] text-[8px] font-bold text-white pointer-events-none shadow-sm">PSD</div>
                    </div>
                )}
                {asset.type === 'audio' && (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <svg className="w-6 h-6 text-emerald-500 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                        <div className="absolute top-1 right-1 bg-emerald-900/60 backdrop-blur-md px-1 py-[1px] rounded-[2px] text-[8px] font-mono text-emerald-400 pointer-events-none border border-emerald-500/20">AUD</div>
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
        <div className="w-[280px] flex flex-col border-r border-zinc-800 bg-[#09090b] h-full shrink-0">
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
