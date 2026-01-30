import React from 'react';

interface TimelineActionItemProps {
    action: Record<string, any>;
    row?: Record<string, any>;
}

export const TimelineActionItem: React.FC<TimelineActionItemProps> = ({ action }) => {
    const { label } = action.data || {};
    const type = label?.split(' ')[0]?.toLowerCase() || 'unknown';

    let typeStyles = "bg-zinc-700 border-zinc-500 text-zinc-100";
    let icon = "❓";

    if (activeType(type, 'audio')) {
        typeStyles = "bg-emerald-500/10 border-emerald-500 text-emerald-100";
        icon = "🎵";
    } else if (activeType(type, 'text')) {
        typeStyles = "bg-violet-500/10 border-violet-500 text-violet-100";
        icon = "T";
    } else if (activeType(type, 'image')) {
        typeStyles = "bg-blue-500/10 border-blue-500 text-blue-100";
        icon = "🖼️";
    } else if (activeType(type, 'shape')) {
        typeStyles = "bg-zinc-600/30 border-zinc-400 text-zinc-200";
        icon = "⏹️";
    }

    return (
        <div className={`w-full h-full rounded-[3px] border-l-[3px] ${typeStyles} flex items-center px-2 select-none overflow-hidden transition-colors hover:bg-opacity-20`}>
            <span className="mr-2 text-[10px] opacity-70">{icon}</span>
            <span className="text-[10px] font-medium truncate font-sans tracking-wide">
                {label}
            </span>
        </div>
    );
};

function activeType(actual: string, target: string) {
    return actual.includes(target);
}
