import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
});
