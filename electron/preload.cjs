const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  onOpenFiles: (callback) => {
    const handler = (_event, files) => callback(files);
    ipcRenderer.on('open-files', handler);
    return () => ipcRenderer.removeListener('open-files', handler);
  },
  onMenuCommand: (callback) => {
    const handler = (_event, command) => callback(command);
    ipcRenderer.on('menu-command', handler);
    return () => ipcRenderer.removeListener('menu-command', handler);
  },
  consumePendingPdfFiles: () => ipcRenderer.invoke('consume-pending-pdf-files'),
  isElectron: true,
});
