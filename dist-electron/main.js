"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
// import * as os from 'os';
const electron_serve_1 = __importDefault(require("electron-serve"));
const menu_1 = require("./menu");
const loadURL = (0, electron_serve_1.default)({ directory: 'out' }); // 'out' is in project root, relative to app execution? 
// When packaged: 'out' is in Resources/app/out ? 
// electron-serve handles relative paths from app root.
// NOTE: We need to verify 'out' location in packaged app. 
// Files are copied to 'resources/app' usually.
// So 'out' should be at root of app.
// Set App Name
electron_1.app.name = 'Prism';
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false // Allow loading local resources (file://)
        },
        titleBarStyle: 'hidden', // Mac style
        trafficLightPosition: { x: 16, y: 13 }, // Vertically center in 40px header
        backgroundColor: '#09090b', // Zinc-950
        icon: path.join(__dirname, '../resources/icon.png') // Linux/Windows fallback (Mac uses .icns in build)
    });
    (0, menu_1.createAppMenu)(mainWindow);
    // Load App
    const startUrl = process.env.ELECTRON_START_URL;
    if (startUrl && !electron_1.app.isPackaged) {
        mainWindow.loadURL(startUrl);
    }
    else {
        // Production: Load via electron-serve
        console.log('[Main] Loading production app via electron-serve...');
        loadURL(mainWindow)
            .then(() => {
            console.log('[Main] electron-serve loaded successfully.');
        })
            .catch((err) => {
            console.error('[Main] electron-serve failed to load:', err);
            electron_1.dialog.showMessageBox(mainWindow, {
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
    mainWindow.on('enter-full-screen', () => {
        mainWindow?.webContents.send('window:fullscreen', true);
    });
    mainWindow.on('leave-full-screen', () => {
        mainWindow?.webContents.send('window:fullscreen', false);
    });
}
electron_1.app.on('ready', () => {
    createWindow();
    if (process.platform === 'darwin') {
        const iconPath = path.join(__dirname, '../resources/icon.png');
        if (fs.existsSync(iconPath)) {
            electron_1.app.dock?.setIcon(iconPath);
        }
    }
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
// --- IPC Handlers ---
// Open File Dialog
electron_1.ipcMain.handle('dialog:openFile', async () => {
    if (!mainWindow)
        return null;
    const { canceled, filePaths } = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Photoshop Files', extensions: ['psd'] }
        ]
    });
    if (canceled) {
        return null;
    }
    else {
        return filePaths[0];
    }
});
electron_1.ipcMain.handle('fs:saveTempFile', async (event, { filename, buffer }) => {
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
electron_1.ipcMain.handle('fs:readFile', async (event, filePath) => {
    try {
        const buffer = await fs.promises.readFile(filePath);
        return buffer;
    }
    catch (error) {
        console.error("Failed to read file", error);
        throw error;
    }
});
// Render Composition
// Render Composition
const render_1 = require("./render");
electron_1.ipcMain.handle('render-composition', async (event, data) => {
    return new Promise((resolve, reject) => {
        // Find the window to send progress back
        const win = electron_1.BrowserWindow.fromWebContents(event.sender);
        (0, render_1.renderComposition)(data, (progress) => {
            if (win) {
                win.webContents.send('render-progress', progress);
            }
        })
            .then((output) => resolve(output))
            .catch((err) => reject(err));
    });
});
// Persistence
const persistence_1 = require("./persistence");
// TTS Service
const tts_service_1 = require("./tts-service");
tts_service_1.TtsService.init();
electron_1.ipcMain.handle('project:save', async (event, { data, filePath }) => {
    let targetPath = filePath;
    if (!targetPath) {
        const { canceled, filePath: savePath } = await electron_1.dialog.showSaveDialog({
            title: 'Save Project',
            defaultPath: 'Untitled.prsm',
            filters: [{ name: 'Prism Project', extensions: ['prsm'] }]
        });
        if (canceled || !savePath)
            return null;
        targetPath = savePath;
    }
    await (0, persistence_1.saveProjectPackage)(targetPath, data);
    electron_1.app.addRecentDocument(targetPath);
    return targetPath;
});
electron_1.ipcMain.handle('project:open', async () => {
    const { canceled, filePaths } = await electron_1.dialog.showOpenDialog({
        title: 'Open Project',
        properties: ['openFile'],
        filters: [{ name: 'Prism Project', extensions: ['prsm'] }]
    });
    if (canceled || filePaths.length === 0)
        return null;
    const filePath = filePaths[0];
    const data = await (0, persistence_1.loadProjectPackage)(filePath);
    electron_1.app.addRecentDocument(filePath);
    return { filePath, data };
});
