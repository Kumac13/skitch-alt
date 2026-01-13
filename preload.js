const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // スクリーンショット撮影
  captureScreen: () => ipcRenderer.invoke('capture-screen'),

  // ファイルを開く
  openFile: () => ipcRenderer.invoke('open-file'),

  // ファイルを保存
  saveFile: (dataUrl) => ipcRenderer.invoke('save-file', dataUrl),

  // 画像ファイルを読み込み
  readImage: (filePath) => ipcRenderer.invoke('read-image', filePath)
});
