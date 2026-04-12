interface EmptyStateProps {
  onOpenFile: () => void;
}

export function EmptyState({ onOpenFile }: EmptyStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-neutral-900 text-text-secondary">
      <img
        src="./app-icon.png"
        alt="PDFoff Viewer"
        className="mb-4 h-24 w-24 opacity-[0.85]"
      />
      <div className="flex flex-col items-center">
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
