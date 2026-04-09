import { useRef, useCallback, useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { PdfPage } from './PdfPage';

interface PdfViewerProps {
  pdfDoc: PDFDocumentProxy;
  totalPages: number;
  zoom: number;
  currentPage: number;
  onCurrentPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
}

export function PdfViewer({
  pdfDoc,
  totalPages,
  zoom,
  currentPage,
  onCurrentPageChange,
  onZoomChange,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollingToPage, setScrollingToPage] = useState(false);
  const scrollTimeoutRef = useRef<number>(0);

  const handlePageVisible = useCallback(
    (pageNum: number) => {
      if (!scrollingToPage) {
        onCurrentPageChange(pageNum);
      }
    },
    [onCurrentPageChange, scrollingToPage]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const pageEl = containerRef.current.querySelector(`[data-page="${currentPage}"]`);
    if (!pageEl) return;

    const container = containerRef.current;
    const pageRect = pageEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const isVisible =
      pageRect.top >= containerRect.top && pageRect.bottom <= containerRect.bottom;

    if (!isVisible) {
      setScrollingToPage(true);
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

      clearTimeout(scrollTimeoutRef.current);
      scrollTimeoutRef.current = window.setTimeout(() => {
        setScrollingToPage(false);
      }, 500);
    }
  }, [currentPage]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = 1 - e.deltaY * 0.002;
        const newZoom = Math.max(0.1, Math.min(10, zoom * factor));
        onZoomChange(Math.round(newZoom * 1000) / 1000);
      }
    },
    [zoom, onZoomChange]
  );

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-neutral-900 p-4"
      onWheel={handleWheel}
    >
      <div className="flex flex-col items-center gap-2">
        {pages.map((pageNum) => (
          <PdfPage
            key={`${pdfDoc.fingerprints[0]}-${pageNum}`}
            pdfDoc={pdfDoc}
            pageNum={pageNum}
            zoom={zoom}
            onVisible={handlePageVisible}
          />
        ))}
      </div>
    </div>
  );
}
