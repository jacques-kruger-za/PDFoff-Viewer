const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.argv.includes('--dev');

let mainWindow;
// Files queued before the window is ready (e.g. from file association launch)
let pendingFiles = [];

function sendMenuCommand(command) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('menu-command', command);
  }
}

// Extract PDF paths from command-line arguments (file association on Windows
// passes the file path as an argument).
// Strip wrapping quotes and resolve to absolute paths before checking existence.
function extractPdfArgs(argv) {
  return argv
    .map((arg) => arg.replace(/^["']|["']$/g, '')) // strip quotes
    .filter((arg) => arg.toLowerCase().endsWith('.pdf'))
    .map((arg) => path.resolve(arg))
    .filter((arg) => fs.existsSync(arg));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    title: 'PDFoff Viewer',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    backgroundColor: '#171717',
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
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendMenuCommand('close-tab'),
        },
        {
          label: 'Print',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.print({});
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Settings (coming soon)',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Settings',
              message: 'Settings are coming soon.',
              detail: 'A dedicated settings screen has not been built yet.',
            });
          },
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
        {
          label: 'Show Page Sidebar',
          type: 'checkbox',
          checked: true,
          click: (menuItem) => sendMenuCommand(menuItem.checked ? 'show-sidebar' : 'hide-sidebar'),
        },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'PDFoff Documentation',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'PDFoff Documentation',
              message: 'Documentation is coming soon.',
              detail: 'This menu item is a placeholder for a future documentation hub.',
            });
          },
        },
        {
          label: "What's New",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: "What's New",
              message: 'PDFoff Viewer v1.1 is in progress.',
              detail:
                'Current improvements include startup polish, smoother Ctrl+wheel zoom, and expanded application menus.',
            });
          },
        },
        {
          label: 'Keyboard Shortcuts',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Keyboard Shortcuts',
              message: 'Current keyboard shortcuts',
              detail: [
                'Ctrl+O  Open PDF',
                'Ctrl+W  Close tab',
                'Ctrl+P  Print',
                'Ctrl+Mouse Wheel  Zoom in or out',
              ].join('\n'),
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

}

function consumePendingFiles() {
  const files = pendingFiles;
  pendingFiles = [];
  return files;
}

function readPdfPayloads(filePaths) {
  return filePaths.map((filePath) => {
    const buffer = fs.readFileSync(filePath);
    return {
      path: filePath,
      name: path.basename(filePath),
      data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
  });
}

// Renderer pulls pending files after React mounts.
ipcMain.handle('consume-pending-pdf-files', () => {
  return readPdfPayloads(consumePendingFiles());
});

async function openFileDialog() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open PDF',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile', 'multiSelections'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow.webContents.send('open-files', readPdfPayloads(result.filePaths));
  }
}

function sendOrQueueFiles(filePaths) {
  if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send('open-files', readPdfPayloads(filePaths));
  } else {
    pendingFiles.push(...filePaths);
  }
}

// Collect PDFs from initial launch arguments.
// No need to guess argv offsets — just scan all args for .pdf files.
// The exe path, internal Electron args, and --dev flag will never end in .pdf.
const launchFiles = extractPdfArgs(process.argv);
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
    const files = extractPdfArgs(argv);
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
