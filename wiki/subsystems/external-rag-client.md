---
type: subsystem
title: External RAG retrieval client
status: current
sources: [ADR-0033, ADR-0034, ADR-0029, ui/src/main/rag/index.ts, ui/src/main/rag/loopback.ts, ui/src/main/rag/http.ts, ui/src/main/rag/mcp.ts, ui/src/main/rag/parse.ts]
updated: 2026-06-05
tags: [rag, privacy, egress, electron-main, ipc]
---

A loopback-only vault-retrieval client in Electron main, used **only when**
`prefs.rag.backend === 'external'`: a hand-rolled raw-`fetch` client (no MCP SDK)
with two transports — plain HTTP and a minimal MCP-over-Streamable-HTTP slice —
gated by `assertLoopbackEndpoint` + `fetch redirect:'error'` (SSRF closed) and
mapping every result into the same chunk shape the built-in engine path emits.

## Code map

**Layer:** Privacy & LLM Egress.

**Files:**

- `ui/src/main/rag/index.ts` — facade: reads backend config from prefs, enforces loopback-only endpoints, clamps result count, dispatches `retrieve`/`testConnection` to the HTTP or MCP transport.
- `ui/src/main/rag/loopback.ts` — privacy guard asserting a configured endpoint resolves to a loopback host before any fetch (ADR-0034: retrieval traffic never leaves the machine).
- `ui/src/main/rag/http.ts` — plain-HTTP transport: loopback POST with abort-timeout, mapping fetch failures to content-free verdicts.
- `ui/src/main/rag/mcp.ts` — minimal MCP-over-Streamable-HTTP client: hand-rolled JSON-RPC handshake, tool calls, SSE extraction, no SDK (ADR-0029).
- `ui/src/main/rag/parse.ts` — defensively coerces untrusted backend responses into well-formed `RetrievedChunk`s, discarding malformed entries.
- `ui/src/main/rag/types.ts` — type defs: transport selection, backend config (mirrors prefs), retrieved-chunk shapes, connection-result verdicts.

**Key types & functions:**

- `retrieve` (index.ts, L77–99) — reads config, validates loopback, clamps `k`, routes to MCP/HTTP, maps results into renderer-shaped chunks.
- `testConnection` (index.ts, L106–121) — reads config, enforces loopback, delegates a connection probe to the configured transport.
- `assertLoopbackEndpoint` (loopback.ts, L23–43) — parses the endpoint URL and throws unless its host is a recognized loopback address.
- `httpRetrieve` (http.ts, L23–57) — POST retrieve with abort timeout; coerces the untrusted response into chunks.
- `httpTestConnection` (http.ts, L61–92) — canned-query probe returning a content-free verdict.
- `mapFetchError` (http.ts, L97–108) — translates raw fetch/abort errors into content-free detail strings.
- `rpc` (mcp.ts, L36–105) — one JSON-RPC request over Streamable HTTP, parsing JSON or SSE-framed responses.
- `handshake` (mcp.ts, L135–151) — `initialize` exchange + `initialized` notification.
- `extractRpcFromSse` (mcp.ts, L110–124) — scans the SSE stream for the data line whose JSON-RPC `id` matches.
- `mcpRetrieve` (mcp.ts, L156–178) — handshake then call the search tool; coerce tool JSON into chunks.
- `mcpTestConnection` (mcp.ts, L181–210) — handshake + `tools/list`, verifying the configured tool exists.
- `extractToolJson` (mcp.ts, L214–226) — pulls text content out of a tool-call result envelope and parses it.
- `coerceExternalChunks` (parse.ts, L18–35) — validates the untrusted array, mapping well-formed entries to `RetrievedChunk`, dropping the rest; never throws.

**Pinned by tests:** none in slice.

**Connections:**

- ⇐ imports [[subsystems/electron-main|Electron main]] (`main.ts` → `index.ts`/`types.ts`; `prefs.ts` → `types.ts`)
- ⇐ imports [[subsystems/preload-security|Preload security]] (`preload.ts` → `types.ts`)
- imports → [[subsystems/electron-main|Electron main]] (`index.ts` → `prefs.ts`)
- calls → [[subsystems/electron-main|Electron main]] (`retrieve` → `loadPrefs`)

## What it does

Hark's vault RAG is **pluggable** (ADR-0033): retrieval comes from either the
**built-in** backend (the engine's CoreML embedder + index, queried over the
loopback WebSocket — see [[rag]]) or an **external** backend (a user-run *local*
retrieval service). The renderer picks the path per `prefs.rag.backend`; this
module (`ui/src/main/rag/`) is the **external client only**. When the backend is
built-in, this module is never invoked.

It does five things and nothing more (`ui/src/main/rag/index.ts`):

1. Reads `prefs.rag` config (`readRagConfig`) — defaults to `builtin` when
   absent/malformed (the safe, out-of-box default, same posture as the engine).
2. Enforces the **loopback guard** before any network I/O (`assertLoopbackEndpoint`).
3. Clamps an untrusted `k` into `[1, 50]`, default `6` (`clampK`, mirrors the
   engine's `rag.retrieve` clamp).
4. Dispatches to the `http` or `mcp` transport.
5. Maps each backend chunk into the renderer's `RetrievedChunk` shape (`mapChunk`).

This is a **retrieval client, not an egress point**: it talks only to a loopback
service and returns vault chunks to the local renderer. The downstream
redact → LLM → log → citations path stays in `ui/src/main/llm/` ([[llm-egress]],
ADR-0029/0031) regardless of which backend retrieved — the egress chokepoint never
moves (ADR-0033).

## Key files

- `ui/src/main/rag/index.ts` — the main-process facade: `readRagConfig`,
  `retrieve(query, {k, scope})`, `testConnection()`, `clampK`, `mapChunk`.
- `ui/src/main/rag/loopback.ts` — the privacy gate: `isLoopbackHost` +
  `assertLoopbackEndpoint` (throws a content-free `Error` for empty / unparseable /
  non-`http(s)` / non-loopback endpoints before any `fetch`).
- `ui/src/main/rag/http.ts` — the plain-HTTP transport: `httpRetrieve`,
  `httpTestConnection`, and the shared `mapFetchError`.
- `ui/src/main/rag/mcp.ts` — the minimal MCP-over-Streamable-HTTP transport:
  `mcpRetrieve`, `mcpTestConnection`, an internal JSON-RPC `rpc` helper, SSE
  extraction (`extractRpcFromSse`), and `tools/call` result parsing.
- `ui/src/main/rag/parse.ts` — `coerceExternalChunks`: defensive coercion of
  untrusted backend JSON into clean `ExternalChunk[]`.
- `ui/src/main/rag/types.ts` — `RagTransport`, `RagBackendConfig`, `ExternalChunk`,
  `RetrievedChunk`, `RagConnectionResult`.

## The two transports

Both are hand-rolled with raw `fetch` — **no `@modelcontextprotocol/sdk`, no new
dependency** — deliberately consistent with ADR-0029's "raw fetch, no vendor SDK"
choice for the LLM layer (ADR-0034: keeps the bundle lean, the egress surface
auditable, and adds nothing to sign/audit under CLAUDE.md rule #6).

**`http` (plain loopback HTTP).** `POST <endpoint>` with JSON `{ query, k, scope }`
→ `200 { chunks: [{ text, source, headingPath?, score? }] }`. The simplest contract
— a ~20-line local server satisfies it. There is no separate test endpoint: *test
connection* is a canned `k:1` retrieve (`query: 'hark connection test'`). Timeouts:
15 s retrieve, 8 s test, both via `AbortController`.

**`mcp` (MCP over Streamable HTTP, loopback).** A *tiny* slice of MCP, not the full
spec: `initialize` → (best-effort `notifications/initialized`) →
`tools/call { name: toolName, arguments: { query, k } }`. `toolName` defaults to
`search`. Each request carries `Mcp-Protocol-Version: 2025-06-18`; any
`Mcp-Session-Id` returned by `initialize` is echoed on later requests. A response may
be a single JSON-RPC object (`application/json`) **or** Server-Sent Events
(`text/event-stream`) — both are handled (`extractRpcFromSse` scans `data:` lines for
the JSON-RPC message whose `id` matches). The tool's text content (or newer
`structuredContent`) is parsed as `{ chunks: [...] }` or a bare array. *Test
connection* = `initialize` + `tools/list`, asserting the configured `toolName` is
present. This is the "reusable local asset" path (ADR-0033) — the same MCP server can
serve Claude Desktop and the user's other MCP clients, not just Hark.

## How it connects to other subsystems

- **[[rag]] (built-in backend)** — the sibling path. The two are mutually exclusive,
  chosen at onboarding / Settings, selected per `prefs.rag.backend`. Built-in
  retrieves in the engine over the WebSocket ([[wire-protocol]]); external retrieves
  here in main.
- **[[electron-main]]** — this module lives in main and is reached via an IPC handler
  (`hark:rag:retrieve` per ADR-0034) from the renderer's [[retrieval-service]]. Main
  is the right home: the engine ([[engine-harkd]]) stays network-free, and the
  sandboxed renderer ([[preload-security]]) never opens these sockets.
- **[[retrieval-service]]** — the renderer orchestrator that routes to built-in vs
  external and feeds the top-K into the Ask panel ([[ui-shell]]).
- **[[llm-egress]]** — strictly downstream. This module returns vault chunks; the
  redact → LLM → log → citations chokepoint is in `ui/src/main/llm/`. The
  loopback-host set here (`localhost` / `127.0.0.1` / `::1`) is the same one
  `isLocalEgress` uses there.
- **[[pluggable-retrieval]]** / **[[egress-governance]]** — the concepts this
  subsystem embodies: pluggable retrieval with an unchanged, single-sited egress
  chokepoint.

The mapping that lets both backends render identically (ADR-0034, `mapChunk`):
external `source → note_path`, `headingPath → heading_path`, missing `score → 0`,
and `char_start/char_end = 0` — external backends own their own addressing, so the
char offsets that power a future jump-to-source are built-in-only.

## Governing ADRs

- [ADR-0033](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0033-pluggable-retrieval-backend.md) — pluggable
  vault-retrieval backend (built-in OR external local service, user-chosen);
  loopback-only guardrail; downstream egress unchanged. Digest:
  [[vault-rag-decisions]].
- [ADR-0034](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0034-external-retrieval-transport.md) — *this module's*
  ADR: hand-rolled loopback HTTP + minimal MCP-over-HTTP, no SDK; `src/main/rag/`;
  the loopback guard + `redirect:'error'` SSRF defense; the chunk mapping. Digest:
  [[vault-rag-decisions]].
- [ADR-0029](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0029-llm-provider-layer-egress.md) — the "raw fetch, no
  vendor SDK, calls originate in main" precedent this client follows, and the egress
  chokepoint that stays downstream. See [[llm-egress]] / [[egress-governance]].

## Invariants

- **Loopback-only, refused before any `fetch`.** `assertLoopbackEndpoint` throws for
  any endpoint that is empty, unparseable, not `http(s)`, or whose host is not
  `localhost` / `127.0.0.1` / `::1` (ADR-0034). A non-local endpoint never reaches
  the network. Retrieval results are vault content flowing *back into* Hark, so a
  remote backend would put vault content (the query) on the wire and receive vault
  content off-machine — a [[threat-model]] rule #1/#2 violation.
- **SSRF closed via `redirect:'error'`.** The loopback check validates only the
  *initial* URL; a redirect to a remote host would exfiltrate the query + vault
  content. Every `fetch` in `http.ts` and `mcp.ts` sets `redirect: 'error'`, so the
  client refuses redirects outright rather than following them (a local retrieval API
  never redirects).
- **Content-free everywhere.** Nothing logs the query, the response body, or chunk
  text — only one content-free `[rag] …` status line per step. Thrown / returned
  error `detail` strings name only the host + HTTP status / a content-free reason,
  never a body or vault content.
- **Untrusted input is coerced, never trusted.** `coerceExternalChunks` accepts a
  `{ chunks: [...] }` envelope or a bare array, keeps only items with string `text`
  **and** `source`, carries `headingPath` only if a string and `score` only if a
  finite number, and never throws. The JSON-RPC layer validates message shape and
  surfaces only the server-authored `error.message`, never the `error.data` payload.
- **The backend never sees the API key and never calls an LLM** (ADR-0033/0034). This
  module does *local retrieval* only; egress is a separate, downstream concern
  ([[llm-egress]]).
- **`k` is clamped** to `[1, 50]` (default `6`) before it reaches a transport,
  mirroring the engine's `rag.retrieve` clamp; an empty/whitespace query short-circuits
  to `[]`. `testConnection` never throws — a bad config / unreachable host maps to
  `{ ok: false, detail }`; built-in ⇒ a clear "nothing external to test".

## See also

[[glossary]] · [[vault-rag-decisions]] · [[privacy-egress]] · [[pluggable-retrieval]]
