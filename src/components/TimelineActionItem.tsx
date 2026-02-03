import React, { useRef, useEffect, useState } from 'react';
import { AudioWaveform } from './AudioWaveform';

interface TimelineActionItemProps {
    action: Record<string, any>;
    row?: Record<string, any>;
}

export const TimelineActionItem: React.FC<TimelineActionItemProps> = ({ action }) => {
    const { label, type, src, color } = action.data || {};

    // Default Styles
    let baseClasses = "flex items-center px-3 h-[24px] my-auto rounded-md shadow-md border text-xs font-medium select-none overflow-hidden transition-all hover:brightness-110 ring-1 ring-white/10 relative";
    let colorClasses = "bg-zinc-700 border-zinc-600 text-zinc-200";
    let icon = null;

    // Custom background style for thumbnails
    let style: React.CSSProperties = {};

    switch (type) {
        case 'audio':
            colorClasses = "bg-emerald-900/80 border-emerald-700/50 text-emerald-200 border-l-4 border-l-emerald-500";
            icon = <svg className="w-3 h-3 mr-1.5 opacity-70 mb-[1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>;
            break;
        case 'text':
            colorClasses = "bg-violet-900/80 border-violet-700/50 text-violet-200 border-l-4 border-l-violet-500";
            icon = <svg className="w-3 h-3 mr-1.5 opacity-70 mb-[1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>;
            break;
        case 'image':
            colorClasses = "bg-blue-900/80 border-blue-700/50 text-blue-200 border-l-4 border-l-blue-500";
            if (src) {
                // If we have a source, use it as a repeating background (filmstrip style)
                style = {
                    backgroundImage: `url(${src})`,
                    backgroundSize: 'auto 100%', // Fit height
                    backgroundRepeat: 'repeat-x',
                    backgroundPosition: 'left center'
                };
                // Make text readable over image
                colorClasses += " text-white text-shadow-sm";
            }
            icon = <svg className="w-3 h-3 mr-1.5 opacity-90 drop-shadow-md mb-[1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
            break;
        case 'shape':
            colorClasses = "bg-zinc-800/80 border-zinc-600/50 text-zinc-300 border-l-4 border-l-zinc-500";
            if (color) {
                // Use the shape's specific color if available
                style = { backgroundColor: color };
                // Ensure text contrast? Assuming dark BG for now or adding a scrim
                colorClasses = "border-zinc-700 text-zinc-200 border-l-4 border-l-zinc-400";
            }
            icon = <svg className="w-3 h-3 mr-1.5 opacity-70 mb-[1px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" /></svg>;
            break;
        default:
            break;
    }

    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (containerRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            setDimensions({ width, height });
        }
    }, [action]);

    // Helper: Determine if we should show waveform
    // Only if type is audio and we have a valid src
    const showWaveform = type === 'audio' && src;

    return (
        <div ref={containerRef} className={`w-full h-full flex flex-col justify-center`}>
            {/* If using image background, add a dark scrim overlay to make text readable */}
            <div className={`${baseClasses} ${colorClasses} overflow-hidden group`} style={style}>
                {src && type === 'image' && <div className="absolute inset-0 bg-black/40 pointer-events-none" />}

                {/* Audio Waveform Background */}
                {showWaveform && (
                    <div className="absolute inset-0 z-0 opacity-50 mix-blend-overlay">
                        {/* We pass dynamically measured width to canvas */}
                        {dimensions.width > 0 && (
                            <AudioWaveform
                                src={src}
                                width={dimensions.width}
                                height={24} // Fixed height of row
                                color="#a7f3d0" // emerald-200
                            />
                        )}
                    </div>
                )}

                <div className="relative flex items-center z-10 w-full pl-1">
                    {icon}
                    <span className={`truncate drop-shadow-md transition-opacity duration-200 ${type === 'text' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {label || 'Untitled'}
                    </span>
                </div>
            </div>
        </div>
    );
};
