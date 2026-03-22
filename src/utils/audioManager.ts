/**
 * AudioEffectManager
 * 
 * Manages Web Audio connections for the Prism Editor.
 * Ensures each HTMLMediaElement is only connected once to Avoid "already connected" errors.
 * Uses a single AudioContext to reduce overhead and latency.
 */

class AudioEffectManager {
    private static instance: AudioEffectManager;
    private context: AudioContext | null = null;
    private nodes: Map<HTMLMediaElement, {
        source: MediaElementAudioSourceNode;
        bass: BiquadFilterNode;
        treble: BiquadFilterNode;
        pan: StereoPannerNode;
        gain: GainNode;
    }> = new Map();

    private constructor() {}

    static getInstance() {
        if (!AudioEffectManager.instance) {
            AudioEffectManager.instance = new AudioEffectManager();
        }
        return AudioEffectManager.instance;
    }

    private initContext() {
        if (!this.context) {
            this.context = new (window.AudioContext || (window as any).webkitAudioContext)({
                latencyHint: 'playback'
            });
        }
        if (this.context.state === 'suspended') {
            this.context.resume();
        }
        return this.context;
    }

    applyFilters(element: HTMLMediaElement, options: { 
        bass?: number, 
        treble?: number, 
        volume?: number, 
        pan?: number 
    }) {
        const { bass = 0, treble = 0, volume = 1, pan = 0 } = options;

        // Optimization: Only initialize if processing is actually needed
        if (bass === 0 && treble === 0 && volume === 1 && pan === 0 && !this.nodes.has(element)) {
            return;
        }

        const ctx = this.initContext();
        let chain = this.nodes.get(element);
        
        if (!chain) {
            try {
                const source = ctx.createMediaElementSource(element);
                const gainNode = ctx.createGain();
                
                const bassNode = ctx.createBiquadFilter();
                bassNode.type = 'lowshelf';
                bassNode.frequency.value = 200;

                const trebleNode = ctx.createBiquadFilter();
                trebleNode.type = 'highshelf';
                trebleNode.frequency.value = 3000;

                const panNode = ctx.createStereoPanner();

                // Chain: Source -> Gain -> Bass -> Treble -> Pan -> Destination
                source.connect(gainNode);
                gainNode.connect(bassNode);
                bassNode.connect(trebleNode);
                trebleNode.connect(panNode);
                panNode.connect(ctx.destination);

                chain = { source, bass: bassNode, treble: trebleNode, pan: panNode, gain: gainNode };
                this.nodes.set(element, chain);
            } catch (e) {
                return;
            }
        }

        // Apply values
        if (chain) {
            const now = ctx.currentTime;
            // Slightly longer time constant for smoother transitions (0.1s instead of 0.03s)
            const tc = 0.1; 
            chain.bass.gain.setTargetAtTime(bass, now, tc);
            chain.treble.gain.setTargetAtTime(treble, now, tc);
            chain.gain.gain.setTargetAtTime(volume, now, tc);
            chain.pan.pan.setTargetAtTime(pan, now, tc);
            
            // If using our gain node, we MUST set element volume to 1 to avoid double processing
            if (volume !== 1) {
                element.volume = 1.0;
            }
        }
    }

    // Call this if the element is removed from DOM permanently
    releaseElement(element: HTMLMediaElement) {
        const chain = this.nodes.get(element);
        if (chain) {
            try {
                chain.source.disconnect();
                chain.gain.disconnect();
                chain.bass.disconnect();
                chain.treble.disconnect();
                chain.pan.disconnect();
            } catch (e) {
                // Ignore disconnect errors
            }
            this.nodes.delete(element);
        }
    }
}

export const audioManager = AudioEffectManager.getInstance();
