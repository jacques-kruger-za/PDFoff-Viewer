# Backlog — PDFoff-Viewer

Raw inbox for features, issues, and bugs. Unsorted, ungroomed, no sequencing. Capture freely. Items get promoted to `ROADMAP.md` once they're scoped, prioritised, and sequenced.

## Features

### Annotation + Signature (decided design, pending implementation)

The headline v1.3 feature. Goal: fill in and mark up PDFs digitally, baked into the file.

**Decided design:**
- **Save model:** annotations + form values are baked into the PDF via PDF.js `saveDocument()` and written back to the original file on disk (Ctrl+S). New `SAVE_FILE` IPC channel; main process writes bytes. Permanent, portable to any reader.
- **Tools (PDF.js v5 native AnnotationEditorLayer, all in one pass):** free-text, ink/pen, highlight, image stamp — plus the dedicated signature below.
- **Forms — support both:** if the PDF has AcroForm fields, fill them interactively (PDF.js AnnotationLayer + annotationStorage). If not (most fill-out PDFs aren't real forms), use free-text/annotations. Both must work.
- **Signature (enhanced Stamp):** image-based insert (transparent PNG), distinct from cryptographic signing.
  - Create two ways: (a) draw in-app on a canvas → captured as transparent PNG; (b) upload an existing transparent PNG.
  - Saved to the user-data folder, reused as the default. Multiple identities = later.
  - Placement: click-to-drop, then drag + resize; remember size.
- **UI:** toolbar mode — extend the existing top toolbar with annotation tool toggles. No right-hand panel (few tools).
- **Persistence/sync:** none — standalone app, signature lives in user data only.

**Open/later:** multiple signature identities; shapes (rect/ellipse/line/polygon), underline/strikethrough, sticky-note comments, text stamps (all beyond PDF.js native — custom overlay + pdf-lib).

### Other

- [ ] In-document text search

## Issues

- [ ]

## Bugs

- [ ]

## From GitHub Issues

- [ ] #1 — Performance degrades above 300% zoom (partially mitigated by 500% cap in `1af9a5b`; verify whether still reproducible)

## From Sessions

<!-- Auto-populated by /project-hygiene --fix from vault pending_hygiene queue (type: backlog-add). -->

---

**Promoting to ROADMAP:** when an item is scoped + prioritised + ready to schedule, move it to `ROADMAP.md` and delete it here. The split is intentional — a healthy backlog has more in it than the roadmap.
