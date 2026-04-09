import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  FolderOpen,
} from 'lucide-react';

interface ToolbarProps {
  currentPage: number;
  totalPages: number;
  zoom: number;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onOpenFile: () => void;
}

const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 5];

function findNextZoom(current: number, direction: 'in' | 'out'): number {
  if (direction === 'in') {
    const next = ZOOM_STEPS.find((z) => z > current + 0.01);
    return next ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  }
  const reversed = [...ZOOM_STEPS].reverse();
  const next = reversed.find((z) => z < current - 0.01);
  return next ?? ZOOM_STEPS[0];
}

export function Toolbar({
  currentPage,
  totalPages,
  zoom,
  onPageChange,
  onZoomChange,
  onOpenFile,
}: ToolbarProps) {
  const disabled = totalPages === 0;

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-surface border-b border-border select-none">
      <button
        onClick={onOpenFile}
        className="p-1.5 rounded hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors"
        title="Open PDF"
      >
        <FolderOpen size={18} />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <button
        onClick={() => onPageChange(1)}
        disabled={disabled || currentPage <= 1}
        className="p-1 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-default text-text-secondary hover:text-text-primary transition-colors"
        title="First page"
      >
        <ChevronFirst size={18} />
      </button>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={disabled || currentPage <= 1}
        className="p-1 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-default text-text-secondary hover:text-text-primary transition-colors"
        title="Previous page"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="flex items-center gap-1 mx-1 text-sm">
        <input
          type="number"
          min={1}
          max={totalPages}
          value={disabled ? '' : currentPage}
          disabled={disabled}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            if (val >= 1 && val <= totalPages) onPageChange(val);
          }}
          className="w-12 text-center bg-neutral-800 border border-border rounded px-1 py-0.5 text-text-primary text-sm focus:outline-none focus:border-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-text-muted">/ {totalPages || '–'}</span>
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={disabled || currentPage >= totalPages}
        className="p-1 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-default text-text-secondary hover:text-text-primary transition-colors"
        title="Next page"
      >
        <ChevronRight size={18} />
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={disabled || currentPage >= totalPages}
        className="p-1 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-default text-text-secondary hover:text-text-primary transition-colors"
        title="Last page"
      >
        <ChevronLast size={18} />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <button
        onClick={() => onZoomChange(findNextZoom(zoom, 'out'))}
        disabled={disabled || zoom <= ZOOM_STEPS[0]}
        className="p-1 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-default text-text-secondary hover:text-text-primary transition-colors"
        title="Zoom out"
      >
        <Minus size={18} />
      </button>
      <span className="text-sm text-text-secondary w-14 text-center tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => onZoomChange(findNextZoom(zoom, 'in'))}
        disabled={disabled || zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
        className="p-1 rounded hover:bg-surface-hover disabled:opacity-30 disabled:cursor-default text-text-secondary hover:text-text-primary transition-colors"
        title="Zoom in"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
