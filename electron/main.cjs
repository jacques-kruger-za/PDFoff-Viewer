const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.argv.includes('--dev');

let mainWindow;
// Files queued before the window is ready (e.g. from file association launch)
let pendingFiles = [];

// Extract PDF paths from command-line arguments (file association on Windows
// passes the file path as an argument)
function extractPdfArgs(argv) {
  return argv
    .filter((arg) => arg.toLowerCase().endsWith('.pdf'))
    .filter((arg) => fs.existsSync(arg));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'PDFoff Viewer',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open PDF...',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFileDialog(),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'copy' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Once the page is ready, send any files that were queued before window load
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingFiles.length > 0) {
      mainWindow.webContents.send('open-files', pendingFiles);
      pendingFiles = [];
    }
  });
}

async function openFileDialog() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open PDF',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile', 'multiSelections'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow.webContents.send('open-files', result.filePaths);
  }
}

function sendOrQueueFiles(filePaths) {
  if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send('open-files', filePaths);
  } else {
    pendingFiles.push(...filePaths);
  }
}

// Collect PDFs from initial launch arguments
const launchFiles = extractPdfArgs(process.argv.slice(1));
if (launchFiles.length > 0) {
  pendingFiles.push(...launchFiles);
}

// Windows: second-instance handles "Open with" when app is already running.
// The file path arrives in argv of the second instance.
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const files = extractPdfArgs(argv.slice(1));
    if (files.length > 0) {
      sendOrQueueFiles(files);
    }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);
}

app.on('window-all-closed', () => {
  app.quit();
});
