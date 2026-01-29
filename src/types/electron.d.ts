export interface ElectronAPI {
    openFile: () => Promise<string | null>;
    readFile: (filePath: string) => Promise<Uint8Array>;
}

declare global {
    interface Window {
        electron: ElectronAPI;
    }
}
