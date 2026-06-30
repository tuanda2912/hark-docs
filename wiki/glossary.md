---
type: glossary
title: Glossary
status: current
sources: [docs/00-index.md, docs/design/06-architecture-overview.md, docs/design/07-data-flows.md]
updated: 2026-06-30
tags: [glossary, terminology]
---

# Glossary

- **harkd** — the Swift engine sidecar binary (capture → ASR → diarization → translation → WebSocket). [[streaming-daemon]]
- **ASR** — automatic speech recognition. Hark uses **WhisperKit** (large-v3-turbo) on the Apple Neural Engine.
- **VAD** — voice-activity detection (**Silero**, CoreML) — gates audio into the ASR window. [[audio-capture]]
- **Diarization** — segmenting audio by *who spoke when* (**FluidAudio**), then matched to known speakers by
  cosine similarity of embeddings. [[streaming-daemon]]
- **RTF** — real-time factor (processing time ÷ audio duration); RTF > 1 means the pipeline is falling behind
  and the ring buffer drops oldest audio (`06-architecture-overview.md` §Component view: Swift Engine).
- **Vault** — the user's git-backed markdown folder (`~/Documents/vault/hark`): transcripts, notes, and
  `.speakers/*.json` embeddings. The source of truth; never auto-pushed anywhere.
- **Egress** — outbound network traffic. In Hark there is exactly one egress edge: the **Claude API**,
  text-only and user-invoked. [[local-first-egress]]
- **RAG** — retrieval-augmented generation: the local SQLite + `sqlite-vec` embedding index over the vault,
  used to ground Q&A. [[streaming-daemon]]
- **WebSocket contract** — the JSON message schema between the Swift engine and the Electron UI
  (`docs/design/08-websocket-api-contract.md`).
