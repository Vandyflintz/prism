"use client";
import React from 'react';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    progress: number;
    status: 'idle' | 'rendering' | 'done' | 'error';
    outputValue?: string; // path or error message
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, progress, status, outputValue }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-[400px] bg-zinc-900 border border-zinc-700 rounded-xl p-6 shadow-2xl flex flex-col gap-4">
                <h2 className="text-xl font-bold text-white">Export Video</h2>

                {status === 'rendering' && (
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between text-sm text-zinc-400">
                            <span>Rendering...</span>
                            <span>{Math.round(progress * 100)}%</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                                style={{ width: `${progress * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                {status === 'done' && (
                    <div className="flex flex-col gap-4 text-center">
                        <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <p className="text-zinc-300">Export Completed!</p>
                        <p className="text-xs text-zinc-500 break-all">{outputValue}</p>
                    </div>
                )}

                {status === 'error' && (
                    <div className="flex flex-col gap-4 text-center">
                        <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </div>
                        <p className="text-red-400">Export Failed</p>
                        <p className="text-xs text-zinc-500">{outputValue}</p>
                    </div>
                )}

                <div className="flex justify-end mt-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-sm transition-colors"
                    >
                        {status === 'rendering' ? 'Cancel (Not Implemented)' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};
