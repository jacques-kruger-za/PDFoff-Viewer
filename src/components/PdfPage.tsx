import { useEffect, useRef, useState } from 'react';
import { TextLayer } from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

function addLineGutters(textDiv: HTMLDivElement, pageWidth: number) {
  const spans = textDiv.querySelectorAll<HTMLElement>(':scope > span');
  if (spans.length === 0) return;

  const lines = new Map<number, { maxRight: number; top: string; height: number }>();

  for (const span of spans) {
    const top = span.offsetTop;
    const right = span.offsetLeft + span.offsetWidth;
    const height = span.offsetHeight;

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

  for (const [, line] of lines) {
    const gap = pageWidth - line.maxRight;
    if (gap < 5) continue;

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

export const BASE_SCALE = (96 / 72) * 1.25;

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
  const renderCommitTimeoutRef = useRef<number | null>(null);
  const [renderZoom, setRenderZoom] = useState(zoom);
  const [renderedSize, setRenderedSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (Math.abs(zoom - renderZoom) < 0.001) return;

    if (renderCommitTimeoutRef.current !== null) {
      window.clearTimeout(renderCommitTimeoutRef.current);
    }

    renderCommitTimeoutRef.current = window.setTimeout(() => {
      setRenderZoom(zoom);
      renderCommitTimeoutRef.current = null;
    }, 250);

    return () => {
      if (renderCommitTimeoutRef.current !== null) {
        window.clearTimeout(renderCommitTimeoutRef.current);
        renderCommitTimeoutRef.current = null;
      }
    };
  }, [renderZoom, zoom]);

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

      const effectiveScale = renderZoom * BASE_SCALE;
      const viewport = page.getViewport({ scale: effectiveScale });
      const dpr = window.devicePixelRatio || 1;

      pageContainer.style.setProperty('--scale-factor', `${effectiveScale * dpr}`);
      pageContainer.style.setProperty('--user-unit', '1');
      pageContainer.style.setProperty('--total-scale-factor', `${effectiveScale * dpr}`);
      pageContainer.classList.add('page');

      pageContainer.style.width = `${viewport.width}px`;
      pageContainer.style.height = `${viewport.height}px`;
      setRenderedSize({ width: viewport.width, height: viewport.height });

      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      renderTask = page.render({ canvasContext: ctx, viewport, canvas });
      try {
        await renderTask.promise;
      } catch {
        return;
      }
      if (cancelled) return;

      const textContent = await page.getTextContent();
      if (cancelled) return;

      textDiv.replaceChildren();

      const textLayer = new TextLayer({
        container: textDiv,
        textContentSource: textContent,
        viewport,
      });

      await textLayer.render();

      if (!cancelled) {
        addLineGutters(textDiv, viewport.width);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNum, renderZoom]);

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

  useEffect(() => {
    return () => {
      if (renderCommitTimeoutRef.current !== null) {
        window.clearTimeout(renderCommitTimeoutRef.current);
      }
    };
  }, []);

  const visualScale = renderZoom === 0 ? 1 : zoom / renderZoom;
  const wrapperWidth = renderedSize.width * visualScale;
  const wrapperHeight = renderedSize.height * visualScale;

  return (
    <div
      ref={wrapperRef}
      className="mb-2 overflow-hidden shadow-lg"
      data-page={pageNum}
      style={{
        width: wrapperWidth > 0 ? `${wrapperWidth}px` : undefined,
        height: wrapperHeight > 0 ? `${wrapperHeight}px` : undefined,
      }}
    >
      <div
        ref={pageContainerRef}
        className="pdfViewer relative"
        style={{
          transform: `scale(${visualScale})`,
          transformOrigin: 'top left',
        }}
      >
        <canvas ref={canvasRef} className="absolute top-0 left-0" />
        <div ref={textLayerRef} className="textLayer" />
      </div>
    </div>
  );
}
