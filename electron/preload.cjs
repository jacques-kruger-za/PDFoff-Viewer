const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.send('open-file-dialog'),
  openDroppedFiles: (files) => {
    const paths = files.map((f) => webUtils.getPathForFile(f));
    ipcRenderer.send('open-dropped-files', paths);
  },
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
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
  isElectron: true,
});
