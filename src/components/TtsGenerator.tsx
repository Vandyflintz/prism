'use client';

import React, { useState, useEffect } from 'react';
import { usePrismStore } from '../store/usePrismStore';
import { PrismAsset, PrismTrack } from '../../types/prism';

export const TtsGenerator: React.FC = () => {
    const {
        isTtsModalOpen, toggleTtsModal, addAsset, addTrack, currentTime
    } = usePrismStore();

    const [text, setText] = useState('');
    const [provider, setProvider] = useState<'piper-local' | 'elevenlabs-cloud'>('piper-local');
    const [voiceId, setVoiceId] = useState('');
    const [voices, setVoices] = useState<{ id: string, name: string }[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoadingVoices, setIsLoadingVoices] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Settings
    const [showSettings, setShowSettings] = useState(false);
    const [elevenLabsKey, setElevenLabsKey] = useState('');
    const [piperPath, setPiperPath] = useState('');
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean, message: string } | null>(null);
    const [downloadStatus, setDownloadStatus] = useState('');
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        if (isTtsModalOpen && (window as any).electron) {
            // Load settings from Electron
            (window as any).electron.getTtsSettings().then((s: any) => {
                setElevenLabsKey(s.elevenLabsKey || '');
                setPiperPath(s.piperPath || '');
            });
            // Initial fetch to populate local voices at least
            fetchVoices();

            // Set up download progress listener
            const cleanup = (window as any).electron.onDownloadProgress((data: { status: string, progress: number }) => {
                setDownloadStatus(data.status);
                setDownloadProgress(data.progress);
            });

            return cleanup;
        }
    }, [isTtsModalOpen]);

    // Fetch voices when provider changes OR when settings change (API Key)
    useEffect(() => {
        if (isTtsModalOpen && (window as any).electron) {
            fetchVoices();
        }
    }, [provider, isTtsModalOpen, elevenLabsKey]);

    const fetchVoices = async () => {
        if (!(window as any).electron) return;
        setIsLoadingVoices(true);
        try {
            const v = await (window as any).electron.getVoices(provider);
            console.log(`[TTS] Fetched ${v.length} voices for ${provider}`);
            setVoices(v);

            if (v.length > 0) {
                // Determine best voice to select
                const currentVoiceStillValid = v.find((voice: any) => voice.id === voiceId);
                if (!currentVoiceStillValid) {
                    setVoiceId(v[0].id);
                }
            } else {
                setVoiceId('');
            }
        } catch (err) {
            console.error("Failed to fetch voices", err);
        } finally {
            setIsLoadingVoices(false);
        }
    };

    if (!isTtsModalOpen) return null;

    const handleSaveSettings = async () => {
        if (!(window as any).electron) {
            setShowSettings(false);
            return;
        }
        await (window as any).electron.updateTtsSettings({
            elevenLabsKey,
            piperPath
        });
        setTestResult(null);
        setShowSettings(false);
    };

    const handleTestConnection = async () => {
        if (!(window as any).electron) return;
        setIsTestingConnection(true);
        setTestResult(null);
        try {
            // First update the key in the store so the test uses the latest
            await (window as any).electron.updateTtsSettings({ elevenLabsKey });
            const result = await (window as any).electron.testTtsConnection();
            setTestResult({ success: true, message: `Connected! Tier: ${result.user.tier}` });
            fetchVoices(); // Refresh voices on success
        } catch (err: any) {
            setTestResult({ success: false, message: err.message });
        } finally {
            setIsTestingConnection(false);
        }
    };

    const onGenerate = (outputPath: string) => {
        // Add as Asset
        const assetId = crypto.randomUUID();
        const newAsset: PrismAsset = {
            id: assetId,
            type: 'audio',
            src: `prism-asset://${outputPath}`,
            metadata: {
                originalName: `TTS: ${text.substring(0, 20)}...`,
                tts: {
                    isTts: true,
                    ttsText: text,
                    ttsVoiceId: voiceId,
                    ttsProvider: provider
                }
            }
        };
        addAsset(newAsset);

        // Add to Timeline
        const newTrack: PrismTrack = {
            id: crypto.randomUUID(),
            type: 'audio',
            startFrame: currentTime,
            durationInFrames: 150, // Temporary, should ideally get duration from file
            props: {
                x: 0, y: 0, width: 0, height: 0, opacity: 1, rotation: 0, scale: 1,
                assetId: assetId,
                volume: 1
            }
        };
        addTrack(newTrack);

        toggleTtsModal();
        setText('');
    };

    const handleGenerate = async () => {
        if (!text.trim()) return;
        setIsGenerating(true);
        setError('');

        try {
            if (!(window as any).electron) {
                throw new Error("TTS Generation is only available in the Desktop App.");
            }
            const outputPath = await (window as any).electron.generateTts({
                text,
                voiceId,
                provider
            });
            onGenerate(outputPath);
        } catch (err: any) {
            console.error(err);
            if (err.message && err.message.includes("Prism Voice Engine is missing")) {
                setError("ENGINE_MISSING");
            } else {
                setError(err.message || 'Unknown generation error');
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownloadEngine = async () => {
        if (!(window as any).electron) return;
        setIsDownloading(true);
        setError('');
        try {
            await (window as any).electron.downloadPiper();
            setDownloadStatus('');
            // Optional: trigger generation automatically after download?
            // handleGenerate();
            setError(''); // clear the missing error
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-zinc-800 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                    <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">AI Voiceover</h2>
                        <p className="text-sm text-zinc-400 mt-1">Generate ultra-realistic speech from text</p>
                    </div>
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                        title="TTS Settings"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 00-1.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 002.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {showSettings ? (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-200">
                            <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                TTS Configuration
                            </h3>

                            <div className="space-y-3">
                                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">ElevenLabs API Key</label>
                                <input
                                    type="password"
                                    value={elevenLabsKey}
                                    onChange={(e) => setElevenLabsKey(e.target.value)}
                                    placeholder="Enter your xi-api-key..."
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                />
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={handleTestConnection}
                                        disabled={isTestingConnection || !elevenLabsKey}
                                        className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 flex items-center gap-1"
                                    >
                                        {isTestingConnection ? (
                                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        ) : null}
                                        Test Connection
                                    </button>
                                    {testResult && (
                                        <span className={`text-[10px] font-medium ${testResult.success ? 'text-emerald-500' : 'text-red-500'}`}>
                                            {testResult.message}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Custom Prism Engine Path</label>
                                <input
                                    type="text"
                                    value={piperPath}
                                    onChange={(e) => setPiperPath(e.target.value)}
                                    placeholder="/path/to/prism/engine/binary"
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                                />
                                <p className="text-[10px] text-zinc-500 italic">Leave empty to auto-download or use the bundled Prism Engine.</p>
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={handleSaveSettings}
                                    className="flex-1 bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition-colors shadow-lg"
                                >
                                    Save Settings
                                </button>
                                <button
                                    onClick={() => setShowSettings(false)}
                                    className="px-6 bg-zinc-800 text-zinc-300 font-bold py-3 rounded-xl hover:bg-zinc-700 transition-colors"
                                >
                                    Back
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Your Script</label>
                                <textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="Type what you want the AI to say..."
                                    className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-all leading-relaxed"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Provider</label>
                                    <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                                        <button
                                            onClick={() => setProvider('piper-local')}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${provider === 'piper-local' ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
                                        >
                                            Prism Native
                                        </button>
                                        <button
                                            onClick={() => setProvider('elevenlabs-cloud')}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${provider === 'elevenlabs-cloud' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                                        >
                                            Cloud
                                            <span className="text-[8px] bg-white/20 px-1 rounded text-white/80">PRO</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Voice</label>
                                        {provider === 'elevenlabs-cloud' && (
                                            <button
                                                onClick={fetchVoices}
                                                disabled={isLoadingVoices}
                                                className="text-[10px] text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                                            >
                                                {isLoadingVoices ? 'Refreshing...' : 'Refresh'}
                                            </button>
                                        )}
                                    </div>
                                    <select
                                        value={voiceId}
                                        onChange={(e) => setVoiceId(e.target.value)}
                                        className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none transition-all ${isLoadingVoices ? 'opacity-50 cursor-slow' : ''}`}
                                        disabled={isLoadingVoices || isGenerating}
                                    >
                                        {isLoadingVoices ? (
                                            <option value="">Loading voices...</option>
                                        ) : voices.length === 0 ? (
                                            <option value="">No voices found...</option>
                                        ) : (
                                            voices.map(v => (
                                                <option key={v.id} value={v.id}>{v.name}</option>
                                            ))
                                        )}
                                    </select>
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && error !== 'ENGINE_MISSING' && (
                                <div className="flex items-start gap-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-xs font-medium">
                                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="flex-1 break-words leading-relaxed">{error}</p>
                                </div>
                            )}

                            {error === 'ENGINE_MISSING' && (
                                <div className="flex items-start gap-2 text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-lg text-xs font-medium">
                                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <p className="flex-1 break-words leading-relaxed">Prism Voice Engine is missing. Click the Download button below to automatically install it.</p>
                                </div>
                            )}

                            <div className="flex gap-3 mt-4">
                                {error === 'ENGINE_MISSING' ? (
                                    <button
                                        onClick={handleDownloadEngine}
                                        disabled={isDownloading}
                                        className={`relative flex-2 flex-grow bg-indigo-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100 hover:bg-indigo-500 overflow-hidden`}
                                    >
                                        {isDownloading ? (
                                            <>
                                                <div
                                                    className="absolute inset-0 bg-indigo-400/30 transition-all duration-300 pointer-events-none"
                                                    style={{ width: `${downloadProgress}%` }}
                                                />
                                                <svg className="animate-spin h-5 w-5 relative z-10" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                <span className="relative z-10">{downloadStatus || 'Downloading...'}</span>
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                                Download Prism Engine
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating || !text.trim()}
                                        className={`flex-2 flex-grow bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${isGenerating ? 'cursor-not-allowed' : 'hover:bg-zinc-200'}`}
                                    >
                                        {isGenerating ? (
                                            <>
                                                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                                                Add to Timeline
                                            </>
                                        )}
                                    </button>
                                )}
                                <button
                                    onClick={() => { toggleTtsModal(); setText(''); setError(null); }}
                                    className="px-8 bg-zinc-800 text-zinc-300 font-bold rounded-2xl hover:bg-zinc-700 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
