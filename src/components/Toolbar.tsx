import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  FolderOpen,
  Maximize,
  MoveHorizontal,
  RotateCcw,
  MousePointer2,
  Type,
  Pen,
  Highlighter,
  Image as ImageIcon,
  Signature,
  Save,
} from 'lucide-react';
import { ZOOM } from '../constants/layout';
import type { ToolType } from '../types/annotations';

const ZOOM_STEPS_REVERSED = [...ZOOM.STEPS].reverse();

interface ToolbarProps {
  currentPage: number;
  totalPages: number;
  zoom: number;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onOpenFile: () => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  // Annotation tools
  tool: ToolType;
  onToolChange: (tool: ToolType) => void;
  onPickImage: () => void;
  onOpenSignature: () => void;
  onSave: () => void;
  isDirty: boolean;
}

function findNextZoom(current: number, direction: 'in' | 'out'): number {
  if (direction === 'in') {
    const next = ZOOM.STEPS.find((z) => z > current + 0.01);
    return next ?? ZOOM.STEPS[ZOOM.STEPS.length - 1];
  }
  const next = ZOOM_STEPS_REVERSED.find((z) => z < current - 0.01);
  return next ?? ZOOM.STEPS[0];
}

export function Toolbar({
  currentPage,
  totalPages,
  zoom,
  onPageChange,
  onZoomChange,
  onOpenFile,
  onFitPage,
  onFitWidth,
  tool,
  onToolChange,
  onPickImage,
  onOpenSignature,
  onSave,
  isDirty,
}: ToolbarProps) {
  const disabled = totalPages === 0;
  const toolBtn = (active: boolean) =>
    `btn-toolbar ${active ? 'bg-accent/40 text-text-primary' : ''}`;

  return (
    <div className="flex items-center gap-1 px-3 py-1.5 bg-surface border-b border-border select-none">
      <button
        onClick={onOpenFile}
        className="btn-toolbar-lg"
        title="Open PDF"
      >
        <FolderOpen size={18} />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <button
        onClick={() => onPageChange(1)}
        disabled={disabled || currentPage <= 1}
        className="btn-toolbar"
        title="First page"
      >
        <ChevronFirst size={18} />
      </button>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={disabled || currentPage <= 1}
        className="btn-toolbar"
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
        <span className="w-14 text-left tabular-nums text-text-muted">/ {totalPages || '-'}</span>
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={disabled || currentPage >= totalPages}
        className="btn-toolbar"
        title="Next page"
      >
        <ChevronRight size={18} />
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={disabled || currentPage >= totalPages}
        className="btn-toolbar"
        title="Last page"
      >
        <ChevronLast size={18} />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <button
        onClick={() => onZoomChange(findNextZoom(zoom, 'out'))}
        disabled={disabled || zoom <= ZOOM.STEPS[0]}
        className="btn-toolbar"
        title="Zoom out"
      >
        <Minus size={18} />
      </button>
      <span className="text-sm text-text-secondary w-14 text-center tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <button
        onClick={() => onZoomChange(findNextZoom(zoom, 'in'))}
        disabled={disabled || zoom >= ZOOM.STEPS[ZOOM.STEPS.length - 1]}
        className="btn-toolbar"
        title="Zoom in"
      >
        <Plus size={18} />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <button
        onClick={onFitPage}
        disabled={disabled}
        className="btn-toolbar"
        title="Fit full page"
      >
        <Maximize size={18} />
      </button>
      <button
        onClick={onFitWidth}
        disabled={disabled}
        className="btn-toolbar"
        title="Fit width"
      >
        <MoveHorizontal size={18} />
      </button>
      <button
        onClick={() => onZoomChange(1)}
        disabled={disabled}
        className="btn-toolbar"
        title="Reset zoom (100%)"
      >
        <RotateCcw size={18} />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      {/* Annotation tools */}
      <button onClick={() => onToolChange('select')} disabled={disabled} className={toolBtn(tool === 'select')} title="Select / move">
        <MousePointer2 size={18} />
      </button>
      <button onClick={() => onToolChange('text')} disabled={disabled} className={toolBtn(tool === 'text')} title="Add text">
        <Type size={18} />
      </button>
      <button onClick={() => onToolChange('pen')} disabled={disabled} className={toolBtn(tool === 'pen')} title="Draw (pen)">
        <Pen size={18} />
      </button>
      <button onClick={() => onToolChange('highlight')} disabled={disabled} className={toolBtn(tool === 'highlight')} title="Highlight">
        <Highlighter size={18} />
      </button>
      <button onClick={onPickImage} disabled={disabled} className={toolBtn(tool === 'image')} title="Insert image">
        <ImageIcon size={18} />
      </button>
      <button onClick={onOpenSignature} disabled={disabled} className={toolBtn(tool === 'signature')} title="Signature">
        <Signature size={18} />
      </button>

      <div className="w-px h-5 bg-border mx-1" />

      <button onClick={onSave} disabled={disabled} className={`btn-toolbar ${isDirty ? 'text-accent' : ''}`} title="Save (Ctrl+S)">
        <Save size={18} />
        {isDirty && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-accent" />}
      </button>
    </div>
  );
}
