const { app, BrowserWindow, ipcMain, Menu, MenuItem } = require('electron');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1000,
        height: 600,
        frame: false,
        webPreferences: {
            contextIsolation: false,
            enableRemoteModule: false,
            nodeIntegration: true,
        },
    });

    mainWindow.loadFile('src/index.html');
}

app.whenReady().then(createWindow);

ipcMain.handle('show-context-menu', (event, filePath) => {
    const menu = new Menu();
    menu.append(new MenuItem({
        label: 'Copy',
        click: () => {
            event.sender.send('context-menu-command', { action: 'copy', filePath });
        }
    }));
    menu.append(new MenuItem({
        label: 'Paste',
        click: () => {
            event.sender.send('context-menu-command', { action: 'paste', filePath });
        }
    }));
    menu.append(new MenuItem({
        label: 'Delete',
        click: () => {
            event.sender.send('context-menu-command', { action: 'delete', filePath });
        }
    }));
    menu.popup();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
