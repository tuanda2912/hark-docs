---
type: decision
title: Vault + RAG decisions
status: current
sources: ["docs/decisions/0015-transcript-vault-persistence.md", "docs/decisions/0028-meeting-audio-persistence.md", "docs/decisions/0032-vault-rag-architecture.md", "docs/decisions/0033-pluggable-retrieval-backend.md"]
updated: 2026-06-30
tags: [decision, vault, rag, persistence, retrieval, privacy]
---

# Vault + RAG decisions

The decision trail behind the vault as Hark's second brain and the local RAG over it. Four ADRs, one through-line: **user content lives in the vault, indexing stays local, and only redacted top-K + the question ever leave.**

## 0015 — transcript → vault (markdown + local git)
Persist each meeting as a markdown file auto-saved on `capture.stop`, in the design-doc format verbatim, committed to a **local-only** git repo (`0015`). Transcripts are user content → the vault, never app-data. Git makes Discard reversible (delete-and-commit, not auto-delete). v1 writes from Electron main (pre-diarization); the write migrates into the engine at Phase 5 with a byte-compatible format. Implemented in [[vault-writer]].

## 0028 — opt-in meeting audio
When — and only when — `keep_audio` is on (default off), write the buffered whole-meeting PCM as a 16 kHz mono WAV to a hidden, **gitignored** `vault/.audio/` folder, keyed to the meeting's markdown stem (`0028`). Reuses the diarization buffer (no second capture) and the `WAVWriter`. Gate off ⇒ zero `.audio/` I/O. Mirrors the `.speakers/` voiceprint precedent: opt-in, vault-only, gitignored, deletable. See [[vault-writer]].

## 0032 — vault RAG architecture
The engine owns the entire local-retrieval pipeline (`0032`): an on-device CoreML embedder (384-dim multilingual default), **brute-force in-memory cosine** over a flat file (not sqlite-vec at personal scale), index stored in **app-data** as a rebuildable cache, and **offset-only** metadata — the cache holds pointers, never note prose, so deleting a note erases its content everywhere. A 30 s-debounced, hash-gated FSEvents watcher keeps it fresh. Implemented in [[rag]].

## 0033 — pluggable retrieval backend
Don't force one backend — make retrieval pluggable behind a `RetrievalBackend` interface: **built-in** (the `0032` engine index, default) or **external** (a user-run loopback retrieval service, recommended as an MCP server so the index is a reusable local asset) (`0033`). The external backend must be loopback; downstream redact → LLM → log → citations governance never moves. The concept is [[pluggable-retrieval]]; the transport is pinned in `0034` (see [[external-rag-client]]).

## Invariant across all four
Indexing and retrieval are local; the vault is sacred (never auto-deleted, history recoverable via git); only the redacted top-K + question cross the [[local-first-egress]] edge, and a local LLM means zero egress.
