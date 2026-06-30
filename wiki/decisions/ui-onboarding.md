---
type: decision
title: UI scaffold, first-run onboarding & model-load
status: current
sources: [docs/decisions/0010-phase-4-ui-scaffold.md, docs/decisions/0022-first-run-model-load-progress.md, docs/decisions/0023-first-run-onboarding-flow.md, docs/decisions/0024-onscreen-transcript-back-annotation.md, docs/decisions/0014-ui-preferences-persistence.md]
updated: 2026-06-30
tags: [decision, ui, onboarding, scaffold, first-run]
---

# Decision — UI scaffold, onboarding & first-run

The cluster of decisions that built the Electron/Angular front end and made a fresh install honest
and un-hung.

## Scaffold (`0010`)
The [[ui-renderer]] under `ui/` is a **hand-rolled Angular 21** project (no `ng new`), standalone
components only, **Tailwind v3** driving the [[design-system]] tokens through CSS vars, and **Angular
signals** for state — no NgRx (a single-window app with one WebSocket source doesn't earn the
ceremony). Two tsconfigs split the renderer build (Angular CLI → `dist/renderer/`) from the main
build (`tsc` → `dist/main/`), keeping Electron's API out of the renderer's type graph. The first
commit was a **thin vertical slice** — scaffold + harkd spawn + WS connect + a minimal live-transcript
view — to prove the dev loop before piling on surfaces (`0010` §Decision).

## Preferences persistence (`0014`)
A small **main-process** layer writes a versioned `~/Library/Application Support/Hark/prefs.json`
(via `app.getPath('appData')` + `'Hark'`, **not** `userData`), read on demand over the whitelisted
`contextBridge` and **validated before write**. Rejected: `electron-store` (new supply-chain surface),
renderer `localStorage` (opaque Chromium-profile dir), and storing prefs in the sacred vault. The
file holds **only** UI defaults — never transcripts, audio, or PII (`0014`). This is the surface the
onboarding flag rides on (see [[preload-security]]).

## Model-load progress — Slice 1 (`0022`)
A fresh install downloads ~626 MB of speech + diarizer models and ANE-compiles them, previously with
**nothing on the wire** between `meta.hello` and `meta.ready` — it looked hung. The fix is the
additive `meta.model_progress` frame ([[wire-protocol]]): a determinate **bar** for byte-counted
downloads, an honest **spinner** for the ANE compile (no fabricated percentage), behind an ~800ms
anti-flash gate so warm-cache launches don't flicker (`0022`).

## Onboarding — Slice 2 (`0023`)
A three-screen overlay (Trust → Permissions → Setup) shown on first run, gated on a persisted
**`hasCompletedOnboarding`** flag (missing reads as `false`, so existing installs see it once).
Content was made **honest, not literal**: engine labeled WhisperKit large-v3-turbo; **two** permissions
not three (the Screen-Recording and Accessibility/global-hotkeys cards dropped — Hark uses Process
Taps, ADR-0011, and global hotkeys aren't built); the folder picker and API-key field are rendered but
disabled placeholders (`0023`). See [[tray]] on the hotkey caveat.

## Transcript back-annotation (`0024`)
Because diarization is offline, the live transcript stays speaker-less until stop, then is **replaced
wholesale** by the `meeting.transcript` frame so every line is attributed and matches the saved
markdown; renames relabel lines live ([[ui-shell]], [[wire-protocol]]).
