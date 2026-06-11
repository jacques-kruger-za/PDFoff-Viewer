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
  // Parsed documents cached by file id so switching between already-open tabs
  // is synchronous — no re-parse, and no momentary totalPages:0 that would
  // flicker the toolbar's disabled state. Persists for the app session.
  const cacheRef = useRef<Map<string, CachedDoc>>(new Map());
  const [, bumpVersion] = useState(0);
  const id = file?.id ?? null;

  useEffect(() => {
    const f = file;
    if (!f || cacheRef.current.has(f.id)) return;

    // `stale` only suppresses the re-render bump after we've switched away;
    // it must NOT destroy the parsed document — that doc is cached for reuse,
    // and destroying the loading task also destroys its PDFDocumentProxy.
    let stale = false;

    // Pass a copy: getDocument may transfer/detach the buffer to the worker,
    // and we need file.data intact for any later reload.
    const loadingTask = pdfjsLib.getDocument({ data: f.data.slice(0) });

    loadingTask.promise.then(
      (doc) => {
        if (cacheRef.current.has(f.id)) {
          // A duplicate load (StrictMode / race) already won — drop this one.
          doc.destroy();
        } else {
          cacheRef.current.set(f.id, { pdfDoc: doc, error: null });
        }
        if (!stale) bumpVersion((v) => v + 1);
      },
      (err: Error) => {
        if (!cacheRef.current.has(f.id)) {
          cacheRef.current.set(f.id, { pdfDoc: null, error: err.message });
        }
        if (!stale) bumpVersion((v) => v + 1);
      }
    );

    return () => {
      stale = true;
    };
  }, [file?.id]);

  // Destroy every cached document when the app unmounts.
  useEffect(() => {
    const cache = cacheRef.current;
    return () => {
      cache.forEach((entry) => entry.pdfDoc?.destroy());
      cache.clear();
    };
  }, []);

  const cached = id ? cacheRef.current.get(id) : undefined;
  return {
    pdfDoc: cached?.pdfDoc ?? null,
    totalPages: cached?.pdfDoc?.numPages ?? 0,
    error: cached?.error ?? null,
  };
}
