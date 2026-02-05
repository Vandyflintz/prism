import { app, BrowserWindow, ipcMain, dialog, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
// import * as os from 'os';
import serve from 'electron-serve';
import { createAppMenu } from './menu';

const loadURL = serve({ directory: 'out' }); // 'out' is in project root, relative to app execution? 
// When packaged: 'out' is in Resources/app/out ? 
// electron-serve handles relative paths from app root.
// NOTE: We need to verify 'out' location in packaged app. 
// Files are copied to 'resources/app' usually.
// So 'out' should be at root of app.


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

    // Load App
    const startUrl = process.env.ELECTRON_START_URL;

    if (startUrl && !app.isPackaged) {
        mainWindow.loadURL(startUrl);
    } else {
        // Production: Load via electron-serve
        console.log('[Main] Loading production app via electron-serve...');
        loadURL(mainWindow)
            .then(() => {
                console.log('[Main] electron-serve loaded successfully.');
            })
            .catch((err) => {
                console.error('[Main] electron-serve failed to load:', err);
                dialog.showMessageBox(mainWindow!, {
                    type: 'error',
                    title: 'Load Error',
                    message: 'Failed to load app via electron-serve',
                    detail: err.toString()
                });
            });
    }



    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    createWindow();
    if (process.platform === 'darwin') {
        const iconPath = path.join(__dirname, '../resources/icon.png');
        if (fs.existsSync(iconPath)) {
            app.dock?.setIcon(iconPath);
        }
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
