---
type: subsystem
title: Retrieval service (backend switch)
status: current
sources: ["ui/src/app/services/retrieval.service.ts", "ui/src/main/rag/index.ts", "ui/src/main/rag/loopback.ts", "ui/src/main/rag/parse.ts", "docs/decisions/0033-pluggable-retrieval-backend.md", "docs/design/07-data-flows.md"]
updated: 2026-06-30
tags: [rag, retrieval, renderer, electron-main, vault]
---

# Retrieval service (backend switch)

The code that turns a vault-scope Ask question into top-K chunks. It hides the [[pluggable-retrieval]] fork so the host + Ask panel render either backend identically (`0033`, slice 4c).

## Renderer — the switch
`RetrievalService` (`ui/src/app/services/retrieval.service.ts`) reads `prefs.rag.backend` and routes `retrieve(query, opts)`:
- **`builtin`** → the engine over the WebSocket (`EngineService.retrieve` → `rag.retrieve`/`rag.results`), i.e. the [[rag]] index (`0032`).
- **`external`** → `window.hark.rag.retrieve`, the loopback client in main (`0034`). If the bridge is absent it throws rather than silently falling back to the engine the user opted out of.

Both channels return the same `RagResultChunk` shape; neither makes a remote call.

## Main — the external facade
`ui/src/main/rag/index.ts` is the **external backend only** (built-in retrieves in the engine). It:
- reads the config via `readRagConfig`, defaulting to `builtin` when the prefs block is absent/malformed — the safe out-of-box default (`index.ts`).
- clamps `k` into `[1, 50]` (`DEFAULT_K = 6`), matching the engine's `rag.retrieve` clamp.
- enforces the loopback guard **before any fetch** via `assertLoopbackEndpoint` (`loopback.ts`) — see [[external-rag-client]].
- dispatches to the `http` or `mcp` transport, then maps each `ExternalChunk` into `RetrievedChunk`: `source → note_path`, `headingPath → heading_path`, `char_start/char_end = 0` (external backends own their addressing; built-in offsets power a future jump-to-source) (`index.ts`; `0034`).
- exposes `testConnection()` for the Settings "Test connection" probe — a content-free verdict that never throws.

`parse.ts` (`coerceExternalChunks`) treats every external response as untrusted: it accepts a `{ chunks: [...] }` envelope or a bare array, keeps only well-formed `{ text, source, headingPath?, score? }` items, and never throws.

## Downstream
Whichever backend returns the chunks, the **redact → LLM → log → citations** path stays in main and never moves (`0033`; [[llm-egress]]). The latency budget is ≤200 ms local retrieval, first token from the LLM ≤3 s (`docs/design/07-data-flows.md` §4). See [[vault-rag-decisions]].
