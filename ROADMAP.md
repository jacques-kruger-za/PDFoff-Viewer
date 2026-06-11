# Roadmap — PDFoff-Viewer

Groomed, prioritised, sequenced work. Items here have been scoped enough to schedule. For raw, ungroomed items see [BACKLOG.md](./BACKLOG.md).

## Now

- [ ] v1.2 — DRY refactor: extract IPC names, layout, zoom, and timing into shared constants

## Next

- [ ] Fix: performance degrades above 300% zoom (GitHub #1)

## Later

- [ ] Form filling
- [ ] In-document text search

## Done

- **v1.1 / 2026-04-12** — Standardize file open pipeline, tab tooltips, zoom fixes (`144af66`)
- **v1.1 / 2026-04-12** — Cap maximum zoom at 500% to prevent stalling (`1af9a5b`)
- **v1.1 / 2026-04-12** — Eliminate flicker on PDF.js re-render handover (`b30f6e6`)
- **v1.1 / 2026-04-12** — Boot splash, app menus, smooth zoom, UI polish (`d7b1dd2`)
- **2026-04-10** — Thumbnail sidebar, fit controls, welcome screen
- **2026-04-09** — Initial Electron + React + PDF.js build, NSIS installer, Windows file association

---

**Conventions:**
- Use checkboxes (`- [ ]` / `- [x]`) so progress is visible.
- One line per item — link to a doc in `docs/` if more is needed.
- A roadmap item is a **scoped, prioritised commitment**, not a wish. Wishes live in `BACKLOG.md`.
- When something ships, move it to `## Done` with a date and (optionally) a commit/PR link. Significant deliveries also get logged in `PROJECT-OVERVIEW.md` Work Log.
