import { create } from 'zustand';
import { PrismProject, PrismTrack } from '../../types/prism';

interface PrismState {
    project: PrismProject | null;
    selectedTrackId: string | null;
    currentTime: number; // For sync between player and timeline
    setProject: (project: PrismProject) => void;
    setSelectedTrackId: (id: string | null) => void;
    setCurrentTime: (time: number) => void;
    updateTrack: (trackId: string, updates: Partial<PrismTrack>) => void;
}

export const usePrismStore = create<PrismState>((set) => ({
    project: null,
    selectedTrackId: null,
    currentTime: 0,

    setProject: (project) => set({ project }),
    setSelectedTrackId: (id) => set({ selectedTrackId: id }),

    setCurrentTime: (time) => set({ currentTime: time }),

    updateTrack: (trackId, updates) => set((state) => {
        if (!state.project) return state;
        const tracks = state.project.tracks.map(t =>
            t.id === trackId ? { ...t, ...updates } : t
        );
        // Important: Maintain bottom-to-top order if needed, or sort?
        // Schema says tracks are ordered.
        return { project: { ...state.project, tracks } };
    }),
}));
