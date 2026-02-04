import { app, BrowserWindow, ipcMain, dialog, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        titleBarStyle: 'hiddenInset', // Mac style
        backgroundColor: '#09090b', // Zinc-950
    });

    const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
    mainWindow.loadURL(startUrl);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// --- IPC Handlers ---

// Open File Dialog
ipcMain.handle('dialog:openFile', async () => {
    if (!mainWindow) return null;
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Photoshop Files', extensions: ['psd'] }
        ]
    });
    if (canceled) {
        return null;
    } else {
        return filePaths[0];
    }
});

ipcMain.handle('fs:saveTempFile', async (event, { filename, buffer }) => {
    console.log(`[Main] Saving temp file: ${filename}, size: ${buffer.byteLength}`);
    const tempDir = path.join(os.tmpdir(), 'prism-export-assets');
    if (!fs.existsSync(tempDir)) {
        await fs.promises.mkdir(tempDir, { recursive: true });
    }
    const filePath = path.join(tempDir, filename);
    await fs.promises.writeFile(filePath, new Uint8Array(buffer));
    return filePath;
});

// Read File
ipcMain.handle('fs:readFile', async (event: IpcMainInvokeEvent, filePath: string) => {
    try {
        const buffer = await fs.promises.readFile(filePath);
        return buffer;
    } catch (error) {
        console.error("Failed to read file", error);
        throw error;
    }
});

// Render Composition
import { renderComposition } from './render';
ipcMain.handle('render-composition', async (event: IpcMainInvokeEvent, data: any) => {
    return new Promise((resolve, reject) => {
        // Find the window to send progress back
        const win = BrowserWindow.fromWebContents(event.sender);

        renderComposition(data, (progress) => {
            if (win) {
                win.webContents.send('render-progress', progress);
            }
        })
            .then((output) => resolve(output))
            .catch((err) => reject(err));
    });
});
