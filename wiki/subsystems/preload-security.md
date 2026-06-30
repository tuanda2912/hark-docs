---
type: subsystem
title: Preload security & IPC bridge
status: current
sources: [docs/decisions/0010-phase-4-ui-scaffold.md, docs/decisions/0014-ui-preferences-persistence.md, docs/decisions/0021-macos-app-packaging.md, "graph: Electron Main Process"]
updated: 2026-06-30
tags: [security, preload, ipc, contextisolation, csp]
---

# Preload security & IPC bridge

The boundary between the privileged [[electron-main]] process and the untrusted [[ui-renderer]].
The renderer never touches Node, the filesystem, the network, or the Keychain directly — everything
crosses a **whitelisted** `contextBridge` surface defined in the preload script.

## Files (graph layer "Electron Main Process")
- `ui/src/main/preload.ts` — the main-window preload; exposes a typed `window.hark` API over
  `contextBridge` (the engine port, prefs, onboarding flag, etc.).
- `ui/src/main/tray-preload.ts` — the equivalent locked-down bridge for the [[tray]] popover.

## Posture
- **`contextIsolation: true` + `nodeIntegration: false`.** The renderer runs as plain browser code;
  no `require`, no Node globals. Only the explicit `contextBridge` methods are reachable.
- **Strict CSP — `script-src 'self'`, no `'unsafe-inline'`.** This is core to the privacy posture
  (`0021`). It is load-bearing enough that packaging had to **disable Angular's critical-CSS
  inlining** (`optimization.styles.inlineCritical: false`): the inlining trick uses an inline
  `onload` handler the CSP blocks, which would otherwise leave the packaged `file://` app unstyled
  (`0021`).
- **Engine port handshake.** Main spawns `harkd`, polls
  `~/Library/Application Support/Hark/engine.port`, parses the JSON, and exposes the port to the
  renderer via `contextBridge`; the renderer then opens the browser-native `WebSocket` itself
  (`0010` §Decision 5). Keeping the WS client in the renderer is deliberate — the loopback bind
  already gates external access, so no second copy of the message-shape code is needed
  (`0010` §Alternatives).

## What goes through the bridge, not around it
- **Preferences I/O.** `prefs.json` is read/written **only** in main, validated before write, and
  exposed to the renderer over the whitelisted `contextBridge` API — never via renderer
  `localStorage`, which would live opaquely in the Chromium profile dir (`0014`). See
  [[ui-onboarding]].
- **Onboarding state.** The `hasCompletedOnboarding` flag is a main-process pref surfaced through the
  same bridge (`0023`).

The egress edge (Claude API, Keychain) is likewise main-only — see [[local-first-egress]] and the
[[llm-egress]] subsystem. The streaming contract the renderer speaks is the [[wire-protocol]].
