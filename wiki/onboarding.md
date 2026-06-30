---
type: onboarding
title: New-contributor onboarding
status: current
sources: [wiki/overview.md, docs/design/06-architecture-overview.md, docs/analysis/04-user-journeys.md, docs/product/01-vision-and-personas.md]
updated: 2026-06-30
tags: [onboarding, contributor, getting-started, architecture]
---

# New-contributor onboarding

A 10-minute orientation for someone new to the Hark codebase.

## What Hark is
A **local-first, macOS-only meeting-transcription app with a built-in markdown second brain** — live
captions, translation, speaker diarization, and Claude-powered Q&A, all on the user's Mac with **no
cloud ASR** ([[overview]]). The one-line pitch: "a meeting tool you can actually trust with your work
calls — because every byte of audio stays on your Mac" (`docs/product/01-vision-and-personas.md`
§One-line pitch). The target user is a compliance-bound knowledge worker (banking/insurance/legal/
healthcare) for whom SaaS transcription is forbidden or risky (§The problem).

## The one invariant
**The Claude API edge is the only outbound channel** — it carries transcript text and vault excerpts,
**never audio**; everything else stays on the Mac (`docs/design/06-architecture-overview.md` §Trust
boundaries). Internalize this before touching anything network-adjacent — see [[local-first-egress]].

## The three processes
From the container view (`docs/design/06-architecture-overview.md`):
1. **Swift engine** (`harkd` sidecar) — audio capture, ASR (WhisperKit), VAD, diarization, and a
   Swift-NIO **WebSocket server**: [[streaming-daemon]] · [[audio-capture]].
2. **Electron + Angular UI** — all user surfaces in the renderer ([[ui-shell]], [[ui-renderer]],
   [[tray]]); the Electron **main** process owns every privileged edge — Keychain, network, FS,
   hotkeys ([[electron-main]]), reached only across the [[preload-security]] bridge.
3. **On-disk stores** — the git-backed **vault** of plain markdown ([[markdown-second-brain]]) plus
   `~/Library/Application Support/Hark/` (model cache, indexes, prefs).

The engine and UI talk over **one** localhost WebSocket — the [[wire-protocol]] — which is the first
thing to read to understand how a caption gets from microphone to screen.

## The main flow to trace
Follow Journey 2 (`docs/analysis/04-user-journeys.md`): click the tray → `capture.start` → engine
streams `segment.partial`/`segment.final` to the live transcript → stop → offline diarization →
`meeting.transcript` back-annotates speakers → vault write + git commit → "Summarize?" prompt. That
single path crosses every subsystem.

## Where to start reading
- [[overview]] and the glossary first.
- Then the [[wire-protocol]] (the contract both sides obey), then a side: [[streaming-daemon]] for the
  engine, [[ui-shell]] for the front end.
- For "why is it built this way," the decisions: [[swift-engine-sidecar]], [[ui-onboarding]],
  [[packaging-distribution]], [[translation]].

> Visual conventions live in the [[design-system]]; the feature→file map is `feature-map.md`.
