import { useEffect, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

interface PdfDocumentState {
  source: ArrayBuffer | null;
  pdfDoc: PDFDocumentProxy | null;
  totalPages: number;
  error: string | null;
}

const emptyState: PdfDocumentState = {
  source: null,
  pdfDoc: null,
  totalPages: 0,
  error: null,
};

export function usePdfDocument(data: ArrayBuffer | null) {
  const [state, setState] = useState<PdfDocumentState>(emptyState);

  useEffect(() => {
    if (!data) return;

    let cancelled = false;
    const loadingTask = pdfjsLib.getDocument({ data: data.slice(0) });

    loadingTask.promise
      .then((doc) => {
        if (!cancelled) {
          setState({
            source: data,
            pdfDoc: doc,
            totalPages: doc.numPages,
            error: null,
          });
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setState({
            source: data,
            pdfDoc: null,
            totalPages: 0,
            error: err.message,
          });
        }
      });

    return () => {
      cancelled = true;
      loadingTask.destroy();
    };
  }, [data]);

  if (!data) {
    return { pdfDoc: null, totalPages: 0, error: null };
  }

  if (state.source !== data) {
    return { pdfDoc: null, totalPages: 0, error: null };
  }

  return {
    pdfDoc: state.pdfDoc,
    totalPages: state.totalPages,
    error: state.error,
  };
}
