export interface ElectronAPI {
    openFile: () => Promise<string | null>;
    readFile: (filePath: string) => Promise<Uint8Array>;
    renderComposition: (data: any) => Promise<string>;
    saveTempFile: (filename: string, buffer: ArrayBuffer) => Promise<string>;
    onRenderProgress: (callback: (progress: number) => void) => () => void;
}

declare global {
    interface Window {
        electron: ElectronAPI;
    }
}
