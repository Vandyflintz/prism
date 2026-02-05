import { create } from 'zustand';

interface UIState {
    isAboutOpen: boolean;
    isShortcutsOpen: boolean;
    openAbout: () => void;
    closeAbout: () => void;
    openShortcuts: () => void;
    closeShortcuts: () => void;
    // Add other UI states here (e.g., panels) if needed later
}

export const useUIStore = create<UIState>((set) => ({
    isAboutOpen: false,
    isShortcutsOpen: false,
    openAbout: () => set({ isAboutOpen: true }),
    closeAbout: () => set({ isAboutOpen: false }),
    openShortcuts: () => set({ isShortcutsOpen: true }),
    closeShortcuts: () => set({ isShortcutsOpen: false }),
}));
