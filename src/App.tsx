import { useState, useRef, useCallback, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { TabBar } from './components/TabBar';
import { PdfViewer } from './components/PdfViewer';
import { ThumbnailSidebar } from './components/ThumbnailSidebar';
import { EmptyState } from './components/EmptyState';
import { usePdfDocument } from './hooks/usePdfDocument';
import { BASE_SCALE } from './components/PdfPage';
import type { PdfFile } from './types/pdf';

declare global {
  interface Window {
    electronAPI?: {
      onOpenFiles: (callback: (filePaths: string[]) => void) => void;
      readFile: (filePath: string) => ArrayBuffer;
      getFileName: (filePath: string) => string;
      isElectron: boolean;
    };
  }
}

let fileIdCounter = 0;

export default function App() {
  const [files, setFiles] = useState<PdfFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const activeFile = files.find((f) => f.id === activeFileId) ?? null;
  const { pdfDoc, totalPages, error } = usePdfDocument(activeFile?.data ?? null);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFileId]);

  const addFilesFromBuffers = useCallback(
    (loaded: PdfFile[]) => {
      setFiles((prev) => [...prev, ...loaded]);
      setActiveFileId(loaded[loaded.length - 1].id);
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
        return { id, name: file.name, data } as PdfFile;
      })
    ).then(addFilesFromBuffers);
  }, [addFilesFromBuffers]);

  // Listen for files opened from Electron (File > Open menu, file association, CLI args)
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onOpenFiles((filePaths: string[]) => {
      const loaded = filePaths.map((filePath) => {
        const data = window.electronAPI!.readFile(filePath);
        const name = window.electronAPI!.getFileName(filePath);
        const id = `pdf-${++fileIdCounter}`;
        return { id, name, data } as PdfFile;
      });
      addFilesFromBuffers(loaded);
    });
  }, [addFilesFromBuffers]);

  const handleOpenFile = useCallback(() => {
    fileInputRef.current?.click();
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
      setFiles((prev) => {
        const next = prev.filter((f) => f.id !== id);
        if (activeFileId === id) {
          const idx = prev.findIndex((f) => f.id === id);
          const newActive = next[Math.min(idx, next.length - 1)] ?? null;
          setActiveFileId(newActive?.id ?? null);
        }
        return next;
      });
    },
    [activeFileId]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      addFiles(droppedFiles);
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

  // Fit-page: scale so the full page (width & height) fits in the viewer
  const handleFitPage = useCallback(async () => {
    if (!pdfDoc || !viewerRef.current) return;
    const page = await pdfDoc.getPage(currentPage);
    const vp = page.getViewport({ scale: 1 });
    const container = viewerRef.current;
    // Subtract padding (p-4 = 16px each side)
    const availW = container.clientWidth - 32;
    const availH = container.clientHeight - 32;
    const fitZoom = Math.min(availW / (vp.width * BASE_SCALE), availH / (vp.height * BASE_SCALE));
    setZoom(Math.round(fitZoom * 1000) / 1000);
  }, [pdfDoc, currentPage]);

  // Fit-width: scale so the page width fills the viewer width
  const handleFitWidth = useCallback(async () => {
    if (!pdfDoc || !viewerRef.current) return;
    const page = await pdfDoc.getPage(currentPage);
    const vp = page.getViewport({ scale: 1 });
    const container = viewerRef.current;
    // Subtract padding + scrollbar (~16px)
    const availW = container.clientWidth - 48;
    const fitZoom = availW / (vp.width * BASE_SCALE);
    setZoom(Math.round(fitZoom * 1000) / 1000);
  }, [pdfDoc, currentPage]);

  return (
    <div
      className="h-screen flex flex-col bg-neutral-900"
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

      <Toolbar
        currentPage={currentPage}
        totalPages={totalPages}
        zoom={zoom}
        onPageChange={setCurrentPage}
        onZoomChange={setZoom}
        onOpenFile={handleOpenFile}
        onFitPage={handleFitPage}
        onFitWidth={handleFitWidth}
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
          <ThumbnailSidebar
            pdfDoc={pdfDoc}
            totalPages={totalPages}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
          <PdfViewer
            ref={viewerRef}
            pdfDoc={pdfDoc}
            totalPages={totalPages}
            zoom={zoom}
            currentPage={currentPage}
            onCurrentPageChange={setCurrentPage}
            onZoomChange={setZoom}
          />
        </div>
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
    </div>
  );
}
