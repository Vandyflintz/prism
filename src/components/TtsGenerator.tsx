'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePrismStore } from '../store/usePrismStore';
import { PrismAsset } from '../../types/prism';
import { AssetStorage } from '../lib/AssetStorage';
import { generateId } from '../../lib/id';

export const TtsGenerator: React.FC = () => {
    const {
        isTtsModalOpen, toggleTtsModal, addAsset
    } = usePrismStore();

    const [text, setText] = useState('');
    const [provider, setProvider] = useState<'piper-local' | 'elevenlabs-cloud'>('piper-local');
    const [voiceId, setVoiceId] = useState('');
    const [voices, setVoices] = useState<{ id: string, name: string, isDownloaded?: boolean }[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoadingVoices, setIsLoadingVoices] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Advanced UI States
    type TtsTab = 'voice' | 'rate' | 'pitch' | 'pause' | 'emphasis';
    const [activeTab, setActiveTab] = useState<TtsTab>('voice');
    const [rateValue, setRateValue] = useState(1.0);
    const [pitchValue, setPitchValue] = useState(0);
    const [pauseValue, setPauseValue] = useState('short');
    const [emphasisValue, setEmphasisValue] = useState('strong');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Settings
    const [showSettings, setShowSettings] = useState(false);
    const [elevenLabsKey, setElevenLabsKey] = useState('');
    const [piperPath, setPiperPath] = useState('');
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean, message: string } | null>(null);
    const [downloadStatus, setDownloadStatus] = useState('');
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    const [generatedPath, setGeneratedPath] = useState<string | null>(null);

    useEffect(() => {
        if (isTtsModalOpen && (window as any).electron) {
            // Load settings from Electron
            (window as any).electron.getTtsSettings().then((s: any) => {
                setElevenLabsKey(s.elevenLabsKey || '');
                setPiperPath(s.piperPath || '');
            });
            // Initial fetch to populate local voices at least
            fetchVoices();

            // Set up download progress listener — backend emits these during auto-install
            const cleanup = (window as any).electron.onDownloadProgress((data: { status: string, progress: number }) => {
                setDownloadStatus(data.status);
                setDownloadProgress(data.progress);
                // Automatically show downloading state when progress events arrive
                if (data.progress > 0 && data.progress < 100) {
                    setIsDownloading(true);
                } else if (data.progress >= 100) {
                    setIsDownloading(false);
                }
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

    const onConfirmSaveAudio = async () => {
        if (!generatedPath) return;
        
        try {
            // Fetch the generated local file as a Blob to persist it
            const response = await fetch(`file://${generatedPath}`);
            const blob = await response.blob();
            
            // Generate a permanent Object URL
            const objectUrl = URL.createObjectURL(blob);
            
            // Add as persistent Asset
            const assetId = generateId();
            const newAsset: PrismAsset = {
                id: assetId,
                type: 'audio',
                src: objectUrl,
                metadata: {
                    originalName: `TTS: ${text.substring(0, 20)}...`,
                    mimeType: 'audio/wav',
                    createdAt: Date.now(),
                    tts: {
                        isTts: true,
                        ttsText: text,
                        ttsVoiceId: voiceId,
                        ttsProvider: provider
                    }
                }
            };
            
            await AssetStorage.saveAsset(newAsset, blob);
            addAsset(newAsset);

            setGeneratedPath(null);
            toggleTtsModal();
            setText('');
        } catch (err: any) {
            console.error('[TTS] Failed to persist generated audio:', err);
            setError(`Failed to save to Media: ${err.message}`);
        }
    };

    const insertTag = (type: string, value: string | number) => {
        if (!textareaRef.current) return;
        const start = textareaRef.current.selectionStart;
        const end = textareaRef.current.selectionEnd;
        const selectedText = text.substring(start, end);

        let injectedText = '';
        if (type === 'pause') {
            injectedText = `[pause:${value}]`;
        } else {
            if (selectedText) {
                injectedText = `[${type}:${value}]${selectedText}[/${type}]`;
            } else {
                injectedText = `[${type}:${value}] `;
            }
        }

        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start, end);

        // Using standard document.execCommand to securely insert text while preserving the native browser Ctrl+Z undo history
        const success = document.execCommand('insertText', false, injectedText);

        // Fallback for extremely strict environments where execCommand is disabled
        if (!success) {
            const newText = text.substring(0, start) + injectedText + text.substring(end);
            setText(newText);
        }

        // Refocus and set cursor position exactly after the newly injected text
        setTimeout(() => {
            if (textareaRef.current) {
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(start + injectedText.length, start + injectedText.length);
            }
        }, 0);
    };

    const handleGenerate = async () => {
        if (!text.trim()) return;
        setIsGenerating(true);
        setError('');
        setGeneratedPath(null);

        try {
            if (!(window as any).electron) {
                throw new Error("TTS Generation is only available in the Desktop App.");
            }
            // Backend auto-downloads engine if missing, emitting progress events.
            // The download progress listener (set up in useEffect) updates the UI.
            const outputPath = await (window as any).electron.generateTts({
                text, voiceId, provider
            });
            console.log('[TTS UI] Generation success, outputPath:', outputPath);
            fetchVoices(); // Refresh voice list to update (Downloaded) status
            setGeneratedPath(outputPath);
        } catch (err: any) {
            console.error('[TTS UI] Error:', err);
            setError(err.message || 'Unknown generation error');
        } finally {
            setIsGenerating(false);
            setIsDownloading(false);
            setDownloadStatus('');
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
                            <div className="flex flex-col gap-0 border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950/50 mb-6">
                                {/* Tab Header */}
                                <div className="flex border-b border-zinc-800 bg-zinc-900 overflow-x-auto scroller-hide">
                                    {(['voice', 'rate', 'pitch', 'pause', 'emphasis'] as TtsTab[]).map(t => (
                                        <button
                                            key={t}
                                            onClick={() => setActiveTab(t)}
                                            className={`flex-1 px-4 py-3 text-xs font-semibold tracking-wide transition-colors whitespace-nowrap ${
                                                activeTab === t ? 'text-white border-b-2 border-indigo-500 bg-zinc-800/50' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'
                                            }`}
                                        >
                                            {t === 'voice' ? 'Voice' : t === 'rate' ? 'Speaking Rate' : t === 'pitch' ? 'Pitch' : t === 'pause' ? 'Pause' : 'Emphasis'}
                                        </button>
                                    ))}
                                </div>
                                
                                {/* Tab Content */}
                                <div className="p-4 bg-zinc-950">
                                    {activeTab === 'voice' && (
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Provider</label>
                                                <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800/50">
                                                    <button
                                                        onClick={() => setProvider('piper-local')}
                                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${provider === 'piper-local' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                    >
                                                        Prism Native
                                                    </button>
                                                    <button
                                                        onClick={() => setProvider('elevenlabs-cloud')}
                                                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${provider === 'elevenlabs-cloud' ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20' : 'text-zinc-500 hover:text-zinc-300'}`}
                                                    >
                                                        Cloud
                                                        <span className="text-[8px] bg-white/20 px-1 rounded text-white/80">PRO</span>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <label className="block text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Voice Model</label>
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
                                                    className={`w-full bg-zinc-900 border border-zinc-800/50 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none transition-all ${isLoadingVoices ? 'opacity-50 cursor-slow' : ''}`}
                                                    disabled={isLoadingVoices || isGenerating}
                                                >
                                                    {isLoadingVoices ? (
                                                        <option value="">Loading voices...</option>
                                                    ) : voices.length === 0 ? (
                                                        <option value="">No voices found...</option>
                                                    ) : (
                                                        voices.map(v => (
                                                            <option key={v.id} value={v.id}>
                                                                {v.name} {provider === 'piper-local' && !v.isDownloaded ? '  ( ↓ )' : ''}
                                                            </option>
                                                        ))
                                                    )}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                    {activeTab === 'rate' && (
                                        <div className="flex gap-4 items-center">
                                            <span className="text-xs font-medium text-zinc-400 w-12 text-right">{rateValue.toFixed(1)}x</span>
                                            <input type="range" min="0.5" max="2.0" step="0.1" value={rateValue} onChange={e => setRateValue(parseFloat(e.target.value))} className="flex-1 accent-indigo-500" />
                                            <button onClick={() => insertTag('speed', rateValue)} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20">Apply</button>
                                        </div>
                                    )}
                                    {activeTab === 'pitch' && (
                                        <div className="flex gap-4 items-center">
                                            <span className="text-xs font-medium text-zinc-400 w-12 text-right">{pitchValue > 0 ? `+${pitchValue}` : pitchValue}%</span>
                                            <input type="range" min="-50" max="50" step="5" value={pitchValue} onChange={e => setPitchValue(parseInt(e.target.value))} className="flex-1 accent-indigo-500" />
                                            <button onClick={() => insertTag('pitch', pitchValue)} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20">Apply</button>
                                        </div>
                                    )}
                                    {activeTab === 'pause' && (
                                        <div className="flex gap-4 items-center">
                                            <select value={pauseValue} onChange={e => setPauseValue(e.target.value)} className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                                                <option value="short">Short Pause (0.5s)</option>
                                                <option value="medium">Medium Pause (1.0s)</option>
                                                <option value="long">Long Pause (2.0s)</option>
                                            </select>
                                            <button onClick={() => insertTag('pause', pauseValue)} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20">Apply</button>
                                        </div>
                                    )}
                                    {activeTab === 'emphasis' && (
                                        <div className="flex gap-4 items-center">
                                            <select value={emphasisValue} onChange={e => setEmphasisValue(e.target.value)} className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50">
                                                <option value="strong">Strong</option>
                                                <option value="moderate">Moderate</option>
                                                <option value="reduced">Reduced</option>
                                            </select>
                                            <button onClick={() => insertTag('emphasis', emphasisValue)} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-lg shadow-indigo-500/20">Apply</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Your Script</label>
                                <textarea
                                    ref={textareaRef}
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="Type what you want the AI to say. Highlight text and use the tabs above to add pitch, speed, or emphasis tags..."
                                    className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-sm text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-all leading-relaxed"
                                />
                            </div>

                            {/* Success Preview */}
                            {generatedPath && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-lg text-xs font-medium">
                                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        <p>Audio generated successfully! Preview it below.</p>
                                    </div>
                                    <audio
                                        controls
                                        src={`file://${generatedPath}`}
                                        className="w-full rounded-lg"
                                        autoPlay
                                    />
                                </div>
                            )}

                            {/* Error Message */}
                            {error && (
                                <div className="flex items-start gap-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-xs font-medium">
                                    <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p className="flex-1 break-words leading-relaxed">{error}</p>
                                </div>
                            )}

                            <div className="flex gap-3 mt-4">
                                {generatedPath ? (
                                    <>
                                        <button
                                            onClick={onConfirmSaveAudio}
                                            className="flex-2 flex-grow bg-emerald-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 hover:bg-emerald-500"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                            Save to Media
                                        </button>
                                        <button
                                            onClick={() => { setGeneratedPath(null); }}
                                            className="px-6 bg-zinc-800 text-zinc-300 font-bold rounded-2xl hover:bg-zinc-700 transition-colors"
                                        >
                                            Regenerate
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        onClick={handleGenerate}
                                        disabled={isGenerating || isDownloading || !text.trim()}
                                        className={`relative flex-2 flex-grow bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl active:scale-95 disabled:opacity-70 disabled:active:scale-100 overflow-hidden ${isGenerating || isDownloading ? 'cursor-not-allowed' : 'hover:bg-zinc-200'}`}
                                    >
                                        {isDownloading ? (
                                            <>
                                                <div
                                                    className="absolute inset-0 bg-indigo-500/20 transition-all duration-300 pointer-events-none"
                                                    style={{ width: `${downloadProgress}%` }}
                                                />
                                                <svg className="animate-spin h-5 w-5 relative z-10" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                </svg>
                                                <span className="relative z-10">{downloadStatus || 'Setting up...'}</span>
                                            </>
                                        ) : isGenerating ? (
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
                                                Generate
                                            </>
                                        )}
                                    </button>
                                )}
                                <button
                                    onClick={() => { toggleTtsModal(); setText(''); setError(null); setGeneratedPath(null); }}
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
