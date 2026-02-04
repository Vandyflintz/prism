import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    // Render API
    renderComposition: (data: any) => ipcRenderer.invoke('render-composition', data),
    saveTempFile: (filename: string, buffer: ArrayBuffer) => ipcRenderer.invoke('fs:saveTempFile', { filename, buffer }),
    onRenderProgress: (callback: (progress: number) => void) => {
        const subscription = (_event: any, progress: number) => callback(progress);
        ipcRenderer.on('render-progress', subscription);
        // Return a cleanup function
        return () => ipcRenderer.removeListener('render-progress', subscription);
    }
});
