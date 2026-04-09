import { useRef, useEffect } from 'react';
import { TextLayer } from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

/**
 * After TextLayer renders, group spans by visual line (same `top` value)
 * and add an invisible gutter span from the rightmost span to the page edge.
 * This gives the browser a selectable target at end-of-line, preventing
 * selection from jumping to a different line when dragging past text.
 */
function addLineGutters(textDiv: HTMLDivElement, pageWidth: number) {
  const spans = textDiv.querySelectorAll<HTMLElement>(':scope > span');
  if (spans.length === 0) return;

  // Group spans by approximate top position (within 2px = same line)
  const lines = new Map<number, { maxRight: number; top: string; height: number }>();

  for (const span of spans) {
    const top = span.offsetTop;
    const right = span.offsetLeft + span.offsetWidth;
    const height = span.offsetHeight;

    // Find existing line within 2px tolerance
    let lineKey = -1;
    for (const [key] of lines) {
      if (Math.abs(key - top) < 2) {
        lineKey = key;
        break;
      }
    }

    if (lineKey === -1) {
      lines.set(top, { maxRight: right, top: span.style.top, height });
    } else {
      const line = lines.get(lineKey)!;
      if (right > line.maxRight) {
        line.maxRight = right;
      }
      if (height > line.height) {
        line.height = height;
      }
    }
  }

  // Add a gutter span for each line that doesn't reach the page edge
  for (const [, line] of lines) {
    const gap = pageWidth - line.maxRight;
    if (gap < 5) continue; // already near the edge

    const gutter = document.createElement('span');
    gutter.style.position = 'absolute';
    gutter.style.left = `${line.maxRight}px`;
    gutter.style.top = line.top;
    gutter.style.width = `${gap}px`;
    gutter.style.height = `${line.height}px`;
    gutter.style.cursor = 'text';
    gutter.style.color = 'transparent';
    gutter.style.userSelect = 'text';
    gutter.textContent = ' ';
    textDiv.appendChild(gutter);
  }
}

interface PdfPageProps {
  pdfDoc: PDFDocumentProxy;
  pageNum: number;
  zoom: number;
  onVisible?: (pageNum: number) => void;
}

export function PdfPage({ pdfDoc, pageNum, zoom, onVisible }: PdfPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);

  // Single unified effect: render canvas + text layer with shared viewport
  useEffect(() => {
    const canvas = canvasRef.current;
    const textDiv = textLayerRef.current;
    const pageContainer = pageContainerRef.current;
    if (!canvas || !textDiv || !pageContainer) return;

    let cancelled = false;
    let renderTask: RenderTask | null = null;

    (async () => {
      const page = await pdfDoc.getPage(pageNum);
      if (cancelled) return;

      // Single viewport for both canvas and text layer
      const viewport = page.getViewport({ scale: zoom });
      const dpr = window.devicePixelRatio || 1;

      // Set the CSS variables that pdf.js v5 TextLayer needs.
      // pdf_viewer.css computes --total-scale-factor from --scale-factor * --user-unit,
      // and TextLayer uses --total-scale-factor for all font-size and dimension calcs.
      // Normally these are set by the full pdf.js viewer — we must set them ourselves.
      pageContainer.style.setProperty('--scale-factor', `${zoom * dpr}`);
      pageContainer.style.setProperty('--user-unit', '1');
      pageContainer.style.setProperty('--total-scale-factor', `${zoom * dpr}`);
      pageContainer.classList.add('page');

      // Size the container to match the viewport
      pageContainer.style.width = `${viewport.width}px`;
      pageContainer.style.height = `${viewport.height}px`;

      // --- Canvas rendering ---
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      renderTask = page.render({ canvasContext: ctx, viewport });
      try {
        await renderTask.promise;
      } catch {
        // Render cancelled — no action needed
        return;
      }
      if (cancelled) return;

      // --- Text layer rendering ---
      const textContent = await page.getTextContent();
      if (cancelled) return;

      // Clear previous text layer content
      textDiv.replaceChildren();

      const textLayer = new TextLayer({
        container: textDiv,
        textContentSource: textContent,
        viewport,
      });

      await textLayer.render();

      // Post-process: add invisible gutter spans at the end of each visual line.
      // Without these, dragging past the last text on a line causes the browser
      // to jump selection to a different line (since absolutely-positioned spans
      // don't give the browser a concept of "visual lines").
      if (!cancelled) {
        addLineGutters(textDiv, viewport.width);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNum, zoom]);

  // Intersection observer for page tracking
  useEffect(() => {
    if (!onVisible || !wrapperRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onVisible(pageNum);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [pageNum, onVisible]);

  return (
    <div ref={wrapperRef} className="mb-2 shadow-lg" data-page={pageNum}>
      <div ref={pageContainerRef} className="pdfViewer relative">
        <canvas ref={canvasRef} className="absolute top-0 left-0" />
        <div ref={textLayerRef} className="textLayer" />
      </div>
    </div>
  );
}
