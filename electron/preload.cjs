const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  onOpenFiles: (callback) => {
    ipcRenderer.on('open-files', (_event, files) => callback(files));
  },
  consumePendingPdfFiles: () => ipcRenderer.invoke('consume-pending-pdf-files'),
  isElectron: true,
});
