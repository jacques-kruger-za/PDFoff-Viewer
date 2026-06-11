import type { SignatureEntry } from '../types/annotations';

/**
 * Signature persistence. In Electron, signatures live as PNGs + index.json in the
 * user-data folder (via IPC). In a plain browser (dev at localhost:5173), they fall
 * back to localStorage so the feature is still testable.
 */

const LS_KEY = 'pdfoff.signatures';

function genId(): string {
  return `sig-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function readLocal(): SignatureEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(entries: SignatureEntry[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

export async function getSignatures(): Promise<SignatureEntry[]> {
  if (window.electronAPI?.getSignatures) {
    return window.electronAPI.getSignatures();
  }
  return readLocal();
}

export async function saveSignature(input: {
  label: string;
  kind: 'signature' | 'initial';
  dataUrl: string;
  makeDefault?: boolean;
}): Promise<SignatureEntry> {
  const id = genId();
  if (window.electronAPI?.saveSignature) {
    return window.electronAPI.saveSignature({ id, ...input });
  }
  // localStorage fallback
  let entries = readLocal();
  const isFirst = entries.length === 0;
  const isDefault = Boolean(input.makeDefault) || isFirst;
  if (isDefault) entries = entries.map((e) => ({ ...e, isDefault: false }));
  const entry: SignatureEntry = {
    id,
    label: input.label || 'Signature',
    kind: input.kind,
    isDefault,
    dataUrl: input.dataUrl,
  };
  entries.push(entry);
  writeLocal(entries);
  return entry;
}

export async function deleteSignature(id: string): Promise<void> {
  if (window.electronAPI?.deleteSignature) {
    await window.electronAPI.deleteSignature(id);
    return;
  }
  let entries = readLocal();
  const wasDefault = entries.find((e) => e.id === id)?.isDefault;
  entries = entries.filter((e) => e.id !== id);
  if (wasDefault && entries.length > 0) entries[0].isDefault = true;
  writeLocal(entries);
}
