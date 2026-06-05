---
type: concept
title: Pluggable retrieval
status: current
sources: [ADR-0032, ADR-0033, ADR-0034, ui/src/app/services/retrieval.service.ts, ui/src/main/rag/index.ts]
updated: 2026-06-05
tags: [rag, retrieval, privacy, mcp, vault]
---

# Pluggable retrieval

> Vault retrieval sits behind **one `RetrievalBackend` interface** with two
> user-chosen implementations — **built-in** (the engine's CoreML embedder +
> brute-force offset-only index, the default) or **external** (a user-run loopback
> service, recommended as an MCP server) — while the downstream
> **redact → LLM → log → citations** path stays identical regardless of backend.

This is the concept that lets [[rag|Vault RAG]] be both *out-of-box for newcomers*
and *a reusable local asset for power users* without forking the privacy story. The
two backends differ only in *how* the top-K chunks are fetched; everything after
retrieval — and every guarantee in [[egress-governance]] / [[threat-model]] — is
unchanged. Settled across three ADRs: `ADR-0032` (the built-in design), `ADR-0033`
(the pluggable abstraction + the choice), `ADR-0034` (how main talks to an external
backend).

## The one interface

`RetrievalBackend.retrieve(query, k, scope) → [{ text, source, headingPath?, score }]`
(`ADR-0033`). A backend does **local retrieval only** — it never calls an LLM and
never sees the API key. The selector lives in `prefs.rag` (mirrors the `llm` block,
`ADR-0034`):

```
{ backend: 'builtin' | 'external',
  external?: { transport: 'http' | 'mcp', endpoint: string, toolName?: string } }
```

Default **builtin**; a missing/malformed block sanitizes to builtin — the safe,
out-of-box default (`ui/src/main/rag/index.ts` `readRagConfig`). The choice is made
at **onboarding** and is changeable in **Settings → (Knowledge/RAG)**: *"Where should
Hark search your notes? Built-in (works out of the box) · Connect my own (external
tool / MCP server)."* (`ADR-0033`).

## Two implementations

### Built-in (default, out-of-box)

The Swift engine's CoreML embedder (ANE, multilingual `multilingual-e5-small` default,
384-dim) + brute-force in-memory cosine + an FSEvents watcher, exactly per `ADR-0032`.
Fully self-contained — nothing external to run. The index is an **offset-only**
rebuildable cache in app-data (`vectors.bin` + `meta.jsonl` + `manifest.json`); the
`meta.jsonl` holds pointers only (`chunk_id`, `note_path`, `heading_path`,
`char_start/char_end`, `content_hash`) and **never raw note text** — at retrieve time
the engine reads the snippet live from the vault and skips any chunk whose file is
missing or changed-since-index (`ADR-0032`). See [[rag]] for the embedder / index /
chunker detail. Reached from the renderer over the loopback WebSocket via
`rag.retrieve`/`rag.results` ([[wire-protocol]]).

### External (recommended: a loopback MCP server)

A **user-run local retrieval service** — recommended as a **loopback MCP server** so
the same 2nd-brain index is reusable by Claude Desktop, the user's scripts, any MCP
client (the user's stated motivation, `ADR-0033`). Hark connects as a **client**. The
client is hand-rolled in Electron main with raw `fetch` — **no MCP SDK, no new
dependency** — consistent with `ADR-0029`'s no-SDK egress style (`ADR-0034`). Two
transports, chosen by config:

- **`http`** — `POST <endpoint>` with `{ query, k, scope }` → `200 { chunks: [...] }`;
  a ~20-line local server satisfies it. *Test connection* = a canned `k:1` retrieve.
- **`mcp`** — MCP over Streamable HTTP (loopback): a minimal JSON-RPC client doing
  `initialize` → `notifications/initialized` → `tools/call`, carrying any
  `Mcp-Session-Id` and accepting a JSON or SSE response. *Test connection* =
  `initialize` + `tools/list` asserting `toolName` exists.

Choosing external means Hark's CoreML embedder model is **never downloaded** — the
leanness win for that audience (`ADR-0033`). See [[external-rag-client]] for the
client internals and [[vault-rag-decisions]] for the digest.

## Where the branch is decided

The fork is in the **renderer**, keyed on `prefs.rag.backend` (`ADR-0034`):

- `ui/src/app/services/retrieval.service.ts` — [[retrieval-service|RetrievalService]]
  hides the switch. `isExternal()` is `prefs.ragBackend() === 'external'`. `retrieve()`
  routes **external → `window.hark.rag.retrieve`** (main's loopback client) and
  **built-in → `engine.retrieve`** (the WebSocket). If external is chosen but the
  bridge is absent, it **fails honestly** rather than silently falling back to the
  engine the user opted out of.
- `ui/src/main/rag/index.ts` — the **external client only**. `retrieve()` reads the
  config, enforces the loopback guard *before any fetch*, dispatches to the `http`/`mcp`
  transport, and maps external chunks into the shared `RagResultChunk` shape.

External chunks map `source → note_path`, `headingPath → heading_path`, and carry
`char_start/char_end = 0` — the external backend owns its own addressing; the built-in
offsets power a future jump-to-source, so offset-based deep-linking is **built-in-only**
(`ADR-0034`, `mapChunk`).

## What stays identical (the point)

Whichever backend returns the top-K chunks, **the downstream path never moves and
lives in Hark's main process**: redact (for cloud) → `llm.ask` → log the call →
render citations (`ADR-0033`). The egress chokepoint + governance (`ADR-0029`/`0031`)
are single-sited and unchanged — see [[egress-governance]]. Both backends produce the
**same `RagResultChunk` shape**, so the Ask panel renders either identically (slice
4c). Only the **redacted top-K + question** ever leave on a cloud LLM; a **local LLM
⇒ zero egress** (`ADR-0031`), independent of backend.

## Invariants

1. **One interface, two impls.** `retrieve(query, k, scope) → chunks`; a backend does
   local retrieval only — never an LLM call, never the API key (`ADR-0033`).
2. **Built-in is the default and the safe fallback.** Missing/malformed `prefs.rag`
   sanitizes to builtin (`readRagConfig`); onboarding defaults to built-in (`ADR-0033`).
3. **External is loopback-only.** The endpoint host MUST be `localhost`/`127.0.0.1`/
   `::1` — the same `isLocalEgress` check — refused before any network I/O. Retrieval
   results are vault content flowing *back into* Hark, so a remote backend would put
   vault content on the network (`ADR-0033`/`0034`). See [[egress-governance]].
4. **Local indexing is guaranteed only for built-in.** The external backend indexes
   locally by the user's choice/assurance; Hark guarantees fully-local indexing only
   for the built-in backend, and the onboarding/Settings copy says so (`ADR-0033`).
5. **The downstream redact → LLM → log → citations path is backend-agnostic.** It
   stays in main, single-sited (`ADR-0029`/`0031`); the backend never sees it.
6. **No new dependency for the external client.** Hand-rolled raw `fetch`, covering
   only the slice used (`initialize` + `tools/call`, JSON or basic SSE); an SDK is a
   future ADR if MCP usage grows (`ADR-0034`).

## Sources

- [ADR-0032](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0032-vault-rag-architecture.md) — the built-in backend
  (engine CoreML embedder + brute-force offset-only index + watcher).
- [ADR-0033](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0033-pluggable-retrieval-backend.md) — the `RetrievalBackend`
  abstraction; built-in vs external, user-chosen at onboarding.
- [ADR-0034](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0034-external-retrieval-transport.md) — external transport:
  hand-rolled loopback `http` + minimal MCP-over-HTTP, no SDK.
- `ui/src/app/services/retrieval.service.ts` — renderer-side backend switch.
- `ui/src/main/rag/index.ts` — main-process external-client facade.

Related: [[rag]] · [[external-rag-client]] · [[retrieval-service]] ·
[[markdown-second-brain]] · [[vault-rag-decisions]] · [[glossary]]
