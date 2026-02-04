"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAppMenu = void 0;
const electron_1 = require("electron");
const createAppMenu = (mainWindow) => {
    const isMac = process.platform === 'darwin';
    const send = (channel, ...args) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(channel, ...args);
        }
    };
    const template = [
        // { role: 'appMenu' }
        ...(isMac ? [{
                label: electron_1.app.name,
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    { role: 'services' },
                    { type: 'separator' },
                    { role: 'hide' },
                    { role: 'hideOthers' },
                    { role: 'unhide' },
                    { type: 'separator' },
                    { role: 'quit' }
                ]
            }] : []),
        // { role: 'fileMenu' }
        {
            label: 'File',
            submenu: [
                {
                    label: 'Open Project...',
                    accelerator: 'CmdOrCtrl+O',
                    click: () => send('menu:open-project')
                },
                {
                    label: 'Open Recent',
                    submenu: [
                        { label: 'No Recent Files', enabled: false }
                        // TODO: Implement dynamic recent files list
                    ]
                },
                { type: 'separator' },
                {
                    label: 'Save Project',
                    accelerator: 'CmdOrCtrl+S',
                    click: () => send('menu:save-project')
                },
                {
                    label: 'Save Project As...',
                    accelerator: 'Shift+CmdOrCtrl+S',
                    click: () => send('menu:save-project-as')
                },
                { type: 'separator' },
                {
                    label: 'Import PSD...',
                    accelerator: 'CmdOrCtrl+I',
                    click: () => send('menu:import-psd')
                },
                { type: 'separator' },
                {
                    label: 'Export Video...',
                    accelerator: 'CmdOrCtrl+E',
                    click: () => send('menu:export-video')
                },
                { type: 'separator' },
                { role: isMac ? 'close' : 'quit' }
            ]
        },
        // { role: 'editMenu' }
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Undo',
                    accelerator: 'CmdOrCtrl+Z',
                    click: () => send('menu:undo')
                },
                {
                    label: 'Redo',
                    accelerator: 'Shift+CmdOrCtrl+Z',
                    click: () => send('menu:redo')
                },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'pasteAndMatchStyle' },
                { role: 'delete' },
                { role: 'selectAll' },
                { type: 'separator' },
                {
                    label: 'Timeline',
                    submenu: [
                        {
                            label: 'Split Track',
                            accelerator: 'CmdOrCtrl+B',
                            click: () => send('menu:split-track')
                        },
                        {
                            label: 'Align All to Start',
                            click: () => send('menu:align-tracks')
                        },
                        { type: 'separator' },
                        {
                            label: 'Clear Timeline',
                            click: () => send('menu:clear-timeline')
                        },
                        {
                            label: 'Reset Project Settings',
                            click: () => send('menu:reset-project')
                        }
                    ]
                }
            ]
        },
        // { role: 'viewMenu' }
        {
            label: 'View',
            submenu: [
                {
                    label: 'Toggle Resources',
                    accelerator: 'CmdOrCtrl+Alt+1',
                    click: () => send('menu:toggle-left-panel')
                },
                {
                    label: 'Toggle Inspector',
                    accelerator: 'CmdOrCtrl+Alt+2',
                    click: () => send('menu:toggle-right-panel')
                },
                { type: 'separator' },
                { role: 'togglefullscreen' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' }
            ]
        },
        // { role: 'windowMenu' }
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac ? [
                    { type: 'separator' },
                    { role: 'front' },
                    { type: 'separator' },
                    { role: 'window' }
                ] : [
                    { role: 'close' }
                ])
            ]
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Keyboard Shortcuts',
                    click: () => send('menu:shortcuts')
                }
            ]
        }
    ];
    const menu = electron_1.Menu.buildFromTemplate(template);
    electron_1.Menu.setApplicationMenu(menu);
};
exports.createAppMenu = createAppMenu;
