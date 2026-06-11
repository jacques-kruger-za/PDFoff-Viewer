import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Annotation } from '../types/annotations';
import { ANNOTATION_DEFAULTS } from '../types/annotations';

function hexToRgb(hex: string) {
  const m = hex.replace('#', '');
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export interface ExportOptions {
  /** AcroForm field values to fill, keyed by field name. */
  formValues?: Record<string, string | boolean>;
}

/**
 * Bake annotations (and optional AcroForm values) into the original PDF bytes.
 * Returns new PDF bytes. Coordinate system: annotations are top-left normalized;
 * pdf-lib is bottom-left in points.
 */
export async function exportPdf(
  originalBytes: ArrayBuffer,
  annotations: Annotation[],
  options: ExportOptions = {}
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(originalBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  // Fill AcroForm fields first, if any.
  if (options.formValues && Object.keys(options.formValues).length > 0) {
    const form = doc.getForm();
    for (const [name, value] of Object.entries(options.formValues)) {
      try {
        const field = form.getField(name);
        const kind = field.constructor.name;
        if (kind === 'PDFTextField') {
          form.getTextField(name).setText(String(value));
        } else if (kind === 'PDFCheckBox') {
          const cb = form.getCheckBox(name);
          if (value) cb.check();
          else cb.uncheck();
        } else if (kind === 'PDFDropdown') {
          form.getDropdown(name).select(String(value));
        } else if (kind === 'PDFRadioGroup') {
          form.getRadioGroup(name).select(String(value));
        }
      } catch {
        // unknown / mismatched field — skip
      }
    }
  }

  // PNG embed cache so repeated stamps/signatures embed once.
  const imageCache = new Map<string, Awaited<ReturnType<typeof doc.embedPng>>>();

  for (const a of annotations) {
    const page = pages[a.page - 1];
    if (!page) continue;
    const { width: pw, height: ph } = page.getSize();

    if (a.type === 'highlight') {
      page.drawRectangle({
        x: a.x * pw,
        y: ph - (a.y + a.h) * ph,
        width: a.w * pw,
        height: a.h * ph,
        color: hexToRgb(a.color),
        opacity: ANNOTATION_DEFAULTS.HIGHLIGHT_ALPHA,
      });
    } else if (a.type === 'text') {
      const size = a.fontSize * ph;
      const lineHeight = size * 1.18;
      const lines = a.text.split('\n');
      lines.forEach((line, i) => {
        page.drawText(line, {
          x: a.x * pw,
          y: ph - a.y * ph - size - i * lineHeight,
          size,
          font,
          color: hexToRgb(a.color),
          maxWidth: a.w * pw,
          lineHeight,
        });
      });
    } else if (a.type === 'pen') {
      const thickness = Math.max(0.5, a.strokeWidth * ph);
      const color = hexToRgb(a.color);
      for (let i = 1; i < a.points.length; i++) {
        const p0 = a.points[i - 1];
        const p1 = a.points[i];
        page.drawLine({
          start: { x: p0.x * pw, y: ph - p0.y * ph },
          end: { x: p1.x * pw, y: ph - p1.y * ph },
          thickness,
          color,
        });
      }
    } else if (a.type === 'image') {
      let img = imageCache.get(a.dataUrl);
      if (!img) {
        img = await doc.embedPng(dataUrlToBytes(a.dataUrl));
        imageCache.set(a.dataUrl, img);
      }
      page.drawImage(img, {
        x: a.x * pw,
        y: ph - (a.y + a.h) * ph,
        width: a.w * pw,
        height: a.h * ph,
      });
    }
  }

  return doc.save();
}
