import { useRef, useEffect } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

const THUMB_WIDTH = 120;

interface ThumbnailProps {
  pdfDoc: PDFDocumentProxy;
  pageNum: number;
  isActive: boolean;
  onClick: () => void;
}

function Thumbnail({ pdfDoc, pageNum, isActive, onClick }: ThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let renderTask: RenderTask | null = null;

    (async () => {
      const page = await pdfDoc.getPage(pageNum);
      if (cancelled) return;

      const unscaledVp = page.getViewport({ scale: 1 });
      const scale = THUMB_WIDTH / unscaledVp.width;
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext('2d')!;
      renderTask = page.render({ canvasContext: ctx, viewport, canvas });
      try {
        await renderTask.promise;
      } catch {
        // cancelled
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNum]);

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-1.5 rounded transition-colors ${
        isActive
          ? 'bg-accent/20 ring-2 ring-accent'
          : 'hover:bg-surface-hover'
      }`}
    >
      <canvas
        ref={canvasRef}
        className="rounded shadow-sm"
      />
      <span className={`text-xs tabular-nums ${isActive ? 'text-accent' : 'text-text-muted'}`}>
        {pageNum}
      </span>
    </button>
  );
}

interface ThumbnailSidebarProps {
  pdfDoc: PDFDocumentProxy;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function ThumbnailSidebar({ pdfDoc, totalPages, currentPage, onPageChange }: ThumbnailSidebarProps) {
  const activeRef = useRef<HTMLDivElement>(null);

  // Scroll active thumbnail into view
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentPage]);

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="w-[148px] min-w-[148px] overflow-y-auto bg-neutral-850 border-r border-border p-2 flex flex-col gap-1"
         style={{ backgroundColor: 'rgb(28, 28, 28)' }}>
      {pages.map((pageNum) => (
        <div key={pageNum} ref={pageNum === currentPage ? activeRef : undefined}>
          <Thumbnail
            pdfDoc={pdfDoc}
            pageNum={pageNum}
            isActive={pageNum === currentPage}
            onClick={() => onPageChange(pageNum)}
          />
        </div>
      ))}
    </div>
  );
}
