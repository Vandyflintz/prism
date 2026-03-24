import React, { useState } from 'react';
import { usePrismStore } from '../store/usePrismStore';
import { PrismTrack } from '../../types/prism';

interface AutoCaptionsModalProps {
    onClose: () => void;
}

export const AutoCaptionsModal: React.FC<AutoCaptionsModalProps> = ({ onClose }) => {
    const { project, assets, addTracks } = usePrismStore();
    
    const [selectedTrackId, setSelectedTrackId] = useState<string>('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [statusText, setStatusText] = useState('');

    // Filter to only allow users to select audio or video tracks
    const mediaTracks = project?.tracks.filter(t => t.type === 'audio' || t.type === 'video') || [];

    const handleGenerate = async () => {
        if (!selectedTrackId) return;
        
        const track = mediaTracks.find(t => t.id === selectedTrackId);
        if (!track) return;
        
        const assetId = track.props.assetId;
        if (!assetId) {
            alert("No underlying asset found for this track.");
            return;
        }

        const asset = assets[assetId];
        if (!asset || !asset.src) {
            alert("Asset source not found.");
            return;
        }

        setIsGenerating(true);

        try {
            // 1. Fetch and segment the media. We only want the part that's actually on the timeline.
            setStatusText("Segmenting and resampling media...");
            
            const response = await fetch(asset.src);
            const arrayBuffer = await response.arrayBuffer();
            
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

            const fps = project?.fps || 30;
            const trackDurationSeconds = track.durationInFrames / fps;
            const mediaOffsetSeconds = (track.props.mediaOffset || 0) / fps;
            const timelineStartSeconds = track.startFrame / fps;

            console.log(`[AutoCaptions] Track region: Offset=${mediaOffsetSeconds}s, Duration=${trackDurationSeconds}s`);

            // We only process the part of the audio that is actually visible on the timeline
            const offlineCtx = new OfflineAudioContext(1, Math.ceil(trackDurationSeconds * 16000), 16000);
            const source = offlineCtx.createBufferSource();
            source.buffer = decodedBuffer;
            source.connect(offlineCtx.destination);
            
            // Start reading from the media offset
            source.start(0, mediaOffsetSeconds, trackDurationSeconds);
            
            const resampledBuffer = await offlineCtx.startRendering();
            const wavBlob = audioBufferToWav(resampledBuffer);
            const wavArrayBuffer = await wavBlob.arrayBuffer();

            console.log(`[AutoCaptions] Segment extracted. WAV size: ${wavArrayBuffer.byteLength} bytes`);

            setStatusText("Transcribing locally with Whisper (this may take a moment)...");

            // 2. Call our local Electron Node Transformers.js inference engine
            const responseData = await (window as any).electron.generateCaptions(wavArrayBuffer);
            const { chunks, diagnostics } = responseData || { chunks: [], diagnostics: {} };

            console.log(`[AutoCaptions] Received result for ${trackDurationSeconds.toFixed(1)}s clip:`, responseData);
            setStatusText("Injecting captions into timeline...");

            // 3. Build caption tracks (Now relative to the clip start!)
            const canvasHeight = project?.height || 1920;
            const canvasWidth = project?.width || 1080;
            const baseYOffset = canvasHeight * 0.75;
            const baseXOffset = canvasWidth / 2;
            
            const captionTracks: PrismTrack[] = [];

            for (const chunk of chunks) {
                if (!chunk.text?.trim()) continue;

                // Timestamps are now relative to the START of the segment we sent (0.0 == clip start)
                const wordStartSeconds = chunk.timestamp[0];
                const wordEndSeconds = chunk.timestamp[1] ?? (wordStartSeconds + 0.5);

                const adjustedStartSeconds = wordStartSeconds + timelineStartSeconds;
                const adjustedEndSeconds = wordEndSeconds + timelineStartSeconds;

                const startFrame = Math.round(adjustedStartSeconds * fps);
                const endFrame = Math.round(adjustedEndSeconds * fps);
                const durationInFrames = Math.max(1, endFrame - startFrame);

                captionTracks.push({
                    id: crypto.randomUUID(),
                    type: 'text',
                    startFrame,
                    durationInFrames,
                    props: {
                        content: chunk.text.trim().toUpperCase(),
                        x: baseXOffset - 500,
                        y: baseYOffset,
                        fontFamily: 'Inter',
                        fontSize: 60,
                        fontWeight: '900',
                        color: '#ffffff',
                        textStrokeColor: '#000000',
                        textStrokeWidth: 4,
                        textAlign: 'center',
                        textShadow: '0px 4px 12px rgba(0,0,0,0.8)',
                        width: 1000,
                        height: 200,
                        opacity: 1,
                        rotation: 0,
                        scale: 1,
                    }
                });
            }

            console.log(`[AutoCaptions] Built ${captionTracks.length} tracks (from ${chunks.length} raw words). Potential words: ${chunks.map((c: any) => c.text).join(' ').slice(0, 100)}...`);

            if (captionTracks.length === 0) {
                const diagMsg = diagnostics?.peak !== undefined ? `\n(Peak: ${diagnostics.peak.toFixed(5)}, Avg: ${diagnostics.avg?.toFixed(5)}, Length: ${diagnostics.duration?.toFixed(2)}s)` : '';
                const detectedTextMsg = diagnostics?.originalText ? `\nDetected: "${diagnostics.originalText.slice(0, 50)}${diagnostics.originalText.length > 50 ? '...' : ''}"` : '';
                
                alert(`Transcription returned no word tracks.${diagMsg}${detectedTextMsg}\n\nWhisper may not have heard any clear speech during this clip.`);
                setIsGenerating(false);
                return;
            }

            // Batch inject all tracks in one single store update
            addTracks(captionTracks);

            setStatusText(`Done! Added ${captionTracks.length} caption clips.`);
            setTimeout(onClose, 1500);

        } catch (err: any) {
            console.error("[AutoCaptions] Transcription failed:", err);
            alert(`Transcription failed: ${err?.message || err}`);
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-4 pointer-events-auto">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col relative">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-zinc-900 bg-zinc-900/40">
                    <div className="flex flex-col">
                        <h2 className="text-zinc-100 font-bold tracking-tight text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                            Auto Captions
                        </h2>
                        <span className="text-[10px] text-zinc-500 mt-0.5">Powered locally by Transformers.js</span>
                    </div>
                    <button onClick={onClose} disabled={isGenerating} className="p-1 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors disabled:opacity-50">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 flex flex-col gap-5">
                    
                    {/* Track Selection */}
                    <div className="flex flex-col gap-2 relative">
                        <label className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase">Select Media Track</label>
                        {mediaTracks.length === 0 ? (
                            <div className="text-sm text-zinc-500 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800 text-center">
                                No audio or video tracks available on the timeline.
                            </div>
                        ) : (
                            <select 
                                value={selectedTrackId}
                                onChange={(e) => setSelectedTrackId(e.target.value)}
                                disabled={isGenerating}
                                className="w-full bg-zinc-900 border border-zinc-700 text-sm text-white rounded-lg px-3 py-2.5 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-all appearance-none cursor-pointer"
                            >
                                <option value="" disabled>-- Select a Track --</option>
                                {mediaTracks.map(t => {
                                    const assetName = assets[t.props.assetId || '']?.metadata?.originalName || 'Unknown Asset';
                                    return (
                                        <option key={t.id} value={t.id}>
                                            {t.type.toUpperCase()}: {assetName} (Start: {t.startFrame})
                                        </option>
                                    );
                                })}
                            </select>
                        )}
                        {/* Custom arrow for select */}
                        {mediaTracks.length > 0 && (
                            <div className="absolute right-3 top-9 pointer-events-none text-zinc-500">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-zinc-900 bg-zinc-900/20 flex flex-col gap-3">
                    {isGenerating && (
                        <div className="flex items-center gap-3 w-full bg-violet-500/10 border border-violet-500/20 rounded-lg p-2.5">
                            <div className="w-4 h-4 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin shrink-0"></div>
                            <span className="text-[11px] font-mono text-violet-400 break-all leading-tight">
                                {statusText}
                            </span>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button 
                            onClick={onClose}
                            disabled={isGenerating}
                            className="flex-1 py-2 bg-transparent hover:bg-zinc-800 text-zinc-400 font-bold text-[11px] tracking-wider uppercase rounded-lg transition-colors border border-transparent disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleGenerate}
                            disabled={!selectedTrackId || isGenerating}
                            className={`flex-1 flex gap-2 items-center justify-center py-2 text-white font-bold text-[11px] tracking-wider uppercase rounded-lg transition-all shadow-[0_0_15px_rgba(139,92,246,0.3)] ${
                                !selectedTrackId || isGenerating 
                                ? 'bg-zinc-800 text-zinc-600 shadow-none cursor-not-allowed' 
                                : 'bg-violet-600 hover:bg-violet-500 hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] active:scale-95 border border-violet-500/50'
                            }`}
                        >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            <span>GENERATE</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

// Raw PCM to WAV Encoder 
function audioBufferToWav(buffer: AudioBuffer) {
    let numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferArray = new ArrayBuffer(length),
        view = new DataView(bufferArray),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    const setUint16 = (data: number) => {
        view.setUint16(offset, data, true);
        offset += 2;
    };

    const setUint32 = (data: number) => {
        view.setUint32(offset, data, true);
        offset += 4;
    };

    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8);
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt "
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164); // "data"
    setUint32(length - 44);

    for(i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while(pos < buffer.length) {
        for(i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][pos]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
            view.setInt16(offset, sample, true);
            offset += 2;
        }
        pos++;
    }

    return new Blob([bufferArray], {type: "audio/wav"});
}
