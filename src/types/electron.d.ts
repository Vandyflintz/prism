export interface ElectronAPI {
    openFile: () => Promise<string | null>;
    readFile: (filePath: string) => Promise<Uint8Array>;
    renderComposition: (data: any) => Promise<string>;
    saveTempFile: (filename: string, buffer: ArrayBuffer) => Promise<string>;
    saveProject: (data: any, filePath: string | null) => Promise<string | null>;
    openProject: () => Promise<{ filePath: string, data: any } | null>;
    onFullscreenChange: (callback: (isFullscreen: boolean) => void) => () => void;
    onRenderProgress: (callback: (progress: number) => void) => () => void;
    onMenuAction: (callback: (action: string) => void) => () => void;
}

declare global {
    interface Window {
        electron: ElectronAPI;
    }
}
