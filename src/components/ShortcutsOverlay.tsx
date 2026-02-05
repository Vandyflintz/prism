import React, { useEffect, useRef } from 'react';
import { useUIStore } from '../store/uiStore';

const SHORTCUTS = [
    { label: 'Save Project', keys: ['⌘', 'S'] },
    { label: 'Open Project', keys: ['⌘', 'O'] },
    { label: 'Undo', keys: ['⌘', 'Z'] },
    { label: 'Redo', keys: ['⌘', '⇧', 'Z'] },
    { label: 'Split Track', keys: ['⌘', 'B'] },
    { label: 'Play / Pause', keys: ['Space'] },
    { label: 'Delete Item', keys: ['⌫'] },
];

const ShortcutsOverlay: React.FC = () => {
    const { isShortcutsOpen, closeShortcuts } = useUIStore();
    const overlayRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeShortcuts();
        };
        if (isShortcutsOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isShortcutsOpen, closeShortcuts]);

    // Close on click outside
    const handleClickOutside = (e: React.MouseEvent) => {
        if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
            closeShortcuts();
        }
    };

    if (!isShortcutsOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleClickOutside}
        >
            <div
                ref={overlayRef}
                className="relative flex flex-col p-8 bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl w-[500px] backdrop-blur-xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={closeShortcuts}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    Keyboard Shortcuts
                </h2>

                <div className="grid grid-cols-1 gap-3">
                    {SHORTCUTS.map((shortcut, index) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800/80 transition-colors border border-zinc-800/50">
                            <span className="text-sm font-medium text-zinc-300">
                                {shortcut.label}
                            </span>
                            <div className="flex items-center gap-1">
                                {shortcut.keys.map((key, kIndex) => (
                                    <kbd key={kIndex} className="px-2 py-1 text-xs font-semibold text-zinc-300 bg-zinc-700/80 border border-zinc-600 rounded">
                                        {key}
                                    </kbd>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-6 pt-4 border-t border-zinc-800 text-center text-xs text-zinc-500">
                    Pro Tip: You can customize these in future updates.
                </div>
            </div>
        </div>
    );
};

export default ShortcutsOverlay;
