const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onOpenFiles: (callback) => {
    ipcRenderer.on('open-files', (_event, filePaths) => callback(filePaths));
  },
  isElectron: true,
});
