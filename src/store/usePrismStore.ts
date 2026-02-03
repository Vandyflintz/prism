import { create } from 'zustand';
import { temporal } from 'zundo';
import { PrismProject, PrismTrack } from '../../types/prism';

// Helper to generate IDs (Polyfill for crypto.randomUUID)
const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

interface PrismState {
    project: PrismProject | null;
    selectedTrackId: string | null;
    currentTime: number; // For sync between player and timeline
    isPlaying: boolean;
    isMagnetEnabled: boolean;
    setProject: (project: PrismProject) => void;
    setSelectedTrackId: (id: string | null) => void;
    setCurrentTime: (time: number) => void;
    setIsPlaying: (playing: boolean) => void;
    toggleMagnet: () => void;
    updateTrack: (trackId: string, updates: Partial<PrismTrack>) => void;
    reorderTracks: (orderedTrackIds: string[]) => void;

    // Track Controls
    toggleTrackLock: (trackId: string) => void;
    toggleTrackVisibility: (trackId: string) => void;
    toggleTrackMute: (trackId: string) => void;

    // Tools
    splitTrack: (trackId: string) => void;
    deleteTrack: (trackId: string) => void;
}

export const usePrismStore = create<PrismState>()(
    temporal(
        (set) => ({
            project: null,
            selectedTrackId: null,
            currentTime: 0,
            isPlaying: false,
            isMagnetEnabled: true,

            setProject: (project) => set({ project }),
            setSelectedTrackId: (id) => set({ selectedTrackId: id }),

            setCurrentTime: (time) => set({ currentTime: time }),
            setIsPlaying: (playing) => set({ isPlaying: playing }),
            toggleMagnet: () => set((state) => ({ isMagnetEnabled: !state.isMagnetEnabled })),

            updateTrack: (trackId, updates) => set((state) => {
                if (!state.project) return state;
                const tracks = state.project.tracks.map(t =>
                    t.id === trackId ? { ...t, ...updates } : t
                );
                return { project: { ...state.project, tracks } };
            }),

            reorderTracks: (orderedTrackIds: string[]) => set((state) => {
                console.log('reorderTracks called with:', orderedTrackIds);
                if (!state.project) return state;
                const trackMap = new Map(state.project.tracks.map(t => [t.id, t]));
                const tracks = orderedTrackIds.map(id => trackMap.get(id)).filter((t): t is PrismTrack => !!t);
                return { project: { ...state.project, tracks } };
            }),

            toggleTrackLock: (trackId) => set((state) => {
                if (!state.project) return state;
                const tracks = state.project.tracks.map(t =>
                    t.id === trackId ? { ...t, locked: !t.locked } : t
                );
                return { project: { ...state.project, tracks } };
            }),

            toggleTrackVisibility: (trackId) => set((state) => {
                if (!state.project) return state;
                const tracks = state.project.tracks.map(t =>
                    t.id === trackId ? { ...t, visible: t.visible === undefined ? false : !t.visible } : t
                );
                return { project: { ...state.project, tracks } };
            }),

            toggleTrackMute: (trackId) => set((state) => {
                if (!state.project) return state;
                const tracks = state.project.tracks.map(t =>
                    t.id === trackId ? { ...t, muted: !t.muted } : t
                );
                return { project: { ...state.project, tracks } };
            }),

            splitTrack: (trackId) => set((state) => {
                if (!state.project) return state;
                const { project, currentTime } = state;

                const trackIndex = project.tracks.findIndex(t => t.id === trackId);
                if (trackIndex === -1) return state;

                const track = project.tracks[trackIndex];
                const splitFrame = currentTime;

                // Validation: Can only split if playhead is strictly inside the track
                // Ensure there is at least 1 frame on each side
                if (splitFrame <= track.startFrame || splitFrame >= track.startFrame + track.durationInFrames - 1) {
                    return state;
                }

                const firstHalfDuration = splitFrame - track.startFrame;
                const secondHalfDuration = track.durationInFrames - firstHalfDuration;

                // Create second half (new track)
                const newTrack: PrismTrack = {
                    ...track,
                    id: generateId(),
                    startFrame: splitFrame,
                    durationInFrames: secondHalfDuration,
                };

                // Update first half (existing track)
                const updatedOriginalTrack = {
                    ...track,
                    durationInFrames: firstHalfDuration,
                };

                // Insert new track after the original
                const newTracks = [...project.tracks];
                newTracks[trackIndex] = updatedOriginalTrack;
                newTracks.splice(trackIndex + 1, 0, newTrack);

                return { project: { ...project, tracks: newTracks } };
            }),

            deleteTrack: (trackId) => set((state) => {
                if (!state.project) return state;
                const tracks = state.project.tracks.filter(t => t.id !== trackId);
                return {
                    project: { ...state.project, tracks },
                    selectedTrackId: state.selectedTrackId === trackId ? null : state.selectedTrackId
                };
            }),
        }),
        {

            partialize: (state) => ({
                project: state.project
            }),
            equality: (a, b) => JSON.stringify(a) === JSON.stringify(b), // Simple deep compare to avoid duplicate history entries
            limit: 50 // Increase limit slightly now that it's cleaner
        }
    )
);
