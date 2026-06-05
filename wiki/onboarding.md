---
type: overview
title: Onboarding — a newcomer's guide to the Hark source
status: current
sources: [knowledge-graph.json (commit 8efdfde), CLAUDE.md, STATUS.md, ADR-0008, ADR-0009, ADR-0029]
updated: 2026-06-05
tags: [onboarding, overview, architecture, map]
---

# Onboarding — a newcomer's guide to the Hark source

A reading path for someone opening the Hark codebase for the first time. Generated from
the `understand-anything` knowledge graph (280 nodes / 445 edges / 7 layers / 12-step
tour; `hark/.understand-anything/knowledge-graph.json`, commit `8efdfde`, **code-only**
scope) and woven into this wiki. The *why* behind every choice lives in the ADRs; each
subsystem linked below has a verified `## Code map`.

> **Two copies, one source.** A plain contributor copy lives in the code repo at
> [`docs/ONBOARDING.md`](https://github.com/tuanda2912/hark/blob/main/docs/ONBOARDING.md);
> this is the wiki-integrated version. Start at [[overview]] for the evergreen map, or
> `STATUS.md` for the live snapshot.

## What Hark is

A **local-first, macOS-only** meeting-transcription app: live captions, on-demand
translation, and offline speaker diarization with **WhisperKit** on-device ASR, writing
markdown notes to a user-owned vault — no cloud STT, no account, no telemetry. It is
**two runtimes in one repo**: a Swift sidecar daemon (`harkd`) under `engine/`, and an
Electron + Angular 21 shell under `ui/` that spawns and drives it over a loopback
WebSocket. See [[local-first-guarantee]] and [[threat-model]].

- **Languages:** Swift, TypeScript (+ HTML/CSS/JS, Python, Shell, YAML/JSON)
- **Frameworks:** Angular 21, Electron, Tailwind, RxJS · SwiftPM, WhisperKit, Swift NIO, FluidAudio
- **Platform:** macOS 14.4+, Apple Silicon only

## Architecture layers

The graph groups 127 source files into **7 layers** (full table in [[overview]]):

1. **Engine Core & Audio Capture** — [[audio-capture]], engine shell in [[engine-harkd]], `ModelLoader` in [[whisperkit-asr]].
2. **Streaming Daemon & Transcription** — [[engine-harkd]], [[whisperkit-asr]], [[vad]], [[wire-protocol]] (Swift), [[diarization]], [[speaker-enrollment]], [[vault-writer]], [[audio-store]], [[rag]].
3. **Engine Tests** — XCTest suites pinning the above (see each page's *Pinned by tests*).
4. **UI Renderer (Angular)** — [[ui-shell]], [[engine-service]], [[llm-service]], [[retrieval-service]], [[wire-protocol]] (TS mirror).
5. **Electron Main Process** — [[electron-main]], [[preload-security]], [[tray]].
6. **Privacy & LLM Egress** — [[llm-egress]], [[external-rag-client]].
7. **Build & Configuration** — SwiftPM manifest, CoreML/sign scripts, Angular/TS/electron-builder configs (see [[packaging-distribution]]).

> The graph doesn't resolve Swift *module imports*, so engine cross-file wiring is captured
> as `depends_on`/`calls`/`implements`, not `imports`.

## Key concepts

- **Two processes, one trust boundary** — a separate signed Swift binary; the real
  isolation seam is the loopback WS contract ([[wire-protocol]], ADR-0008).
- **The port handshake** — `harkd` binds its WS server and writes its port *before* the
  heavy model load, so the UI shows a loading state instead of timing out
  ([[electron-main]] ↔ [[engine-harkd]]).
- **Streaming finalization** — `utterance_id` reconciliation + region-based commit-once
  turn a re-transcribed window into stable text ([[streaming-finalization]], ADR-0009/0019/0036).
- **Egress governance** — one chokepoint in Electron main: redact → send → metadata-only
  receipt; renderer never networks, never reads the key back ([[egress-governance]], [[llm-egress]]).
- **Opt-in, default-off** — keep-audio + remember-speakers do zero I/O when off ([[privacy-data-control]]).
- **The vault is sacred** — one writer, append/merge only, git-committed ([[vault-writer]]).
- **Pluggable retrieval** — built-in on-device index or an external loopback service ([[pluggable-retrieval]]).

## Guided tour (the runtime of one meeting)

1. **App launch** → [[electron-main]] (`main.ts`) — the conductor.
2. **Spawn the engine** → [[electron-main]] (`harkd-spawn.ts`, `port-file.ts`).
3. **The harkd daemon** → [[engine-harkd]] / [[wire-protocol]] (`HarkdCommand.swift`, `WebSocketServer.swift`).
4. **Engine build map** → `engine/Package.swift` (4 executables + pinned deps; see [[packaging-distribution]]).
5. **Capture & mix audio** → [[audio-capture]] (`CapturePipeline`, `SystemAudioTap`, `Mixer`, `PermissionGate`).
6. **Load WhisperKit** → [[whisperkit-asr]] (`ModelLoader.swift`, `HarkPaths.swift`).
7. **Transcription: VAD, window, finalize** → [[engine-harkd]] + [[vad]] + [[whisperkit-asr]] (`EngineSession`, `SlidingWindow`).
8. **The wire protocol** → [[wire-protocol]] (`WireProtocol.swift` ↔ `engine.types.ts`).
9. **Live captions** → [[engine-service]] + [[ui-shell]] (`EngineService`, `AppComponent`, `transcript-line`).
10. **On stop: diarize, save, enroll** → [[diarization]], [[vault-writer]], [[speaker-enrollment]].
11. **The only network egress** → [[llm-egress]] + [[external-rag-client]] (`llm/index.ts`, `redaction.ts`, `rag/loopback.ts`).
12. **Packaging** → [[packaging-distribution]] (`ui/electron-builder.yml`).

## Complexity hotspots (approach carefully)

48 files are rated `complex`; the ones a newcomer should read slowly:

- **`EngineSession.swift`** ([[engine-harkd]]) — the actor that owns *everything*.
- **`SlidingWindow.swift`** ([[whisperkit-asr]], [[streaming-finalization]]) — subtle identity math; pinned by `UtteranceLedgerTests` / `CommitWatermarkTests` / `DedupTests`.
- **`CapturePipeline` + `SystemAudioTap` + `CoreAudioProcessTap`** ([[audio-capture]]) — TCC, CFRunLoop, aggregate devices, the no-op video-stream trick.
- **`WireProtocol.swift` ↔ `engine.types.ts`** ([[wire-protocol]]) — the two-sided contract; change one, change both.
- **`RagIndex` / `RagIndexer` / `TextEmbedder`** ([[rag]]) — actor concurrency + offset-only persistence + FSEvents gating.
- **`main.ts`, `prefs.ts`, `preload.ts`** ([[electron-main]], [[preload-security]]) — the IPC trust boundary.
- **`llm/index.ts` + `rag/mcp.ts`** ([[llm-egress]], [[external-rag-client]]) — the egress chokepoint + hand-rolled MCP client.
- **`app.component.ts`** ([[ui-shell]]) — the ~976-line renderer orchestrator.

## Go deeper

- [[overview]] — the evergreen subsystem map + invariants.
- [[glossary]] — RTF, `utterance_id`, template image, squircle, …
- Decision digests: [[foundations]], [[streaming-finalization-decisions]], [[privacy-egress]], [[vault-rag-decisions]], [[packaging-distribution]].
- Interactive: run `/understand-anything:understand-dashboard` to explore the graph (layers, tour, hubs) visually.
