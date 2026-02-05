import React from 'react';
import { usePrismStore } from '../store/usePrismStore';

interface TimelineSettingsModalProps {
    onClose: () => void;
}

const PRESET_RATIOS = [
    { label: 'YouTube (16:9)', w: 1920, h: 1080 },
    { label: 'Shorts/Reels (9:16)', w: 1080, h: 1920 },
    { label: 'Instagram Post (1:1)', w: 1080, h: 1080 },
    { label: 'Portrait (4:5)', w: 1080, h: 1350 },
    { label: 'Ultrawide (21:9)', w: 2560, h: 1080 },
];

export const TimelineSettingsModal: React.FC<TimelineSettingsModalProps> = ({ onClose }) => {
    const { project, updateProjectSettings } = usePrismStore();

    // Local state for draft changes
    const [width, setWidth] = React.useState(project?.width || 1920);
    const [height, setHeight] = React.useState(project?.height || 1080);
    const [fps, setFps] = React.useState(project?.fps || 30);
    const [durationSec, setDurationSec] = React.useState((project?.durationInFrames || 300) / (project?.fps || 30));
    const [bgColor, setBgColor] = React.useState(project?.backgroundColor || '#000000');

    // Derived state for ratio label
    // const activeRatio = PRESET_RATIOS.find(r => r.w === width && r.h === height)?.label || 'Custom';

    const handleApply = () => {
        updateProjectSettings({
            width,
            height,
            fps,
            durationInFrames: Math.round(durationSec * fps),
            backgroundColor: bgColor
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-[500px] bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans">
                {/* Header */}
                <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900/50">
                    <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Project Settings
                    </h3>
                    <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-6 text-sm">

                    {/* Basic Settings Section */}
                    <div className="flex flex-col gap-4">
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Composition</span>

                        {/* Aspect Ratio Presets */}
                        <div className="flex flex-col gap-2">
                            <label className="text-zinc-400">Resolution Preset</label>
                            <div className="grid grid-cols-3 gap-2">
                                {PRESET_RATIOS.map(p => (
                                    <button
                                        key={p.label}
                                        onClick={() => { setWidth(p.w); setHeight(p.h); }}
                                        className={`px-2 py-2 rounded border text-xs text-center transition-all ${p.w === width && p.h === height
                                            ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                                            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700'
                                            }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Resolution Inputs */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-zinc-400 text-xs">Width (px)</label>
                                <input
                                    type="number"
                                    value={width}
                                    onChange={(e) => setWidth(Number(e.target.value))}
                                    className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-zinc-400 text-xs">Height (px)</label>
                                <input
                                    type="number"
                                    value={height}
                                    onChange={(e) => setHeight(Number(e.target.value))}
                                    className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    </div>


                    <div className="h-[1px] bg-zinc-800 w-full" />


                    {/* Timing & Color Section */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Left: Timing */}
                        <div className="flex flex-col gap-4">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Timing</span>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-zinc-400 text-xs">Frame Rate</label>
                                <select
                                    value={fps}
                                    onChange={(e) => setFps(Number(e.target.value))}
                                    className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 focus:border-indigo-500 focus:outline-none appearance-none"
                                >
                                    <option value={24}>24 FPS</option>
                                    <option value={25}>25 FPS</option>
                                    <option value={30}>30 FPS</option>
                                    <option value={60}>60 FPS</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-zinc-400 text-xs">Duration (sec)</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={durationSec}
                                        onChange={(e) => setDurationSec(Number(e.target.value))}
                                        className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 w-full focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right: Appearance */}
                        <div className="flex flex-col gap-4">
                            <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Appearance</span>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-zinc-400 text-xs">Background Color</label>
                                <div className="flex gap-2">
                                    <input
                                        type="color"
                                        value={bgColor}
                                        onChange={(e) => setBgColor(e.target.value)}
                                        className="w-10 h-9 p-0 bg-transparent border-0 rounded cursor-pointer"
                                    />
                                    <input
                                        type="text"
                                        value={bgColor}
                                        onChange={(e) => setBgColor(e.target.value)}
                                        className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-200 w-full focus:border-indigo-500 focus:outline-none font-mono uppercase"
                                    />
                                </div>
                            </div>

                            {/* Placeholder for Bitrate/Quality (Visual Only for now) */}
                            <div className="flex flex-col gap-1.5 opacity-50 cursor-not-allowed" title="Coming Soon">
                                <label className="text-zinc-500 text-xs">Export Bitrate</label>
                                <select disabled className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-zinc-500 appearance-none">
                                    <option>High (Default)</option>
                                </select>
                            </div>
                        </div>
                    </div>


                    <div className="h-[1px] bg-zinc-800 w-full" />


                </div>

                {/* Footer */}
                <div className="h-16 border-t border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50">
                    <div className="text-xs text-zinc-500">
                        {(durationSec * fps).toFixed(0)} Total Frames
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-4 py-2 rounded text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
                        <button onClick={handleApply} className="px-5 py-2 rounded text-sm bg-indigo-600 text-white font-medium hover:bg-indigo-500 shadow-lg shadow-indigo-900/20 transition-all active:scale-95">Save Changes</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

