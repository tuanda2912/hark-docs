---
type: decision
title: A separate Swift engine sidecar (not in-process Node)
status: current
sources: [docs/design/06-architecture-overview.md]
updated: 2026-06-30
tags: [decision, architecture, engine, swift]
---

# Decision — a separate Swift engine sidecar

**Decision:** run audio capture + ASR + diarization + translation as a **standalone signed Swift binary**
(`harkd`), not inside the Electron/Node process.

## Why (from `docs/design/06-architecture-overview.md` §Why a separate Swift engine)
- **Performance** — WhisperKit on the ANE wants real-time priority; in Electron's main process it would
  deadline-starve UI rendering.
- **Crash isolation** — if the engine OOMs on a large model + multi-hour meeting, the UI survives and can
  offer a restart.
- **Permission model** — ScreenCaptureKit permission is **per-binary** on macOS; a stable signed Swift binary
  avoids re-prompting on every Electron update.
- **Language fit** — WhisperKit, ScreenCaptureKit, AVAudioEngine, FluidAudio are all Swift-native (no FFI tax).

## Consequences
- A WebSocket contract is needed between engine and UI (`docs/design/08-websocket-api-contract.md`); the engine
  is spawned/supervised by [[electron-main]] (`harkd-spawn.ts`, `port-file.ts`) and implemented in
  [[streaming-daemon]] / [[audio-capture]].

> Related ADR in the source repo: `docs/decisions/0001-electron-over-tauri.md` (UI shell choice). The
> Tauri/SwiftUI alternative is recorded there; this page covers the engine-split decision specifically.
