---
type: subsystem
title: Vault RAG — embedder, index & chunker
status: current
sources: [ADR-0032, ADR-0033, ADR-0034, engine/Sources/Harkd/TextEmbedder.swift, engine/Sources/Harkd/EmbedderLoader.swift, engine/Sources/Harkd/EmbedderModels.swift, engine/Sources/Harkd/RagIndex.swift, engine/Sources/Harkd/RagIndexer.swift, engine/Sources/Harkd/RagChunker.swift]
updated: 2026-06-05
tags: [engine, rag, embeddings, coreml, ane, retrieval, privacy, second-brain]
---

The engine's fully-local retrieval pipeline: a CoreML `multilingual-e5-small` embedder (384-dim, ANE, e5 query/passage prefixing + masked mean-pooling), a heading-aware chunker, and a brute-force in-memory cosine index over an **offset-only** persisted file set (`vectors.bin` / `meta.jsonl` / `manifest.json` in app-data, **never raw note text**), refreshed by a content-hash-gated FSEvents watcher. This is the **built-in** retrieval backend (ADR-0033); the external one lives in [[external-rag-client]].

## Code map

_Grounded in the understand-anything graph (commit 8efdfde, 2026-06-05, code-only)._

**Layer:** Streaming Daemon & Transcription.

**Files** (6):

- `engine/Sources/Harkd/TextEmbedder.swift` — on-device CoreML text embedding (ADR-0032): a `TextEmbedder` protocol plus a `CoreMLTextEmbedder` actor mapping a string to an L2-normalized 384-dim vector via e5 prefix, offline tokenize, fixed tensors, ANE inference, and masked mean-pooling.
- `engine/Sources/Harkd/EmbedderLoader.swift` — downloads (one-time), ANE-compiles, and builds a `CoreMLTextEmbedder` for the vault-RAG default model, forcing both the CoreML package and tokenizer files to cache under Hark's app-support dir.
- `engine/Sources/Harkd/EmbedderModels.swift` — curated, local-only registry of text-embedding models for vault RAG (ADR-0032): immutable descriptors pinning repo, revision, tokenizer family, and the 384-dim invariant. Data only, no behavior.
- `engine/Sources/Harkd/RagChunker.swift` — stateless, pure utility that splits a vault markdown note into overlapping, heading-aware text windows sized under the embedder's 512-token cap, lifting YAML front-matter into metadata rather than embedding it.
- `engine/Sources/Harkd/RagIndex.swift` — brute-force in-memory cosine vector store, persisted as `vectors.bin` + `meta.jsonl` + `manifest.json` under app-support; an actor serializing the background indexer and foreground query path, storing offsets/pointers only and never raw note text.
- `engine/Sources/Harkd/RagIndexer.swift` — vault-RAG index coordinator: owns the indexing lifecycle off the live transcription path with a cold build on open, an FSEvents watcher with a 30 s debounce + content-hash gate, a manual rebuild entry point, and graceful degradation when the embedder is absent.

**Key types & functions:**

- `CoreMLTextEmbedder` (actor, `TextEmbedder.swift` L81–267) — conforms to `TextEmbedder`: applies the e5 query/passage prefix, tokenizes offline, runs ANE inference, and masked-mean-pools to a unit-length 384-dim vector.
- `TextEmbedder` (protocol, `TextEmbedder.swift` L69–80) — Sendable abstraction over a string-to-384-dim embedder so the loader and pipeline are indifferent to the concrete CoreML implementation.
- `LoadedEmbedder` (`EmbedderLoader.swift` L28–35) — result of `loadTextEmbedder` carrying the ready `CoreMLTextEmbedder`, its model descriptor, and load timing for cold-start logging.
- `EmbedderModel` (`EmbedderModels.swift` L37–65) — immutable Sendable descriptor for one curated embedder: stable id, HuggingFace repo, pinned revision, dim, and tokenizer convention.
- `RagChunker` (enum namespace, `RagChunker.swift` L66–416) — pure chunking functions turning one markdown file into heading-breadcrumbed, overlapping embeddable windows with stable content-addressed chunk ids.
- `RagChunk` (`RagChunker.swift` L37–59) — one embeddable unit with a stable content-addressed `chunkId` (hash of notePath, charStart, content), heading breadcrumb, and char offsets.
- `RagIndex` (actor, `RagIndex.swift` L117–388) — vector store: loads/persists the flat index files and runs brute-force cosine search returning `RagSearchHit`/`RagRetrievedChunk`.
- `RagChunkMeta` (`RagIndex.swift` L44–70) — Codable per-chunk metadata line (offsets and pointers only) parallel to a row in `vectors.bin`.
- `RagManifest` (`RagIndex.swift` L71–94) — Codable manifest recording modelId, revision, dim, schemaVersion, chunkCount, and per-file content hashes for the incremental change-gate.
- `RagIndexer` (actor, `RagIndexer.swift` L48–232) — coordinator wiring the FSEvents watcher, debounce timer, chunker, and embedder around the `RagIndex` store; drains dirty paths and re-indexes changed `.md` files.
- `FSWatcher` (`RagIndexer.swift` L465–576) — wraps the C `FSEventStream` on a dedicated `DispatchQueue`, surfacing vault-root file changes to the indexer's debounced re-index callback.

**Pinned by tests:**

- `engine/Tests/HarkdTests/EmbedderTests.swift` — always-on pure pipeline math (masked mean-pooling, L2-normalization, prefix selection, MLMultiArray bridging) plus a gated on-device cross-lingual sanity test.
- `engine/Tests/HarkdTests/RagChunkerTests.swift` — front-matter stripping, heading-aware breadcrumb splitting, overlapping window packing, original-file char offsets, and content-addressed stable chunk ids.
- `engine/Tests/HarkdTests/RagIndexTests.swift` — brute-force cosine top-K ranking, add/search ordering, persist/reload round-trip, offset-only metadata (never raw note text), model-revision rebuild, and incremental `replaceFile` semantics.
- `engine/Tests/HarkdTests/RagIndexerTests.swift` — cold build, content-hash skip gate, incremental change/delete handling, embedder-unavailable degradation, and the offset-only live-retrieve path, all driven by a deterministic fake embedder.
- `engine/Tests/HarkdTests/RagWireTests.swift` — contract suite pinning the snake_case wire shapes (`rag.retrieve`, `rag.results`, `rag.index_status`) so the TypeScript mirror can be written against assertions.

**Connections:**

- ⇐ depends_on [[engine-harkd|Engine / harkd]] — `EngineSession` owns and drives the `RagIndexer` at daemon startup.

_Outbound edges to [[wire-protocol]] / [[external-rag-client]] documented in "How it connects" are unresolved in the graph (Swift cross-module imports), so only the inbound `engine-harkd` edge appears here._

## What it does

This is the local half of "Ask Hark across the vault" — the [[markdown-second-brain]] semantic search. It runs entirely in [[engine-harkd]], reads the vault read-only, and answers a `rag.retrieve` over the [[wire-protocol]] with the top-K matching note snippets + their citations. It **never calls an LLM** and **never networks at query time**; the egress + answer synthesis happen later, in the renderer/main path (see [[external-rag-client]] and [[llm-egress]]).

The hard constraint (ADR-0032, rules #1/#5): indexing embeds the *whole* vault, so the embedder must be **local-only** — a cloud embedder would egress every note. Hence an on-device CoreML embedder on the Apple Neural Engine, mirroring the WhisperKit / FluidAudio model-cache pattern. See [[local-first-guarantee]].

The pipeline, end to end:

1. **Chunk** each `.md` into heading-aware, overlapping windows (`RagChunker`).
2. **Embed** each chunk as a `passage` → L2-normalized 384-dim vector (`TextEmbedder`), then drop the text.
3. **Store** the vector + an *offset-only* metadata row (`RagIndex`), persisted under app-data.
4. **Refresh** incrementally on an FSEvents watcher, content-hash-gated (`RagIndexer`).
5. **Retrieve**: embed the query, brute-force cosine top-K, then **read each hit's snippet live from the vault** at the stored char offsets.

## Key files

- `engine/Sources/Harkd/TextEmbedder.swift` — the `TextEmbedder` protocol + `CoreMLTextEmbedder` actor. `embed(text, kind:) async -> [Float]`: e5 prefix → offline tokenize → pad/mask → CoreML `last_hidden_state` → **masked mean-pool** → L2-normalize. The pure math (`padded`, `maskedMeanPool`, `l2Normalized`, `topK`'s sibling `cosineSimilarity`) is `static` so tests drive it without the real `.mlpackage`.
- `engine/Sources/Harkd/EmbedderLoader.swift` — `loadTextEmbedder(...)`: one-time HuggingFace snapshot (pinned to `HarkPaths.modelsDir()`, **not** swift-transformers' default `~/Documents/huggingface/`) → `compileModel` to ANE (`computeUnits = .cpuAndNeuralEngine`) → offline tokenizer from the same folder → validates the `last_hidden_state` output exists at load. Emits `downloading_embedder` / `optimizing_embedder` progress.
- `engine/Sources/Harkd/EmbedderModels.swift` — the curated `EmbedderModel` registry. `multilingualE5Small` (the only model loaded in v1) + `bgeSmallEn` (declared for the slice-5 slot, **not** loaded). Both pinned to a fixed revision and 384-dim.
- `engine/Sources/Harkd/RagChunker.swift` — pure `chunk(notePath:rawMarkdown:) -> ([RagChunk], NoteFrontMatter)`: strip YAML front-matter → heading-aware section split (fence-aware) → pack ~1600-char windows with ~200-char overlap → mint a stable content-addressed `chunkId`. No I/O, no actor.
- `engine/Sources/Harkd/RagIndex.swift` — the `RagIndex` actor: a flat `[Float]` vector matrix + parallel `[RagChunkMeta]`, brute-force `search`, atomic `persist`, and the rebuild-gated `loadFromDisk`. Defines `RagChunkMeta` (offset-only), `RagManifest` (schema v2), `RagSearchHit`, `RagRetrievedChunk`.
- `engine/Sources/Harkd/RagIndexer.swift` — the `RagIndexer` actor (coordinator) + the `FSWatcher` box. Owns cold build / reconcile / incremental update / manual rebuild, the FSEvents stream + 30 s debounce, and `retrieve(...)` (embed query → search → **recover text live from the vault**).

## The embedder (ADR-0032 §4)

`CoreMLTextEmbedder` is an `actor` — a CoreML `MLModel` is a stateful, non-Sendable handle, and the actor serializes inference so exactly one ANE call runs at a time (predictable RTF, no contention). The `embed` pipeline:

- **e5 asymmetric prefix.** A stored chunk gets `"passage: "`, a search string gets `"query: "` (`EmbeddingKind`). e5 was trained this way; omitting the prefix measurably hurts retrieval, so it's explicit, not optional.
- **Offline tokenize** via swift-transformers (`UnigramTokenizer` + Metaspace pre-tokenizer for the SentencePiece/XLM-RoBERTa family), special tokens included, truncated to `maxSequenceLength` (512) keeping a trailing EOS.
- **Pad + attention mask**, then a flexible-shape `[1, L]` int32 tensor (short chunks run as short sequences — less ANE work). Pad token id `<pad>` = 1.
- **CoreML** → `last_hidden_state` `[1, L, 384]` on the ANE.
- **Masked mean-pool** over the real (mask=1) tokens only. This is the load-bearing invariant: averaging the padding positions too drags every vector toward the pad-token embedding and collapses cross-lingual separation. Hark pools itself rather than trusting a model with pooling baked in, so the invariant is verifiable (the slice-4a VI/TH/EN cross-lingual sanity test guards it).
- **L2-normalize** → unit-length 384-dim. Because both stored and query vectors are normalized, cosine == dot product, which is what makes the brute-force search a single multiply-accumulate per dimension (no per-row normalization).

The CoreML float output is read as Float32 / Float16 / Double and validated against the expected `tokens × dimension` element count, so a shape regression in a re-converted model fails loudly rather than silently mis-pooling.

### The curated model set (`EmbedderModels`)

| | `multilingual-e5-small` (default, loaded) | `bge-small-en-v1.5` (declared, **not** loaded) |
|---|---|---|
| dim | 384 | 384 |
| tokenizer | SentencePiece Unigram (XLM-RoBERTa) | WordPiece (BERT) |
| query prefix | `"query: "` | `"Represent this sentence for searching relevant passages: "` |
| passage prefix | `"passage: "` | `""` |
| repo | `tuanda2912/hark-multilingual-e5-small-coreml` (Hark-owned int8 conversion, pinned sha `0a386d4…`) | `BAAI/bge-small-en-v1.5` (pinned) |

Why multilingual default: the audience runs VI / TH / EN notes; an English-only embedder retrieves poorly on non-English. **Every v1 option is 384-dim so the index schema is constant**, and the embedder may **never** be a cloud endpoint. The default `.mlpackage` is produced by `scripts/convert-embedder-coreml.py` (fp16, ~224 MB) then `scripts/quantize-embedder-int8.py` (int8, ~113 MB; fp16↔int8 cosine 0.99986, validated on-device). `bgeSmallEn` exists only to prove the loader + protocol are shaped for a WordPiece model (ADR-0032 slice-5); it is never downloaded in v1.

### Loading (`EmbedderLoader`, mirrors `ModelLoader` / `DiarizerLoader`)

One-time snapshot (the **single** network event in the whole subsystem) into `HarkPaths.modelsDir()` (rule #2 — never the default HF cache dir), globbed to just the `.mlpackage` + tokenizer JSONs, then `compileModel` to ANE. `HARK_EMBEDDER_LOCAL_DIR` bypasses the download (how the on-device cross-lingual test runs before publish, and a hook for a user's own local conversion). Changing the embedder ⇒ a model id/revision change in the manifest ⇒ full re-index — it is a "pick it, re-index if you change it" setting, not a per-query toggle.

## The chunker (`RagChunker`, ADR-0032 §chunking / ADR-0033)

Pure value→value, no I/O. Pipeline:

1. **Strip YAML front-matter** → `NoteFrontMatter` (title/date/tags, hand-parsed, tolerant) + the body + a `bodyOffset` so chunk char offsets point into the **original** file, not the stripped body. YAML keys are *not* embedded (navigation, not prose — embedding them pollutes the vector).
2. **Heading-aware section split.** Walk lines tracking an ATX-heading stack; each section carries a `" > "` breadcrumb (e.g. `Design > Risks`). Fenced code blocks (```` ``` ````) pass through verbatim and are not scanned for headings.
3. **Pack windows** within each section: `targetChars = 1600` (≈ 400 tokens, well under the 512 cap to leave room for the breadcrumb + `"passage: "` prefix), `overlapChars = 200` (~12%), `minTailChars = 80` (no sliver tails). Window ends snap to a nearby sentence/paragraph boundary so a window doesn't split mid-word.
4. **Mint a stable `chunkId`** = `SHA-256(notePath ␟ charStart ␟ contentHash)` truncated to 24 hex chars — deterministic, so an unchanged region re-chunks to the same id (incremental diffing).

Token count is approximated as ~4 chars/token (EN/VI/TH) — deliberately simple; the embedder truncates at 512 anyway, so a slightly-off estimate only costs a touch of overlap precision, never correctness. Offsets are measured over `[Character]` (extended grapheme clusters) — the **same unit** the retrieve path slices with, so a stored `charStart`/`charEnd` recovers exactly the embedded window.

## The index (`RagIndex`, brute-force cosine, ADR-0032 / ADR-0033)

An `actor` (serializes the background indexer and the foreground query path without locks; disk I/O runs on the actor, off the live audio/ASR path). State is one **contiguous** `[Float]` matrix (`chunkCount × dim`, cache-friendly + a byte-for-byte memcpy round-trip with `vectors.bin`) parallel to `[RagChunkMeta]`.

- **Search** (`search` / pure `topK`): dot product per row (pre-normalized ⇒ dot == cosine), partial-select the K best, ties broken to the lower row index for determinism. **Why brute-force, not sqlite-vec:** at ≤50k chunks a single pass is <80 ms on an M-series core — well inside the ≤200 ms budget — with **zero** new native dependency. sqlite-vec would pull a native `.node` + a loadable `.dylib` (deep-sign + electron-builder footgun) for no benefit at personal scale (ADR-0032). Scale-up path past ~100k chunks is sqlite-vec + ANN behind the same `search` interface — don't re-litigate.
- **Mutation**: `replaceFile` swaps all of a note's rows + records its whole-file hash; `removeFile` drops a deleted note; both rebuild the flat matrix (O(n), off the live path).

### On-disk layout (offset-only, decision 2026-06-03)

All three files live **only** under `HarkPaths.indexDir()` (`~/Library/Application Support/Hark/index/`) — a rebuildable cache, **never** the vault (the vault is sacred + externally synced; the indexer reads it, writes only app-data — ADR-0032 rejected an in-vault `.index/`).

| File | Holds |
|---|---|
| `vectors.bin` | contiguous little-endian Float32, `dim` floats per chunk, row *i* = `meta.jsonl` line *i*'s vector |
| `meta.jsonl` | one JSON object/line — **pointers + offsets only**: `chunk_id`, `note_path`, `heading_path`, `char_start`, `char_end`, `content_hash`. **NO raw note text.** |
| `manifest.json` | `model_id`, `model_revision`, `dim`, `schema_version`, `chunk_count`, `per_file_content_hashes` (notePath → whole-file SHA-256) |

**`meta.jsonl` never contains note prose.** At retrieve time the engine reads each hit's snippet **live from the vault** at `[char_start, char_end)`. Rationale (rules #2/#4): raw note text is never persisted outside the vault, so deleting a note from the vault erases its content everywhere — nothing lingers in the cache. Removing the old `text` field bumped `schema_version` 1 → 2; a pre-existing v1 index rebuilds on first launch. The `rag.results` wire shape is unchanged (still `{ text, … }`) — only the *source* of `text` changed (live vault read vs cache).

**Persist is atomic + manifest-last.** Each file is written temp-then-rename (`Data.write(.atomic)`); the manifest is written **last** so a partial `vectors`/`meta` is never blessed by a fresh manifest. `loadFromDisk` is **rebuild-gated**: it refuses (resets to empty → cold build) on any of — manifest unreadable, `schema_version` mismatch, **model id/revision changed** (the headline ADR-0033 rule: vectors from a different model live in a different space), dim mismatch, a meta parse failure, or `vectors.bin` length ≠ `chunkCount × dim × 4`.

## The indexer (`RagIndexer` + `FSWatcher`)

The coordinator actor wires the FSEvents stream, debounce timer, chunker, and embedder around the index actor. **Lifecycle** (`start`): `loadFromDisk` → on `.loaded` reconcile against the live vault (hash gate makes unchanged files free) / on `.empty` cold build / on `.rebuildRequired` full rebuild → start the watcher. `rebuild()` is the manual full-rebuild entry point (a future Settings "Reindex" frame).

**Freshness** (ADR-0032): an `FSWatcher` box wraps a CoreServices `FSEventStream` on a **dedicated serial DispatchQueue** (never the main/audio thread). FSEvents-layer latency 1 s + `kFSEventStreamCreateFlagFileEvents` (per-file paths) + `kFSEventStreamCreateFlagUseCFTypes` (**required** — without it the callback's `eventPaths` is a raw `char **` and the cast SIGSEGVs). On top of that sits a **~30 s debounce** (each event pushes the fire time out, so an Obsidian-sync save-storm coalesces into one pass). On fire, `handleDebouncedChanges` re-indexes existing `.md` (hash-gated) and drops vanished ones.

**Content-hash gate**: `indexOne` reads a file, hashes it (`RagChunker.sha256Hex(Data)`), and if `index.isFileUnchanged` returns true (recorded hash matches) it **skips** — an atomic-save that only bumps mtime never triggers re-embedding. Otherwise it chunks → embeds each chunk as `.passage` → `replaceFile`. The chunk text is embedded **transiently** and dropped; only the vector + offset-only meta are persisted (`c.text` does not escape the loop). Non-UTF8 files are skipped but their hash is recorded so they aren't retried each event.

**Retrieve** (`retrieve(query:k:)`): embed the query (`.query`) → `index.search` top-K → `recoverText`. The offset-only design means text is sliced live from the vault, and each hit is **dropped** if its source is no longer trustworthy:
- file **missing** (deleted since indexing) → skip;
- file **changed** (live whole-file hash ≠ recorded hash) → skip — the offsets may now point at moved text; dropping is honest, returning a wrong slice is not (the 30 s watcher re-indexes it shortly).

Reads are read-only + memoized per note (K hits in one note = one read), sliced over `[Character]` clamped defensively. No embedder loaded ⇒ `retrieve` throws `RagError.unavailable` (mapped to a `RAG_UNAVAILABLE` wire error); the rest of indexing degrades to a logged no-op so **capture/transcription are never affected**.

## How it connects

- **Hosted by** [[engine-harkd]] — the embedder + index + indexer are Harkd actors loaded at daemon startup (after the embedder load attempt); the model-cache location is shared via `HarkCore.HarkPaths`.
- **Wire** [[wire-protocol]] — the renderer sends `rag.retrieve { query, k, scope }`; the engine returns ranked `{ text, notePath, headingPath, charRange, score }` chunks and emits `rag.index_status` build state (`idle` / `building` / `ready`) via the `RagStatusSink`. The engine never calls an LLM.
- **Sibling backend** [[external-rag-client]] — this is the *built-in* `RetrievalBackend` (ADR-0033). The *external* backend (a user-run loopback MCP/HTTP service, ADR-0034) lives in Electron main and is selected per `prefs.rag.backend`. Both produce the same `RagResultChunk` the Ask panel renders.
- **Concept** [[pluggable-retrieval]] — the two-backend abstraction; [[markdown-second-brain]] — the product feature this powers.
- **Privacy** [[local-first-guarantee]] — fully-local indexing; the redact → LLM → log → citations egress chokepoint stays in main regardless of backend (see [[llm-egress]]).
- **Reused patterns**: model-cache load mirrors `ModelLoader` (WhisperKit, see [[whisperkit-asr]]) + `DiarizerLoader`; `l2Normalized` mirrors `SpeakerStore` (ADR-0026, see [[speaker-enrollment]]) — same math, independent owners.

## Governing ADRs

See [[vault-rag-decisions]] for the full digest.

- [ADR-0032](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0032-vault-rag-architecture.md) — vault-wide RAG: engine-side on-device CoreML embeddings + brute-force retrieval + offset-only index + FSEvents watcher. **Accepted.**
- [ADR-0033](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0033-pluggable-retrieval-backend.md) — pluggable `RetrievalBackend`: built-in (this page) **or** external local MCP, user-chosen. **Accepted.**
- [ADR-0034](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0034-external-retrieval-transport.md) — external transport (hand-rolled loopback HTTP + minimal MCP-over-HTTP). **Accepted.** (Scopes the *external* backend — [[external-rag-client]].)

## Invariants

- **The embedder is local-only, never a cloud endpoint.** Indexing embeds the whole vault; a cloud embedder would egress all of it (rules #1/#5, ADR-0032). `embed()` never networks; the one network event is the first-run model snapshot in `EmbedderLoader`.
- **Every v1 model is 384-dim.** The index schema is fixed at 384; `dimensionIsValid` rejects anything else at load. A model id/revision change ⇒ full re-index.
- **The index persists vectors + pointers, never raw note text.** `meta.jsonl` is offset-only; snippets are read live from the vault at retrieve time. Deleting a note erases its content everywhere (no stale copy in app-data) — rules #2/#4.
- **The cache lives only in app-data, never the vault.** The indexer reads the vault read-only and writes only `HarkPaths.indexDir()`; it never auto-writes the sacred, externally-synced vault.
- **Masked mean-pool excludes padding.** Pooling padding positions collapses cross-lingual separation — the guarded slice-4a invariant.
- **Stale hits are dropped, not returned.** A hit whose source file is missing or whose whole-file hash changed since indexing is skipped at retrieve time (the offsets could slice the wrong text).
- **RAG degrades in isolation.** No embedder, a failed index write, or a watcher that won't start degrade only RAG (logged); capture / ASR are untouched.
- **The engine does retrieval only — never an LLM call, never the API key.** Egress + answer synthesis happen downstream in main (ADR-0033, [[llm-egress]]).

## See also

[[engine-harkd]] · [[wire-protocol]] · [[external-rag-client]] · [[pluggable-retrieval]] · [[markdown-second-brain]] · [[local-first-guarantee]] · [[vault-rag-decisions]] · [[glossary]] (embedding, chunk, masked mean-pooling, e5 prefix, offset-only index, content-hash gate, ANE)
