---
type: subsystem
title: Electron main process
status: current
sources: [docs/design/06-architecture-overview.md, "graph: Electron Main Process"]
updated: 2026-06-30
tags: [electron, main, ipc, security, lifecycle]
---

# Electron main process

The **privileged** process: it holds every sensitive edge — window/tray management, global hotkeys,
auto-updater, Keychain access, the Claude API client, and the vault FS + git wrapper. The renderer
([[ui-renderer]]) reaches these only via IPC (`docs/design/06-architecture-overview.md` §Component view: UI).

## Files (graph layer "Electron Main Process")
- `ui/src/main/main.ts` — main-process entrypoint, window/tray lifecycle.
- `ui/src/main/harkd-spawn.ts` — spawns + supervises the [[streaming-daemon]] sidecar.
- `ui/src/main/port-file.ts` — discovers the engine's WebSocket port (port handshake file).
- `ui/src/main/{tray,tray-popover,tray-preload}.ts` — the tray menu surface.
- `ui/src/main/preload.ts` — the locked-down IPC bridge (contextIsolation boundary).
- `ui/src/main/prefs.ts` — preferences (`~/Library/Application Support/Hark/prefs.json`).

## Notes
- Crash isolation: if `harkd` OOMs on a long meeting, main survives and can offer a restart — a reason for the
  [[swift-engine-sidecar]] split.
- The Claude client and Keychain bridge live here; the egress policy is documented in [[local-first-egress]]
  and the provider code is the [[llm-egress]] subsystem.
