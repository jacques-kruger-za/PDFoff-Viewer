---
project: PDFoff-Viewer
status: active
last_updated: 2026-05-03
---

# PDFoff-Viewer — Project Overview

Living state + history. Captures what this project is made of, what it does, why it's shaped the way it is, and what's been done. Mirrored to vault as `_VaultOperations/projects/PDFOff_Session_Notes.md` (sparse-cloned).

For *future* work, see `ROADMAP.md` (sequenced) and `BACKLOG.md` (raw inbox).

## Stack

- **Language:** TypeScript (renderer) + Rust (Tauri backend)
- **Framework:** Tauri v2, Vite
- **Key libs:** mupdf (rendering), PDF.js (re-render handover for smooth zoom), native Windows GDI for printing
- **Runtime / target:** Windows desktop, registered as the system PDF file handler
- **External services:** None

## Functionality

- Tabbed multi-document PDF viewer with browser-style tab UI and tooltips.
- Fit-to-width zoom, smooth zoom controls, fit controls, welcome screen, and boot splash.
- Thumbnail sidebar for page navigation; annotations.
- Native Windows GDI printing (over the browser print dialog).
- Windows file association: registers as a per-machine PDF handler; main process reads PDF bytes and forwards to the renderer to fix the black-screen bug.
- Standardised file-open pipeline across drag-drop, OS open, and menu open.

## Architecture & Key Decisions

- **2026-04-01** — Browser-style tabs for multi-document workflow; project registers as Windows PDF handler.
- **2026-03-12** — Tauri v2 + mupdf chosen over a pure Electron / PDF.js stack — native rendering quality and smaller installer.
- **GDI printing chosen over the browser print dialog** for fidelity and Windows-native feel.
- **PDF.js used only for the re-render handover step** during smooth zoom; mupdf is the steady-state renderer (eliminated zoom flicker).
- **Main process reads PDF bytes** for file associations (fix for black screen in production build), then forwards to renderer.

## Work Log

- **2026-04-?? (v1.1)** — Standardize file open pipeline, tab tooltips, zoom fixes (`144af66`)
- **2026-04-?? (v1.1)** — Cap max zoom at 500% to prevent stalling (`1af9a5b`)
- **2026-04-?? (v1.1)** — Boot splash, app menus, smooth zoom, UI polish (`d7b1dd2`)
- **2026-03-??** — Reduce installer size (`204544b`)
- **2026-03-??** — Fix file association (read PDF bytes in main process, perMachine install) (`94d4e2f`)
- **2026-03-??** — Fix black screen in production build (`8d12be1`)
- **2026-03-??** — Thumbnail sidebar for page navigation (`ca2f944`)

## References

- **Repo:** github.com/jacques-kruger-za/PDFoff-Viewer
- **Prod URL / deployment:** Local Windows installer (Tauri build, `release/`)
- **Vault status:** `_VaultOperations/projects/PDFOff_Session_Notes.md`
- **Key resource IDs:** _TODO_
- **Related vault notes:** _TODO_
