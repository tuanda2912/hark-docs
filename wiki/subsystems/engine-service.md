---
type: subsystem
title: EngineSession (session service)
status: current
sources: [docs/design/06-architecture-overview.md, docs/design/07-data-flows.md, "engine/Sources/Harkd/EngineSession.swift", "engine/Sources/Harkd/HarkdCommand.swift"]
updated: 2026-06-30
tags: [engine, harkd, session, actor, websocket]
---

# EngineSession (session service)

`EngineSession` is harkd's brain — the session service that wires
**Capture → VAD → SlidingWindow → WhisperKit → WS emit** (`engine/Sources/Harkd/EngineSession.swift`
header). It is modeled as a Swift `actor` so every state mutation serializes on the actor's executor
without explicit locks (the source likens it to a Spring `@Service` bean).

## State machine
`[idle] ──capture.start──► [running] ──capture.stop──► [idle]`, with pause/resume orthogonal
(`EngineSession.swift`). Dependencies are wired at startup: `attachModel` injects WhisperKit once it
finishes loading, `attachDiarizer` and `attachRagIndexer` wire the post-stop / vault-search paths
(`EngineSession.swift`; `HarkdCommand.swift`). Until the model is attached, `capture.start` is gated with
`ENGINE_WARMING_UP`; a UI connecting mid-download gets the last model-progress snapshot replayed after
`meta.hello`.

## Hot path
The `CapturePipeline` pump (a `DispatchQueue`) calls a float-frame sink; each batch hops into the actor via
`Task { await session.ingest(...) }`, which runs [[vad]] classify → append to [[whisperkit-asr]]'s sliding
window → pop a hop when ready → enqueue a transcription job → reconcile against the `UtteranceLedger` →
emit WS frames (`EngineSession.swift` header). NIO callbacks (`clientDidConnect/Disconnect/Send`) bridge
into the actor the same way through `WSDelegateAdapter` (`HarkdCommand.swift`).

## Backpressure
Hard rule (`docs/design/07-data-flows.md` §Backpressure): if a transcription job is already in flight when
a new hop is ready, the in-flight job's pending replacement is dropped — never more than one outstanding
window. The freshest hop wins; the older window is discarded and a `warning code:"rtf_high"` is emitted
(`EngineSession.swift`).

## Owned services
The actor owns `SpeakerStore` (enrollment / cosine match, ADR-0026), the [[audio-store]] (opt-in
`keep_audio`, ADR-0027), and the offline diarizer — all invoked off the live path at stop
(`EngineSession.swift`). Privacy: the actor sees transcript text and **must not log content** — log lines
are progress / state transitions only (`EngineSession.swift` header).

Spawned and supervised by [[engine-harkd]]; serves [[swift-engine-sidecar]]'s clients.
