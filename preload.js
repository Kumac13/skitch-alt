const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Capture screenshot
  captureScreen: () => ipcRenderer.invoke('capture-screen'),

  // Open file
  openFile: () => ipcRenderer.invoke('open-file'),

  // Read image file
  readImage: (filePath) => ipcRenderer.invoke('read-image', filePath),

  // Save to clipboard
  saveToClipboard: (dataUrl) => ipcRenderer.invoke('save-to-clipboard', dataUrl),

  // Save to file
  saveToFile: (dataUrl) => ipcRenderer.invoke('save-to-file', dataUrl),

  // Listen for capture trigger from main process
  onTriggerCapture: (callback) => ipcRenderer.on('trigger-capture', callback),

  // Listen for image data from main process
  onLoadImageData: (callback) => ipcRenderer.on('load-image-data', (event, dataUrl) => callback(dataUrl))
});
