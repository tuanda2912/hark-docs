---
type: concept
title: Pluggable retrieval backend
status: current
sources: ["docs/decisions/0033-pluggable-retrieval-backend.md", "docs/decisions/0034-external-retrieval-transport.md"]
updated: 2026-06-30
tags: [rag, retrieval, mcp, architecture, privacy]
---

# Pluggable retrieval backend

The idea that **where Hark searches your notes is the user's choice**, behind one interface. Neither pure option wins: built-in is out-of-box but Hark-locked + heavy; external is lean + reusable but needs a running service. So retrieval is pluggable, chosen at onboarding and changeable in Settings (`0033`).

## The abstraction
A single `RetrievalBackend` contract — `retrieve(query, k, scope) → [{ text, source, headingPath?, score }]` — with two implementations (`0033`):

- **Built-in (default):** the engine's on-device CoreML embedder + brute-force index + FSEvents watcher, exactly per `0032`. Self-contained; nothing external to run. Implemented in [[rag]].
- **External:** a user-run **local** retrieval service Hark connects to as a client — recommended as a loopback **MCP server** so the same 2nd-brain index is reusable by Claude Desktop, scripts, any MCP client. Plain loopback HTTP is the alternative transport (`0033`, `0034`). Users who pick external skip the built-in CoreML model download entirely — the leanness win. Implemented in [[external-rag-client]].

## What stays fixed
The choice is local-only on both sides. Whichever backend returns the top-K, **Hark's main process redacts (for cloud), calls the LLM, logs the call, and renders citations** — the egress chokepoint never moves (`0033`; [[llm-egress]]). The backend only does *local retrieval*; it never calls an LLM and never sees the API key.

## The loopback invariant
The external backend **must be loopback** (`localhost` / `127.0.0.1` / `::1`); Hark refuses a non-local endpoint (`0034`). Retrieval results are vault content flowing *back into* Hark, so a remote backend would put vault content on the network — the same rule as the embedder and LLM. Hark *guarantees* local indexing only for the built-in backend; for external, local indexing is the user's assurance, which the onboarding copy states (`0033`).

## Transport (the external pin)
`0034` pins the external transport: hand-rolled `fetch`, no MCP SDK, two transports (`http`, `mcp`), loopback-guarded. See [[external-rag-client]] for the mechanics and [[vault-rag-decisions]] for the decision trail.
