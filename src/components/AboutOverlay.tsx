import React, { useEffect, useRef } from 'react';
import { useUIStore } from '../store/uiStore';
// import Image from 'next/image';

const AboutOverlay: React.FC = () => {
    const { isAboutOpen, closeAbout } = useUIStore();
    const overlayRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeAbout();
        };
        if (isAboutOpen) {
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isAboutOpen, closeAbout]);

    // Close on click outside
    const handleClickOutside = (e: React.MouseEvent) => {
        if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
            closeAbout();
        }
    };

    if (!isAboutOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleClickOutside}
        >
            <div
                ref={overlayRef}
                className="relative flex flex-col items-center p-8 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-2xl w-96 backdrop-blur-xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={closeAbout}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                {/* Content */}
                <div className="mb-6 relative w-24 h-24">
                    {/* Using the same icon resource if available via public or creating a new mapping. 
                         For now, assuming we might need to copy the icon to public or use a generic one. 
                         Checking if we can access the generated icon path or if we should use a freshly imported one.
                         Since this is Next.js, images should be in public.
                         I'll assume 'icon.png' is not in public yet. I'll add a step to copy it.
                     */}
                    <img
                        src="/icon.png"
                        alt="Prism Logo"
                        className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                    />
                </div>

                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                    Prism
                </h2>

                <div className="flex items-center gap-2 mb-6">
                    <span className="px-2 py-0.5 text-xs font-medium text-white bg-zinc-800 rounded border border-zinc-700">BETA</span>
                    <span className="text-sm text-zinc-400">v0.1.0</span>
                </div>

                <div className="text-center space-y-2 text-sm text-zinc-400">
                    <p>Advanced Content Creation Suite</p>
                    <p>© 2026 SayToonz. All rights reserved.</p>
                </div>
            </div>
        </div>
    );
};

export default AboutOverlay;
