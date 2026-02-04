import { app, BrowserWindow, ipcMain, dialog, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { createAppMenu } from './menu';

// Set App Name
app.name = 'Prism';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false // Allow loading local resources (file://)
        },
        titleBarStyle: 'hiddenInset', // Mac style
        backgroundColor: '#09090b', // Zinc-950
        icon: path.join(__dirname, '../resources/icon.png') // Linux/Windows fallback (Mac uses .icns in build)
    });

    createAppMenu(mainWindow);

    const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
    mainWindow.loadURL(startUrl);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    createWindow();
    if (process.platform === 'darwin') {
        app.dock?.setIcon(path.join(__dirname, '../resources/icon.png'));
    }
});

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

// Persistence
import { saveProjectPackage, loadProjectPackage } from './persistence';

ipcMain.handle('project:save', async (event, { data, filePath }) => {
    let targetPath = filePath;

    if (!targetPath) {
        const { canceled, filePath: savePath } = await dialog.showSaveDialog({
            title: 'Save Project',
            defaultPath: 'Untitled.prsm',
            filters: [{ name: 'Prism Project', extensions: ['prsm'] }]
        });
        if (canceled || !savePath) return null;
        targetPath = savePath;
    }

    await saveProjectPackage(targetPath, data);
    return targetPath;
});

ipcMain.handle('project:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: 'Open Project',
        properties: ['openFile'],
        filters: [{ name: 'Prism Project', extensions: ['prsm'] }]
    });

    if (canceled || filePaths.length === 0) return null;

    const filePath = filePaths[0];
    const data = await loadProjectPackage(filePath);

    return { filePath, data };
});
