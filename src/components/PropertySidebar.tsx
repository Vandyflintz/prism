import React from 'react';
import { usePrismStore } from '../store/usePrismStore';
import { PanControl } from './PanControl';

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

    const handleNumberChange = (key: string, value: string, isFloat = false) => {
        if (!track) return;
        let parsed = isFloat ? parseFloat(value) : parseInt(value);
        if (isNaN(parsed)) parsed = 0;
        updateTrack(track.id, {
            props: { ...track.props, [key]: parsed }
        });
    };

    return (
        <div className="w-full h-full bg-zinc-950 border-l border-zinc-800 flex flex-col z-20 shadow-xl overflow-hidden">
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
                                            onChange={(e) => handleNumberChange('x', e.target.value, false)}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-xs text-zinc-400">Y</span>
                                        <input
                                            type="number"
                                            value={track.props.y}
                                            onChange={(e) => handleNumberChange('y', e.target.value, false)}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 outline-none"
                                        />
                                    </div>
                                    <div className="col-span-2 grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/50">
                                        <div className="space-y-1">
                                            <span className="text-xs text-zinc-400">Width</span>
                                            <input
                                                type="number"
                                                value={track.props.width || 0}
                                                onChange={(e) => handleNumberChange('width', e.target.value, false)}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-xs text-zinc-400">Height</span>
                                            <input
                                                type="number"
                                                value={track.props.height || 0}
                                                onChange={(e) => handleNumberChange('height', e.target.value, false)}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 outline-none"
                                            />
                                        </div>
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
                                                value={track.props.fontSize ?? 0}
                                                onChange={(e) => handleNumberChange('fontSize', e.target.value, false)}
                                                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Audio Group */}
                        {(track.type === 'audio' || track.type === 'video') && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Audio Mixer</label>
                                <div className="space-y-4">
                                    {/* Volume */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-zinc-400">Volume</span>
                                            <span className="text-xs text-zinc-500 font-mono">{((track.props.volume ?? 1) * 100).toFixed(0)}%</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="2" step="0.05"
                                            value={track.props.volume ?? 1}
                                            onChange={(e) => handleChange('volume', parseFloat(e.target.value))}
                                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400"
                                        />
                                    </div>

                                    {/* Pitch / Speed */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-zinc-400">Pitch / Speed</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-zinc-500 font-mono">{(track.props.playbackRate ?? 1).toFixed(2)}x</span>
                                                <button 
                                                    onClick={() => handleChange('playbackRate', 1)}
                                                    className="text-[9px] text-zinc-600 hover:text-zinc-400 uppercase font-bold"
                                                >Reset</button>
                                            </div>
                                        </div>
                                        <input
                                            type="range" min="0.5" max="2" step="0.05"
                                            value={track.props.playbackRate ?? 1}
                                            onChange={(e) => handleChange('playbackRate', parseFloat(e.target.value))}
                                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-500 hover:accent-sky-400"
                                        />
                                    </div>

                                    {/* Bass */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-zinc-400">Bass Boost</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-zinc-500 font-mono">{(track.props.bass ?? 0) > 0 ? '+' : ''}{track.props.bass ?? 0} dB</span>
                                                <button 
                                                    onClick={() => handleChange('bass', 0)}
                                                    className="text-[9px] text-zinc-600 hover:text-zinc-400 uppercase font-bold"
                                                >Reset</button>
                                            </div>
                                        </div>
                                        <input
                                            type="range" min="-20" max="20" step="1"
                                            value={track.props.bass ?? 0}
                                            onChange={(e) => handleChange('bass', parseInt(e.target.value))}
                                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                                        />
                                    </div>

                                    {/* Treble */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-zinc-400">Treble</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-zinc-500 font-mono">{(track.props.treble ?? 0) > 0 ? '+' : ''}{track.props.treble ?? 0} dB</span>
                                                <button 
                                                    onClick={() => handleChange('treble', 0)}
                                                    className="text-[9px] text-zinc-600 hover:text-zinc-400 uppercase font-bold"
                                                >Reset</button>
                                            </div>
                                        </div>
                                        <input
                                            type="range" min="-20" max="20" step="1"
                                            value={track.props.treble ?? 0}
                                            onChange={(e) => handleChange('treble', parseInt(e.target.value))}
                                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-400"
                                        />
                                    </div>

                                    {/* Stereo Pan */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-zinc-400">Stereo Pan</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-zinc-500 font-mono">
                                                    {(track.props.pan ?? 0) === 0 ? 'Center' : (track.props.pan ?? 0) < 0 ? `L ${Math.abs(track.props.pan ?? 0).toFixed(1)}` : `R ${(track.props.pan ?? 0).toFixed(1)}`}
                                                </span>
                                                <button 
                                                    onClick={() => handleChange('pan', 0)}
                                                    className="text-[9px] text-zinc-600 hover:text-zinc-400 uppercase font-bold"
                                                >Reset</button>
                                            </div>
                                        </div>
                                        <input
                                            type="range" min="-1" max="1" step="0.1"
                                            value={track.props.pan ?? 0}
                                            onChange={(e) => handleChange('pan', parseFloat(e.target.value))}
                                            className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500 hover:accent-purple-400"
                                        />
                                    </div>

                                    {/* Fades */}
                                    <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/50">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-zinc-500 uppercase font-bold">Fade In (s)</span>
                                            <input
                                                type="number" min="0" max="10" step="0.1"
                                                value={track.props.fadeInDuration ?? 0}
                                                onChange={(e) => handleNumberChange('fadeInDuration', e.target.value, true)}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-zinc-500 uppercase font-bold">Fade Out (s)</span>
                                            <input
                                                type="number" min="0" max="10" step="0.1"
                                                value={track.props.fadeOutDuration ?? 0}
                                                onChange={(e) => handleNumberChange('fadeOutDuration', e.target.value, true)}
                                                className="w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:border-indigo-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Image/Video Layout Settings */}
                        {(track.type === 'image' || track.type === 'video') && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="h-[1px] bg-zinc-800 my-4" />
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Frame & Crop</label>

                                <div className="space-y-3">
                                    {/* Object Fit Dropdown */}
                                    <div className="space-y-1">
                                        <span className="text-xs text-zinc-400">Fit Mode</span>
                                        <select
                                            value={track.props.objectFit || 'cover'}
                                            onChange={(e) => handleChange('objectFit', e.target.value)}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 outline-none"
                                        >
                                            <option value="cover">Cover (Default)</option>
                                            <option value="contain">Contain (Fit)</option>
                                            <option value="fill">Fill (Stretch)</option>
                                            <option value="none">Manual / Crop</option>
                                        </select>
                                    </div>

                                    {/* Manual Crop Controls */}
                                    {track.props.objectFit === 'none' && (
                                        <div className="p-2 bg-zinc-900/30 rounded border border-zinc-800/50 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] font-bold text-zinc-500 uppercase">Crop Transform</span>
                                                <button
                                                    onClick={() => updateTrack(track.id, { props: { ...track.props, contentX: 0, contentY: 0, contentScale: 1 } })}
                                                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                                                >
                                                    Reset
                                                </button>
                                            </div>

                                            {/* Interactive Pan Control */}
                                            <PanControl
                                                x={track.props.contentX || 0}
                                                y={track.props.contentY || 0}
                                                onChange={(x: number, y: number) => {
                                                    updateTrack(track.id, {
                                                        props: { ...track.props, contentX: x, contentY: y }
                                                    });
                                                }}
                                            />

                                            <div className="space-y-1">
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-zinc-400">Zoom</span>
                                                    <span className="text-xs text-zinc-500">{Math.round((track.props.contentScale || 1) * 100)}%</span>
                                                </div>
                                                <input
                                                    type="range" min="0.1" max="3" step="0.1"
                                                    value={track.props.contentScale || 1}
                                                    onChange={(e) => handleChange('contentScale', parseFloat(e.target.value))}
                                                    className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Color & Effects Group */}
                        {(track.type === 'image' || track.type === 'video') && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="h-[1px] bg-zinc-800 my-4" />
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 block">Color & Effects</label>

                                <div className="space-y-4">
                                    {/* Brightness / Exposure */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-zinc-400">Exposure</span>
                                            <span className="text-xs text-zinc-500">{Math.round((track.props.brightness ?? 1) * 100)}%</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="3" step="0.05"
                                            value={track.props.brightness ?? 1}
                                            onChange={(e) => handleChange('brightness', parseFloat(e.target.value))}
                                            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                        />
                                    </div>

                                    {/* Contrast */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-zinc-400">Contrast</span>
                                            <span className="text-xs text-zinc-500">{Math.round((track.props.contrast ?? 1) * 100)}%</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="3" step="0.05"
                                            value={track.props.contrast ?? 1}
                                            onChange={(e) => handleChange('contrast', parseFloat(e.target.value))}
                                            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                        />
                                    </div>

                                    {/* Saturation */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-zinc-400">Saturation</span>
                                            <span className="text-xs text-zinc-500">{Math.round((track.props.saturate ?? 1) * 100)}%</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="3" step="0.05"
                                            value={track.props.saturate ?? 1}
                                            onChange={(e) => handleChange('saturate', parseFloat(e.target.value))}
                                            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                        />
                                    </div>

                                    {/* Grayscale */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-zinc-400">Grayscale</span>
                                            <span className="text-xs text-zinc-500">{Math.round((track.props.grayscale ?? 0) * 100)}%</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="1" step="0.01"
                                            value={track.props.grayscale ?? 0}
                                            onChange={(e) => handleChange('grayscale', parseFloat(e.target.value))}
                                            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                        />
                                    </div>

                                    {/* Blur */}
                                    <div className="space-y-1">
                                        <div className="flex justify-between">
                                            <span className="text-xs text-zinc-400">Blur (px)</span>
                                            <span className="text-xs text-zinc-500">{track.props.blur ?? 0}px</span>
                                        </div>
                                        <input
                                            type="range" min="0" max="20" step="1"
                                            value={track.props.blur ?? 0}
                                            onChange={(e) => handleChange('blur', parseFloat(e.target.value))}
                                            className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Animation: Entrance */}


                        {/* Animation: Motion Loop */}
                        {(track.type === 'image' || track.type === 'video' || track.type === 'text') && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-4 mb-3 block">Motion Loop</label>

                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <span className="text-xs text-zinc-400">Effect</span>
                                        <select
                                            value={track.motion || ''}
                                            onChange={(e) => updateTrack(track.id, { motion: e.target.value || undefined })}
                                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:border-indigo-500 outline-none"
                                        >
                                            <option value="">None</option>
                                            <option value="pulse">Pulse</option>
                                            <option value="shake">Shake</option>
                                            <option value="wiggle">Wiggle (Rotate)</option>
                                            <option value="spin">Spin</option>
                                            <option value="bounce">Bounce</option>
                                            <option value="ken_burns">Ken Burns (Linear)</option>
                                        </select>
                                    </div>

                                    {track.motion && (
                                        <>
                                            <div className="space-y-1">
                                                <div className="flex justify-between">
                                                    <span className="text-xs text-zinc-400">Speed / Period</span>
                                                    <span className="text-xs text-zinc-500">{track.motionSpeed || 90}f</span>
                                                </div>
                                                <input
                                                    type="range" min="15" max="300" step="5"
                                                    value={track.motionSpeed || 90}
                                                    onChange={(e) => updateTrack(track.id, { motionSpeed: parseInt(e.target.value) })}
                                                    className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                />
                                            </div>

                                            {track.motion !== 'ken_burns' && (
                                                <div className="space-y-1">
                                                    <div className="flex justify-between">
                                                        <span className="text-xs text-zinc-400">Repeat Count</span>
                                                        <span className="text-xs text-zinc-500">{!track.motionRepeat ? 'Infinite' : track.motionRepeat}</span>
                                                    </div>
                                                    <input
                                                        type="range" min="0" max="10" step="1"
                                                        value={track.motionRepeat || 0}
                                                        onChange={(e) => updateTrack(track.id, { motionRepeat: parseInt(e.target.value) })}
                                                        className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                    </>
                )}

            </div>
        </div>
    );
};
