---
type: subsystem
title: UI shell & main window
status: current
sources: [docs/design/11-ui-visual-brief.md, docs/analysis/04-user-journeys.md, "graph: UI Renderer (Angular)", docs/decisions/0024-onscreen-transcript-back-annotation.md]
updated: 2026-06-30
tags: [ui, angular, shell, transcript, panels]
---

# UI shell & main window

The Angular app shell that hosts every main-window surface, running in the locked-down
[[ui-renderer]] (`contextIsolation: true`, `nodeIntegration: false`, strict CSP — see
[[preload-security]]). `app.component.ts` is the orchestration root; it owns window-level state and
composes the panels below (graph layer "UI Renderer (Angular)").

## The main window (live transcript = primary screen)
The centerpiece is a three-column live-transcript view, canonical size 1100×700, resizable
(`docs/design/11-ui-visual-brief.md` §6 Screen 2):
- **Left (collapsible, 240px):** attendees / speaker sidebar with per-speaker color chips and manual
  tag UI — `attendees-panel.component.ts`.
- **Center (flexible):** the live transcript, latest line at the bottom, auto-scroll with manual
  override — `transcript-line.component.ts`. Each line is speaker name (colored smallcaps) +
  monospace timestamp + body text + optional translated line + optional wiki-linked term + pin.
- **Right (collapsible, 320px):** the Q&A / Ask panel, term cards, or off — `ask-panel.component.ts`.

A top bar carries the recording indicator (red pulse + elapsed time), pause, bookmark (⌘⇧B hint),
and settings cog; a `status-banner.component.ts` strip above the transcript shows warnings only when
active (`docs/design/11-ui-visual-brief.md` §6).

## Other surfaces
- **Summary / translate / post-meeting review:** `summary-panel.component.ts`,
  `translate-panel.component.ts`, `post-meeting-review.component.ts` — the post-stop flow
  (Summary | Action Items | Decisions | Open Questions | Full Transcript | Speakers tabs;
  `docs/design/11-ui-visual-brief.md` §6 Screen 4).
- **Speaker tagging:** `speaker-tagging.component.ts` plus `speaker-tag.component.ts` pills.

## Speaker back-annotation
During capture the transcript shows **no** speaker labels — diarization is offline. At stop the UI
**replaces** its live transcript wholesale with the engine's `meeting.transcript` frame, so every
line becomes attributed and matches the saved markdown; renames relabel + recolor lines live (`0024`,
see [[wire-protocol]]). A single `speakerColorFor(label)` mapping drives both transcript and
attendees colors (`0024`).

Hotkeys (⌘⇧R / ⌘⇧B / ⌘⇧Q / ⌘⇧S) are owned by [[electron-main]] and routed via [[tray]]. Visual
tokens come from the [[design-system]]; the streaming frames come over the [[wire-protocol]].
