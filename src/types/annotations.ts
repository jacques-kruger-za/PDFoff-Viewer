/**
 * Annotation model. All geometry is normalized to 0..1 relative to the page's
 * displayed size, so annotations stay correct across zoom and are trivial to map
 * into PDF points at save time (custom overlay → pdf-lib bake).
 */

export type ToolType =
  | 'select'
  | 'text'
  | 'pen'
  | 'highlight'
  | 'image'
  | 'signature';

interface AnnotationBase {
  id: string;
  page: number; // 1-based page number
}

export interface TextAnnotation extends AnnotationBase {
  type: 'text';
  x: number; // top-left, normalized
  y: number;
  w: number; // box width, normalized
  text: string;
  fontSize: number; // normalized to page height (so it scales with the page)
  color: string; // hex
}

export interface PenAnnotation extends AnnotationBase {
  type: 'pen';
  points: Array<{ x: number; y: number }>; // normalized
  color: string;
  strokeWidth: number; // normalized to page height
}

export interface HighlightAnnotation extends AnnotationBase {
  type: 'highlight';
  x: number;
  y: number;
  w: number;
  h: number;
  color: string; // hex (alpha applied at render/bake)
}

export interface ImageAnnotation extends AnnotationBase {
  type: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  dataUrl: string; // PNG data URL
  kind: 'image' | 'signature';
}

export type Annotation =
  | TextAnnotation
  | PenAnnotation
  | HighlightAnnotation
  | ImageAnnotation;

export interface SignatureEntry {
  id: string;
  label: string;
  kind: 'signature' | 'initial';
  isDefault: boolean;
  dataUrl: string; // transparent PNG
}

export const ANNOTATION_DEFAULTS = {
  TEXT_COLOR: '#1a1a1a',
  TEXT_FONT_SIZE: 0.018, // fraction of page height (~13pt on US Letter)
  PEN_COLOR: '#d11', // red ink, common for marking
  PEN_STROKE: 0.003, // fraction of page height
  HIGHLIGHT_COLOR: '#ffe34d',
  HIGHLIGHT_ALPHA: 0.4,
} as const;
