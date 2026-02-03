import React from 'react';
import { usePrismStore } from '../store/usePrismStore';

export const PropertySidebar: React.FC = () => {
    const { project, selectedTrackId, updateTrack, setSelectedTrackId } = usePrismStore();

    if (!project) return null;

    const track = project.tracks.find(t => t.id === selectedTrackId);

    const handleChange = (key: string, value: any) => {
        if (!track) return;
        updateTrack(track.id, {
            props: { ...track.props, [key]: value }
        });
    };

    return (
        <div className="w-80 h-full bg-zinc-950 border-l border-zinc-800 flex flex-col z-20 shadow-xl overflow-hidden">
            {/* Sidebar Header */}
            <div className="h-14 flex items-center px-4 border-b border-zinc-800 glass">
                <span className="font-semibold text-sm tracking-wide text-zinc-300">Inspector</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">

                {/* Track Selector */}
                <div>
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 block">Active Track</label>
                    <div className="relative">
                        <select
                            value={selectedTrackId || ''}
                            onChange={(e) => setSelectedTrackId(e.target.value || null)}
                            className="w-full appearance-none bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-md px-3 py-2 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        >
                            <option value="">Select a track...</option>
                            {project.tracks.map(t => (
                                <option key={t.id} value={t.id}>
                                    {t.type.toUpperCase()} - {t.id}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-500">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>
                </div>

                {!track ? (
                    <div className="flex flex-col items-center justify-center py-10 opacity-50">
                        <div className="text-zinc-600 text-sm">No track selected</div>
                    </div>
                ) : (
                    <>
                        {/* Track Info */}
                        <div className="p-3 bg-zinc-900/50 rounded border border-zinc-800/50">
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-zinc-500">ID</span>
                                <span className="font-mono text-zinc-400 truncate max-w-[120px]">{track.id}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs mt-1">
                                <span className="text-zinc-500">Type</span>
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-medium uppercase text-[10px]">{track.type}</span>
                            </div>
                        </div>

                        {/* Transform Group */}
                        {track.type !== 'audio' && (
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Transform</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <span className="text-xs text-zinc-400">X</span>
                                        <input
                                            type="number"
                                            value={track.props.x}
                                            onChange={(e) => handleChange('x', parseInt(e.target.value))}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs text-zinc-400">Y</span>
                                        <input
                                            type="number"
                                            value={track.props.y}
                                            onChange={(e) => handleChange('y', parseInt(e.target.value))}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-zinc-400">Opacity</span>
                                            <span className="text-xs text-zinc-500">{Math.round(track.props.opacity * 100)}%</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="1" step="0.01"
                                            value={track.props.opacity}
                                            onChange={(e) => handleChange('opacity', parseFloat(e.target.value))}
                                            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Appearance Group (Text) */}
                        {track.type === 'text' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Text Appearance</label>
                                <div className="space-y-3">
                                    <textarea
                                        value={track.props.content}
                                        onChange={(e) => handleChange('content', e.target.value)}
                                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-zinc-200 focus:border-indigo-500 outline-none resize-y min-h-[60px]"
                                        placeholder="Enter text..."
                                    />
                                    <div className="flex gap-2">
                                        <input
                                            type="color"
                                            value={track.props.color || '#ffffff'}
                                            onChange={(e) => handleChange('color', e.target.value)}
                                            className="h-8 w-8 rounded bg-transparent cursor-pointer border-none"
                                        />
                                        <div className="flex-1 space-y-1">
                                            <span className="text-xs text-zinc-400 block">Size (px)</span>
                                            <input
                                                type="number"
                                                value={track.props.fontSize}
                                                onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Audio Group */}
                        {track.type === 'audio' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Audio Mixer</label>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-xs text-zinc-400">Volume</span>
                                        <span className="text-xs text-zinc-500">{((track.props.volume || 1) * 100).toFixed(0)}%</span>
                                    </div>
                                    <input
                                        type="range" min="0" max="1" step="0.05"
                                        value={track.props.volume ?? 1}
                                        onChange={(e) => handleChange('volume', parseFloat(e.target.value))}
                                        className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Animation Group (Image Only) */}
                        {track.type === 'image' && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Animations</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => updateTrack(track.id, { animation: track.animation === 'zoom_in' ? undefined : 'zoom_in' })}
                                        className={`flex flex-col items-center justify-center p-3 rounded bg-zinc-900 border transition-all group ${track.animation === 'zoom_in' ? 'border-blue-500 bg-blue-900/20' : 'border-zinc-800 hover:border-blue-500/50 hover:bg-blue-900/10'}`}
                                    >
                                        <svg className={`w-5 h-5 mb-2 ${track.animation === 'zoom_in' ? 'text-blue-400' : 'text-zinc-500 group-hover:text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                                        <span className={`text-[10px] ${track.animation === 'zoom_in' ? 'text-blue-200' : 'text-zinc-400'}`}>Zoom In</span>
                                    </button>
                                    <button
                                        onClick={() => updateTrack(track.id, { animation: track.animation === 'zoom_out' ? undefined : 'zoom_out' })}
                                        className={`flex flex-col items-center justify-center p-3 rounded bg-zinc-900 border transition-all group ${track.animation === 'zoom_out' ? 'border-blue-500 bg-blue-900/20' : 'border-zinc-800 hover:border-blue-500/50 hover:bg-blue-900/10'}`}
                                    >
                                        <svg className={`w-5 h-5 mb-2 ${track.animation === 'zoom_out' ? 'text-blue-400' : 'text-zinc-500 group-hover:text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" /></svg>
                                        <span className={`text-[10px] ${track.animation === 'zoom_out' ? 'text-blue-200' : 'text-zinc-400'}`}>Zoom Out</span>
                                    </button>
                                    <button
                                        onClick={() => updateTrack(track.id, { animation: track.animation === 'slide_in' ? undefined : 'slide_in' })}
                                        className={`flex flex-col items-center justify-center p-3 rounded bg-zinc-900 border transition-all group ${track.animation === 'slide_in' ? 'border-blue-500 bg-blue-900/20' : 'border-zinc-800 hover:border-blue-500/50 hover:bg-blue-900/10'}`}
                                    >
                                        <svg className={`w-5 h-5 mb-2 ${track.animation === 'slide_in' ? 'text-blue-400' : 'text-zinc-500 group-hover:text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                        <span className={`text-[10px] ${track.animation === 'slide_in' ? 'text-blue-200' : 'text-zinc-400'}`}>Slide In</span>
                                    </button>
                                    <button
                                        onClick={() => updateTrack(track.id, { animation: track.animation === 'ken_burns' ? undefined : 'ken_burns' })}
                                        className={`flex flex-col items-center justify-center p-3 rounded bg-zinc-900 border transition-all group ${track.animation === 'ken_burns' ? 'border-blue-500 bg-blue-900/20' : 'border-zinc-800 hover:border-blue-500/50 hover:bg-blue-900/10'}`}
                                    >
                                        <svg className={`w-5 h-5 mb-2 ${track.animation === 'ken_burns' ? 'text-blue-400' : 'text-zinc-500 group-hover:text-blue-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <span className={`text-[10px] ${track.animation === 'ken_burns' ? 'text-blue-200' : 'text-zinc-400'}`}>Ken Burns</span>
                                    </button>
                                </div>
                            </div>
                        )}

                    </>
                )}

            </div>
        </div>
    );
};
