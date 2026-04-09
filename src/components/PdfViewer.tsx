import { useRef, useCallback, useEffect, useLayoutEffect, useState, forwardRef } from 'react';
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

export const PdfViewer = forwardRef<HTMLDivElement, PdfViewerProps>(function PdfViewer({
  pdfDoc,
  totalPages,
  zoom,
  currentPage,
  onCurrentPageChange,
  onZoomChange,
}, ref) {
  const internalRef = useRef<HTMLDivElement>(null);
  const containerRef = (ref as React.RefObject<HTMLDivElement | null>) ?? internalRef;
  const [scrollingToPage, setScrollingToPage] = useState(false);
  const scrollTimeoutRef = useRef<number>(0);
  const zoomAnchorRef = useRef<{
    mouseX: number;
    mouseY: number;
    scrollX: number;
    scrollY: number;
    oldZoom: number;
  } | null>(null);
  const lastWheelTimeRef = useRef(0);
  const wheelStreakRef = useRef(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

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
        const container = containerRef.current!;
        const rect = container.getBoundingClientRect();

        // Mouse position relative to the scroll container viewport
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Remember the content-space point under the cursor so we can
        // re-anchor after React re-renders at the new zoom level.
        zoomAnchorRef.current = {
          mouseX,
          mouseY,
          scrollX: container.scrollLeft + mouseX,
          scrollY: container.scrollTop + mouseY,
          oldZoom: zoom,
        };

        // Accelerating zoom: rapid successive scrolls increase the step.
        // Base is ~3%, ramping up to ~15% during fast scrolling.
        const now = performance.now();
        if (now - lastWheelTimeRef.current < 120) {
          wheelStreakRef.current = Math.min(wheelStreakRef.current + 1, 8);
        } else {
          wheelStreakRef.current = 0;
        }
        lastWheelTimeRef.current = now;

        // Step grows with streak: 1.03 → 1.06 → 1.09 → ... → 1.15
        const STEP = 1.03 + wheelStreakRef.current * 0.015;
        const direction = e.deltaY < 0 ? 1 : -1; // scroll-up = zoom in
        const factor = direction > 0 ? STEP : 1 / STEP;
        const newZoom = Math.max(0.1, Math.min(10, zoom * factor));
        onZoomChange(Math.round(newZoom * 1000) / 1000);
      }
    },
    [zoom, onZoomChange]
  );

  // After React re-renders with the new zoom, adjust scroll so the point
  // that was under the cursor stays under the cursor.
  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    if (!anchor || !containerRef.current) return;

    const container = containerRef.current;
    const ratio = zoom / anchor.oldZoom;

    container.scrollLeft = anchor.scrollX * ratio - anchor.mouseX;
    container.scrollTop = anchor.scrollY * ratio - anchor.mouseY;

    zoomAnchorRef.current = null;
  }, [zoom]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
    // No active selection → let the default context menu through
  }, []);

  const handleCopy = useCallback(() => {
    const selection = window.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection.toString());
    }
    setContextMenu(null);
  }, []);

  // Dismiss context menu on any click or scroll
  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = () => setContextMenu(null);
    window.addEventListener('click', dismiss);
    window.addEventListener('scroll', dismiss, true);
    return () => {
      window.removeEventListener('click', dismiss);
      window.removeEventListener('scroll', dismiss, true);
    };
  }, [contextMenu]);

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-neutral-900 p-4"
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
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

      {contextMenu && (
        <div
          className="fixed z-50 bg-neutral-800 border border-neutral-600 rounded shadow-xl py-1 min-w-[140px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="w-full text-left px-4 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700 flex items-center gap-2"
            onClick={handleCopy}
          >
            Copy
            <span className="ml-auto text-neutral-500 text-xs">Ctrl+C</span>
          </button>
        </div>
      )}
    </div>
  );
});
