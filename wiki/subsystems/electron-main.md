---
type: subsystem
title: Electron main — lifecycle, harkd spawn & port handshake
status: current
sources: [ADR-0001, ADR-0008, ADR-0011, ADR-0012, ADR-0014, ADR-0027, ADR-0028, ADR-0038, ui/src/main/main.ts, ui/src/main/harkd-spawn.ts, ui/src/main/port-file.ts, ui/src/main/prefs.ts]
updated: 2026-06-05
tags: [ui, electron, lifecycle, ipc, security]
---

The Electron **main process** orchestrates the app and is the **IPC trust boundary**:
it spawns the `harkd` sidecar, discovers its loopback WebSocket via the `engine.port`
handshake (poll the JSON `{port, pid, version}` file with a **180 s** timeout to absorb
a cold ANE compile), opens the hardened main window + tray, and **gates every
privileged IPC** the sandboxed renderer can't do for itself — prefs, vault-confined
file reveal/read, and the mic-permission status/prompt.

## Code map

*Grounded in the understand-anything graph (commit 8efdfde, 2026-06-05, code-only).*

**Layer:** Electron Main Process.

**Files:**

- `ui/src/main/main.ts` — Electron main-process entry point: bootstraps the app, ensures the vault directory, spawns harkd, creates the main BrowserWindow and the menu-bar tray, and wires the IPC handlers that bridge the renderer to prefs, the LLM layer, and RAG retrieval.
- `ui/src/main/harkd-spawn.ts` — Spawns and supervises the harkd Swift sidecar child process, resolving the signed binary path and waiting on the port file before reporting readiness.
- `ui/src/main/port-file.ts` — Reads and polls the harkd port file (the sidecar writes its listening port as JSON), exposing a path resolver and an await-with-timeout helper used during engine startup.
- `ui/src/main/prefs.ts` — Loads, sanitizes, and atomically persists user preferences (theme, privacy flags, window bounds, LLM and RAG backend config) to the app-support directory, with defensive validation of every untrusted field.

**Key types & functions:**

- `bootstrap` (`main.ts` L361–374) — startup sequence: ensure vault dir → spawn harkd → create window + tray.
- `createWindow` (`main.ts` L211–306) — constructs the secure-preload BrowserWindow, restores bounds, loads the renderer, registers tray-state/geometry listeners.
- `resolveInitialBounds` (`main.ts` L92–120) — returns persisted bounds only if still on a connected display, else defaults.
- `isRectOnSomeDisplay` (`main.ts` L125–137) — checks a stored rect still overlaps an attached display.
- `createTray` (`main.ts` L314–329) — instantiates the menu-bar tray + popover, wiring actions back into window/renderer messaging.
- `spawnHarkd` (`harkd-spawn.ts` L63–125) — launches harkd, races startup against early-exit/port-file timeout, returns a handle with the resolved port and a graceful stop.
- `resolveBinaryPath` (`harkd-spawn.ts` L32–60) — probes packaged-app and dev candidate paths, returns the first existing on disk.
- `waitForPortFile` (`port-file.ts` L49–70) — polls for the port file until it appears and parses, else rejects after timeout.
- `readPortFile` (`port-file.ts` L26–40) — reads + JSON-parses the port file, returns the port or null if missing/malformed.
- `loadPrefs` (`prefs.ts` L171–191) — reads, parses, and sanitizes the prefs file, falling back to defaults on missing/corrupt.
- `savePrefs` (`prefs.ts` L211–266) — merges a partial patch over current prefs, sanitizes, writes atomically via temp file + rename.
- `sanitize` (`prefs.ts` L280–346) — top-level sanitizer coercing each section (theme, privacy, window, LLM, RAG) through its validator, dropping unknown/invalid fields.
- `sanitizeWindow` (`prefs.ts` L428–443) — accepts only finite positive dimensions and finite coordinates.
- `sanitizeRag` (`prefs.ts` L356–375) — normalizes transport, trimmed endpoint, and tool name for an external retrieval backend.

**Pinned by tests:** none in this slice.

**Connections:**

- imports → [[subsystems/tray|Tray & popover]]
- calls → [[subsystems/tray|Tray & popover]]
- imports → [[subsystems/llm-egress|LLM egress]]
- imports → [[subsystems/external-rag-client|External RAG client]]
- ⇐ imports [[subsystems/preload-security|Preload security]]
- ⇐ imports [[subsystems/llm-egress|LLM egress]]
- ⇐ imports [[subsystems/external-rag-client|External RAG client]]
- ⇐ calls [[subsystems/external-rag-client|External RAG client]]

## What it does

Hark is Electron + Angular 21 (ADR-0001) with the ASR engine as a *separate* Swift
binary (`harkd`) talking over localhost WebSocket. The main process is the Node-side
host that ties those two together and brokers everything the Chromium renderer is
sandboxed out of:

1. **Process lifecycle** — on `app.whenReady()` it spawns `harkd`, opens the window,
   creates the tray; on `before-quit` it tears `harkd` down (SIGTERM → 5 s → SIGKILL)
   and drops the tray/popover.
2. **Engine discovery** — spawns `harkd`, waits for the `engine.port` file, and exposes
   the discovered port to the renderer over IPC (`hark:get-engine-port`). The renderer's
   [[engine-service]] then opens the WebSocket itself ([[wire-protocol]]).
3. **The IPC trust boundary** — because the renderer runs with `contextIsolation`,
   `sandbox`, and `nodeIntegration: false` (ADR-0001), it cannot touch the filesystem,
   spawn processes, or call native macOS APIs. Every privileged operation crosses the
   `contextBridge` ([[preload-security]]) as **untrusted structured-clone data** and is
   re-validated here before main acts on it.

Entry point: `ui/src/main/main.ts`.

## Key files

| File | Role |
|---|---|
| `ui/src/main/main.ts` | App lifecycle, window + tray creation, **all `ipcMain` handlers** (the trust boundary). |
| `ui/src/main/harkd-spawn.ts` | Owns the `harkd` child: resolve binary path (dev vs packaged), `spawn`, race port-file-ready against early-exit, SIGTERM/SIGKILL shutdown. |
| `ui/src/main/port-file.ts` | Reads + polls `~/Library/Application Support/Hark/engine.port`; parses + type-validates the `{port, pid, version}` JSON. |
| `ui/src/main/prefs.ts` | Hand-rolled versioned `prefs.json` reader/writer (ADR-0014): `loadPrefs` (never throws), `savePrefs` (merge + sanitize + atomic temp-rename). |

## Lifecycle (spawn → window → quit)

`bootstrap()` (`main.ts`) runs on `app.whenReady()`:

```
ready  → ensureVaultDir() → spawnHarkd() → createWindow() → createTray()
window → ng serve :4200 (dev)  |  dist/renderer/browser/index.html (prod)
quit   → before-quit: flush prefs, SIGTERM harkd (≤5 s) else SIGKILL, drop tray
```

- **Spawn never hard-blocks boot.** If `spawnHarkd()` throws, the error is logged and
  the window opens anyway in an error state — the renderer surfaces it via
  `EngineService.connection.kind === 'error'` ([[engine-service]]).
- **Hide-on-close, not destroy.** The red traffic-light / ⌘W *hides* the window; the
  [[tray]] is the app's persistent home. Only a real quit (tray "Quit Hark" or ⌘Q,
  routed through `quitApp()` which flips `isQuitting`) lets the window close and tears
  down the WebSocket with it.
- **`backgroundThrottling: false`** so a hidden (tray-tucked) window keeps processing
  WebSocket segments, the per-second REC counter, and the tray-state push — a
  live-transcription app must keep working while its window is away.
- **Window bounds persistence** — resize/move are debounced (400 ms) into a
  `savePrefs({ window })`; only *normal* (non-maximized/-fullscreen) bounds are saved,
  and `resolveInitialBounds()` re-validates a saved rect against the **live** display
  layout (`isRectOnSomeDisplay`, ≥64 px overlap) so an unplugged monitor can't strand
  the window off-screen.

## harkd spawn + the engine.port handshake

This is the heart of the page. The engine is a sidecar; the main process is the only
thing that knows where it is.

### Spawn (`harkd-spawn.ts`)

1. **Resolve the binary.** Packaged: `process.resourcesPath/engine/harkd` (electron-builder
   `extraResources`, ADR-0021/ADR-0038). Dev: `<repo>/engine/.build/release/harkd`
   (resolved relative to `app.getAppPath()`, with a `process.cwd()` fallback), checked
   `X_OK`. Missing → a throw whose message tells you to `swift build -c release`.
2. **`spawn(binary, [], { stdio: ['ignore', 'inherit', 'inherit'] })`** — harkd's
   stdout/stderr stream straight into main's, so engine logs appear in the Electron
   console. No args; harkd defaults its own config.
3. **Race readiness against early death.** `Promise.race` of `waitForPortFile()` vs the
   `exit` promise: if harkd dies before writing the port file, the race rejects with
   `harkd exited before writing port file (code=…)` and the child is SIGTERM'd. The
   port file is matched **by `pid`** (`expectedPid: child.pid`) so a *stale* port file
   from a previous harkd can't be mistaken for this run's.

### The port file (`port-file.ts`, ADR-0008 §1)

`engine.port` is the **canonical port-discovery channel** between UI and engine
(ADR-0008 §1). ADR-0008 open-question #2 leaned toward **JSON over a bare integer** for
forward-compat, and that's what shipped — so it is **JSON, not a bare port number**:

```json
{ "port": 50713, "pid": 53124, "version": "0.3.0" }
```

- Location: `~/Library/Application Support/Hark/engine.port` (the sanctioned app-data
  dir, CLAUDE.md rule #2 — **never** the vault). `harkd` writes it; main reads it.
- `readPortFile()` parses and **type-validates** all three fields (`port`/`pid` numbers,
  `version` string) — a half-written or malformed file throws and the poller keeps
  waiting.
- `waitForPortFile()` polls every **250 ms** up to a **180 000 ms (180 s) timeout**,
  returning only when a readable file's `pid` matches the spawned child's. The generous
  timeout exists for one reason: on an **M1 cold start, harkd can take 90 s+** to
  compile WhisperKit's `mlmodelc` bundles to the ANE before it serves (see
  [[whisperkit-asr]], STATUS open thread #15). ADR-0012 made harkd write the port file
  *before* the model load so the UI is discoverable immediately — but the very first
  ANE compile still gates a usable port, hence the deliberately long ceiling.

> The "serve before the model is ready" contract (ADR-0012) means a port arriving does
> **not** mean transcription is ready: an early `capture.start` is rejected with a
> recoverable `ENGINE_WARMING_UP` error, and the engine pushes `meta.ready` when the
> model attaches (see [[engine-harkd]], [[wire-protocol]]).

### Exposing the port

Once ready, `spawnHarkd()` resolves a `HarkdHandle` (`{ port, pid, engineVersion,
child, stop() }`). The renderer pulls the port via `ipcMain.handle('hark:get-engine-port')`
(throws if harkd never started) and connects the WebSocket itself — main never proxies
the socket traffic, only the *port number*. The wire contract is owned by
[[wire-protocol]]; the renderer client is [[engine-service]].

### Shutdown

`HarkdHandle.stop()` sends SIGTERM, waits `SHUTDOWN_GRACE_MS` (5 s) for a clean exit,
then SIGKILL. `before-quit` calls it (and `preventDefault`s the quit until it
resolves), flushes window bounds, commits any pending live-translation cloud-log
roll-up, and destroys the tray + popover.

## The IPC trust boundary

The renderer is sandboxed; **every privileged action is an `ipcMain` handler in
`main.ts`**, and each treats its payload as untrusted. The surfaces:

| IPC channel | Kind | What main does | Guard |
|---|---|---|---|
| `hark:get-engine-port` | handle | return the discovered port | throws if harkd not started |
| `hark:load-prefs` / `hark:save-prefs` | handle / on | read/merge-write `prefs.json` + return `vaultPath` | `savePrefs` whitelists + sanitizes keys before write (in `prefs.ts`) |
| `hark:reveal-vault` | on | open the vault root in Finder | path is the **fixed** `VAULT_DIR` (renderer can't pass one) |
| `hark:reveal-path` | on | reveal a **specific** vault file in Finder | `path.resolve` + `path.relative` descendant-of-vault check; reveal-only |
| `hark:read-meeting-audio` | handle | read `vault/.audio/<id>.wav` bytes for playback | same vault-descendant check + **`.wav`-only** + read-only (ADR-0028) |
| `hark:get-mic-permission` / `hark:ask-mic-permission` | handle | read TCC mic status / fire the OS prompt | `systemPreferences` only; system-audio TCC is *not* exposed here |
| `hark:tray-state` / `hark:tray:action` | on | mirror renderer state into the tray; dispatch validated tray actions | shape-validated; action re-checked against a whitelist |
| `hark:llm:*`, `hark:rag:*` | handle / on | LLM egress + external retrieval | owned by separate modules — see [[llm-egress]], [[external-rag-client]] |

Three of these are the security-load-bearing ones for this subsystem:

- **Vault-confined file access (CLAUDE.md rules #2/#4, ADR-0028).** `hark:reveal-path`
  and `hark:read-meeting-audio` both take an **untrusted path** and apply the canonical
  "is X inside Y" check: `path.resolve(raw)`, then `path.relative(VAULT_DIR, resolved)`
  must be non-empty, not start with `..`, and not be absolute. This is immune to the
  `/vault-evil` sibling-prefix trap a naive `startsWith(VAULT_DIR)` would fall for. The
  audio read additionally rejects non-`.wav` and is strictly read-only — it can never
  write, rename, or delete inside the **sacred vault**. Rejections throw a deliberately
  generic message so a probe can't map the filesystem. `VAULT_DIR` is fixed
  (`~/Documents/vault/hark`), constructed from `os.homedir()`.

- **Mic permission (ADR-0011/0012).** `getMediaAccessStatus('microphone')` and
  `askForMediaAccess('microphone')` back the onboarding Permissions screen. System-audio
  capture uses Core Audio **Process Taps** (`kTCCServiceAudioCapture`), for which
  Electron exposes *no* API and which macOS only prompts for at first capture — so main
  deliberately exposes **no** "grant system audio" affordance; onboarding frames it as
  "macOS will ask when you start your first recording." See [[audio-capture]].

- **Prefs (ADR-0014).** The renderer's `audio` + `hasCompletedOnboarding` + `privacy`
  (ADR-0027) toggles and main's `window` bounds are *independent writers* of one file,
  so `savePrefs` does load → overlay only the present whitelisted keys → `sanitize` →
  atomic temp-rename. `sanitize()` rebuilds field-by-field from `DEFAULT_PREFS`, so a
  buggy/hostile payload can only ever set whitelisted keys to type-correct values. The
  file is **config only** — never transcripts, audio, or PII (ADR-0014) — and lives at
  `app.getPath('appData')/Hark/prefs.json` (explicitly **not** `userData`, which would
  misresolve to `.../Electron` in dev or `.../hark-ui` packaged).

> The privacy gates (`keepAudio`, `rememberSpeakers`, …) default **false** here and a
> *missing* block sanitizes to all-false, so the privacy-safe state is the implicit one
> (ADR-0027). The renderer forwards them into `capture.start` ([[wire-protocol]]); the
> engine enforces them ([[engine-harkd]], [[privacy-data-control]]).

## How it connects to other subsystems

- **[[engine-harkd]]** — the child process this spawns; writes `engine.port`, serves
  the WebSocket, and (ADR-0012) serves *before* the model is ready.
- **[[wire-protocol]]** — the JSON-frame contract the renderer speaks over the
  discovered port. Main only hands over the port number; it never touches the socket.
- **[[engine-service]]** — the renderer-side WebSocket client that calls
  `hark:get-engine-port` and connects.
- **[[preload-security]]** — the `contextBridge` that exposes exactly these IPC channels
  to the renderer; this page is the *main* half of that boundary.
- **[[tray]]** — created here; receives mirrored capture state and dispatches whitelisted
  tray actions back through main.
- **[[ui-shell]]** — the Angular renderer hosted in the window main opens.
- **[[llm-egress]]** / **[[external-rag-client]]** — the `hark:llm:*` / `hark:rag:*`
  handlers live in `main.ts` but delegate to the `llm` / `rag` modules; main is the
  egress chokepoint, not the policy owner.
- **[[audio-capture]]** — main brokers the mic-permission prompt; system-audio TCC is
  out of its reach by design.

## Governing ADRs

- **[ADR-0001](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0001-electron-over-tauri.md)** (Accepted) — Electron +
  Angular over Tauri/SwiftUI; mandates the hardened renderer (CSP, no remote content,
  `contextIsolation` on, `nodeIntegration` off) this process enforces. Digest:
  [[foundations]].
- **[ADR-0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md)** (Accepted) — names
  `harkd`, defines `engine.port` as the discovery channel, and (open-Q #2) leaned JSON →
  the `{port, pid, version}` shape this poller parses. Digest:
  [[streaming-finalization-decisions]].
- **[ADR-0011](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0011-process-tap-system-audio-gotchas.md)** (Accepted) —
  system audio via Core Audio Process Taps (`kTCCServiceAudioCapture`); the reason main
  exposes no system-audio grant. Digest: [[capture-audio]].
- **[ADR-0012](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0012-harkd-lazy-permissions-startup.md)** (Accepted) — harkd
  writes the port file **before** loading the model and acquires permissions lazily at
  `capture.start`; the basis for the long port-file timeout + `ENGINE_WARMING_UP`.
- **[ADR-0014](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0014-ui-preferences-persistence.md)** (Accepted) — the
  hand-rolled `prefs.json` in `~/Library/Application Support/Hark/` (no `electron-store`).
  Digest: [[ui-onboarding]].
- **[ADR-0027](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0027-privacy-data-control-model.md)** (Accepted) — the
  privacy flags persisted (all default off) and plumbed into `capture.start`. Digest:
  [[privacy-egress]]; concept: [[privacy-data-control]].
- **[ADR-0028](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0028-meeting-audio-persistence.md)** (Accepted) — opt-in
  meeting audio at `vault/.audio/<id>.wav`; the read path behind `hark:read-meeting-audio`.
  See [[audio-store]].
- **[ADR-0038](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0038-notarization-signing-chain.md)** (Accepted, amends
  [ADR-0021](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0021-macos-app-packaging.md)) — signs the spawned `harkd` with
  inherit entitlements so its TCC audio grant attributes to **Hark**; ties the prod spawn
  path `process.resourcesPath/engine/harkd` to the bundle layout. Digest:
  [[packaging-distribution]].

## Invariants (must stay true)

1. **`engine.port` is JSON, never a bare integer.** `{port, pid, version}`, all
   type-validated; `pid` must match the spawned child (defeats stale port files). This
   is a footgun for anyone hand-connecting — see the `smoke-harkd` skill.
2. **App data only in `~/Library/Application Support/Hark/`; never the vault.**
   `prefs.json`, `engine.port`, keystore, cloud-log all live there. Prefs hold **config
   only** — no transcripts, audio, or PII (CLAUDE.md rule #2, ADR-0014).
3. **Every renderer-supplied path is canonicalized + confined to the vault before use,
   and file access is read/reveal-only.** `path.resolve` + `path.relative` descendant
   check; `.wav`-only for audio reads; main never writes/renames/deletes in the vault
   (CLAUDE.md rules #2/#4, ADR-0028).
4. **The renderer stays sandboxed.** `contextIsolation: true`, `sandbox: true`,
   `nodeIntegration: false`, `webSecurity: true`, no remote content
   (`setWindowOpenHandler` → `openExternal`), DevTools off when packaged (ADR-0001).
5. **No system-audio TCC API is exposed to the renderer.** Process-Tap permission is
   acquired by `harkd` at first capture (ADR-0011/0012); main only brokers the mic
   prompt.
6. **harkd is always reaped on quit.** SIGTERM → 5 s grace → SIGKILL; the spawn path
   matches its in-bundle location in lockstep with electron-builder (ADR-0038) so the
   prod binary is found, signed, and inherits Hark's identity.
7. **Spawn failure degrades, never crashes.** A missing/dying harkd opens the window in
   an error state rather than blocking boot.

## See also

[[engine-harkd]] · [[wire-protocol]] · [[engine-service]] · [[preload-security]] ·
[[tray]] · [[threat-model]] · [[foundations]] · [[packaging-distribution]] · [[glossary]]
