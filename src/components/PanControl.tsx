import React, { useRef, useState, useEffect } from 'react';

interface PanControlProps {
    x: number;
    y: number;
    onChange: (x: number, y: number) => void;
    scale?: number;
}

export const PanControl: React.FC<PanControlProps> = ({ x, y, onChange, scale = 1 }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const lastPos = useRef({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        lastPos.current = { x: e.clientX, y: e.clientY };
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;

            const dx = e.clientX - lastPos.current.x;
            const dy = e.clientY - lastPos.current.y;

            // Invert logic? 
            // If I drag the handle RIGHT, I expect the content to move RIGHT.
            // contentX/Y translates the content.
            // So +dx means +contentX.

            // Sensitivity factor? 1:1 might be good for direct manipulation.
            onChange(x + dx, y + dy);

            lastPos.current = { x: e.clientX, y: e.clientY };
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, x, y, onChange]);

    return (
        <div className="flex flex-col gap-2">
            <div
                ref={containerRef}
                className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded relative overflow-hidden cursor-move group"
                onMouseDown={handleMouseDown}
            >
                {/* Grid Lines / Crosshair */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <div className="w-full h-[1px] bg-zinc-500"></div>
                    <div className="h-full w-[1px] bg-zinc-500 absolute"></div>
                </div>

                {/* Content Representation */}
                {/* We visualize the content relative to the center. 
                    If contentX is 100, it is 100px to the right.
                    We center the handle at 50%, 50% + offset.
                */}
                <div
                    className="absolute w-4 h-4 bg-indigo-500 rounded-full shadow-lg border-2 border-white transform -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
                    style={{
                        left: `calc(50% + ${x * 0.2}px)`, // Scale down for visualization?
                        top: `calc(50% + ${y * 0.2}px)`,
                    }}
                >
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 text-[9px] bg-zinc-900 text-white px-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                        {x.toFixed(0)}, {y.toFixed(0)}
                    </div>
                </div>

                <div className="absolute bottom-2 right-2 text-[10px] text-zinc-500 pointer-events-none">
                    Drag to Pan
                </div>
            </div>

            {/* Fine-tuning inputs */}
            <div className="grid grid-cols-2 gap-2">
                <div className="flex bg-zinc-900 rounded border border-zinc-800 px-2 py-1 items-center">
                    <span className="text-[10px] text-zinc-500 w-4">X</span>
                    <input
                        type="number"
                        value={x}
                        onChange={(e) => onChange(parseInt(e.target.value) || 0, y)}
                        className="bg-transparent text-xs text-zinc-300 outline-none w-full text-right"
                    />
                </div>
                <div className="flex bg-zinc-900 rounded border border-zinc-800 px-2 py-1 items-center">
                    <span className="text-[10px] text-zinc-500 w-4">Y</span>
                    <input
                        type="number"
                        value={y}
                        onChange={(e) => onChange(x, parseInt(e.target.value) || 0)}
                        className="bg-transparent text-xs text-zinc-300 outline-none w-full text-right"
                    />
                </div>
            </div>
        </div>
    );
};
