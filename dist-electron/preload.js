"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electron', {
    openFile: () => electron_1.ipcRenderer.invoke('dialog:openFile'),
    readFile: (filePath) => electron_1.ipcRenderer.invoke('fs:readFile', filePath),
    // Render API
    renderComposition: (data) => electron_1.ipcRenderer.invoke('render-composition', data),
    saveTempFile: (filename, buffer) => electron_1.ipcRenderer.invoke('fs:saveTempFile', { filename, buffer }),
    // Project Persistence
    saveProject: (data, filePath) => electron_1.ipcRenderer.invoke('project:save', { data, filePath }),
    openProject: () => electron_1.ipcRenderer.invoke('project:open'),
    onRenderProgress: (callback) => {
        const subscription = (_event, progress) => callback(progress);
        electron_1.ipcRenderer.on('render-progress', subscription);
        // Return a cleanup function
        return () => electron_1.ipcRenderer.removeListener('render-progress', subscription);
    },
    onMenuAction: (callback) => {
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
        const listeners = {};
        actions.forEach(act => {
            listeners[act] = (_e) => callback(act);
            electron_1.ipcRenderer.on(act, listeners[act]);
        });
        return () => {
            actions.forEach(act => {
                electron_1.ipcRenderer.removeListener(act, listeners[act]);
            });
        };
    }
});
