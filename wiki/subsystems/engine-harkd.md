---
type: subsystem
title: harkd daemon (engine binary)
status: current
sources: [docs/design/06-architecture-overview.md, "engine/Sources/Harkd/HarkdCommand.swift", "0011", "0012"]
updated: 2026-06-30
tags: [engine, harkd, daemon, lifecycle, websocket]
---

# harkd daemon

`harkd` is the **long-lived Swift sidecar binary** the Electron UI spawns — the Phase 3 streaming engine
daemon (`engine/Sources/Harkd/HarkdCommand.swift`). It is a separate signed process, not in-process Node,
for performance / crash-isolation / permission reasons (`docs/design/06-architecture-overview.md` §Why a
separate Swift engine; see [[swift-engine-sidecar]]). CLI: `harkd [--port N] [--port-file PATH] [--verbose]`.

## Lifecycle (startup order matters)
1. **Bind first, serve before the model.** harkd binds the WebSocket server on `127.0.0.1` and writes the
   `engine.port` file (JSON `{port, pid, version}`) **before** the slow model load, so the UI can discover
   it immediately (`HarkdCommand.swift`; `0012` §Decision). Loopback only — no auth.
2. **Load WhisperKit behind the running server.** NIO keeps serving during the `await`; `capture.start`
   arriving early is rejected with a recoverable `ENGINE_WARMING_UP` until `attachModel` runs (`0012`).
   The RAG embedder loads concurrently; the FluidAudio diarizer loads after WhisperKit — both **non-fatal**
   (`HarkdCommand.swift`).
3. **Park on SIGINT/SIGTERM.** On signal: close clients, stop capture, delete the port file, exit 0
   (`HarkdCommand.swift`).

The default port file is `~/Library/Application Support/Hark/engine.port`
(`HarkdCommand.swift` `resolvePortFileURL`).

## Permissions are lazy
harkd does **not** gate on permissions at startup (`0012` §Decision). They are requested at `capture.start`,
per requested source: mic via `PermissionGate` (only if the mic source is on), system audio inside the
Process Tap backend — both grant **live**, so capture continues in the same process with no relaunch
(`HarkdCommand.swift`; `0011`). A denial becomes a recoverable WS error frame the UI can act on, not a
process exit (`0012`).

## Privacy
stderr carries lifecycle + state transitions only — no transcript text, no audio (`HarkdCommand.swift`
header).

See [[engine-service]] for the session it drives, [[capture-audio]] for the capture backend, and
[[whisperkit-asr]] for the model.
