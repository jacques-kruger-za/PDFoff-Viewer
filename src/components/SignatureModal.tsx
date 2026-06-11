import { useEffect, useRef, useState } from 'react';
import { Trash2, Star, X, Pen, Upload } from 'lucide-react';
import type { SignatureEntry } from '../types/annotations';
import { getSignatures, saveSignature, deleteSignature } from '../services/signatureStore';

interface SignatureModalProps {
  onClose: () => void;
  onUse: (dataUrl: string) => void;
}

export function SignatureModal({ onClose, onUse }: SignatureModalProps) {
  const [entries, setEntries] = useState<SignatureEntry[]>([]);
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [label, setLabel] = useState('My signature');
  const [kind, setKind] = useState<'signature' | 'initial'>('signature');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  const refresh = () => getSignatures().then(setEntries);
  useEffect(() => {
    refresh();
  }, []);

  // ── Drawing canvas ──────────────────────────────────────────────────────────
  const ctx = () => canvasRef.current?.getContext('2d') ?? null;

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };

  const onDown = (e: React.PointerEvent) => {
    const c = ctx();
    if (!c) return;
    drawing.current = true;
    hasInk.current = true;
    const { x, y } = pos(e);
    c.beginPath();
    c.moveTo(x, y);
    canvasRef.current!.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = ctx();
    if (!c) return;
    const { x, y } = pos(e);
    c.lineTo(x, y);
    c.strokeStyle = '#0a0a0a';
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke();
  };
  const onUp = () => {
    drawing.current = false;
  };
  const clearCanvas = () => {
    const c = ctx();
    if (c && canvasRef.current) c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    hasInk.current = false;
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const currentDataUrl = (): string | null => {
    if (mode === 'upload') return uploadPreview;
    if (!hasInk.current || !canvasRef.current) return null;
    return canvasRef.current.toDataURL('image/png');
  };

  const handleSaveAndUse = async () => {
    const dataUrl = currentDataUrl();
    if (!dataUrl) return;
    await saveSignature({ label, kind, dataUrl, makeDefault: entries.length === 0 });
    onUse(dataUrl);
  };

  const handleDelete = async (id: string) => {
    await deleteSignature(id);
    refresh();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-[560px] max-w-[92vw] rounded-xl bg-neutral-800 text-text-primary shadow-2xl border border-border">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-medium">Signatures</h2>
          <button onClick={onClose} className="btn-toolbar" title="Close">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Saved signatures */}
          {entries.length > 0 && (
            <div>
              <div className="text-xs text-text-muted mb-2">Saved — click to place</div>
              <div className="grid grid-cols-3 gap-2">
                {entries.map((s) => (
                  <div key={s.id} className="relative group border border-border rounded bg-white/90 p-2 h-20 flex items-center justify-center">
                    <img src={s.dataUrl} alt={s.label} className="max-h-full max-w-full object-contain cursor-pointer" onClick={() => onUse(s.dataUrl)} />
                    {s.isDefault && <Star size={12} className="absolute top-1 left-1 text-amber-500 fill-amber-500" />}
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 bg-neutral-900/70 rounded p-0.5"
                      title="Delete"
                    >
                      <Trash2 size={12} className="text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Create new */}
          <div>
            <div className="flex gap-1 mb-2">
              <button onClick={() => setMode('draw')} className={`btn-toolbar text-xs px-2 gap-1 ${mode === 'draw' ? 'bg-accent/30' : ''}`}>
                <Pen size={14} /> Draw
              </button>
              <button onClick={() => setMode('upload')} className={`btn-toolbar text-xs px-2 gap-1 ${mode === 'upload' ? 'bg-accent/30' : ''}`}>
                <Upload size={14} /> Upload PNG
              </button>
            </div>

            {mode === 'draw' ? (
              <div className="space-y-1">
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={180}
                  className="w-full rounded border border-border bg-white touch-none"
                  style={{ height: 180 }}
                  onPointerDown={onDown}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                />
                <button onClick={clearCanvas} className="text-xs text-text-muted hover:text-text-primary">
                  Clear
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input type="file" accept="image/png,image/*" onChange={onUpload} className="text-xs" />
                {uploadPreview && (
                  <div className="h-24 border border-border rounded bg-white/90 flex items-center justify-center">
                    <img src={uploadPreview} alt="preview" className="max-h-full max-w-full object-contain" />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 mt-3">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Label"
                className="flex-1 bg-neutral-900 border border-border rounded px-2 py-1 text-sm focus:outline-none focus:border-accent"
              />
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as 'signature' | 'initial')}
                className="bg-neutral-900 border border-border rounded px-2 py-1 text-sm"
              >
                <option value="signature">Signature</option>
                <option value="initial">Initial</option>
              </select>
              <button onClick={handleSaveAndUse} className="btn-toolbar-lg bg-accent/30 hover:bg-accent/50 text-sm px-3">
                Save &amp; place
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
