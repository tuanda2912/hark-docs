---
type: subsystem
title: Preload / contextBridge security surface
status: current
sources: [ADR-0001, ADR-0029, ADR-0030, ADR-0031, ADR-0033, ADR-0034, ui/src/main/preload.ts, ui/src/main/tray-preload.ts]
updated: 2026-06-05
tags: [security, ipc, electron, privacy, llm]
---

The single sanctioned renderer↔main channel: `preload.ts` exposes exactly
`window.hark` (and a separate, minimal `window.harkTray`) as thin `ipcRenderer`
wrappers that re-shape every payload to strict whitelisted fields. The
load-bearing property: the API key crosses **one-way (renderer→main)** and is
**never readable back** — there is no `getKey`.

## Code map

**Layer:** Electron Main Process.

**Files:**

- `ui/src/main/preload.ts` — Electron preload that exposes the sandboxed
  `window.hark` API to the renderer via `contextBridge`, bridging engine port
  lookup, tray state, prefs, vault reveal, mic permission, and the LLM/RAG IPC
  channels under `contextIsolation`.
- `ui/src/main/tray-preload.ts` — minimal `contextBridge` preload for the
  menu-bar tray popover: a shape-validated state subscription and a
  whitelist-validated action emitter, with no access to the engine port, vault,
  or LLM.

**Key types & functions:**

- `isTrayPopoverState` (`tray-preload.ts`, Lx 41–50) — runtime type guard
  validating an incoming IPC payload matches the `TrayPopoverState` shape before
  it is handed to the popover callback.

(The slice surfaces no `getKey`/`getApiKey` symbol on either bridge —
consistent with the write-only key invariant.)

**Pinned by tests:** none in the slice.

**Connections:**

- imports → [[subsystems/llm-egress|LLM egress]] (`llm/types.ts`)
- imports → [[subsystems/electron-main|Electron main]] (`prefs.ts`)
- imports → [[subsystems/external-rag-client|External RAG client]] (`rag/types.ts`)

## What it does

Hark runs Electron with `contextIsolation` ON, `nodeIntegration` OFF, `sandbox`
ON (ADR-0001's security model). With those on, the sandboxed Angular renderer
([[ui-shell]]) cannot touch Node, the filesystem, the engine, or the LLM
directly. The preload is the *one* trusted script that bridges the gap: it runs
in an isolated context with limited `require`, and `contextBridge.exposeInMainWorld`
publishes a fixed API object onto the renderer's `window`. **Only what the
preload explicitly exposes crosses the boundary** — nothing else.

There are two bridges, deliberately separate:

- **`window.hark`** (`ui/src/main/preload.ts`) — the main window's broad API:
  engine port handshake, prefs, vault reveal, meeting-audio read, mic
  permission, the whole `llm` namespace, and the external `rag` namespace.
- **`window.harkTray`** (`ui/src/main/tray-preload.ts`) — a deliberately
  minimal surface for the menu-bar tray popover ([[tray]]). It can do exactly
  two things: receive a validated `TrayState` snapshot and emit a whitelisted
  action string. It has **no** access to the engine port, prefs, the vault, the
  LLM, or anything else.

The preload is not a logic layer. Every method is a thin `ipcRenderer.invoke`
(request/reply) or `ipcRenderer.send` (fire-and-forget) wrapper. The real work —
spawning harkd, reading the vault, calling a provider — lives in
[[electron-main]]. The preload's job is to be a *narrow, re-shaping* doorway.

## Key files

- `ui/src/main/preload.ts` — the `window.hark` bridge (every method below).
- `ui/src/main/tray-preload.ts` — the `window.harkTray` bridge for the popover.
- (handlers on the other side live in [[electron-main]]; the LLM provider layer
  in [[llm-egress]]; the external RAG client in [[external-rag-client]].)

## The two guarantees this surface enforces

### 1. Re-shaping to whitelisted fields (a structured-clone scrub)

Every payload that crosses is rebuilt field-by-field in the preload to *only*
the known keys, coerced to the expected type — never passed through whole
(except `rag`, see below). So even if renderer code (or injected DOM) hands a
fat object with extra properties, only the whitelisted shape reaches main, and
main re-validates *again* before acting. The preload is the first of a two-layer
trust boundary, not the only one.

Examples from `preload.ts`:

- `savePrefs` rebuilds `audio` / `theme` / `privacy` (ADR-0027 flags) to strict
  booleans + a known-value `theme`; main's `sanitizeTheme` / sanitizers are the
  final gate before writing `prefs.json`.
- `llm.setConfig` forwards only `provider` / `model` / `baseUrl` (dropping
  `undefined` `baseUrl` via structured-clone so it stays absent for Anthropic).
- `llm.summarize` / `translate` / `ask` / `translateSegment` coerce
  `transcript` / `text` / `question` to strings and filter `knownNames` /
  `context` to string arrays — main re-coerces.

### 2. The API key is write-only across the bridge (no `getKey`)

This is the load-bearing privacy invariant for LLM features. The `llm`
namespace exposes:

- `setApiKey(key)` — sends the key **renderer→main, one way**; main encrypts it
  with `safeStorage` (OS Keychain) and stores it in `llm-keys.json`
  (ADR-0030). Resolves a fresh `LlmStatus`.
- `clearApiKey()` — removes the stored key, resolves status.
- `getStatus()` / `setConfig()` / `testConnection()` — all resolve an
  `LlmStatus` that carries **`hasKey: boolean`** and config, but **never the
  key value**.

There is deliberately **no `getKey` / `getApiKey` method on the bridge.** The
key can be *set* but can *never be read back* into the renderer/DevTools
context. Combined with ADR-0029 (calls originate in main, not the renderer,
"the API key never enters the renderer/DevTools context") and ADR-0030
(decrypt only in main, only to inject into the auth header at call time), this
is what backs the product promise "Hark never sees your key."

## How it connects to other subsystems

- **[[electron-main]]** — every `ipcRenderer.invoke`/`send` here has a matching
  `ipcMain.handle`/`on` there. Main is the trusted process that re-validates and
  does the work. The preload and main's handler set are a hand-maintained
  lockstep pair (like the wire protocol's Swift↔TS pair, [[wire-protocol]]).
- **[[engine-service]]** — `getEnginePort()` is how the renderer's WebSocket
  client learns which loopback port harkd is listening on (the port handshake;
  see [[electron-main]]). The preload never speaks to the engine directly — only
  hands over the port number.
- **[[llm-egress]]** — the `llm` namespace (`getStatus` / `setConfig` /
  `setApiKey` / `clearApiKey` / `testConnection` / `summarize` / `translate` /
  `ask` / `translateSegment` / `flushLiveTranslate` / `getCloudLog`) is the
  renderer's only door to the provider layer. The bridge carries **text only**,
  never audio (ADR-0029). Results are content-free receipts + status; the
  cloud-call log returned by `getCloudLog()` is metadata-only (ADR-0031).
- **[[external-rag-client]]** — the `rag` namespace (`retrieve` / `testConnection`)
  reaches main's external-backend client, used only when `prefs.rag.backend ===
  'external'` (ADR-0033/0034). All retrieval is loopback-only; main enforces the
  guard. The built-in backend bypasses this bridge and retrieves in the engine
  over the WebSocket instead.
- **[[tray]]** — `window.hark.setTrayState` / `onTrayAction` (main window) and
  the whole `window.harkTray` surface (popover) drive the menu-bar UI. Tray
  actions are validated against a fixed whitelist *in the preload* before
  reaching renderer code, and *again* in main.
- **[[threat-model]]** / **[[egress-governance]]** / **[[privacy-data-control]]**
  — this surface is one of the enforcement points for the privacy hard rules:
  audio/voiceprints never cross it, the key is write-only, and the bridge is the
  renderer's only escape from the sandbox.
- Decision background: [[foundations]] (ADR-0001 Electron security model),
  [[privacy-egress]] (ADR-0029/0030/0031), [[vault-rag-decisions]] (ADR-0033/0034).

## Invariants (must stay true)

1. **`contextIsolation` ON, `nodeIntegration` OFF, `sandbox` ON** for every
   window — the precondition that makes this bridge the *only* renderer↔main
   path (ADR-0001).
2. **The renderer can never read the API key back.** No `getKey`/`getApiKey` on
   any bridge. `setApiKey` is one-way; status exposes `hasKey: boolean` only
   (ADR-0029, ADR-0030).
3. **Audio and voiceprints never cross this bridge.** The `llm` namespace
   carries transcript/markdown text only; there is no audio path to a provider
   (ADR-0029, threat-model rules #1/#5). `readMeetingAudio` reads vault audio
   renderer-bound for playback — it does not feed a provider.
4. **Every payload is re-shaped to whitelisted fields in the preload**, and main
   re-validates again. The preload is the first layer of a two-layer trust
   boundary, never the only one.
5. **Tray actions are whitelist-validated in the preload** (`TRAY_ACTIONS` in
   `preload.ts`, `TRAY_POPOVER_ACTIONS` in `tray-preload.ts`) before reaching
   renderer code or main — a compromised DOM cannot coerce an arbitrary action.
6. **`window.harkTray` stays minimal:** state-in, whitelisted-action-out, and
   nothing else (no port, prefs, vault, LLM, or RAG access).
7. **Path-taking methods are not arbitrary-file primitives.** `readMeetingAudio`
   and `revealPath` hand a path to main, which validates it is inside the vault
   (and a `.wav` for audio) before reading/revealing — the preload exposes the
   capability, main enforces the boundary.

> TODO(wiki): the exact `BrowserWindow` `webPreferences` (where `sandbox: true`,
> `contextIsolation: true`, `nodeIntegration: false` and the `preload` path are
> set) live in [[electron-main]]'s window-creation code, not in the preload
> itself — confirm against `ui/src/main/` when that page is deepened.
