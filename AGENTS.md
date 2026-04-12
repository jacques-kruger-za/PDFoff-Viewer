# PDFoff Viewer

A native PDF viewer built with Electron, React, and PDF.js.

## Tech Stack

- **Runtime:** Electron 41
- **Frontend:** React 19, TypeScript, Tailwind CSS 4, Vite 8
- **PDF engine:** pdfjs-dist v5
- **Icons:** lucide-react
- **Build/packaging:** electron-builder (NSIS installer for Windows)

## Project Structure

```
src/
  App.tsx              — Main app shell: file management, tabs, zoom state
  components/
    Toolbar.tsx        — Top toolbar: navigation, zoom controls, fit buttons
    TabBar.tsx         — File tab bar
    PdfViewer.tsx      — Scroll container, wheel zoom, context menu
    PdfPage.tsx        — Single page renderer (canvas + text layer)
    EmptyState.tsx     — Welcome screen with animated logo
  hooks/
    usePdfDocument.ts  — PDF loading hook (pdfjs-dist)
  types/
    pdf.ts             — PdfFile type
electron/
  main.cjs             — Electron main process
  preload.cjs          — Preload script (file I/O bridge)
assets/                — App icons (source)
build/                 — Build assets (icon.ico for installer)
public/                — Static assets served by Vite (app-icon.png)
```

## Commands

```bash
npm run dev            # Vite dev server only (browser at localhost:5173)
npm run dev:electron   # Vite + Electron together
npm run build          # TypeScript check + Vite production build
npm run build:electron # Full build + electron-builder (produces installer)
npm run lint           # ESLint
```

## Key Design Decisions

- **BASE_SCALE:** `(96/72) * 1.25` in PdfPage.tsx. PDF points are 1/72", CSS pixels are 1/96". The extra 1.25x gives comfortable reading size at 100% zoom.
- **Zoom anchoring:** Ctrl+wheel zoom anchors to cursor position via scroll adjustment in `useLayoutEffect`.
- **Accelerating zoom:** Rapid scroll-wheel events increase zoom step from 3% to 15%.
- **Text selection:** PDF.js TextLayer with custom line gutters for clean end-of-line selection.
- **Context menu:** Custom right-click "Copy" menu when text is selected; default menu otherwise.

## Conventions

- Components in `src/components/`, one per file, named export matching filename
- Hooks in `src/hooks/`
- Electron code uses CommonJS (`.cjs`) for compatibility
