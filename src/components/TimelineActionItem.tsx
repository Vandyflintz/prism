import React from 'react';

interface TimelineActionItemProps {
    action: Record<string, any>;
    row?: Record<string, any>;
}

export const TimelineActionItem: React.FC<TimelineActionItemProps> = ({ action }) => {
    const { label, type } = action.data || {};

    // Default Styles
    let baseClasses = "flex items-center px-3 h-[90%] my-auto rounded-md shadow-sm border text-xs font-medium select-none overflow-hidden transition-all hover:brightness-110 ring-1 ring-black/10";
    let colorClasses = "bg-zinc-800 border-zinc-700 text-zinc-300";
    let icon = null;

    switch (type) {
        case 'audio':
            colorClasses = "bg-emerald-900/80 border-emerald-700/50 text-emerald-200 border-l-4 border-l-emerald-500";
            icon = <svg className="w-3 h-3 mr-1.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>;
            break;
        case 'text':
            colorClasses = "bg-violet-900/80 border-violet-700/50 text-violet-200 border-l-4 border-l-violet-500";
            icon = <svg className="w-3 h-3 mr-1.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>;
            break;
        case 'image':
            colorClasses = "bg-blue-900/80 border-blue-700/50 text-blue-200 border-l-4 border-l-blue-500";
            icon = <svg className="w-3 h-3 mr-1.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
            break;
        case 'shape':
            colorClasses = "bg-zinc-800/80 border-zinc-600/50 text-zinc-300 border-l-4 border-l-zinc-500";
            icon = <svg className="w-3 h-3 mr-1.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" /></svg>;
            break;
        default:
            break;
    }

    return (
        <div className={`w-full h-full flex flex-col justify-center`}>
            <div className={`${baseClasses} ${colorClasses}`}>
                {icon}
                <span className="truncate">{label || 'Untitled'}</span>
            </div>
        </div>
    );
};
