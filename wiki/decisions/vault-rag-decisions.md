---
type: decision-digest
title: Vault RAG (ADR-0032/0033/0034)
status: current
sources: [ADR-0032, ADR-0033, ADR-0034]
updated: 2026-06-05
tags: [decisions, rag, retrieval, privacy, mcp]
---

# Vault RAG (ADR-0032/0033/0034)

The three ADRs that settle Hark's vault-wide retrieval ("Ask Hark across the
vault"), all dated **2026-06-03** and all **Accepted** (none superseded): an
**engine-side on-device CoreML embedder + brute-force, offset-only index**
([0032](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0032-vault-rag-architecture.md)), a **pluggable
`RetrievalBackend`** that is either the built-in engine index OR a user-run
external local service ([0033](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0033-pluggable-retrieval-backend.md)),
and the **hand-rolled loopback HTTP + minimal MCP-over-HTTP transport** with an
SSRF/loopback guard for that external backend
([0034](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0034-external-retrieval-transport.md)). For the running
built-in subsystem see [[rag]]; for the external client see
[[external-rag-client]]; for the renderer orchestrator see [[retrieval-service]].
The cross-cutting idea is [[pluggable-retrieval]]; the privacy framing is
[[egress-governance]] and [[markdown-second-brain]].

> The hard constraint binding all three (rules #1/#2/#5; ADR-0029/0031):
> **indexing must be fully local** — the whole vault must never be sent out to
> embed. Only the redacted top-K chunks + the question may leave at *answer*
> time (cloud LLM), and a **local LLM ⇒ zero egress**. Each ADR refines a layer:
> 0032 the local index, 0033 who owns it, 0034 how Hark talks to an external one.

## At a glance

| ADR | Title | Status | Supersession |
|---|---|---|---|
| 0032 | Vault RAG — engine CoreML embedder + brute-force offset-only index | Accepted | Sequencing (4a–4c) **re-planned by 0033's backend split**; decision intact |
| 0033 | Pluggable retrieval backend (built-in OR external local MCP) | Accepted | Builds on 0032 (now "the built-in backend") |
| 0034 | External retrieval transport — hand-rolled loopback HTTP + minimal MCP | Accepted | Pins 0033's left-open `external{ transport }` field |

## ADR-0032 — Engine-side embeddings + brute-force offset-only index

[../decisions/0032-vault-rag-architecture.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0032-vault-rag-architecture.md) · 2026-06-03 · **Accepted**

- **The split of responsibilities:** the **Swift engine owns the entire
  local-retrieval pipeline**; Electron main owns the egress; the renderer gets a
  scope toggle + citations. The engine **never calls an LLM** — it only returns
  local chunks.
- **Embeddings:** an **on-device CoreML embedder in the engine (ANE)**, from a
  small **curated set of LOCAL models**, defaulting to a **384-dim multilingual**
  one (`multilingual-e5-small`) — chosen so VI/TH/EN notes retrieve well, where an
  English-only `bge-small-en` would fail. Reuses the WhisperKit/FluidAudio
  model-cache pattern (`HarkPaths.modelsDir()` → first-run download + ANE compile +
  progress frames). All v1 options are **384-dim** so the index schema is constant;
  the set spans **WordPiece** (bge/MiniLM) and **SentencePiece** (e5) tokenizers,
  both via `swift-transformers`. The embedder may **NEVER be a cloud endpoint** —
  indexing embeds the whole vault. **Changing the embedder ⇒ full re-index**
  (vectors are embedder-specific; `manifest.json` records model id+version).
  *Rejected:* Node/ONNX `transformers.js` (heavy `onnxruntime-node` native module
  breaks ADR-0021's clean signing story) and **local Ollama `/embeddings`** as the
  default (would force the user to install Ollama for vault Q&A to work at all —
  kept as a deferred power-user override, loopback-guarded).
- **Vector store:** **brute-force in-memory cosine over a flat persisted file —
  NOT sqlite-vec for v1.** At personal scale (1k–50k chunks) that's ~1.5–77 MB RAM,
  **<80 ms/query** (vs a ≤200 ms budget), *exact* KNN, zero new native dependency.
  **Scale-up path (don't re-litigate):** migrate to sqlite-vec + ANN only past
  ~100k chunks — a backend swap behind the same interface.
- **Offset-only index, in app-data (never the vault):**
  `~/Library/Application Support/Hark/index/` holds `vectors.bin` + `meta.jsonl` +
  `manifest.json`, a **rebuildable cache**. `meta.jsonl` stores **pointers ONLY** —
  `chunk_id`, `note_path`, `heading_path`, `char_start`, `char_end`,
  `content_hash` — and **never the raw note text**. At retrieve time the engine
  **reads the snippet live from the vault** at `[char_start, char_end)`, **skipping
  any chunk whose file is missing or whose whole-file hash ≠ the recorded hash**
  (stale offsets aren't trusted). So deleting a note erases its content everywhere;
  no stale prose lingers in the cache (strengthens rules #2/#4). The format change
  bumped `schema_version` 1 → 2; the `rag.results` wire shape is unchanged — only
  the *source* of `text` moved (vault read vs cache).
- **Freshness:** engine-side **FSEvents watcher, ~30 s debounced,
  content-hash-gated** (an atomic-save that only bumps mtime is skipped); re-chunk
  only the changed file, drop a deleted file's chunks. A model-version change in
  `manifest.json` triggers a one-time full rebuild.
- **Chunking:** heading-aware, ~256–512-token windows with ~10–15 % overlap,
  carrying `notePath + headingPath + charRange` so citations deep-link to the
  source note (filling the empty `[1][2]` citations an earlier slice left unfaked).
- **Wire contract:** new `rag.*` frames — `rag.retrieve` (UI→engine
  `{ query, k, scope }` → local embed + brute-force top-K) and
  `rag.index_status` / progress.
- **Embodied by:** [[rag]] (the built-in index), [[markdown-second-brain]]. See
  [[wire-protocol]] for the `rag.*` frames, [[glossary]] for RTF/ANE/embedder.

## ADR-0033 — Pluggable retrieval backend (built-in OR external)

[../decisions/0033-pluggable-retrieval-backend.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0033-pluggable-retrieval-backend.md) · 2026-06-03 · **Accepted** · builds on ADR-0032 (now "the built-in backend")

- **The decision:** a **`RetrievalBackend` abstraction** with one interface
  (`retrieve(query, k, scope) → [{ text, source, headingPath?, score }]`) and two
  implementations, **chosen at onboarding** (default **built-in**), changeable in
  **Settings → Knowledge/RAG**:
  - **Built-in (default, out-of-box):** the engine's CoreML embedder +
    brute-force index + FSEvents watcher, exactly per **ADR-0032**. Self-contained.
  - **External:** a **user-run local retrieval service** — recommended as a
    **loopback MCP server** so the same 2nd-brain index is reusable by Claude
    Desktop, scripts, any MCP client. Hark connects as a **client**. Plain local
    HTTP is an acceptable alternative transport.
- **Why pluggable:** the 4a spike confirmed the built-in path is viable but means
  Hark owns a CoreML conversion + hosting the `.mlpackage` + a tokenizer dep + the
  index/watcher — real ongoing weight. The user already runs an external
  Obsidian-ingestion tool and wants the index to be a **reusable local asset**.
  Neither pure choice wins, so don't force one. Users who pick external **skip the
  built-in model download entirely** — the leanness win. *Rejected:* built-in-only
  (no reuse of the user's index) and external-only (no out-of-box vault search,
  broken for anyone without a backend).
- **Downstream is identical regardless of backend:** whichever backend returns the
  top-K, **Hark's main process redacts (for cloud), calls the LLM, logs the call,
  and renders citations** — the egress chokepoint (ADR-0029/0031) never moves. The
  backend only does *local retrieval*; it never calls an LLM and **never sees the
  API key**.
- **Privacy guardrails:** the external backend **MUST be loopback-only**
  (`localhost`/`127.0.0.1`/`::1`) — retrieval results are vault content flowing
  *back into* Hark, so a remote backend would put vault content on the network.
  Hark **guarantees local indexing only for the built-in backend**; for external,
  local indexing is the user's assurance (onboarding copy states this).
- **Embodied by:** [[pluggable-retrieval]] (the concept), [[external-rag-client]]
  (the external client), [[rag]] (built-in). Selector surfaces in [[ui-shell]] /
  onboarding; orchestrated by [[retrieval-service]].

## ADR-0034 — External transport: hand-rolled loopback HTTP + minimal MCP (no SDK)

[../decisions/0034-external-retrieval-transport.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0034-external-retrieval-transport.md) · 2026-06-03 · **Accepted** · pins ADR-0033's left-open `external{ transport }`

- **The decision:** the external backend is a **client in Electron main
  (`src/main/rag/`), hand-rolled with raw `fetch` — NO MCP SDK, NO new
  dependency** (consistent with ADR-0029's "raw fetch, no SDK" LLM-layer choice).
  Two config-chosen transports:
  - **`http` (plain loopback):** `POST <endpoint>` with `{ query, k, scope }` →
    `200 { chunks: [{ text, source, headingPath?, score? }] }`. A ~20-line local
    server satisfies it. *Test connection* = a canned retrieve (`k:1`).
  - **`mcp` (MCP over Streamable HTTP, loopback):** a minimal JSON-RPC client doing
    `initialize` → (`notifications/initialized`) → `tools/call { name, arguments:
    { query, k } }`, carrying any `Mcp-Session-Id` and accepting a single JSON-RPC
    response **or** an SSE (`text/event-stream`) one; the tool text is parsed as
    `{ chunks: [...] }` or a bare chunk array. *Test connection* = `initialize` +
    `tools/list` asserting `toolName` exists. The "reusable local asset" path.
- **Why hand-rolled, not `@modelcontextprotocol/sdk`:** (1) ADR-0029 set the
  precedent — main speaks HTTP with raw `fetch`, no vendor SDK; (2) rule #6 — a
  hand-rolled client adds no new network-socket dependency to audit/sign; (3) Hark
  uses a *tiny* slice of MCP (one tool call), so the full SDK is overkill. *Also
  rejected:* MCP over stdio (no loopback endpoint to guard, and not the
  reusable-shared-server model 0033 wants).
- **Where the branch lives:** **built-in retrieves in the engine** (renderer →
  `rag.retrieve` over the loopback WebSocket, ADR-0032); **external retrieves in
  main** (renderer → `hark:rag:retrieve` IPC → main's loopback client). The
  **renderer picks the path** per `prefs.rag.backend`; main's `rag/` module is the
  **external client only**. Both produce the same `RagResultChunk` the Ask panel
  renders — external chunks map `source → note_path`, `headingPath → heading_path`,
  and carry `char_start/char_end = 0` (the external backend owns its own
  addressing; **jump-to-source by offset is built-in-only**).
- **Config (`prefs.rag`, mirrors the `llm` block):**
  `{ backend: 'builtin' | 'external', external?: { transport: 'http' | 'mcp', endpoint, toolName? } }`.
  Default **builtin**; a missing/malformed block ⇒ builtin (the safe default). No
  secret lives here.
- **Loopback guard (the SSRF/privacy gate):** before ANY fetch, the `endpoint`
  host MUST be `localhost`/`127.0.0.1`/`::1` (same check as `isLocalEgress`). A
  non-loopback or unparseable endpoint is **refused** with a clear error — it never
  reaches the network.
- **Embodied by:** [[external-rag-client]] (the `src/main/rag/` client),
  [[retrieval-service]] (renderer path selection), [[egress-governance]] (the
  loopback guard sits alongside the LLM `isLocalEgress` check). See [[wire-protocol]]
  for the engine-side `rag.retrieve`, [[preload-security]] for the
  `hark:rag:retrieve` IPC boundary.

## Invariants these lock in

- **Indexing is fully local.** The whole vault is never sent out to embed; the
  built-in embedder may never be a cloud endpoint (0032). Only the **redacted
  top-K + question** ever leave at answer time; **local LLM ⇒ zero egress** (0032,
  carried through 0033/0034). See [[egress-governance]], [[threat-model]].
- **The index is a rebuildable app-data cache, never the vault**, and holds
  **offsets only — no vault prose** (0032). Deleting a note erases its content
  everywhere; stale/changed chunks are dropped at retrieve time by the hash gate.
- **The external backend is loopback-only**, enforced before any fetch by the same
  guard as the LLM egress (0033/0034). A remote retrieval endpoint is refused.
- **The egress chokepoint stays single-sited in main** — redact → LLM → log →
  citations — regardless of which backend retrieved (0033). The backend never sees
  the API key and never calls an LLM.
- **No new networked dependency** for the external transport: raw `fetch`, no MCP
  SDK (0034; rule #6). jump-to-source by char offset is **built-in-only**.

## See also

- [[rag]] · [[external-rag-client]] · [[retrieval-service]] ·
  [[pluggable-retrieval]] · [[egress-governance]] · [[markdown-second-brain]] ·
  [[glossary]]
- Related digests: [[privacy-egress]] (ADR-0027/0029/0030/0031 — the egress
  chokepoint these reuse), [[translation]], [[foundations]].
