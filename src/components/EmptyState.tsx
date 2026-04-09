import { useEffect, useState } from 'react';

interface EmptyStateProps {
  onOpenFile: () => void;
}

export function EmptyState({ onOpenFile }: EmptyStateProps) {
  const [phase, setPhase] = useState<'big' | 'shrink'>('big');

  useEffect(() => {
    // Start the shrink after a short pause so the big logo is visible
    const timer = setTimeout(() => setPhase('shrink'), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-neutral-900 text-text-secondary">
      <img
        src="./app-icon.png"
        alt="PDFoff Viewer"
        className="transition-all duration-700 ease-in-out"
        style={{
          width: phase === 'big' ? 256 : 96,
          height: phase === 'big' ? 256 : 96,
          opacity: phase === 'big' ? 1 : 0.85,
          marginBottom: phase === 'big' ? 0 : 16,
        }}
      />
      <div
        className="flex flex-col items-center transition-all duration-700 ease-in-out"
        style={{
          opacity: phase === 'big' ? 0 : 1,
          transform: phase === 'big' ? 'translateY(20px)' : 'translateY(0)',
        }}
      >
        <h2 className="text-xl font-medium text-text-primary mb-2">PDFoff Viewer</h2>
        <p className="mb-6 text-text-muted">Open a PDF to get started</p>
        <button
          onClick={onOpenFile}
          className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
        >
          Open PDF
        </button>
        <p className="mt-4 text-xs text-text-muted">
          or drag &amp; drop a file anywhere
        </p>
      </div>
    </div>
  );
}
