import { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export function usePdfDocument(data: ArrayBuffer | null) {
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const prevDataRef = useRef<ArrayBuffer | null>(null);

  useEffect(() => {
    if (!data || data === prevDataRef.current) return;
    prevDataRef.current = data;

    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });

    loadingTask.promise
      .then((doc) => {
        if (!cancelled) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setPdfDoc(null);
          setTotalPages(0);
        }
      });

    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [data]);

  return { pdfDoc, totalPages, error };
}
