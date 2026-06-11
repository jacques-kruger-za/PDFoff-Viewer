const { contextBridge, ipcRenderer, webUtils } = require('electron');
const { IPC } = require('./constants.cjs');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.send(IPC.OPEN_FILE_DIALOG),
  openDroppedFiles: (files) => {
    const paths = files.map((f) => webUtils.getPathForFile(f));
    ipcRenderer.send(IPC.OPEN_DROPPED_FILES, paths);
  },
  onOpenFiles: (callback) => {
    const handler = (_event, files) => callback(files);
    ipcRenderer.on(IPC.OPEN_FILES, handler);
    return () => ipcRenderer.removeListener(IPC.OPEN_FILES, handler);
  },
  onMenuCommand: (callback) => {
    const handler = (_event, command) => callback(command);
    ipcRenderer.on(IPC.MENU_COMMAND, handler);
    return () => ipcRenderer.removeListener(IPC.MENU_COMMAND, handler);
  },
  consumePendingPdfFiles: () => ipcRenderer.invoke(IPC.CONSUME_PENDING),
  showInFolder: (filePath) => ipcRenderer.invoke(IPC.SHOW_IN_FOLDER, filePath),
  isElectron: true,
});
