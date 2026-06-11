---
project: PDFoff-Viewer
status: active
last_updated: 2026-06-11
current_focus: v1.2 — DRY refactor extracting IPC names, layout, zoom, and timing into shared constants
next_step: Commit the v1.2 constants refactor and finish remaining v1.2 UI polish
blockers: none
key_decisions:
  - 2026-06-11: v1.3 annotation/signature design — bake into PDF via PDF.js saveDocument() + save to original; all PDF.js-native editors (free-text, ink, highlight, image stamp); support both AcroForm filling and free annotations; signature is an image stamp (draw in-app or upload PNG) stored in user data; toolbar-mode UI, no side panel
  - 2026-04-09: Built on Electron + React + PDF.js (pdfjs-dist) — instant open with native filesystem access, unlike the Stirling/Docker server approach
  - 2026-04-10: Main process reads PDF bytes and forwards to renderer — fixes black screen in production builds and enables file associations
  - 2026-04-12: Cap maximum zoom at 500% to prevent render stalling
  - 2026-06-11: Centralise IPC channel names, layout dims, zoom bounds, and timing into shared constants modules (DRY)
recent_milestones:
  - 2026-04-12: v1.1 — file-open pipeline, tab tooltips, boot splash, app menus, smooth zoom, UI polish
  - 2026-04-10: Thumbnail sidebar, fit controls, welcome screen
  - 2026-04-09: Initial Electron build with NSIS installer and Windows file association
---

# PDFoff-Viewer — Project Overview

Living state + history. Captures what this project is made of, what it does, why it's shaped the way it is, and what's been done. Mirrored to vault as `_VaultOperations/projects/PDFoff-Viewer_Session_Notes.md` (sparse-cloned).

For *future* work, see `ROADMAP.md` (sequenced) and `BACKLOG.md` (raw inbox).

## Lineage

PDFoff-Viewer is the third attempt at a lightweight native PDF reader, and the one that stuck:

1. **Stirling-PDF-Desktop** (archived) — an Electron wrapper around the full Stirling-PDF server (`frooodle/s-pdf`) running in Docker on `localhost:8080`. Comprehensive toolbox, but the browser-sandbox server model meant constant upload → process → download round-trips with no native-file editing, plus a Docker dependency and slow container spin-up. Kept for occasional heavy operations (OCR, convert, redact); not a daily driver.
2. **PDFOff** (archived, dead) — a Tauri v2 + Rust + MuPDF rewrite with native Windows GDI printing. A detour; salvageable code exists if native rendering or GDI printing is ever wanted. *Note the near-identical name — it is **not** this project.*
3. **PDFoff-Viewer** (this repo, active) — Electron + React + PDF.js. Native filesystem access, instant open, no server, no Docker. The daily driver to refine over time.

## Stack

- **Runtime:** Electron 41 (CommonJS `.cjs` for main/preload)
- **Frontend:** React 19, TypeScript, Tailwind CSS 4, Vite 8
- **PDF engine:** pdfjs-dist v5 (PDF.js)
- **Icons:** lucide-react
- **Build/packaging:** electron-builder (NSIS installer for Windows)
- **Runtime / target:** Windows desktop, registered as the system PDF file handler
- **External services:** None

## Functionality

- Tabbed multi-document viewer with browser-style tab bar and tooltips.
- Thumbnail sidebar for page navigation with active-page highlighting.
- Smooth, cursor-anchored Ctrl+wheel zoom with acceleration; fit-page / fit-width / reset controls.
- Page navigation: first/prev/next/last plus direct page-number input.
- Text selection and copy across pages, with a custom right-click Copy context menu.
- Drag-and-drop open, OS file-association open, and menu open — all through one standardised file-open pipeline.
- Animated welcome screen / boot splash on startup and when all tabs are closed.

## Architecture & Key Decisions

- **2026-06-11 (v1.2)** — DRY refactor: IPC channel names, layout dimensions, zoom bounds/steps, and timing constants extracted into shared modules (`src/constants/`, mirrored for Electron CJS in `electron/constants.cjs`). Removes magic numbers and duplicated string literals across main, preload, and renderer.
- **2026-04-12** — Cap max zoom at 500% to prevent render stalling. PDF.js re-render handover tuned to eliminate zoom flicker.
- **2026-04-10** — **Main process reads PDF bytes** for file associations (fix for black screen in production build), then forwards to the renderer. Per-machine NSIS install for system-wide `.pdf` handler registration.
- **2026-04-09** — **Electron + React + PDF.js** chosen as the foundation. The deciding factor over the prior Stirling/Docker server: native filesystem access (open by path, no upload/download round-trip) and instant open with no Docker daemon.
- **BASE_SCALE = `(96/72) * 1.25`** — PDF points are 1/72", CSS pixels 1/96"; the extra 1.25x gives comfortable reading size at 100% zoom.

## Work Log

- **2026-06-11 (v1.2)** — Constants extraction / DRY refactor (uncommitted at time of writing): `src/constants/{ipc,layout,timing}.ts` + `electron/constants.cjs`, threaded through main, preload, and components.
- **2026-04-12 (v1.1)** — Standardise file-open pipeline, tab tooltips, zoom fixes (`144af66`); cap max zoom at 500% (`1af9a5b`); eliminate zoom-handover flicker (`b30f6e6`); boot splash, app menus, smooth zoom, UI polish (`d7b1dd2`).
- **2026-04-10** — Thumbnail sidebar (`ca2f944`); fit controls + welcome screen (`13779ba`); fix file association via main-process byte read + per-machine install (`94d4e2f`); fix black screen in production build (`8d12be1`); reduce installer size (`204544b`).
- **2026-04-09** — Initial Electron build with installer, file associations, app icon (`00c308d`); initial commit (`2f53f90`).

## References

- **Repo:** github.com/jacques-kruger-za/PDFoff-Viewer
- **Prod URL / deployment:** Local Windows installer (electron-builder NSIS, `release/`)
- **Vault status:** `_VaultOperations/projects/PDFoff-Viewer_Session_Notes.md`
- **Related (archived):** `Archive/Stirling-PDF-Desktop` (Docker/Stirling), `Archive/PDFOff` (Tauri/MuPDF)
