---
type: subsystem
title: External RAG client (loopback transport)
status: current
sources: ["ui/src/main/rag/mcp.ts", "ui/src/main/rag/http.ts", "ui/src/main/rag/loopback.ts", "ui/src/main/rag/types.ts", "docs/decisions/0034-external-retrieval-transport.md"]
updated: 2026-06-30
tags: [rag, mcp, http, loopback, electron-main, privacy]
---

# External RAG client (loopback transport)

How Electron main talks to a **user-run local retrieval service** — the external arm of [[pluggable-retrieval]]. Hand-rolled with raw `fetch`, **no MCP SDK, no new dependency**, consistent with the egress layer's no-SDK precedent (`0034`). Picked by [[retrieval-service]] when `prefs.rag.backend === 'external'`.

## Two transports
Config is `{ transport: 'http' | 'mcp', endpoint, toolName? }` (`types.ts`).

- **`http`** (`http.ts`) — the simplest contract: `POST <endpoint>` JSON `{ query, k, scope }` → `200 { chunks: [...] }`. A ~20-line local server satisfies it. *Test connection* is a canned `k:1` retrieve.
- **`mcp`** (`mcp.ts`) — minimal JSON-RPC over Streamable HTTP: `initialize` → `notifications/initialized` → `tools/call { name, { query, k } }`. It carries any `Mcp-Session-Id` the server returns and accepts either a single JSON-RPC response or an SSE (`text/event-stream`) one (`extractRpcFromSse`). The tool's text result is parsed as `{ chunks: [...] }` or a bare array; newer servers' `structuredContent` is preferred. *Test connection* = `initialize` + `tools/list` asserting the configured tool (default `search`) exists. This is the "reusable local asset" path — the same MCP server serves Claude Desktop or any MCP client (`0034`).

## Loopback guard (the privacy gate)
Retrieval results are vault content flowing **back into** Hark, so a remote backend would put vault content on the network. `assertLoopbackEndpoint` (`loopback.ts`) parses the endpoint and **refuses** anything not `http(s)` to `localhost` / `127.0.0.1` / `::1` — the same host set as the LLM layer's `isLocalEgress` — before any `fetch` runs (`0034`). On top of that, both transports set `redirect: 'error'` as an SSRF guard, since a redirect to a remote host would exfiltrate the query and receive vault content off-machine (`http.ts`, `mcp.ts`).

## Content-free by construction
Nothing here logs the query or chunk text — one content-free status line per step; error `detail` derives only from the host + HTTP status (`http.ts`, `mcp.ts`). Bounded timeouts (15 s retrieve, 8 s test) keep a hung backend from stalling the UI. The client never sees the API key and never calls an LLM (`0034`); the downstream egress path stays in [[llm-egress]]. See [[vault-rag-decisions]].
