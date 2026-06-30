---
type: subsystem
title: UI renderer (Angular)
status: current
sources: [docs/design/06-architecture-overview.md, "graph: UI Renderer (Angular)"]
updated: 2026-06-30
tags: [ui, angular, renderer, electron]
---

# UI renderer (Angular)

All user-facing surfaces, running in the **Electron renderer** (locked down: `contextIsolation: true`,
`nodeIntegration: false`, strict CSP). The renderer talks to [[electron-main]] over Electron IPC and never
touches the network, Keychain, or FS directly (`docs/design/06-architecture-overview.md` §Component view: UI).

## Files (graph layer "UI Renderer (Angular)")
- `ui/src/app/app.component.ts` — app shell / orchestration.
- `ui/src/app/components/transcript-line.component.ts` — live transcript lines.
- `ui/src/app/components/speaker-tagging.component.ts` — speaker tagging (diarization UI). [[streaming-daemon]]
- `ui/src/app/components/translate-panel.component.ts`, `summary-panel.component.ts` — translation + summary.
- `ui/src/app/components/post-meeting-review.component.ts`, `meeting-saved-toast.component.ts` — post-meeting flow.
- `ui/src/app/components/settings-panel.component.ts` — settings (incl. privacy / LLM config). [[local-first-egress]]
- `ui/src/app/components/{model-loading,status-banner,eyebrow}.component.ts` — status/loading surfaces.
- `ui/src/app/services/engine.service.ts` — the renderer-side bridge to the engine (via IPC → WebSocket client).

## Notes
The yellow "falling behind" (RTF > 1) banner is surfaced here from engine warning events. Surfaces map to the
global hotkeys owned by [[electron-main]] (⌘⇧R / ⌘⇧B / ⌘⇧Q / ⌘⇧S).
