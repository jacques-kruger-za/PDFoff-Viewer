import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { PdfFile } from '../types/pdf';

interface TabBarProps {
  files: PdfFile[];
  activeFileId: string | null;
  onSelectFile: (id: string) => void;
  onCloseFile: (id: string) => void;
}

export function TabBar({ files, activeFileId, onSelectFile, onCloseFile }: TabBarProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; fileId: string } | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const showTooltip = useCallback((e: React.MouseEvent, text: string) => {
    if (hoverTimeoutRef.current !== null) window.clearTimeout(hoverTimeoutRef.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    hoverTimeoutRef.current = window.setTimeout(() => {
      setTooltip({ x: rect.left, y: rect.bottom + 4, text });
    }, 400);
  }, []);

  const hideTooltip = useCallback(() => {
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setTooltip(null);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current !== null) window.clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, fileId: string) => {
    e.preventDefault();
    hideTooltip();
    setContextMenu({ x: e.clientX, y: e.clientY, fileId });
  }, [hideTooltip]);

  const handleGoToFolder = useCallback(() => {
    if (!contextMenu) return;
    const file = files.find((f) => f.id === contextMenu.fileId);
    if (file?.path && window.electronAPI) {
      window.electronAPI.showInFolder(file.path);
    }
    setContextMenu(null);
  }, [contextMenu, files]);

  const handleCloseFromMenu = useCallback(() => {
    if (!contextMenu) return;
    onCloseFile(contextMenu.fileId);
    setContextMenu(null);
  }, [contextMenu, onCloseFile]);

  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = () => setContextMenu(null);
    window.addEventListener('click', dismiss);
    return () => window.removeEventListener('click', dismiss);
  }, [contextMenu]);

  if (files.length === 0) return null;

  const contextFile = contextMenu ? files.find((f) => f.id === contextMenu.fileId) : null;

  return (
    <>
      <div className="flex items-center bg-surface border-b border-border overflow-x-auto">
        {files.map((file) => {
          const isActive = file.id === activeFileId;
          const displayPath = file.path || file.name;
          return (
            <div
              key={file.id}
              className={`group flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer border-r border-border min-w-0 max-w-[200px] transition-colors ${
                isActive
                  ? 'bg-neutral-800 text-text-primary border-b-2 border-b-accent'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
              onClick={() => onSelectFile(file.id)}
              onContextMenu={(e) => handleContextMenu(e, file.id)}
              onMouseEnter={(e) => showTooltip(e, displayPath)}
              onMouseLeave={hideTooltip}
            >
              <span className="truncate">{file.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseFile(file.id);
                }}
                className="shrink-0 p-0.5 rounded hover:bg-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Close ${file.name}`}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-[9999] max-w-[500px] rounded border border-neutral-600 bg-neutral-800 px-2.5 py-1.5 text-xs text-text-muted shadow-xl"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed z-[9999] min-w-[160px] rounded border border-neutral-600 bg-neutral-800 py-1 shadow-xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextFile?.path && (
            <button
              className="flex w-full items-center px-4 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
              onClick={handleGoToFolder}
            >
              Go to Folder
            </button>
          )}
          <button
            className="flex w-full items-center px-4 py-1.5 text-left text-sm text-neutral-200 hover:bg-neutral-700"
            onClick={handleCloseFromMenu}
          >
            Close Tab
          </button>
        </div>
      )}
    </>
  );
}
