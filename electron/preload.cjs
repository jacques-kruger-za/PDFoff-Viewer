const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

contextBridge.exposeInMainWorld('electronAPI', {
  onOpenFiles: (callback) => {
    ipcRenderer.on('open-files', (_event, filePaths) => callback(filePaths));
  },
  readFile: (filePath) => {
    const buffer = fs.readFileSync(filePath);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  },
  getFileName: (filePath) => path.basename(filePath),
  isElectron: true,
});
