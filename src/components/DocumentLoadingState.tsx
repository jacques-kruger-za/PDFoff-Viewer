interface DocumentLoadingStateProps {
  fileName: string;
}

export function DocumentLoadingState({ fileName }: DocumentLoadingStateProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-neutral-900 text-text-secondary">
      <img
        src="./app-icon.png"
        alt="PDFoff Viewer"
        className="mb-5 h-24 w-24 opacity-[0.85]"
      />
      <h2 className="mb-2 text-xl font-medium text-text-primary">Opening PDF</h2>
      <p className="max-w-md px-6 text-center text-sm text-text-muted">
        Preparing <span className="text-text-secondary">{fileName}</span>
      </p>
    </div>
  );
}
