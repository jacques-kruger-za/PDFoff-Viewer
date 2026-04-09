import { X } from 'lucide-react';
import type { PdfFile } from '../types/pdf';

interface TabBarProps {
  files: PdfFile[];
  activeFileId: string | null;
  onSelectFile: (id: string) => void;
  onCloseFile: (id: string) => void;
}

export function TabBar({ files, activeFileId, onSelectFile, onCloseFile }: TabBarProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex items-center bg-surface border-b border-border overflow-x-auto">
      {files.map((file) => {
        const isActive = file.id === activeFileId;
        return (
          <div
            key={file.id}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer border-r border-border min-w-0 max-w-[200px] transition-colors ${
              isActive
                ? 'bg-neutral-800 text-text-primary border-b-2 border-b-accent'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
            }`}
            onClick={() => onSelectFile(file.id)}
          >
            <span className="truncate">{file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseFile(file.id);
              }}
              className="shrink-0 p-0.5 rounded hover:bg-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity"
              title={`Close ${file.name}`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
