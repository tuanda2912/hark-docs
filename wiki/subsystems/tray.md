---
type: subsystem
title: Tray menu & global hotkeys
status: current
sources: [docs/design/11-ui-visual-brief.md, docs/analysis/05-user-stories.md, "graph: Electron Main Process", docs/decisions/0023-first-run-onboarding-flow.md]
updated: 2026-06-30
tags: [tray, menu-bar, hotkeys, electron, main]
---

# Tray menu & global hotkeys

The menu-bar surface — the fastest path into a recording without context-switching to a separate
app (`docs/analysis/05-user-stories.md` HARK-A-1). It lives in the [[electron-main]] process because
the tray, its popover window, and global shortcuts are all privileged macOS edges.

## Files (graph layer "Electron Main Process")
- `ui/src/main/tray.ts` — the menu-bar icon + its lifecycle; reflects recording state (idle /
  recording with elapsed time / paused) and pulses a red dot while capturing.
- `ui/src/main/tray-popover.ts` — the compact popover window (~280px wide) shown from the icon.
- `ui/src/main/tray-preload.ts` — the locked-down `contextBridge` for the popover's renderer
  (same security posture as [[preload-security]]).

The popover renderer is `ui/src/app/tray-popover.component.ts` in the [[ui-renderer]].

## Layout (compact, every item < 32px)
Top: recording state. One big button: **Start recording** / **Stop** (color reflects state).
Below: Pause, Bookmark moment. Then: Open main window, Recent meetings (last 3). Footer: Settings,
Quit (`docs/design/11-ui-visual-brief.md` §6 Screen 1). Tone follows the [[design-system]] — Mac-native,
compact, no marketing chrome.

## Behaviour
- Click the icon → pick **Start recording** → capture begins within 500ms and the icon turns red;
  **Stop** ends capture, auto-saves to the vault, and the icon returns to default
  (`docs/analysis/05-user-stories.md` HARK-A-1). These commands cross the [[wire-protocol]] as
  `capture.start` / `capture.stop`.

## Global hotkeys — caveat
The design and journeys describe global shortcuts — ⌘⇧R start, ⌘⇧B bookmark, ⌘⇧S stop, ⌘⇧Q Q&A
(`docs/analysis/04-user-journeys.md` Journey 1 step 8; `docs/design/11-ui-visual-brief.md` §6). **However,
global hotkeys are not yet built:** the onboarding flow deliberately dropped the Accessibility /
global-hotkeys permission card because "global hotkeys aren't built, so showing it would be
dishonest" (`0023`). Treat the ⌘⇧ shortcuts as design intent / in-window hints until that lands.

> TODO: confirm whether any hotkeys are wired in-window (non-global) in the current build.
