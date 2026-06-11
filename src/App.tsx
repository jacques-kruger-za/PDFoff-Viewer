import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Toolbar } from './components/Toolbar';
import { TabBar } from './components/TabBar';
import { PdfViewer } from './components/PdfViewer';
import { ThumbnailSidebar } from './components/ThumbnailSidebar';
import { EmptyState } from './components/EmptyState';
import { DocumentLoadingState } from './components/DocumentLoadingState';
import { SignatureModal } from './components/SignatureModal';
import { usePdfDocument } from './hooks/usePdfDocument';
import type { PdfFile } from './types/pdf';
import type { Annotation, ToolType, SignatureEntry } from './types/annotations';
import { ANNOTATION_DEFAULTS, DEFAULT_BODY_PT } from './types/annotations';
import { exportPdf } from './services/pdfExport';
import { MENU_COMMANDS } from './constants/ipc';
import { ZOOM, LAYOUT } from './constants/layout';

interface SaveResult {
  ok: boolean;
  path?: string;
  canceled?: boolean;
  error?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      onOpenFiles: (
        callback: (files: Array<{ path?: string; name: string; data: ArrayBuffer }>) => void
      ) => () => void;
      onMenuCommand: (callback: (command: string) => void) => () => void;
      consumePendingPdfFiles: () => Promise<Array<{ path?: string; name: string; data: ArrayBuffer }>>;
      showInFolder: (filePath: string) => Promise<void>;
      openFileDialog: () => void;
      openDroppedFiles: (files: File[]) => void;
      saveFile: (path: string, data: Uint8Array) => Promise<SaveResult>;
      saveFileAs: (data: Uint8Array, defaultName: string) => Promise<SaveResult>;
      getSignatures: () => Promise<SignatureEntry[]>;
      saveSignature: (entry: {
        id: string;
        label: string;
        kind: 'signature' | 'initial';
        dataUrl: string;
        makeDefault?: boolean;
      }) => Promise<SignatureEntry>;
      deleteSignature: (id: string) => Promise<{ ok: boolean }>;
      setUnsaved: (value: boolean) => void;
      closeAfterSave: () => void;
      isElectron: boolean;
    };
  }
}

interface PendingImage {
  dataUrl: string;
  kind: 'image' | 'signature';
  aspect: number;
}

function loadAspect(dataUrl: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight || 1);
    img.onerror = () => resolve(1);
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function downloadBytes(bytes: Uint8Array, name: string) {
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

let fileIdCounter = 0;

export default function App() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Annotation state
  const [annotationsByFile, setAnnotationsByFile] = useState<Record<string, Annotation[]>>({});
  const [dirtyFiles, setDirtyFiles] = useState<Record<string, boolean>>({});
  const [tool, setTool] = useState<ToolType>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [penColor, setPenColor] = useState<string>(ANNOTATION_DEFAULTS.PEN_COLOR);
  const [penWidth, setPenWidth] = useState<number>(ANNOTATION_DEFAULTS.PEN_STROKE);
  const [highlightColor, setHighlightColor] = useState<string>(ANNOTATION_DEFAULTS.HIGHLIGHT_COLOR);
  const [signatureHeight, setSignatureHeight] = useState<number>(ANNOTATION_DEFAULTS.SIGNATURE_HEIGHT);
  const [textFontPt, setTextFontPt] = useState<number>(DEFAULT_BODY_PT);
  const [pageHeightPt, setPageHeightPt] = useState<number>(792); // US Letter default

  const activeFile = files.find((f) => f.id === activeFileId) ?? null;
  const { pdfDoc, totalPages, error } = usePdfDocument(activeFile);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedId(null);
  }, [activeFileId]);

  const addFilesFromBuffers = useCallback(
    (loaded: PdfFile[]) => {
      let lastActiveId: string | null = null;

      setFiles((prev) => {
        const newFiles: PdfFile[] = [];
        for (const file of loaded) {
          const existing = prev.find(
            (f) => (file.path && f.path === file.path) || f.name === file.name
          );
          if (existing) {
            lastActiveId = existing.id;
          } else {
            newFiles.push(file);
            lastActiveId = file.id;
          }
        }
        return newFiles.length > 0 ? [...prev, ...newFiles] : prev;
      });

      if (lastActiveId) {
        setActiveFileId(lastActiveId);
      }
    },
    []
  );

  const addFiles = useCallback((newFiles: File[]) => {
    const pdfFiles = newFiles.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );
    if (pdfFiles.length === 0) return;

    Promise.all(
      pdfFiles.map(async (file) => {
        const data = await file.arrayBuffer();
        const id = `pdf-${++fileIdCounter}`;
        // In Electron, File objects from <input> and drag-drop have a .path property
        const filePath = (file as File & { path?: string }).path || undefined;
        return { id, name: file.name, data, path: filePath } as PdfFile;
      })
    ).then(addFilesFromBuffers);
  }, [addFilesFromBuffers]);

  const loadElectronFiles = useCallback(
    (openedFiles: Array<{ path?: string; name: string; data: ArrayBuffer }>) => {
      if (openedFiles.length === 0) return;
      const loaded = openedFiles.map(({ path, name, data }) => {
        const id = `pdf-${++fileIdCounter}`;
        return { id, name, data, path } as PdfFile;
      });
      addFilesFromBuffers(loaded);
    },
    [addFilesFromBuffers]
  );

  // Listen for files opened from Electron (File > Open menu, second-instance)
  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubscribe = window.electronAPI.onOpenFiles(loadElectronFiles);

    // Pull any files that were queued before React mounted (e.g. file association launch)
    window.electronAPI.consumePendingPdfFiles().then(loadElectronFiles);

    return unsubscribe;
  }, [loadElectronFiles]);

  const handleOpenFile = useCallback(() => {
    if (window.electronAPI) {
      window.electronAPI.openFileDialog();
    } else {
      fileInputRef.current?.click();
    }
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files;
      if (fileList) {
        addFiles(Array.from(fileList));
        e.target.value = '';
      }
    },
    [addFiles]
  );

  const handleCloseFile = useCallback(
    (id: string) => {
      if (dirtyFiles[id] && !window.confirm('This document has unsaved changes. Close without saving?')) {
        return;
      }
      setFiles((prev) => {
        const next = prev.filter((f) => f.id !== id);
        if (activeFileId === id) {
          const idx = prev.findIndex((f) => f.id === id);
          const newActive = next[Math.min(idx, next.length - 1)] ?? null;
          setActiveFileId(newActive?.id ?? null);
        }
        return next;
      });
      setAnnotationsByFile((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setDirtyFiles((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [activeFileId, dirtyFiles]
  );

  const handleCloseActiveFile = useCallback(() => {
    if (activeFileId) {
      handleCloseFile(activeFileId);
    }
  }, [activeFileId, handleCloseFile]);

  useEffect(() => {
    if (!window.electronAPI) return;

    return window.electronAPI.onMenuCommand((command) => {
      switch (command) {
        case MENU_COMMANDS.CLOSE_TAB:
          handleCloseActiveFile();
          break;
        case MENU_COMMANDS.SHOW_SIDEBAR:
          setIsSidebarVisible(true);
          break;
        case MENU_COMMANDS.HIDE_SIDEBAR:
          setIsSidebarVisible(false);
          break;
        default:
          break;
      }
    });
  }, [handleCloseActiveFile]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (window.electronAPI?.openDroppedFiles) {
        window.electronAPI.openDroppedFiles(droppedFiles);
      } else {
        addFiles(droppedFiles);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleFitPage = useCallback(async () => {
    if (!pdfDoc || !viewerRef.current) return;
    const page = await pdfDoc.getPage(currentPage);
    const vp = page.getViewport({ scale: 1 });
    const container = viewerRef.current;
    const availW = container.clientWidth - LAYOUT.CONTAINER_PADDING;
    const availH = container.clientHeight - LAYOUT.CONTAINER_PADDING;
    const fitZoom = Math.min(availW / (vp.width * ZOOM.BASE_SCALE), availH / (vp.height * ZOOM.BASE_SCALE));
    setZoom(Math.round(fitZoom * 1000) / 1000);
  }, [pdfDoc, currentPage]);

  const handleFitWidth = useCallback(async () => {
    if (!pdfDoc || !viewerRef.current) return;
    const page = await pdfDoc.getPage(currentPage);
    const vp = page.getViewport({ scale: 1 });
    const container = viewerRef.current;
    const availW = container.clientWidth - LAYOUT.CONTAINER_PADDING_WITH_SCROLLBAR;
    const fitZoom = availW / (vp.width * ZOOM.BASE_SCALE);
    setZoom(Math.round(fitZoom * 1000) / 1000);
  }, [pdfDoc, currentPage]);

  // ── Annotations ─────────────────────────────────────────────────────────────
  const activeAnnotations = useMemo(
    () => (activeFileId ? annotationsByFile[activeFileId] ?? [] : []),
    [activeFileId, annotationsByFile]
  );
  const isDirty = activeFileId ? !!dirtyFiles[activeFileId] : false;
  const selectedAnnotation = selectedId ? activeAnnotations.find((a) => a.id === selectedId) ?? null : null;

  const markDirty = useCallback((fileId: string) => {
    setDirtyFiles((prev) => ({ ...prev, [fileId]: true }));
  }, []);
  const clearDirty = useCallback((fileId: string) => {
    setDirtyFiles((prev) => ({ ...prev, [fileId]: false }));
  }, []);

  const handleAddAnnotation = useCallback(
    (a: Annotation) => {
      if (!activeFileId) return;
      setAnnotationsByFile((prev) => ({ ...prev, [activeFileId]: [...(prev[activeFileId] ?? []), a] }));
      markDirty(activeFileId);
    },
    [activeFileId, markDirty]
  );

  const handleUpdateAnnotation = useCallback(
    (id: string, patch: Partial<Annotation>) => {
      if (!activeFileId) return;
      setAnnotationsByFile((prev) => {
        const next = (prev[activeFileId] ?? []).map((a) => (a.id === id ? ({ ...a, ...patch } as Annotation) : a));
        // Remember a resized signature's height so the next placement matches.
        const changed = next.find((a) => a.id === id);
        if (changed && changed.type === 'image' && changed.kind === 'signature' && 'h' in patch) {
          setSignatureHeight(changed.h);
        }
        return { ...prev, [activeFileId]: next };
      });
      markDirty(activeFileId);
    },
    [activeFileId, markDirty]
  );

  const handleDeleteAnnotation = useCallback(
    (id: string) => {
      if (!activeFileId) return;
      setAnnotationsByFile((prev) => ({
        ...prev,
        [activeFileId]: (prev[activeFileId] ?? []).filter((a) => a.id !== id),
      }));
      markDirty(activeFileId);
    },
    [activeFileId, markDirty]
  );

  // Detect the active document's body text size to use as the default font size.
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await pdfDoc.getPage(1);
        const vp = page.getViewport({ scale: 1 });
        const tc = await page.getTextContent();
        if (cancelled) return;
        setPageHeightPt(vp.height);
        const counts = new Map<number, number>();
        for (const it of tc.items as Array<{ height?: number; str?: string }>) {
          const h = Math.round(it.height ?? 0);
          if (h >= 5 && h <= 48) counts.set(h, (counts.get(h) ?? 0) + (it.str?.length || 1));
        }
        let bodyPt = DEFAULT_BODY_PT;
        let best = 0;
        for (const [h, c] of counts) if (c > best) { best = c; bodyPt = h; }
        setTextFontPt(bodyPt);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc]);

  const handleFontSizeChange = useCallback(
    (pt: number) => {
      setTextFontPt(pt);
      if (selectedId) {
        const sel = activeAnnotations.find((a) => a.id === selectedId);
        if (sel && sel.type === 'text' && pageHeightPt > 0) {
          handleUpdateAnnotation(selectedId, { fontSize: pt / pageHeightPt });
        }
      }
    },
    [selectedId, activeAnnotations, pageHeightPt, handleUpdateAnnotation]
  );

  const handleConsumePendingImage = useCallback(() => {
    setPendingImage(null);
    setTool('select');
  }, []);

  // Toggle: clicking the active tool returns to 'select' (normal app behaviour).
  const handleToolChange = useCallback((t: ToolType) => {
    setTool((prev) => (prev === t ? 'select' : t));
    setSelectedId(null);
    if (t !== 'image' && t !== 'signature') setPendingImage(null);
  }, []);

  // Escape returns to the normal (select) tool. Text editing handles its own
  // Escape (blur) and stops propagation, so this won't fire mid-edit.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTool('select');
        setSelectedId(null);
        setPendingImage(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handlePickImage = useCallback(() => {
    imageInputRef.current?.click();
  }, []);

  const handleImageChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    const aspect = await loadAspect(dataUrl);
    setPendingImage({ dataUrl, kind: 'image', aspect });
    setTool('image');
  }, []);

  const handleSignatureUse = useCallback(async (dataUrl: string) => {
    const aspect = await loadAspect(dataUrl);
    setPendingImage({ dataUrl, kind: 'signature', aspect });
    setTool('signature');
    setSignatureOpen(false);
  }, []);

  const handleSave = useCallback(
    async (saveAs = false) => {
      if (!activeFile) return;
      const anns = annotationsByFile[activeFile.id] ?? [];
      let bytes: Uint8Array;
      try {
        bytes = await exportPdf(activeFile.data.slice(0), anns);
      } catch (err) {
        console.error('PDF export failed:', err);
        return;
      }

      const api = window.electronAPI;
      if (api?.saveFile && activeFile.path && !saveAs) {
        const res = await api.saveFile(activeFile.path, bytes);
        if (res.ok) clearDirty(activeFile.id);
      } else if (api?.saveFileAs) {
        const res = await api.saveFileAs(bytes, activeFile.name);
        if (res.ok) {
          clearDirty(activeFile.id);
          if (res.path) {
            const newPath = res.path;
            setFiles((prev) => prev.map((f) => (f.id === activeFile.id ? { ...f, path: newPath } : f)));
          }
        }
      } else {
        downloadBytes(bytes, activeFile.name);
        clearDirty(activeFile.id);
      }
    },
    [activeFile, annotationsByFile, clearDirty]
  );

  const saveAllDirty = useCallback(async () => {
    const api = window.electronAPI;
    for (const f of files) {
      if (!dirtyFiles[f.id]) continue;
      try {
        const bytes = await exportPdf(f.data.slice(0), annotationsByFile[f.id] ?? []);
        if (api?.saveFile && f.path) await api.saveFile(f.path, bytes);
        else if (api?.saveFileAs) await api.saveFileAs(bytes, f.name);
        clearDirty(f.id);
      } catch (err) {
        console.error('Save failed for', f.name, err);
      }
    }
  }, [files, dirtyFiles, annotationsByFile, clearDirty]);

  // Report unsaved state to the main process for the close-confirmation prompt.
  useEffect(() => {
    window.electronAPI?.setUnsaved?.(Object.values(dirtyFiles).some(Boolean));
  }, [dirtyFiles]);

  // Save menu commands (Electron) — wired here so handleSave is defined.
  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.onMenuCommand((command) => {
      if (command === MENU_COMMANDS.SAVE) handleSave(false);
      else if (command === MENU_COMMANDS.SAVE_AS) handleSave(true);
      else if (command === MENU_COMMANDS.SAVE_ALL) {
        saveAllDirty().then(() => window.electronAPI?.closeAfterSave?.());
      }
    });
  }, [handleSave, saveAllDirty]);

  // Browser (non-Electron) Ctrl+S fallback — Electron uses the menu accelerator.
  useEffect(() => {
    if (window.electronAPI) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave(e.shiftKey);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSave]);

  return (
    <div
      className="relative h-screen flex flex-col bg-neutral-900"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageChange}
      />

      <Toolbar
        currentPage={currentPage}
        totalPages={totalPages}
        zoom={zoom}
        onPageChange={setCurrentPage}
        onZoomChange={setZoom}
        onOpenFile={handleOpenFile}
        onFitPage={handleFitPage}
        onFitWidth={handleFitWidth}
        tool={tool}
        onToolChange={handleToolChange}
        onPickImage={handlePickImage}
        onOpenSignature={() => setSignatureOpen(true)}
        onSave={() => handleSave(false)}
        isDirty={isDirty}
        penColor={penColor}
        onPenColorChange={setPenColor}
        penWidth={penWidth}
        onPenWidthChange={setPenWidth}
        highlightColor={highlightColor}
        onHighlightColorChange={setHighlightColor}
        showFontSize={tool === 'text' || selectedAnnotation?.type === 'text'}
        fontSizePt={
          selectedAnnotation?.type === 'text'
            ? Math.round(selectedAnnotation.fontSize * pageHeightPt)
            : textFontPt
        }
        onFontSizeChange={handleFontSizeChange}
      />

      <TabBar
        files={files}
        activeFileId={activeFileId}
        onSelectFile={setActiveFileId}
        onCloseFile={handleCloseFile}
      />

      {error && (
        <div className="px-4 py-2 bg-red-900/50 text-red-300 text-sm border-b border-red-800">
          Failed to load PDF: {error}
        </div>
      )}

      {pdfDoc ? (
        <div className="flex flex-1 overflow-hidden">
          {isSidebarVisible && (
            <ThumbnailSidebar
              pdfDoc={pdfDoc}
              totalPages={totalPages}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          )}
          <PdfViewer
            ref={viewerRef}
            pdfDoc={pdfDoc}
            totalPages={totalPages}
            zoom={zoom}
            currentPage={currentPage}
            onCurrentPageChange={setCurrentPage}
            onZoomChange={setZoom}
            annotations={activeAnnotations}
            tool={tool}
            penColor={penColor}
            penWidth={penWidth}
            highlightColor={highlightColor}
            signatureHeight={signatureHeight}
            textFontSize={pageHeightPt > 0 ? textFontPt / pageHeightPt : ANNOTATION_DEFAULTS.TEXT_FONT_SIZE}
            selectedId={selectedId}
            pendingImage={pendingImage}
            onSelectAnnotation={setSelectedId}
            onAddAnnotation={handleAddAnnotation}
            onUpdateAnnotation={handleUpdateAnnotation}
            onDeleteAnnotation={handleDeleteAnnotation}
            onConsumePendingImage={handleConsumePendingImage}
          />
        </div>
      ) : activeFile ? (
        <DocumentLoadingState fileName={activeFile.name} />
      ) : (
        <EmptyState onOpenFile={handleOpenFile} />
      )}

      {isDragging && (
        <div className="fixed inset-0 bg-accent/20 border-4 border-dashed border-accent flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-neutral-800 rounded-xl px-8 py-6 text-xl text-text-primary shadow-2xl">
            Drop PDF here
          </div>
        </div>
      )}

      {signatureOpen && (
        <SignatureModal onClose={() => setSignatureOpen(false)} onUse={handleSignatureUse} />
      )}
    </div>
  );
}
