---
type: subsystem
title: Local RAG index (built-in backend)
status: current
sources: ["engine/Sources/Harkd/RagChunker.swift", "engine/Sources/Harkd/RagIndex.swift", "engine/Sources/Harkd/RagIndexer.swift", "docs/decisions/0032-vault-rag-architecture.md", "docs/design/07-data-flows.md"]
updated: 2026-06-30
tags: [rag, engine, harkd, embeddings, vault, privacy]
---

# Local RAG index (built-in backend)

The engine-side, fully-local semantic index over the [[markdown-second-brain]] vault — the default of the [[pluggable-retrieval]] backends (`0033`). It embeds vault notes on-device and answers `rag.retrieve` with the top-K chunks; the engine never calls an LLM (`0032`).

## Pipeline (slice 4b)
- **Chunking** — `RagChunker.chunk` strips YAML front-matter (lifted to metadata, not embedded), splits the body heading-aware, then packs ~1600-char (~400-token) windows with ~200-char overlap, each prefixed with its heading breadcrumb (`RagChunker.swift`; `0032` §Chunking). Each chunk gets a stable content-addressed `chunkId`.
- **Embedding** — chunks are embedded transiently as `.passage` vectors; queries as `.query`. The on-device CoreML embedder defaults to a 384-dim multilingual model (`multilingual-e5-small`) so VI/TH/EN notes retrieve well (`0032` §Decision). Changing the embedder forces a full re-index.
- **Vector store** — `RagIndex` is a Swift `actor` holding one contiguous `[Float]` matrix; `search` is brute-force top-K cosine (dot product over L2-normalized vectors), <80 ms at ≤50k chunks (`RagIndex.swift`; `0032`). sqlite-vec is the documented scale-up past ~100k chunks, not v1.

## Storage — offset-only, app-data only
Three files live under app-data (`~/Library/Application Support/Hark/index/`), **never the vault** (`0032` §Index storage): `vectors.bin`, `meta.jsonl`, `manifest.json`. The offset-only decision (2026-06-03) means `meta.jsonl` holds **pointers only** — `chunkId`, `notePath`, `headingPath`, `charStart/charEnd`, `contentHash` — and never raw note text. At retrieve time `RagIndexer.retrieve` reads the snippet **live from the vault** at the stored offsets, skipping any note that is missing or whose whole-file hash changed since indexing (`RagIndexer.swift`). So deleting a note erases its content everywhere — nothing lingers in the cache.

## Freshness
`RagIndexer` cold-builds on first open, then an FSEvents watcher (`FSWatcher`) with a ~30 s debounce + content-hash gate re-indexes only changed files and drops deleted ones (`RagIndexer.swift`; `0032` §Freshness). All indexing runs off the live audio/ASR path; if the embedder fails to load, RAG degrades to a no-op and transcription is untouched.

## Privacy
The vault is read-only to the indexer; it writes only app-data. Chunk text is never logged. Retrieval stays local — only the redacted top-K + question ever leave Hark, via [[llm-egress]] (`0032` §Answer flow). See [[vault-rag-decisions]].
