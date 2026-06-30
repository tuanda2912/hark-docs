---
type: overview
title: Hark — overview
status: current
sources: [docs/00-index.md, docs/design/06-architecture-overview.md]
updated: 2026-06-30
tags: [overview, architecture, local-first, privacy]
---

# Hark — overview

**Hark is a local-first, macOS-only meeting-transcription app with a built-in markdown second brain.** Live
captions, translation, speaker diarization, and Claude-powered Q&A — all on the user's Mac, **no cloud ASR**
(`docs/00-index.md`).

## Shape — three processes on one Mac
Per the container view in `docs/design/06-architecture-overview.md`:

- **Swift engine** (sidecar binary, `harkd`) — audio capture, ASR (WhisperKit large-v3-turbo), VAD (Silero/CoreML),
  diarization (FluidAudio), translation (NLLB-200), speaker matching, and a Swift-NIO **WebSocket server**.
  See [[audio-capture]] and [[streaming-daemon]].
- **Electron + Angular UI** — all user surfaces (tray, main window, Q&A panel, settings) in the renderer
  ([[ui-renderer]]); the Electron **main** process owns every sensitive edge — Keychain, network, FS, hotkeys,
  auto-update ([[electron-main]]).
- **On-disk stores** — the git-backed **vault** (`~/Documents/vault/hark`, transcripts + notes + speaker
  embeddings) and `~/Library/Application Support/Hark/` (model cache, SQLite term/RAG indexes, prefs); the
  Anthropic key lives in the macOS **Keychain** (`06-architecture-overview.md` §Data stores).

## The one rule everything serves
**The Claude API edge is the *only* outbound channel** — it carries transcript text and vault excerpts,
**never audio**; everything else stays on the Mac (`06-architecture-overview.md` §Trust boundaries). This is
the load-bearing invariant — see [[local-first-egress]].

## Key decisions
- A **separate Swift engine** (not in-process Node) for ANE real-time priority, crash isolation, and the
  per-binary ScreenCaptureKit permission model — see [[swift-engine-sidecar]].

> See [[glossary]] for terms, the per-subsystem pages for detail, and `feature-map.md` for feature→file traceability.
