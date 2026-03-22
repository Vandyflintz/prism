import { create } from 'zustand';
import { temporal } from 'zundo';
import { PrismProject, PrismTrack, PrismAsset } from '../../types/prism';

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
    assets: Record<string, PrismAsset>; // Global Asset Library (Not Undoable)
    project: PrismProject | null;
    selectedTrackId: string | null;
    currentTime: number; // For sync between player and timeline
    isPlaying: boolean;
    isMagnetEnabled: boolean;
    isTimelineFollowEnabled: boolean;
    isLoopingEnabled: boolean;
    isTtsModalOpen: boolean;
    setProject: (project: PrismProject) => void;
    updateProjectSettings: (settings: Partial<PrismProject>) => void;
    setSelectedTrackId: (id: string | null) => void;
    setCurrentTime: (time: number) => void;
    setIsPlaying: (playing: boolean) => void;
    toggleMagnet: () => void;
    toggleTimelineFollow: () => void;
    toggleLooping: () => void;
    toggleTtsModal: () => void;
    updateTrack: (trackId: string, updates: Partial<PrismTrack>) => void;
    reorderTracks: (orderedTrackIds: string[]) => void;

    addTrack: (track: PrismTrack) => void;
    addAsset: (asset: PrismAsset) => void;
    toggleTrackLock: (trackId: string) => void;
    toggleTrackVisibility: (trackId: string) => void;
    toggleTrackMute: (trackId: string) => void;
    hasModifiedCanvas: boolean; // Flag to track if user has manually changed project settings

    // Tools
    splitTrack: (trackId: string) => void;
    deleteTrack: (trackId: string) => void;
    deleteAsset: (assetId: string) => void;
    hydrateAssets: (assets: PrismAsset[]) => void;

    // Timeline Actions
    clearTimeline: () => void;
    resetProject: () => void;
    alignTracksToStart: () => void;
}

export const usePrismStore = create<PrismState>()(
    temporal(
        (set) => ({
            assets: {},
            project: null,
            selectedTrackId: null,
            currentTime: 0,
            isPlaying: false,
            isMagnetEnabled: true,
            isTimelineFollowEnabled: true,
            isLoopingEnabled: true,
            isTtsModalOpen: false,
            hasModifiedCanvas: false,

            setProject: (project) => set((state) => ({ 
                project,
                hasModifiedCanvas: project.id !== 'default-project'
            })),

            updateProjectSettings: (settings) => set((state) => {
                if (!state.project) return state;
                const isDimensionChange = settings.width !== undefined || settings.height !== undefined;
                return {
                    project: { ...state.project, ...settings },
                    hasModifiedCanvas: state.hasModifiedCanvas || isDimensionChange
                };
            }),

            setSelectedTrackId: (id) => set({ selectedTrackId: id }),

            setCurrentTime: (time) => {
                // console.log(`[Store] setCurrentTime: ${time}`);
                set({ currentTime: time });
            },
            setIsPlaying: (playing) => set({ isPlaying: playing }),
            toggleMagnet: () => set((state) => ({ isMagnetEnabled: !state.isMagnetEnabled })),
            toggleTimelineFollow: () => set((state) => ({ isTimelineFollowEnabled: !state.isTimelineFollowEnabled })),
            toggleLooping: () => set((state) => ({ isLoopingEnabled: !state.isLoopingEnabled })),
            toggleTtsModal: () => set((state) => ({ isTtsModalOpen: !state.isTtsModalOpen })),

            updateTrack: (trackId, updates) => set((state) => {
                if (!state.project) return state;
                const tracks = state.project.tracks.map(t =>
                    t.id === trackId ? { ...t, ...updates } : t
                );
                return { project: { ...state.project, tracks } };
            }),

            addTrack: (track) => set((state) => {
                if (!state.project) return state;
                const tracks = [...state.project.tracks, track];
                return { project: { ...state.project, tracks } };
            }),

            addAsset: (asset) => set((state) => {
                return { assets: { ...state.assets, [asset.id]: asset } };
            }),

            reorderTracks: (orderedTrackIds: string[]) => set((state) => {
                // console.log('reorderTracks called with:', orderedTrackIds);
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

                // Calculate new media offset for the second half
                const currentMediaOffset = track.props.mediaOffset || 0;
                const newMediaOffset = currentMediaOffset + firstHalfDuration;

                // Create second half (new track)
                const newTrack: PrismTrack = {
                    ...track,
                    id: generateId(),
                    startFrame: splitFrame,
                    durationInFrames: secondHalfDuration,
                    props: {
                        ...track.props,
                        mediaOffset: newMediaOffset
                    }
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

            deleteAsset: (assetId: string) => set((state) => {
                const { [assetId]: deleted, ...remainingAssets } = state.assets;
                return {
                    assets: remainingAssets
                };
            }),

            hydrateAssets: (assets: PrismAsset[]) => set((state) => {
                const newAssets = { ...state.assets };
                assets.forEach((a: PrismAsset) => {
                    newAssets[a.id] = a;
                });
                return { assets: newAssets };
            }),

            clearTimeline: () => set((state) => {
                if (!state.project) return state;
                return {
                    project: { ...state.project, tracks: [] },
                    selectedTrackId: null,
                    currentTime: 0
                };
            }),

            resetProject: () => set((state) => {
                if (!state.project) return state;
                return {
                    project: {
                        ...state.project,
                        width: 1080,
                        height: 1920,
                        fps: 30,
                        durationInFrames: 900, // Default 30s instead of 10s
                        backgroundColor: '#000000',
                        tracks: [] 
                    },
                    hasModifiedCanvas: false,
                    selectedTrackId: null,
                    currentTime: 0
                };
            }),

            alignTracksToStart: () => set((state) => {
                if (!state.project || state.project.tracks.length === 0) return state;

                // Align ALL tracks to start (Frame 0)
                const tracks = state.project.tracks.map(t => ({
                    ...t,
                    startFrame: 0
                }));

                return { project: { ...state.project, tracks } };
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
