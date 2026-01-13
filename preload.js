const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Capture screenshot
  captureScreen: () => ipcRenderer.invoke('capture-screen'),

  // Open file
  openFile: () => ipcRenderer.invoke('open-file'),

  // Read image file
  readImage: (filePath) => ipcRenderer.invoke('read-image', filePath)
});
