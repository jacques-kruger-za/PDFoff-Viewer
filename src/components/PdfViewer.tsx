import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
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

const AUTO_SCROLL_RESET_MS = 500;

export const PdfViewer = forwardRef<HTMLDivElement, PdfViewerProps>(function PdfViewer({
  pdfDoc,
  totalPages,
  zoom,
  currentPage,
  onCurrentPageChange,
  onZoomChange,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const autoScrollTimeoutRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);
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

  useImperativeHandle(ref, () => containerRef.current!, []);

  const clearAutoScrollTimeout = useCallback(() => {
    if (autoScrollTimeoutRef.current !== null) {
      window.clearTimeout(autoScrollTimeoutRef.current);
      autoScrollTimeoutRef.current = null;
    }
  }, []);

  const scheduleAutoScrollReset = useCallback(() => {
    clearAutoScrollTimeout();
    autoScrollTimeoutRef.current = window.setTimeout(() => {
      isAutoScrollingRef.current = false;
      autoScrollTimeoutRef.current = null;
    }, AUTO_SCROLL_RESET_MS);
  }, [clearAutoScrollTimeout]);

  useEffect(() => clearAutoScrollTimeout, [clearAutoScrollTimeout]);

  const handlePageVisible = useCallback(
    (pageNum: number) => {
      if (!isAutoScrollingRef.current) {
        onCurrentPageChange(pageNum);
      }
    },
    [onCurrentPageChange]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pageEl = container.querySelector<HTMLElement>(`[data-page="${currentPage}"]`);
    if (!pageEl) return;

    const pageRect = pageEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const isFullyVisible =
      pageRect.top >= containerRect.top && pageRect.bottom <= containerRect.bottom;

    if (!isFullyVisible) {
      isAutoScrollingRef.current = true;
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      scheduleAutoScrollReset();
    }
  }, [currentPage, scheduleAutoScrollReset]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (!e.ctrlKey && !e.metaKey) return;

      const container = containerRef.current;
      if (!container) return;

      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      zoomAnchorRef.current = {
        mouseX,
        mouseY,
        scrollX: container.scrollLeft + mouseX,
        scrollY: container.scrollTop + mouseY,
        oldZoom: zoom,
      };

      const now = performance.now();
      if (now - lastWheelTimeRef.current < 120) {
        wheelStreakRef.current = Math.min(wheelStreakRef.current + 1, 8);
      } else {
        wheelStreakRef.current = 0;
      }
      lastWheelTimeRef.current = now;

      const step = 1.03 + wheelStreakRef.current * 0.015;
      const direction = e.deltaY < 0 ? 1 : -1;
      const factor = direction > 0 ? step : 1 / step;
      const nextZoom = Math.max(0.1, Math.min(10, zoom * factor));
      onZoomChange(Math.round(nextZoom * 1000) / 1000);
    },
    [onZoomChange, zoom]
  );

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const container = containerRef.current;
    if (!anchor || !container) return;

    const ratio = zoom / anchor.oldZoom;
    container.scrollLeft = anchor.scrollX * ratio - anchor.mouseX;
    container.scrollTop = anchor.scrollY * ratio - anchor.mouseY;
    zoomAnchorRef.current = null;
  }, [zoom]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  }, []);

  const handleCopy = useCallback(() => {
    const selection = window.getSelection();
    if (selection) {
      navigator.clipboard.writeText(selection.toString());
    }
    setContextMenu(null);
  }, []);

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

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

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
          className="fixed z-50 min-w-[140px] rounded border border-neutral-600 bg-neutral-800 py-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
            onClick={handleCopy}
          >
            Copy
            <span className="ml-auto text-xs text-neutral-500">Ctrl+C</span>
          </button>
        </div>
      )}
    </div>
  );
});
