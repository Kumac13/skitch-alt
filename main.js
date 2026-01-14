const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 }
  });

  mainWindow.loadFile('renderer/index.html');

  // Open DevTools in development
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  // Register global shortcut: Cmd+Shift+5
  globalShortcut.register('CommandOrControl+Shift+5', () => {
    console.log('[main] globalShortcut: Cmd+Shift+5 pressed');
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('trigger-capture');
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Capture screenshot
ipcMain.handle('capture-screen', async () => {
  console.log('[main] capture-screen: start');
  const tmpFile = path.join(os.tmpdir(), `screenshot-${Date.now()}.png`);
  return new Promise((resolve) => {
    exec(`screencapture -i "${tmpFile}"`, () => {
      if (fs.existsSync(tmpFile)) {
        console.log('[main] capture-screen: success -', tmpFile);
        resolve(tmpFile);
      } else {
        console.log('[main] capture-screen: cancelled or failed');
        resolve(null);
      }
    });
  });
});

// Open image file
ipcMain.handle('open-file', async () => {
  console.log('[main] open-file: showing dialog');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp'] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    console.log('[main] open-file: cancelled');
    return null;
  }

  console.log('[main] open-file: selected -', result.filePaths[0]);
  return result.filePaths[0];
});

// Read image file and return as Base64
ipcMain.handle('read-image', async (event, filePath) => {
  console.log('[main] read-image: reading -', filePath);
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
  console.log('[main] read-image: done (size:', data.length, 'bytes)');
  return `data:${mimeType};base64,${data.toString('base64')}`;
});
