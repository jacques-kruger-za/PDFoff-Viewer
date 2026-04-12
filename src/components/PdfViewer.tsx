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
const WHEEL_RENDER_SETTLE_MS = 250;
const WHEEL_ZOOM_STREAK_WINDOW_MS = 140;
const WHEEL_ZOOM_BASE_STEP = 1.06;
const WHEEL_ZOOM_ACCELERATION = 0.02;
const WHEEL_ZOOM_MAX_STREAK = 8;
const ZOOM_ANIMATION_EASING = 0.26;
const ZOOM_ANIMATION_STOP_EPSILON = 0.0015;

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
  const zoomAnimationFrameRef = useRef<number | null>(null);
  const isAutoScrollingRef = useRef(false);
  const zoomAnchorRef = useRef<{
    mouseX: number;
    mouseY: number;
    contentX: number;
    contentY: number;
    anchorZoom: number;
  } | null>(null);
  const lastWheelTimeRef = useRef(0);
  const wheelStreakRef = useRef(0);
  const targetZoomRef = useRef(zoom);
  const displayedZoomRef = useRef(zoom);
  const [displayedZoom, setDisplayedZoom] = useState(zoom);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useImperativeHandle(ref, () => containerRef.current!, []);

  const clearAutoScrollTimeout = useCallback(() => {
    if (autoScrollTimeoutRef.current !== null) {
      window.clearTimeout(autoScrollTimeoutRef.current);
      autoScrollTimeoutRef.current = null;
    }
  }, []);

  const cancelZoomAnimation = useCallback(() => {
    if (zoomAnimationFrameRef.current !== null) {
      window.cancelAnimationFrame(zoomAnimationFrameRef.current);
      zoomAnimationFrameRef.current = null;
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
  useEffect(() => cancelZoomAnimation, [cancelZoomAnimation]);

  const animateZoom = useCallback(() => {
    if (zoomAnimationFrameRef.current !== null) return;

    const tick = () => {
      const current = displayedZoomRef.current;
      const target = targetZoomRef.current;
      const delta = target - current;

      if (Math.abs(delta) <= ZOOM_ANIMATION_STOP_EPSILON) {
        displayedZoomRef.current = target;
        setDisplayedZoom(target);
        zoomAnimationFrameRef.current = null;

        if (performance.now() - lastWheelTimeRef.current >= WHEEL_RENDER_SETTLE_MS) {
          zoomAnchorRef.current = null;
        }
        return;
      }

      const nextZoom = current + delta * ZOOM_ANIMATION_EASING;
      displayedZoomRef.current = nextZoom;
      setDisplayedZoom(nextZoom);
      zoomAnimationFrameRef.current = window.requestAnimationFrame(tick);
    };

    zoomAnimationFrameRef.current = window.requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    targetZoomRef.current = zoom;
    animateZoom();
  }, [animateZoom, zoom]);

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
      const currentZoom = targetZoomRef.current;

      zoomAnchorRef.current = {
        mouseX,
        mouseY,
        contentX: container.scrollLeft + mouseX,
        contentY: container.scrollTop + mouseY,
        anchorZoom: displayedZoomRef.current,
      };

      const now = performance.now();
      if (now - lastWheelTimeRef.current < WHEEL_ZOOM_STREAK_WINDOW_MS) {
        wheelStreakRef.current = Math.min(wheelStreakRef.current + 1, WHEEL_ZOOM_MAX_STREAK);
      } else {
        wheelStreakRef.current = 0;
      }
      lastWheelTimeRef.current = now;

      const step = WHEEL_ZOOM_BASE_STEP + wheelStreakRef.current * WHEEL_ZOOM_ACCELERATION;
      const direction = e.deltaY < 0 ? 1 : -1;
      const factor = direction > 0 ? step : 1 / step;
      const nextZoom = Math.max(0.1, Math.min(10, currentZoom * factor));
      const roundedZoom = Math.round(nextZoom * 1000) / 1000;

      targetZoomRef.current = roundedZoom;
      onZoomChange(roundedZoom);
      animateZoom();
    },
    [animateZoom, onZoomChange]
  );

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const container = containerRef.current;
    if (!anchor || !container) return;

    const ratio = displayedZoom / anchor.anchorZoom;
    container.scrollLeft = anchor.contentX * ratio - anchor.mouseX;
    container.scrollTop = anchor.contentY * ratio - anchor.mouseY;
  }, [displayedZoom]);

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
            zoom={displayedZoom}
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
