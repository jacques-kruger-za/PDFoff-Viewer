import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type {
  Annotation,
  PenAnnotation,
  ToolType,
} from '../types/annotations';
import { ANNOTATION_DEFAULTS } from '../types/annotations';

interface PendingImage {
  dataUrl: string;
  kind: 'image' | 'signature';
  aspect: number;
}

interface AnnotationLayerProps {
  page: number;
  annotations: Annotation[];
  tool: ToolType;
  penColor: string;
  penWidth: number;
  highlightColor: string;
  signatureHeight: number;
  selectedId: string | null;
  pendingImage: PendingImage | null;
  onSelect: (id: string | null) => void;
  onAdd: (a: Annotation) => void;
  onUpdate: (id: string, patch: Partial<Annotation>) => void;
  onDelete: (id: string) => void;
  onConsumePendingImage: () => void;
}

let annCounter = 0;
const newId = () => `ann-${Date.now()}-${++annCounter}`;

function capture(e: React.PointerEvent) {
  try {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  } catch {
    /* synthetic / released pointer */
  }
}

function norm(e: { clientX: number; clientY: number }, rect: DOMRect) {
  return {
    x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
  };
}

function penBounds(a: PenAnnotation) {
  const xs = a.points.map((p) => p.x);
  const ys = a.points.map((p) => p.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

export function AnnotationLayer({
  page,
  annotations,
  tool,
  penColor,
  penWidth,
  highlightColor,
  signatureHeight,
  selectedId,
  pendingImage,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  onConsumePendingImage,
}: AnnotationLayerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [draftPen, setDraftPen] = useState<Array<{ x: number; y: number }> | null>(null);
  const [draftRect, setDraftRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const gestureRef = useRef<
    | { kind: 'move'; id: string; start: { x: number; y: number }; orig: Annotation }
    | { kind: 'resize'; id: string; aspect: number | null }
    | null
  >(null);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rect = () => rootRef.current!.getBoundingClientRect();

  // ── Drawing gestures (pen / highlight / image) on pointerdown ────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const r = rect();
      const p = norm(e, r);

      if (tool === 'pen') {
        capture(e);
        setDraftPen([p]);
      } else if (tool === 'highlight') {
        capture(e);
        setDraftRect({ x: p.x, y: p.y, w: 0, h: 0 });
      } else if ((tool === 'image' || tool === 'signature') && pendingImage) {
        let defW: number;
        let defH: number;
        if (pendingImage.kind === 'signature') {
          // Height-anchored (remembered from last resize); width from aspect.
          defH = signatureHeight;
          defW = (defH * pendingImage.aspect * r.height) / r.width;
        } else {
          defW = ANNOTATION_DEFAULTS.IMAGE_WIDTH;
          defH = (defW * (r.width / r.height)) / pendingImage.aspect;
        }
        const a: Annotation = {
          id: newId(),
          page,
          type: 'image',
          x: Math.min(p.x, 1 - defW),
          y: Math.min(p.y, 1 - defH),
          w: defW,
          h: defH,
          dataUrl: pendingImage.dataUrl,
          kind: pendingImage.kind,
        };
        onAdd(a);
        onSelect(a.id);
        onConsumePendingImage();
      }
    },
    [tool, page, pendingImage, signatureHeight, onAdd, onSelect, onConsumePendingImage]
  );

  // Text is created on click (after the full pointer sequence) so the trailing
  // click can't blur and delete the freshly focused textarea.
  const onRootClick = useCallback(
    (e: React.MouseEvent) => {
      if (tool === 'text' && e.target === rootRef.current) {
        const p = norm(e, rect());
        const id = newId();
        onAdd({
          id,
          page,
          type: 'text',
          x: p.x,
          y: p.y,
          w: Math.min(ANNOTATION_DEFAULTS.TEXT_WIDTH, 1 - p.x),
          text: '',
          fontSize: ANNOTATION_DEFAULTS.TEXT_FONT_SIZE,
          color: ANNOTATION_DEFAULTS.TEXT_COLOR,
        });
        onSelect(id);
        setEditingId(id);
      } else if (tool === 'select' && e.target === rootRef.current) {
        onSelect(null);
        setEditingId(null);
      }
    },
    [tool, page, onAdd, onSelect]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draftPen) {
        setDraftPen((prev) => (prev ? [...prev, norm(e, rect())] : prev));
      } else if (draftRect) {
        const p = norm(e, rect());
        setDraftRect((prev) =>
          prev
            ? { x: Math.min(prev.x, p.x), y: Math.min(prev.y, p.y), w: Math.abs(p.x - prev.x), h: Math.abs(p.y - prev.y) }
            : prev
        );
      }
    },
    [draftPen, draftRect]
  );

  const onPointerUp = useCallback(() => {
    if (draftPen) {
      if (draftPen.length > 1) {
        const a: PenAnnotation = {
          id: newId(),
          page,
          type: 'pen',
          points: draftPen,
          color: penColor,
          strokeWidth: penWidth,
        };
        onAdd(a);
      }
      setDraftPen(null);
    }
    if (draftRect) {
      if (draftRect.w > 0.005 && draftRect.h > 0.005) {
        onAdd({
          id: newId(),
          page,
          type: 'highlight',
          x: draftRect.x,
          y: draftRect.y,
          w: draftRect.w,
          h: draftRect.h,
          color: highlightColor,
        });
      }
      setDraftRect(null);
    }
  }, [draftPen, draftRect, page, penColor, penWidth, highlightColor, onAdd]);

  // ── Move / resize ───────────────────────────────────────────────────────────
  const startMove = useCallback(
    (e: React.PointerEvent, a: Annotation) => {
      if (tool !== 'select') return;
      e.stopPropagation();
      onSelect(a.id);
      capture(e);
      gestureRef.current = { kind: 'move', id: a.id, start: norm(e, rect()), orig: a };
    },
    [tool, onSelect]
  );

  const startResize = useCallback(
    (e: React.PointerEvent, a: Annotation) => {
      e.stopPropagation();
      capture(e);
      const aspect =
        a.type === 'image' && size.w && size.h ? (a.w * size.w) / (a.h * size.h) : null;
      gestureRef.current = { kind: 'resize', id: a.id, aspect };
    },
    [size]
  );

  const onRootPointerMoveGesture = useCallback(
    (e: React.PointerEvent) => {
      const g = gestureRef.current;
      if (!g) return;
      const p = norm(e, rect());
      const a = annotations.find((x) => x.id === g.id);
      if (!a) return;
      if (g.kind === 'move') {
        const dx = p.x - g.start.x;
        const dy = p.y - g.start.y;
        if (g.orig.type === 'pen') {
          onUpdate(g.id, { points: g.orig.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) } as Partial<Annotation>);
        } else {
          const w = g.orig.w;
          const h = g.orig.type === 'text' ? 0.02 : g.orig.h;
          const nx = Math.min(Math.max(0, g.orig.x + dx), 1 - w);
          const ny = Math.min(Math.max(0, g.orig.y + dy), 1 - h);
          onUpdate(g.id, { x: nx, y: ny } as Partial<Annotation>);
        }
      } else if (g.kind === 'resize' && (a.type === 'image' || a.type === 'highlight' || a.type === 'text')) {
        const nw = Math.min(Math.max(0.02, p.x - a.x), 1 - a.x); // never past right edge
        if (a.type === 'text') {
          onUpdate(g.id, { w: nw } as Partial<Annotation>);
        } else {
          let nh = Math.min(Math.max(0.02, p.y - a.y), 1 - a.y);
          if (g.aspect && a.type === 'image' && size.w && size.h) {
            nh = (nw * size.w) / g.aspect / size.h;
          }
          onUpdate(g.id, { w: nw, h: nh } as Partial<Annotation>);
        }
      }
    },
    [annotations, onUpdate, size]
  );

  const endGesture = useCallback(() => {
    gestureRef.current = null;
  }, []);

  // Delete / deselect via keyboard.
  useEffect(() => {
    if (!selectedId || editingId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        onDelete(selectedId);
        onSelect(null);
      } else if (e.key === 'Escape') {
        onSelect(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, editingId, onDelete, onSelect]);

  const selectMode = tool === 'select' && !pendingImage;
  const cursor =
    tool === 'text'
      ? 'text'
      : tool === 'pen' || tool === 'highlight'
      ? 'crosshair'
      : pendingImage
      ? 'copy'
      : 'default';

  return (
    <div
      ref={rootRef}
      className="absolute inset-0"
      style={{ cursor, pointerEvents: selectMode ? 'none' : 'auto', zIndex: 5 }}
      onPointerDown={onPointerDown}
      onClick={onRootClick}
      onPointerMove={(e) => {
        onPointerMove(e);
        onRootPointerMoveGesture(e);
      }}
      onPointerUp={() => {
        onPointerUp();
        endGesture();
      }}
    >
      {/* Pen strokes + selection + live draft */}
      {size.w > 0 && (
        <svg
          width={size.w}
          height={size.h}
          className="absolute top-0 left-0"
          style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
          {annotations
            .filter((a): a is PenAnnotation => a.type === 'pen')
            .map((a) => {
              const pts = a.points.map((pt) => `${pt.x * size.w},${pt.y * size.h}`).join(' ');
              const selected = a.id === selectedId;
              const b = penBounds(a);
              return (
                <g key={a.id}>
                  <polyline
                    points={pts}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={Math.max(0.5, a.strokeWidth * size.h)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* invisible fat hit-line for selecting/moving in select mode */}
                  {selectMode && (
                    <polyline
                      points={pts}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={Math.max(12, a.strokeWidth * size.h + 10)}
                      style={{ pointerEvents: 'stroke', cursor: 'move' }}
                      onPointerDown={(e) => startMove(e, a)}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(a.id);
                      }}
                    />
                  )}
                  {selected && (
                    <rect
                      x={b.x * size.w - 4}
                      y={b.y * size.h - 4}
                      width={b.w * size.w + 8}
                      height={b.h * size.h + 8}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={1}
                      strokeDasharray="4 3"
                      style={{ pointerEvents: 'none' }}
                    />
                  )}
                </g>
              );
            })}
          {draftPen && (
            <polyline
              points={draftPen.map((pt) => `${pt.x * size.w},${pt.y * size.h}`).join(' ')}
              fill="none"
              stroke={penColor}
              strokeWidth={Math.max(0.5, penWidth * size.h)}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      )}

      {/* Box annotations */}
      {annotations.map((a) => {
        if (a.type === 'pen') return null;
        const selected = a.id === selectedId;
        const baseStyle: React.CSSProperties = {
          position: 'absolute',
          left: `${a.x * 100}%`,
          top: `${a.y * 100}%`,
        };

        if (a.type === 'highlight') {
          return (
            <div
              key={a.id}
              style={{
                ...baseStyle,
                width: `${a.w * 100}%`,
                height: `${a.h * 100}%`,
                background: a.color,
                opacity: ANNOTATION_DEFAULTS.HIGHLIGHT_ALPHA,
                mixBlendMode: 'multiply',
                outline: selected ? '1px solid #3b82f6' : 'none',
                cursor: tool === 'select' ? 'move' : 'inherit',
                pointerEvents: tool === 'select' ? 'auto' : 'none',
              }}
              onPointerDown={(e) => startMove(e, a)}
            >
              {selected && <ResizeHandle onPointerDown={(e) => startResize(e, a)} />}
            </div>
          );
        }

        if (a.type === 'image') {
          return (
            <div
              key={a.id}
              style={{
                ...baseStyle,
                width: `${a.w * 100}%`,
                height: `${a.h * 100}%`,
                outline: selected ? '1px solid #3b82f6' : 'none',
                cursor: tool === 'select' ? 'move' : 'inherit',
                pointerEvents: tool === 'select' ? 'auto' : 'none',
              }}
              onPointerDown={(e) => startMove(e, a)}
            >
              <img src={a.dataUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              {selected && <ResizeHandle onPointerDown={(e) => startResize(e, a)} />}
            </div>
          );
        }

        // text
        const fontPx = a.fontSize * size.h;
        const editing = a.id === editingId;
        return (
          <div
            key={a.id}
            style={{
              ...baseStyle,
              width: `${a.w * 100}%`,
              outline: selected ? '1px solid #3b82f6' : a.text ? 'none' : '1px dashed #9ca3af',
              cursor: tool === 'select' && !editing ? 'move' : 'text',
              pointerEvents: tool === 'select' || tool === 'text' || editing ? 'auto' : 'none',
            }}
            onPointerDown={(e) => tool === 'select' && !editing && startMove(e, a)}
            onClick={(e) => {
              // In text mode, clicking an existing box edits it instead of
              // stacking a new box on top.
              if (tool === 'text') {
                e.stopPropagation();
                onSelect(a.id);
                setEditingId(a.id);
              }
            }}
            onDoubleClick={() => {
              onSelect(a.id);
              setEditingId(a.id);
            }}
          >
            {editing ? (
              <textarea
                autoFocus
                value={a.text}
                onChange={(e) => onUpdate(a.id, { text: e.target.value } as Partial<Annotation>)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.stopPropagation();
                    e.currentTarget.blur();
                  }
                }}
                onBlur={() => {
                  setEditingId(null);
                  if (!a.text.trim()) onDelete(a.id);
                }}
                style={{
                  width: '100%',
                  fontSize: `${fontPx}px`,
                  lineHeight: 1.18,
                  color: a.color,
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  border: 'none',
                  outline: 'none',
                  background: 'rgba(255,255,255,0.6)',
                  resize: 'none',
                  overflow: 'hidden',
                  padding: 0,
                  margin: 0,
                }}
                rows={Math.max(1, a.text.split('\n').length)}
              />
            ) : (
              <div
                style={{
                  fontSize: `${fontPx}px`,
                  lineHeight: 1.18,
                  color: a.color,
                  fontFamily: 'Helvetica, Arial, sans-serif',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  minHeight: `${fontPx}px`,
                }}
              >
                {a.text || ' '}
              </div>
            )}
            {selected && <ResizeHandle onPointerDown={(e) => startResize(e, a)} axis="x" />}
          </div>
        );
      })}

      {/* Highlight draft */}
      {draftRect && (
        <div
          style={{
            position: 'absolute',
            left: `${draftRect.x * 100}%`,
            top: `${draftRect.y * 100}%`,
            width: `${draftRect.w * 100}%`,
            height: `${draftRect.h * 100}%`,
            background: highlightColor,
            opacity: ANNOTATION_DEFAULTS.HIGHLIGHT_ALPHA,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

function ResizeHandle({
  onPointerDown,
  axis,
}: {
  onPointerDown: (e: React.PointerEvent) => void;
  axis?: 'x' | 'xy';
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: 'absolute',
        right: -6,
        bottom: axis === 'x' ? '50%' : -6,
        width: 12,
        height: 12,
        background: '#3b82f6',
        border: '2px solid white',
        borderRadius: 2,
        cursor: axis === 'x' ? 'ew-resize' : 'nwse-resize',
        pointerEvents: 'auto',
        transform: axis === 'x' ? 'translateY(50%)' : undefined,
      }}
    />
  );
}
