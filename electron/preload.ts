import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    // Render API
    renderComposition: (data: any) => ipcRenderer.invoke('render-composition', data),
    saveTempFile: (filename: string, buffer: ArrayBuffer) => ipcRenderer.invoke('fs:saveTempFile', { filename, buffer }),

    // Project Persistence
    saveProject: (data: any, filePath: string | null) => ipcRenderer.invoke('project:save', { data, filePath }),
    openProject: () => ipcRenderer.invoke('project:open'),

    // TTS API
    generateTts: (request: any) => ipcRenderer.invoke('tts:generate', request),
    getTtsSettings: () => ipcRenderer.invoke('tts:getSettings'),
    updateTtsSettings: (settings: any) => ipcRenderer.invoke('tts:updateSettings', settings),
    getVoices: (provider: string) => ipcRenderer.invoke('tts:getVoices', provider),
    testTtsConnection: () => ipcRenderer.invoke('tts:testConnection'),
    downloadPiper: () => ipcRenderer.invoke('tts:downloadPiper'),
    
    onDownloadProgress: (callback: (data: {status: string, progress: number}) => void) => {
        const listener = (_e: any, data: any) => callback(data);
        ipcRenderer.on('tts:downloadProgress', listener);
        return () => ipcRenderer.removeListener('tts:downloadProgress', listener);
    },

    onFullscreenChange: (callback: (isFullscreen: boolean) => void) => {
        const listener = (_e: any, isFs: boolean) => callback(isFs);
        ipcRenderer.on('window:fullscreen', listener);
        return () => ipcRenderer.removeListener('window:fullscreen', listener);
    },

    onRenderProgress: (callback: (progress: number) => void) => {
        const subscription = (_event: any, progress: number) => callback(progress);
        ipcRenderer.on('render-progress', subscription);
        // Return a cleanup function
        return () => ipcRenderer.removeListener('render-progress', subscription);
    },
    onMenuAction: (callback: (action: string) => void) => {
        // const subscription = (_event: any, action: string) => callback(action);
        // We listen for multiple channels or just one 'menu-action' channel?
        // Actually, in menu.ts we sent 'menu:open-psd' etc.
        // It's cleaner to listen to all of them or have a single channel.
        // Let's change menu.ts to send 'menu-action' with a payload? No, sending specific events is fine.
        // But preload needs to know which events to listen to.
        // Easier: Preload listens to specific events and maps them to a single callback with a type.

        const actions = [
            'menu:open-project', 'menu:save-project', 'menu:save-project-as', 'menu:import-psd',
            'menu:export-video', 'menu:undo', 'menu:redo',
            'menu:split-track', 'menu:align-tracks', 'menu:clear-timeline', 'menu:reset-project', 'menu:shortcuts',
            'menu:toggle-left-panel', 'menu:toggle-right-panel', 'menu:open-about'
        ];
        const listeners: Record<string, any> = {};

        actions.forEach(act => {
            listeners[act] = (_e: any) => callback(act);
            ipcRenderer.on(act, listeners[act]);
        });

        return () => {
            actions.forEach(act => {
                ipcRenderer.removeListener(act, listeners[act]);
            });
        };
    }
});
