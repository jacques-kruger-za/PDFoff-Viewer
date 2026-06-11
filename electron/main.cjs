const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { IPC, MENU_COMMANDS } = require('./constants.cjs');

const isDev = process.argv.includes('--dev');

let mainWindow;
// Files queued before the window is ready (e.g. from file association launch)
let pendingFiles = [];

function sendMenuCommand(command) {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send(IPC.MENU_COMMAND, command);
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
      // sandbox must be off so the preload can require() shared local modules
      // (./constants.cjs). Sandboxed preloads can only require electron + builtins.
      // contextIsolation stays on; this app loads only local content.
      sandbox: false,
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
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendMenuCommand(MENU_COMMANDS.SAVE),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendMenuCommand(MENU_COMMANDS.SAVE_AS),
        },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => sendMenuCommand(MENU_COMMANDS.CLOSE_TAB),
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
          click: (menuItem) => sendMenuCommand(menuItem.checked ? MENU_COMMANDS.SHOW_SIDEBAR : MENU_COMMANDS.HIDE_SIDEBAR),
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

async function readPdfPayloads(filePaths) {
  return Promise.all(
    filePaths.map(async (filePath) => {
      const buffer = await fs.promises.readFile(filePath);
      return {
        path: filePath,
        name: path.basename(filePath),
        data: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      };
    })
  );
}

// Renderer pulls pending files after React mounts.
ipcMain.handle(IPC.CONSUME_PENDING, async () => {
  return readPdfPayloads(consumePendingFiles());
});

ipcMain.handle(IPC.SHOW_IN_FOLDER, (_event, filePath) => {
  shell.showItemInFolder(filePath);
});

// ── Save: write modified PDF bytes back to disk ───────────────────────────────

// Save to a known path (overwrite original). Returns { ok, path } or { ok:false, error }.
ipcMain.handle(IPC.SAVE_FILE, async (_event, { path: filePath, data }) => {
  try {
    if (!filePath) return { ok: false, error: 'no-path' };
    await fs.promises.writeFile(filePath, Buffer.from(data));
    return { ok: true, path: filePath };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

// Save As: prompt for a destination, then write. Returns { ok, path } or { ok:false, canceled }.
ipcMain.handle(IPC.SAVE_FILE_AS, async (_event, { data, defaultName }) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save PDF As',
      defaultPath: defaultName || 'document.pdf',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    await fs.promises.writeFile(result.filePath, Buffer.from(data));
    return { ok: true, path: result.filePath };
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
});

// ── Signature store: PNGs in userData/signatures + index.json ──────────────────

function signaturesDir() {
  return path.join(app.getPath('userData'), 'signatures');
}

async function readSignatureIndex() {
  const indexPath = path.join(signaturesDir(), 'index.json');
  try {
    const raw = await fs.promises.readFile(indexPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSignatureIndex(entries) {
  const dir = signaturesDir();
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(
    path.join(dir, 'index.json'),
    JSON.stringify(entries, null, 2)
  );
}

// Returns [{ id, label, kind, isDefault, dataUrl }]
ipcMain.handle(IPC.GET_SIGNATURES, async () => {
  const entries = await readSignatureIndex();
  const dir = signaturesDir();
  const out = [];
  for (const e of entries) {
    try {
      const png = await fs.promises.readFile(path.join(dir, `${e.id}.png`));
      out.push({ ...e, dataUrl: `data:image/png;base64,${png.toString('base64')}` });
    } catch {
      // skip entries whose PNG is missing
    }
  }
  return out;
});

// Accepts { id, label, kind, dataUrl, makeDefault }. Writes PNG + index. Returns saved entry.
ipcMain.handle(IPC.SAVE_SIGNATURE, async (_event, { id, label, kind, dataUrl, makeDefault }) => {
  const dir = signaturesDir();
  await fs.promises.mkdir(dir, { recursive: true });
  const base64 = String(dataUrl).replace(/^data:image\/png;base64,/, '');
  await fs.promises.writeFile(path.join(dir, `${id}.png`), Buffer.from(base64, 'base64'));

  let entries = await readSignatureIndex();
  entries = entries.filter((e) => e.id !== id);
  const isFirst = entries.length === 0;
  const isDefault = Boolean(makeDefault) || isFirst;
  if (isDefault) entries = entries.map((e) => ({ ...e, isDefault: false }));
  const entry = { id, label: label || 'Signature', kind: kind || 'signature', isDefault };
  entries.push(entry);
  await writeSignatureIndex(entries);
  return { ...entry, dataUrl };
});

ipcMain.handle(IPC.DELETE_SIGNATURE, async (_event, id) => {
  const dir = signaturesDir();
  try {
    await fs.promises.unlink(path.join(dir, `${id}.png`));
  } catch {
    // ignore missing file
  }
  let entries = await readSignatureIndex();
  const wasDefault = entries.find((e) => e.id === id)?.isDefault;
  entries = entries.filter((e) => e.id !== id);
  if (wasDefault && entries.length > 0) entries[0].isDefault = true;
  await writeSignatureIndex(entries);
  return { ok: true };
});

ipcMain.on(IPC.OPEN_FILE_DIALOG, () => openFileDialog());

ipcMain.on(IPC.OPEN_DROPPED_FILES, async (_event, paths) => {
  const valid = paths.filter((p) => p.toLowerCase().endsWith('.pdf') && fs.existsSync(p));
  if (valid.length > 0) {
    mainWindow.webContents.send(IPC.OPEN_FILES, await readPdfPayloads(valid));
  }
});

async function openFileDialog() {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open PDF',
    filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    properties: ['openFile', 'multiSelections'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow.webContents.send(IPC.OPEN_FILES, await readPdfPayloads(result.filePaths));
  }
}

async function sendOrQueueFiles(filePaths) {
  if (mainWindow && mainWindow.webContents && !mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send(IPC.OPEN_FILES, await readPdfPayloads(filePaths));
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
