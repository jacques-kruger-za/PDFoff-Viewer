import { useEffect, useRef, useState } from 'react';
import { Trash2, Star, X, Pen, Upload } from 'lucide-react';
import type { SignatureEntry } from '../types/annotations';
import { SIGNATURE_NIBS } from '../types/annotations';
import { getSignatures, saveSignature, deleteSignature } from '../services/signatureStore';

interface SignatureModalProps {
  onClose: () => void;
  onUse: (dataUrl: string) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Crop a canvas to the bounding box of its non-transparent pixels (+padding). */
function cropToInk(canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.toDataURL('image/png');
  const { width: W, height: H } = canvas;
  const data = ctx.getImageData(0, 0, W, H).data;
  let minX = W, minY = H, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 12) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return canvas.toDataURL('image/png');
  const pad = 8;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(W - 1, maxX + pad);
  maxY = Math.min(H - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d')!.drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
  return out.toDataURL('image/png');
}

function cropDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      resolve(cropToInk(c));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function SignatureModal({ onClose, onUse }: SignatureModalProps) {
  const [entries, setEntries] = useState<SignatureEntry[]>([]);
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');
  const [label, setLabel] = useState('My signature');
  const [kind, setKind] = useState<'signature' | 'initial'>('signature');
  const [nib, setNib] = useState<number>(SIGNATURE_NIBS[1]);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const lastPt = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastW = useRef<number | null>(null);

  const refresh = () => getSignatures().then(setEntries);
  useEffect(() => {
    refresh();
  }, []);

  const ctx = () => canvasRef.current?.getContext('2d') ?? null;

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };

  const onDown = (e: React.PointerEvent) => {
    if (!ctx()) return;
    drawing.current = true;
    hasInk.current = true;
    const { x, y } = pos(e);
    lastPt.current = { x, y, t: performance.now() };
    lastW.current = null;
    try {
      canvasRef.current!.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic pointer */
    }
  };

  // Fountain-pen feel: stroke width varies inversely with pen speed (slow = thick,
  // fast = thin), smoothed, with round caps so strokes taper naturally.
  const onMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const c = ctx();
    const last = lastPt.current;
    if (!c || !last) return;
    const { x, y } = pos(e);
    const now = performance.now();
    const dist = Math.hypot(x - last.x, y - last.y);
    const dt = Math.max(1, now - last.t);
    const speed = dist / dt; // px per ms
    const target = nib * clamp(1.7 - speed * 1.1, 0.32, 1.7);
    const w = lastW.current == null ? target : lastW.current * 0.6 + target * 0.4;

    c.strokeStyle = '#0a0a0a';
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.lineWidth = w;
    c.beginPath();
    c.moveTo(last.x, last.y);
    c.lineTo(x, y);
    c.stroke();

    lastPt.current = { x, y, t: now };
    lastW.current = w;
  };

  const onUp = () => {
    drawing.current = false;
    lastPt.current = null;
  };

  const clearCanvas = () => {
    const c = ctx();
    if (c && canvasRef.current) c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    hasInk.current = false;
    lastW.current = null;
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const currentDataUrl = async (): Promise<string | null> => {
    if (mode === 'upload') return uploadPreview ? cropDataUrl(uploadPreview) : null;
    if (!hasInk.current || !canvasRef.current) return null;
    return cropToInk(canvasRef.current);
  };

  const handleSaveAndUse = async () => {
    const dataUrl = await currentDataUrl();
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

          <div>
            <div className="flex items-center gap-1 mb-2">
              <button onClick={() => setMode('draw')} className={`btn-toolbar text-xs px-2 gap-1 ${mode === 'draw' ? 'bg-accent/30' : ''}`}>
                <Pen size={14} /> Draw
              </button>
              <button onClick={() => setMode('upload')} className={`btn-toolbar text-xs px-2 gap-1 ${mode === 'upload' ? 'bg-accent/30' : ''}`}>
                <Upload size={14} /> Upload PNG
              </button>
              {mode === 'draw' && (
                <div className="ml-auto flex items-center gap-1 text-xs text-text-muted">
                  <span>Nib</span>
                  {SIGNATURE_NIBS.map((n, i) => (
                    <button
                      key={n}
                      onClick={() => setNib(n)}
                      title={['Fine', 'Medium', 'Broad'][i]}
                      className={`btn-toolbar w-7 ${nib === n ? 'bg-accent/40' : ''}`}
                    >
                      <span className="rounded-full bg-current" style={{ width: [4, 7, 10][i], height: [4, 7, 10][i] }} />
                    </button>
                  ))}
                </div>
              )}
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
                  onPointerLeave={onUp}
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
