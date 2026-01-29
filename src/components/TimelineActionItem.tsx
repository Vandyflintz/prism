import React from 'react';

interface TimelineActionItemProps {
    action: Record<string, any>;
    row?: Record<string, any>;
}

export const TimelineActionItem: React.FC<TimelineActionItemProps> = ({ action }) => {
    const { label } = action.data || {};
    const type = label?.split(' ')[0]?.toLowerCase() || 'unknown';

    let bgClass = "bg-zinc-700 border-zinc-500";
    let icon = "❓";

    if (activeType(type, 'audio')) {
        bgClass = "bg-gradient-to-r from-emerald-900/90 to-emerald-800/90 border-l-4 border-emerald-500 ring-1 ring-emerald-500/50";
        icon = "🎵";
    } else if (activeType(type, 'text')) {
        bgClass = "bg-gradient-to-r from-violet-900/90 to-violet-800/90 border-l-4 border-violet-500 ring-1 ring-violet-500/50";
        icon = "Yz";
    } else if (activeType(type, 'image')) {
        bgClass = "bg-gradient-to-r from-blue-900/90 to-blue-800/90 border-l-4 border-blue-500 ring-1 ring-blue-500/50";
        icon = "🖼️";
    }

    return (
        <div className={`w-full h-full rounded-md ${bgClass} flex items-center px-2 shadow-lg overflow-hidden select-none transition-all hover:brightness-110 active:scale-[0.99]`}>
            <span className="mr-2 text-xs opacity-80 filter drop-shadow-md">{icon}</span>
            <span className="text-[10px] font-semibold text-white/90 truncate font-mono tracking-tight drop-shadow-md">
                {label}
            </span>

            {/* Gloss Effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none"></div>
        </div>
    );
};

function activeType(actual: string, target: string) {
    return actual.includes(target);
}
