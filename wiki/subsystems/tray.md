---
type: subsystem
title: Tray & tray popover
status: current
sources: [ADR-0001, ADR-0021, ui/src/main/tray.ts, ui/src/main/tray-popover.ts, ui/src/main/tray-preload.ts, ui/src/app/tray-popover.component.ts, ui/src/main/main.ts, ui/src/main.ts]
updated: 2026-06-05
tags: [ui, electron, menu-bar, tray, security]
---

The persistent macOS menu-bar surface: **HarkTray** derives its icon + native-menu
enablement from a `{capturing, ready, connected}` **TrayState**; a left-click opens a
frameless, token-styled **popover** (the same Angular bundle loaded with a `#tray`
hash → **TrayPopoverComponent**); and a second, minimal `window.harkTray` bridge
relays only a validated state *in* and a whitelisted action *out* — no engine port,
no prefs, no LLM access.

## Code map

*Grounded in the understand-anything graph (commit `8efdfde`, 2026-06-05, code-only).*

**Layer:** Electron Main Process + UI Renderer (Angular) — this slice spans both.

**Files:**

- `ui/src/main/tray.ts` — builds the macOS menu-bar tray icon and context menu, swapping template images between idle and recording states and dispatching tray actions (start/stop, show window, quit) to main-process callbacks.
- `ui/src/main/tray-popover.ts` — manages the borderless menu-bar tray popover BrowserWindow: lazy window creation, anchored positioning near the tray icon, show/hide/toggle, and pushing capture state to its renderer.
- `ui/src/app/tray-popover.component.ts` — standalone menu-bar popover component bootstrapped on the `#tray` URL hash; a dumb OnPush view fed entirely by the minimal `window.harkTray` IPC bridge that emits whitelisted action strings (start/stop/openMain/settings/quit) back to the main process.

**Key types & functions:**

- `HarkTray` (class, `tray.ts` Lx86–199) — owns the `Tray` instance: sets idle/recording template icons, rebuilds the context menu on state changes, and routes menu clicks to action / toggle-window / quit callbacks.
- `makeTemplateImage` (function, `tray.ts` Lx71–79) — builds a template `nativeImage` from base64 1x and 2x PNG payloads so the icon renders crisply and adapts to the menu-bar appearance.
- `TrayPopover` (class, `tray-popover.ts` Lx51–229) — encapsulates the popover window: lazily builds a borderless always-on-top `BrowserWindow`, computes a position anchored to the tray icon, and toggles/pushes state.
- `TrayPopoverComponent` (class, `tray-popover.component.ts` Lx400–448) — standalone OnPush popover component; subscribes to main's state pushes via `harkTray.onState`, mirrors the resolved theme onto `<html>`, and emits whitelisted actions through `harkTray.action`.

**Pinned by tests:** none in this slice.

**Connections:**

- ⇐ imports [[subsystems/electron-main|Electron main]] — `main.ts` imports `tray.ts` + `tray-popover.ts`.
- ⇐ calls [[subsystems/electron-main|Electron main]] — `createTray()` constructs `HarkTray` + `TrayPopover`.
- ⇐ imports [[subsystems/ui-shell|UI shell]] — `ui/src/main.ts` imports `tray-popover.component.ts` (forked on the `#tray` hash).

## What it does

Hark lives in the menu bar. Three pieces, all in the Electron shell ([[electron-main]]):

1. **`HarkTray`** (`ui/src/main/tray.ts`) — owns the single `Tray` instance. It holds
   a `TrayState` (`{ capturing, ready, connected }`) and re-derives two things from it
   on every push: the **icon** (idle vs. recording template glyph) and the **native
   fallback menu's** item enablement (Start Capture enabled only when
   `connected && ready && !capturing`; Stop Capture only when `capturing`).
2. **`TrayPopover`** (`ui/src/main/tray-popover.ts`) — owns a lazily-created,
   frameless, transparent, `alwaysOnTop`, `type: 'panel'` `BrowserWindow` that drops
   under the icon on a **left-click**. It loads the *same renderer bundle* as the main
   window but with a `#tray` URL hash, dismisses itself on `blur` (click-away) and
   after any action, and positions itself centered under the icon, clamped to the
   work area of the display the icon is on.
3. **`TrayPopoverComponent`** (`ui/src/app/tray-popover.component.ts`) — a **dumb
   Angular view** (the Claude-design `TrayMenu.jsx` artboard, v1 cut): a status pill
   (RECORDING pulses / IDLE static), one big Start↔Stop action button, Open / Settings
   / Quit rows, and an "Audio stays on this Mac." privacy footer. Token vars only
   (`--bg-2`, `--accent`, `--status-recording`, …), no hardcoded hex.

The native menu is deliberately **not** installed via `tray.setContextMenu()` — on
macOS that would make a left-click pop the native menu and fight the popover. Instead
`HarkTray` handles `'click'` (left) → `onLeftClick(bounds)` → popover toggle, and
`'right-click'` → `popUpContextMenu(this.menu)` as a fallback. There is **no "paused"
state** — pause is an engine stub, so the icon is binary idle/recording.

## Key files

| File | Role |
|---|---|
| `ui/src/main/tray.ts` | `HarkTray` — the `Tray`, the two embedded base64 template glyphs, the native fallback menu, `setState()` → icon + menu re-derivation. |
| `ui/src/main/tray-popover.ts` | `TrayPopover` — the frameless popover `BrowserWindow`, its hardened `webPreferences`, positioning, `toggle()` / `show()` / `hide()` / `pushState()`. |
| `ui/src/main/tray-preload.ts` | The minimal `window.harkTray` contextBridge surface — `onState` (validated in) + `action` (whitelisted out). |
| `ui/src/app/tray-popover.component.ts` | `TrayPopoverComponent` — the styled view; subscribes to `harkTray.onState`, emits via `harkTray.action`. |
| `ui/src/main/main.ts` | Wiring: `createTray()`, the `hark:tray:action` dispatch switch, the `hark:tray-state` ingest, `isTrayState` re-validation. |
| `ui/src/main.ts` | Renderer entry: forks on `window.location.hash === '#tray'` to bootstrap `TrayPopoverComponent` instead of `AppComponent`. |

### The two template glyphs

The icon is a TEMPLATE image (`setTemplateImage(true)`): macOS ignores its RGB and
recolors it from the alpha channel to match light/dark menu bars + selection state.
Hark's "Heard ripples" family — idle is a **hollow** source dot + ripples, recording
is a **filled** dot + ripples — 16px logical + 32px @2x for Retina. The glyphs are
**embedded as base64 PNGs** (rehydrated with `nativeImage.createFromBuffer`) rather
than loose `.png` files, because the main process is built with plain `tsc`
(`tsconfig.main.json`) and has **no asset-copy step**, so a loose `.png` would never
land in `dist/main`. To regenerate: re-encode the four tray PNGs (`base64 -i
tray/trayIdleTemplate.png`, etc.). See `ui/src/main/tray.ts` header.

## How state and actions flow

State is **one-directional, renderer → main → tray surfaces**. The renderer's
`EngineService` ([[engine-service]]) is the single source of truth for
capture/connection state; the tray is a *projection*, never an independent engine
client.

```
EngineService (main window)
  → window.hark.setTrayState({capturing, ready, connected})   [preload, ADR-0001]
  → ipc 'hark:tray-state'  →  main.ts isTrayState() re-validate
       ├─ tray.setState(s)          → icon + native-menu enablement
       └─ trayPopover.pushState(s)  → ipc 'hark:tray:state' (+ resolved theme)
            → tray-preload isTrayPopoverState() validate
            → harkTray.onState(cb)  → TrayPopoverComponent.state signal
```

Actions flow the other way, and **every** action is re-validated at the main boundary:

- **Native menu** (right-click) → `HarkTray.onAction('start' | 'stop' | 'settings')`
  → `main.ts` forwards over `hark:tray-action` to the main-window renderer.
- **Popover** (left-click) → `harkTray.action(name)` → whitelist-checked in the
  preload → ipc `hark:tray:action` → **re-validated again** in `main.ts`'s `switch`:
  - `start` / `stop` → forwarded to the renderer (capture lives in `EngineService`,
    reusing its persisted source/language selections).
  - `openMain` → `showMainWindow()` (handled in main; never forwarded).
  - `settings` → `showMainWindow()` **and** forward `'settings'` to ask the renderer
    to open its Settings modal.
  - `quit` → `quitApp()` (handled in main; never forwarded).
  - anything else → ignored. Every branch then `trayPopover?.hide()`s.

The `pushState` payload adds a resolved `theme: 'light' | 'dark'` (from
`nativeTheme.shouldUseDarkColors`) so the popover paints with the *same* tokens as the
main window without a second prefs read or a theme flash — the component mirrors it
onto `<html data-theme>`. The last state is **cached** in `TrayPopover.lastState` and
re-seeded on `did-finish-load` and before each `show()`, so a freshly-built popover
never flashes an empty/idle frame.

## How it connects to other subsystems

- **[[electron-main]]** — owns the `HarkTray` + `TrayPopover` instances
  (`createTray()`), spawns/positions the popover window, and is the dispatch point for
  `hark:tray:action` / `hark:tray-state`.
- **[[engine-service]]** — the renderer state authority; pushes `setTrayState(...)`
  via the main `window.hark` bridge. The tray reflects it and asks it (indirectly via
  `hark:tray-action`) to start/stop capture.
- **[[preload-security]]** — `tray-preload.ts` is a **second, narrower** contextBridge
  surface alongside the main `window.hark`. Same hardened posture
  (`contextIsolation` on, `nodeIntegration` off, `sandbox` on) but exposes *only*
  `harkTray.onState` + `harkTray.action`.
- **[[ui-shell]]** — the popover reuses the shell's *one bundle / one index.html /
  one strict CSP*; `ui/src/main.ts` forks on the `#tray` hash to bootstrap
  `TrayPopoverComponent` instead of `AppComponent`. The popover imports **no**
  `EngineService` — that would be a second engine connection.

## Governing ADRs

- **[ADR-0001](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0001-electron-over-tauri.md)** (Accepted) — Electron + Angular
  shell; mandates the hardened renderer posture (strict CSP, `contextIsolation` on,
  `nodeIntegration` off) the popover window + its preload inherit. See
  [[foundations]].
- **[ADR-0021](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0021-macos-app-packaging.md)** (Accepted) — macOS packaging.
  The popover loads the built `index.html` over `file://` under the strict CSP
  (`script-src 'self'`, no `'unsafe-inline'`), which is why all popover styles are
  inline component styles / token vars. Note ADR-0021 is **superseded for the
  signing/notarization slice by [ADR-0038]** — see [[packaging-distribution]]. The
  tray glyphs are part of the same "Heard ripples" icon work tracked there.

## Invariants

1. **The tray is a projection, never a source.** State only ever flows renderer →
   main → tray/popover. Neither tray surface holds authoritative capture state, and
   neither opens a WebSocket to harkd ([[engine-harkd]]).
2. **The popover bridge is minimal and validated both ways.** `window.harkTray`
   exposes *only* `onState` (shape-validated in the preload via `isTrayPopoverState`)
   and `action` (whitelist-checked in the preload **and** re-validated in `main.ts`).
   It has no engine port, prefs, vault, or LLM access — a compromised popover DOM
   cannot coerce main into an arbitrary action.
3. **`main.ts` re-validates everything at the boundary.** `isTrayState` gates
   `hark:tray-state`; the `switch` gates `hark:tray:action`. The contextBridge payload
   is untrusted structured-clone data even though the preload already filtered it.
4. **One bundle, one CSP.** The popover is the same renderer asset as the main window,
   selected by the `#tray` hash — token vars only, no remote anything, no hardcoded hex.
5. **Glyphs stay embedded.** They're base64-in-source because the `tsc`-only main
   build has no asset-copy step; a loose `.png` would silently not ship.
6. **No "paused" state and no global start/stop hotkey.** Pause is an engine stub
   (icon is binary idle/recording). The popover shows no `⌘⇧R` chip because no
   `globalShortcut` is registered — showing one would lie.

> TODO(wiki): the popover defers an elapsed-timer / meeting title, a Pause/Resume +
> Bookmark sub-grid, "Search transcripts", and a "Recent" meetings list — see the
> `TODO(tray)` markers in `ui/src/app/tray-popover.component.ts`. Re-add once the
> engine and the renderer→main state push can thread them through without churn.

See also: [[glossary]] (template image, squircle, `#tray` hash).
