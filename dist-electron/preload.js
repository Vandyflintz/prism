"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electron', {
    openFile: () => electron_1.ipcRenderer.invoke('dialog:openFile'),
    readFile: (filePath) => electron_1.ipcRenderer.invoke('fs:readFile', filePath),
    // Render API
    renderComposition: (data) => electron_1.ipcRenderer.invoke('render-composition', data),
    saveTempFile: (filename, buffer) => electron_1.ipcRenderer.invoke('fs:saveTempFile', { filename, buffer }),
    onRenderProgress: (callback) => {
        const subscription = (_event, progress) => callback(progress);
        electron_1.ipcRenderer.on('render-progress', subscription);
        // Return a cleanup function
        return () => electron_1.ipcRenderer.removeListener('render-progress', subscription);
    }
});
