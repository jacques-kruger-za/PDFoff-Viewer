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
import { AnnotationLayer } from './AnnotationLayer';
import { ZOOM } from '../constants/layout';
import { TIMING } from '../constants/timing';
import type { Annotation, ToolType } from '../types/annotations';

interface PendingImage {
  dataUrl: string;
  kind: 'image' | 'signature';
  aspect: number;
}

interface PdfViewerProps {
  pdfDoc: PDFDocumentProxy;
  totalPages: number;
  zoom: number;
  currentPage: number;
  onCurrentPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  // Annotation surface
  annotations: Annotation[];
  tool: ToolType;
  penColor: string;
  penWidth: number;
  highlightColor: string;
  signatureHeight: number;
  selectedId: string | null;
  pendingImage: PendingImage | null;
  onSelectAnnotation: (id: string | null) => void;
  onAddAnnotation: (a: Annotation) => void;
  onUpdateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  onDeleteAnnotation: (id: string) => void;
  onConsumePendingImage: () => void;
}

export const PdfViewer = forwardRef<HTMLDivElement, PdfViewerProps>(function PdfViewer({
  pdfDoc,
  totalPages,
  zoom,
  currentPage,
  onCurrentPageChange,
  onZoomChange,
  annotations,
  tool,
  penColor,
  penWidth,
  highlightColor,
  signatureHeight,
  selectedId,
  pendingImage,
  onSelectAnnotation,
  onAddAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onConsumePendingImage,
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
    }, TIMING.AUTO_SCROLL_RESET);
  }, [clearAutoScrollTimeout]);

  useEffect(() => clearAutoScrollTimeout, [clearAutoScrollTimeout]);
  useEffect(() => cancelZoomAnimation, [cancelZoomAnimation]);

  const animateZoom = useCallback(() => {
    if (zoomAnimationFrameRef.current !== null) return;

    const tick = () => {
      const current = displayedZoomRef.current;
      const target = targetZoomRef.current;
      const delta = target - current;

      if (Math.abs(delta) <= ZOOM.ANIMATION_STOP_EPSILON) {
        displayedZoomRef.current = target;
        setDisplayedZoom(target);
        zoomAnimationFrameRef.current = null;

        if (performance.now() - lastWheelTimeRef.current >= TIMING.WHEEL_RENDER_SETTLE) {
          zoomAnchorRef.current = null;
        }
        return;
      }

      const nextZoom = current + delta * ZOOM.ANIMATION_EASING;
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

  // Reset scroll to top when switching documents and suppress intersection
  // callbacks while pages are mounting (they'd overwrite currentPage with
  // whatever random page intersects the viewport during layout).
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTop = 0;
    }
    isAutoScrollingRef.current = true;
    scheduleAutoScrollReset();
  }, [pdfDoc, scheduleAutoScrollReset]);

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
      if (now - lastWheelTimeRef.current < TIMING.WHEEL_ZOOM_STREAK_WINDOW) {
        wheelStreakRef.current = Math.min(wheelStreakRef.current + 1, ZOOM.WHEEL_MAX_STREAK);
      } else {
        wheelStreakRef.current = 0;
      }
      lastWheelTimeRef.current = now;

      const step = ZOOM.WHEEL_BASE_STEP + wheelStreakRef.current * ZOOM.WHEEL_ACCELERATION;
      const direction = e.deltaY < 0 ? 1 : -1;
      const factor = direction > 0 ? step : 1 / step;
      const nextZoom = Math.max(ZOOM.MIN, Math.min(ZOOM.MAX, currentZoom * factor));
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
            overlay={
              <AnnotationLayer
                page={pageNum}
                annotations={annotations.filter((a) => a.page === pageNum)}
                tool={tool}
                penColor={penColor}
                penWidth={penWidth}
                highlightColor={highlightColor}
                signatureHeight={signatureHeight}
                selectedId={selectedId}
                pendingImage={pendingImage}
                onSelect={onSelectAnnotation}
                onAdd={onAddAnnotation}
                onUpdate={onUpdateAnnotation}
                onDelete={onDeleteAnnotation}
                onConsumePendingImage={onConsumePendingImage}
              />
            }
          />
        ))}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="context-menu-item gap-2"
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
