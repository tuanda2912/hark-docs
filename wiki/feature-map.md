# Feature → file map

Feature → capability (stable graph layer/tag) → files, with status + gaps. The graph-derived blocks are
wrapped in markers so a future `/lodestar` refresh won't clobber hand-owned columns.

<!-- @generated:lodestar start (graph: ../hark/.understand-anything/knowledge-graph.json) -->

| Feature | Capability (layer) | Key files | Status | Gap / note |
|---|---|---|---|---|
| Capture audio | Engine Core & Audio Capture | `engine/Sources/HarkCapture/{CapturePipeline,Mixer,MicCapture,CoreAudioProcessTap}.swift` | current | mic + system audio mixed @16 kHz |
| Transcribe | Streaming Daemon & Transcription | `engine/Sources/Harkd/{EngineSession,SlidingWindow}.swift` | current | WhisperKit; RTF>1 → backpressure |
| Diarize / speakers | Streaming Daemon & Transcription | `engine/Sources/Harkd/{Diarizer,DiarizerLoader,SpeakerEnrollment,EmbedderLoader}.swift`, `ui/src/app/components/speaker-tagging.component.ts` | current | embeddings persisted to vault |
| Translate | (engine NLLB-200) | engine translation path | planned | architecture documents it; files not yet tagged in graph — gap |
| RAG Q&A | Streaming Daemon (RAG) + Privacy & LLM Egress | `engine/Sources/Harkd/{RagChunker,RagIndex,RagIndexer}.swift`, `ui/src/main/rag/*.ts`, `ui/src/main/llm/anthropic.ts` | current | retrieval local; only prompt egresses |
| Egress control | Privacy & LLM Egress | `ui/src/main/llm/{provider,keystore,cloud-log}.ts` | current | Keychain key; audit log; text-only |

<!-- @generated:lodestar end -->

## Notes (hand-owned)
- **Translate** is a real **gap** in traceability: the architecture (`06-architecture-overview.md`) describes
  NLLB-200 translation, but no graph layer/tag cleanly resolves its files yet — surface for `/cairn-sync-code`.
- This map was hand-seeded during the rebuild; run **`/lodestar`** for the full, staleness-stamped version.
