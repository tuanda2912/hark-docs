---
type: overview
title: Hark — Overview & Subsystem Map
status: current
sources: [CLAUDE.md, STATUS.md, meetingmind-handoff.md, ADR-0002, ADR-0003, ADR-0008, ADR-0010]
updated: 2026-06-05
tags: [overview, architecture, map]
---

# Hark — Overview & Subsystem Map

Hark is a **local-first, macOS-only** meeting transcription app. A Swift sidecar
(`harkd`) does on-device ASR, diarization, and vault RAG; an Electron + Angular
shell drives it over a **loopback WebSocket**. The *only* content egress is an
explicit, user-invoked LLM edge. Privacy and trust ARE the product (`CLAUDE.md`).

> Resuming a session? `STATUS.md` is the live snapshot; this page is the
> evergreen map. ADRs in `../decisions/` are the source of truth — wiki pages
> digest and link them, never contradict them.

## What Hark is

- **Live captions + post-stop translation, diarization, and a markdown
  second-brain** — all on the user's Mac, no cloud ASR ([ADR-0002](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0002-macos-only-scope.md),
  [ADR-0003](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0003-swift-whisperkit-engine.md)). See
  [[markdown-second-brain]].
- **macOS-only, Apple Silicon** — Windows/Linux/iOS/Android are out of scope, not
  deferred ([ADR-0002](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0002-macos-only-scope.md)). Intel Macs are
  refused at install.
- **Two processes, one trust boundary.** The engine is a separate signed Swift
  binary so a crash can't take the UI down and so capture permission attaches to a
  stable binary, not Electron ([ADR-0003](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0003-swift-whisperkit-engine.md)).
  The real isolation seam is engine ↔ UI — the loopback WS contract ([ADR-0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md)).

## Where the project is (2026-06-05)

Phase 0–6 shipped; **Phase 7 (packaging / notarization) in progress (~60%)**.
Live ASR, offline diarization, speaker enrollment, opt-in audio persistence,
provider-agnostic LLM, pluggable vault RAG, and on-demand post-stop translation
are all done. Notarization is blocked on a paid Developer ID. See `STATUS.md` for
the live state and [[packaging-distribution]].

## End-to-end flow (one meeting)

```
mic + system audio  ──capture──▶  VAD gate  ──30s/5s window──▶  WhisperKit (ANE)
   [[audio-capture]]   [[vad]]      [[whisperkit-asr]]/[[streaming-finalization]]
        │                                                              │
        │                                              segment.partial/.final
        │                                                              ▼
        └──(WAV, opt-in)──▶ [[audio-store]]            [[wire-protocol]] (loopback WS)
                                                                       │
   on STOP:  offline [[diarization]] ─▶ [[vault-writer]] (markdown + per-meeting git)
             ▲ speaker match against [[speaker-enrollment]]            │
             │                                                         ▼
   user-invoked: summary · Q&A · translation · vault search ──▶ [[ui-shell]]
             │                                          [[engine-service]] (WS client)
   [[rag]] (built-in) or [[external-rag-client]] retrieve ─▶ redacted top-K + question
             │                                                         │
             └──────────── only here does content leave ──▶ [[llm-egress]]
                                            (cloud: redacted + logged · local: zero)
```

The **only** path content leaves the machine is the explicit LLM edge — and only
when the user invokes summary, Q&A, or high-quality translation, and only if they
chose a *cloud* provider. A local (loopback) model means zero egress. The engine
itself is network-free. See [[egress-governance]] and [[threat-model]].

## Subsystem map

### Engine — `harkd` (Swift, `engine/Sources/Harkd/`)
A single long-lived executable that imports `HarkCapture` + `HarkCore` and runs
the whole pipeline in-process — no IPC inside the engine ([ADR-0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md) §2).
Swift NIO serves a loopback WebSocket on an ephemeral port written to
`~/Library/Application Support/Hark/engine.port` ([ADR-0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md) §1).

- [[engine-harkd]] — the daemon, `EngineSession.swift`, lifecycle, port handshake.
- [[whisperkit-asr]] — `SlidingWindow.swift`, WhisperKit large-v3-turbo on the ANE.
- [[vad]] — `VAD.swift`, energy-based gate behind a protocol (Silero is the planned upgrade).
- [[audio-capture]] — Process Taps / ScreenCaptureKit + mic, 16 kHz mono.
- [[wire-protocol]] — `WireProtocol.swift` + `WebSocketServer.swift`, the JSON frame contract.
- [[diarization]] — `Diarizer.swift` / `DiarizerLoader.swift`, offline FluidAudio at stop.
- [[speaker-enrollment]] — `SpeakerEnrollment.swift`, local-only voiceprints in `vault/.speakers/`.
- [[vault-writer]] — `VaultWriter.swift`, markdown + per-meeting git.
- [[audio-store]] — `AudioStore.swift`, opt-in meeting WAV in `vault/.audio/`.
- [[rag]] — `RagIndex.swift` / `RagIndexer.swift` / `RagChunker.swift` / `TextEmbedder.swift`
  / `EmbedderLoader.swift`, the built-in CoreML embedder + cosine retrieval.

### UI — Electron + Angular 21 (`ui/`)
Electron main owns the engine's lifecycle; the Angular renderer connects to the
WS directly (loopback already gates external access — [ADR-0010](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0010-phase-4-ui-scaffold.md) §5).

- [[electron-main]] — `ui/src/main/main.ts` + `harkd-spawn.ts` + `port-file.ts`, spawn & port handshake.
- [[preload-security]] — `ui/src/main/preload.ts`, the `contextBridge` surface.
- [[llm-egress]] — `ui/src/main/llm/`, all LLM HTTP in main (raw fetch, no SDK), key in Keychain.
- [[external-rag-client]] — `ui/src/main/rag/`, loopback-guarded HTTP / MCP retrieval client.
- [[tray]] — `ui/src/main/tray.ts` + `tray-popover.ts`, menu-bar tray & popover.
- [[engine-service]] — `ui/src/app/services/`, the renderer's WebSocket client.
- [[ui-shell]] — `ui/src/app/`, the Angular renderer, services & panels.
- [[llm-service]] — renderer model-provider facade.
- [[retrieval-service]] — `RetrievalService` + `TranslationJobService` renderer orchestrators.

## Architectural layers (knowledge graph)

The `understand-anything` knowledge graph (`hark/.understand-anything/knowledge-graph.json`
— 280 nodes / 445 edges over 127 source files, commit `8efdfde`, code-only scope) groups
the code into **7 layers**. Each subsystem page below carries a verified `## Code map`
(files, key types/functions, pinning tests, and cross-subsystem edges) drawn from it.

| Layer | Subsystems |
|---|---|
| **Engine Core & Audio Capture** | [[audio-capture]], engine shell in [[engine-harkd]], `ModelLoader` in [[whisperkit-asr]] |
| **Streaming Daemon & Transcription** | [[engine-harkd]], [[whisperkit-asr]], [[vad]], [[wire-protocol]] (Swift side), [[diarization]], [[speaker-enrollment]], [[vault-writer]], [[audio-store]], [[rag]] |
| **Engine Tests** | XCTest suites pinning the above — see each page's *Pinned by tests* |
| **UI Renderer (Angular)** | [[ui-shell]], [[engine-service]], [[llm-service]], [[retrieval-service]], [[wire-protocol]] (TS mirror) |
| **Electron Main Process** | [[electron-main]], [[preload-security]], [[tray]] (main side) |
| **Privacy & LLM Egress** | [[llm-egress]], [[external-rag-client]] |
| **Build & Configuration** | SwiftPM manifest, CoreML/sign scripts, Angular/TS/electron-builder configs — see [[packaging-distribution]] |

> The graph doesn't resolve Swift *module imports*, so engine cross-file wiring is captured
> as `depends_on`/`calls`/`implements` edges (grounded in observed symbols), not `imports`.

## Cross-cutting concepts

- [[threat-model]] — the privacy hard rules (audio never leaves except the explicit
  LLM path; nothing PII outside the vault; no telemetry; vault is sacred).
- [[local-first-guarantee]] — engine is network-free; ASR/diarization/RAG all on-device.
- [[egress-governance]] — cloud sends redacted content + a metadata-only receipt; local = zero.
- [[streaming-finalization]] — partial → final segment lifecycle, `utterance_id`, grow-in-place.
- [[pluggable-retrieval]] — built-in on-device RAG or an external loopback backend, interchangeable.
- [[privacy-data-control]] — opt-in, default-off gates (keep-audio, remember-speakers, sync).
- [[markdown-second-brain]] — the vault-as-knowledge-base roadmap (this wiki dogfoods the pattern).

## Decision digests (by area)

- [[foundations]] — ADR-0001/0002/0003/0004/0005/0013 (Electron, macOS-only, Swift engine, RTF).
- [[capture-audio]] — ADR-0006/0007/0011.
- [[streaming-finalization-decisions]] — ADR-0008/0009/0018/0019/0036.
- [[diarization-speakers]] — ADR-0016/0017/0020/0024/0025/0026.
- [[privacy-egress]] — ADR-0027/0028/0029/0030/0031.
- [[vault-rag-decisions]] — ADR-0032/0033/0034.
- [[translation]] — ADR-0035/0037.
- [[packaging-distribution]] — ADR-0021/0038.
- [[ui-onboarding]] — ADR-0010/0014/0022/0023.

Term definitions: [[glossary]] (RTF, `utterance_id`, template image, squircle, …).

## Invariants (must stay true)

1. **Content leaves only through the explicit, user-invoked LLM edge** — and a
   local provider means zero egress (`CLAUDE.md` rule #1; [[egress-governance]],
   [ADR-0029](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0029-llm-provider-layer-egress.md)).
2. **Nothing PII (transcripts, audio) is written outside `~/Documents/vault/hark`**;
   models/prefs live in `~/Library/Application Support/Hark/` (`CLAUDE.md` rule #2).
3. **The engine is network-free** — all LLM HTTP lives in Electron main only,
   raw fetch, no vendor SDK (`STATUS.md` locks; [[llm-egress]]).
4. **The WebSocket binds loopback-only and has no auth** — acceptable *only*
   because of the loopback bind; it breaks the moment the socket opens beyond
   loopback ([ADR-0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md);
   `STATUS.md` open thread #6).
5. **The vault is sacred** — never auto-delete or auto-rewrite; all changes go
   through per-meeting git so history is recoverable (`CLAUDE.md` rule #4; [[vault-writer]]).
6. **Voiceprints stay local** — `vault/.speakers/` never touches any API
   (`CLAUDE.md` rule #5; [[speaker-enrollment]]).
7. **macOS-only / Apple Silicon** — no cross-platform abstraction layer; no cloud
   ASR ([ADR-0002](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0002-macos-only-scope.md), [ADR-0003](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0003-swift-whisperkit-engine.md)).
