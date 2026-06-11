import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { PdfFile } from '../types/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface CachedDoc {
  pdfDoc: PDFDocumentProxy | null;
  error: string | null;
}

export function usePdfDocument(file: PdfFile | null) {
  // Parsed documents cached by file id (in state, so reads happen during render
  // cleanly) — switching between already-open tabs is synchronous: no re-parse,
  // and no momentary totalPages:0 that would flicker the toolbar.
  const [cache, setCache] = useState<Map<string, CachedDoc>>(() => new Map());
  const id = file?.id ?? null;

  useEffect(() => {
    const f = file;
    if (!f || cache.has(f.id)) return;

    // `stale` is informational only; we never destroy a parsed doc here — it's
    // cached for reuse, and destroying the loading task also destroys its proxy.
    let stale = false;

    // Pass a copy: getDocument may transfer/detach the buffer to the worker.
    const loadingTask = pdfjsLib.getDocument({ data: f.data.slice(0) });

    loadingTask.promise.then(
      (doc) => {
        setCache((prev) => {
          if (prev.has(f.id)) {
            doc.destroy(); // a duplicate load won the race
            return prev;
          }
          const next = new Map(prev);
          next.set(f.id, { pdfDoc: doc, error: null });
          return next;
        });
      },
      (err: Error) => {
        setCache((prev) => {
          if (prev.has(f.id)) return prev;
          const next = new Map(prev);
          next.set(f.id, { pdfDoc: null, error: err.message });
          return next;
        });
      }
    );

    return () => {
      stale = true;
      void stale;
    };
  }, [file, cache]);

  // Destroy every cached document when the app unmounts.
  const cacheRef = useRef(cache);
  useEffect(() => {
    cacheRef.current = cache;
  }, [cache]);
  useEffect(() => {
    return () => {
      cacheRef.current.forEach((entry) => entry.pdfDoc?.destroy());
    };
  }, []);

  const cached = id ? cache.get(id) : undefined;
  return {
    pdfDoc: cached?.pdfDoc ?? null,
    totalPages: cached?.pdfDoc?.numPages ?? 0,
    error: cached?.error ?? null,
  };
}
