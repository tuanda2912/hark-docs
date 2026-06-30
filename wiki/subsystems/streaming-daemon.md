---
type: subsystem
title: Streaming daemon & transcription (harkd)
status: current
sources: [docs/design/06-architecture-overview.md, docs/design/08-websocket-api-contract.md, "graph: Streaming Daemon & Transcription"]
updated: 2026-06-30
tags: [engine, harkd, asr, diarization, rag, websocket]
---

# Streaming daemon & transcription (harkd)

The heart of the Swift engine: the streaming session that runs ASR over a sliding window, diarizes,
matches speakers, builds the local RAG index, and serves results to the UI over a WebSocket
(`docs/design/06-architecture-overview.md`).

## Files (graph layer "Streaming Daemon & Transcription")
- `engine/Sources/Harkd/EngineSession.swift`, `HarkdCommand.swift` — session lifecycle + the daemon entrypoint.
- `engine/Sources/Harkd/SlidingWindow.swift` — 30 s window / 5 s hop feeding WhisperKit.
- `engine/Sources/Harkd/Diarizer.swift`, `DiarizerLoader.swift` — FluidAudio diarization + model load. [[glossary]]
- `engine/Sources/Harkd/{EmbedderLoader,EmbedderModels}.swift`, `SpeakerEnrollment.swift` — speaker embeddings
  + enrollment/matching (cosine similarity).
- `engine/Sources/Harkd/{RagChunker,RagIndex,RagIndexer}.swift` — the local RAG index over vault content.
- `engine/Sources/Harkd/AudioStore.swift` — audio buffering/storage.

## Contract
The engine talks to [[ui-renderer]] / [[electron-main]] over a **WebSocket** on `ws://localhost:PORT`; the JSON
message schema is the source of truth in `docs/design/08-websocket-api-contract.md`.

## Upstream / downstream
Audio in from [[audio-capture]]; transcript/speaker/term events out to the UI; speaker embeddings persisted to
the vault. RAG grounds Q&A which is answered via the [[local-first-egress]] path.
