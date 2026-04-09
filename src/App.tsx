import { useState, useRef, useCallback, useEffect } from 'react';
import { Toolbar } from './components/Toolbar';
import { TabBar } from './components/TabBar';
import { PdfViewer } from './components/PdfViewer';
import { EmptyState } from './components/EmptyState';
import { usePdfDocument } from './hooks/usePdfDocument';
import type { PdfFile } from './types/pdf';

declare global {
  interface Window {
    electronAPI?: {
      onOpenFiles: (callback: (filePaths: string[]) => void) => void;
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

  // Listen for files opened from Electron's native File > Open menu
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onOpenFiles(async (filePaths: string[]) => {
      const loaded = await Promise.all(
        filePaths.map(async (filePath) => {
          const response = await fetch(`file://${filePath}`);
          const data = await response.arrayBuffer();
          const name = filePath.split(/[\\/]/).pop() || 'untitled.pdf';
          const id = `pdf-${++fileIdCounter}`;
          return { id, name, data } as PdfFile;
        })
      );
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
        <PdfViewer
          pdfDoc={pdfDoc}
          totalPages={totalPages}
          zoom={zoom}
          currentPage={currentPage}
          onCurrentPageChange={setCurrentPage}
          onZoomChange={setZoom}
        />
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
