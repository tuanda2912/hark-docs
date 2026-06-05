---
type: concept
title: Markdown second-brain & roadmap
status: partial
sources: [ADR-0015, ADR-0032, STATUS.md, docs/wiki/WIKI.md, CLAUDE.md]
updated: 2026-06-05
tags: [vault, markdown, second-brain, rag, roadmap, obsidian, git, dogfood]
---

The vault is a plain, **Obsidian-compatible, git-backed markdown folder the user owns** (`~/Documents/vault/hark`, *outside* the repo) — the durable record of every meeting and the substrate the rest of the product builds on: vault-wide RAG, semantic search, and LLM extraction all read it but never own it. It is also the eventual **in-app feature this very project wiki dogfoods** (`docs/wiki/` runs the same Karpathy "LLM wiki" pattern over Hark's own sources). This page also tracks the **Phase 0–7 roadmap** — currently **Phase 7 (packaging / notarization), ~60% done**.

## The idea: markdown is the second-brain substrate

Hark's promise is a **durable, searchable markdown record of every meeting** — a "second brain" the user owns outright, not a row in someone's database (ADR-0015). The design commitments that make the vault a *substrate* rather than just an output:

- **Plain markdown, Obsidian-compatible.** Each meeting is `~/Documents/vault/hark/meetings/YYYY-MM-DD-{slug}.md`: YAML front-matter (`title`, `date`, `duration_sec`, `attendees`, `bookmarks`, `hark_version`) + a `## Transcript` body of blockquoted, wall-clock-timestamped utterances, with 📌 on bookmarked moments (ADR-0015 §1). Post-diarization adds `**Name** · HH:MM:SS` headers and a populated `attendees` array additively. On-demand translation appends a `## Transcript — <lang>` section that is a byte-for-byte structural mirror of the original ([[streaming-finalization]], ADR-0036). Written by the [[vault-writer]].
- **The user owns it, so it stays plain.** No proprietary format, no app-data lock-in — open it in Obsidian, grep it, edit it by hand. This is *why* RAG reads the snippet **live from the vault at retrieve time** instead of caching note text (ADR-0032): the vault is the single source of truth, and a hand-edit or a deletion must take effect immediately.
- **Git-backed, recoverable.** The vault is a **local-only** git repo; every save is a commit, every Discard is a delete-and-commit (recoverable, never auto-deleted) — `CLAUDE.md` rule #4, ADR-0015 §4. No remote, no push: the instant a remote is contemplated, that's a new ADR under rule #6.
- **Sacred.** Hark **reads** the vault for RAG and writes only meeting notes / summaries / translations the user invoked; it never autonomously rewrites or deletes vault files. The RAG index lives in app-data (`~/Library/Application Support/Hark/index/`), *never* in the vault, precisely so Hark isn't a constant autonomous writer in the user's notes (ADR-0032).

## What the substrate powers

The vault is plumbed into three capabilities, each of which treats it as read-only ground truth:

| Capability | What it does with the vault | Lives in |
|---|---|---|
| **Vault-wide RAG / semantic search** | On-device CoreML embedder (`multilingual-e5-small`, 384-dim, ANE) indexes the whole vault; brute-force cosine top-K; **offset-only** index reads snippets live from the vault (ADR-0032) | [[rag]] |
| **LLM extraction** | Summary, this-meeting and vault-wide Q&A — only the redacted top-K chunks + question leave; a local model = zero egress | [[llm-egress]] · [[pluggable-retrieval]] |
| **Pluggable retrieval** | The same vault is searchable via the built-in engine RAG **or** a user-run local external backend (loopback MCP/HTTP), interchangeable at onboarding / Settings | [[pluggable-retrieval]] · [[external-rag-client]] |

The hard local-indexing invariant ([[local-first-guarantee]]): indexing embeds the *whole* vault, so the embedder may **never** be a cloud endpoint — that would egress every note. Only the few retrieved chunks (redacted, if cloud) + the question ever leave (ADR-0032).

## Dogfooding: the project wiki is the same pattern

The wiki you are reading (`docs/wiki/`) is the **dogfood** for the eventual in-app second-brain feature, called out explicitly in `WIKI.md` and `STATUS.md`. Both apply [Karpathy's "LLM Wiki" pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f): a persistent, interlinked set of plain-markdown pages an LLM maintains over a corpus of sources, so a reader (or a fresh session) browses the digest instead of re-deriving everything from raw material.

| | This project wiki (`docs/wiki/`) | The in-app feature (the user's vault) |
|---|---|---|
| Corpus | 38 ADRs, `CLAUDE.md`, `STATUS.md`, handoff, code | the user's meeting notes + synced Obsidian notes |
| Output | interlinked markdown pages + `index.md` + `log.md` | RAG answers + citations over the vault |
| Linking | Obsidian `[[wikilinks]]` (Hark's own `TranscriptLine` renders these too) | the same |
| Maintainer | an LLM session, human curates | the engine RAG + LLM layer |

> The same Obsidian wikilink syntax is load-bearing in both: `WIKI.md` notes Hark's own `TranscriptLine` renders `[[slug]]` links, so a vault note can cross-link like a wiki page.

## Roadmap — Phase 0–7

Status snapshot from `STATUS.md` (2026-06-04). Phases 0–6 + translation are **shipped**; **Phase 7 is current (~60%)**.

| Phase | Scope | Status |
|---|---|---|
| **0** | RTF harness — validated 0.075 on M4 (ADR-0005) | ✅ done |
| **1–3** | Batch transcribe; capture (Process Taps + mic, 16 kHz mono); `harkd` streaming engine + loopback WebSocket; `utterance_id` v2 overlap rule (ADR-0008/0009/0011/0012) | ✅ done — [[engine-harkd]] · [[audio-capture]] · [[wire-protocol]] |
| **4** | Electron + Angular 21 UI: live transcript + live-tail, menu-bar tray, Settings + prefs persistence (ADR-0014) | ✅ done — [[ui-shell]] · [[tray]] |
| **5** | Offline FluidAudio diarization; engine **writes** diarized markdown to the vault + per-meeting local git (ADR-0015/0016/0017); utterance supersession (ADR-0018) | ✅ done — [[vault-writer]] · [[diarization]] |
| **5.1** | Speaker enrollment (opt-in voiceprints in `vault/.speakers/`), privacy/data-control model, on-screen back-annotation, meeting-audio persistence (ADR-0024/0026/0027/0028) | ✅ done — [[speaker-enrollment]] · [[audio-store]] · [[privacy-data-control]] |
| **6** | Provider-agnostic LLM (summary · this-meeting Q&A · vault-wide Q&A) + **vault RAG** (built-in CoreML embedder + pluggable external backend) behind egress governance (ADR-0029/0030/0031/0032/0033/0034) | ✅ done — [[rag]] · [[llm-egress]] · [[pluggable-retrieval]] |
| **(translation)** | On-demand, **post-stop** structured per-utterance translation; live translation deferred (ADR-0036/0037) | ✅ done — [[streaming-finalization]] |
| **7** | **Packaging / notarization (CURRENT, ~60%).** electron-builder + signed Swift sidecar + hardened-runtime entitlements + `kTCCServiceAudioCapture` attribution (ADR-0021/0038) | ⏳ in progress — [[packaging-distribution]] · [[electron-main]] |

**Phase 7 remaining** (`STATUS.md` ⏳ Next up): an app icon (`ui/build/icon.icns`) — *partly landed* per recent commit `8efdfde` "Heard ripples" app icon; a **TCC-attribution check** on a signed build (the mic / system-audio prompt must say **"Hark"**, not "Electron"); and the **notarize / staple** last mile, which needs a **paid Apple Developer Program** membership + a **Developer ID Application** cert (the free "Apple Development" cert signs but can't notarize). Plus remaining on-device testing and onboarding polish.

> TODO(wiki): reconcile the exact Phase-7 percentage and the app-icon item — `STATUS.md` (2026-06-04, "~60% done", icon listed as *remaining*) predates commit `8efdfde` which adds the "Heard ripples" app icon. Re-ingest `STATUS.md` once it's bumped.

## The in-app second-brain — what's not built yet

The wiki dogfoods the *pattern*; the **in-app** version (an LLM-maintained, interlinked digest *over the user's vault*, beyond Q&A) is **future work**. v1 ships the substrate (markdown vault, git, RAG, LLM extraction, citations); the auto-maintained wiki-over-your-meetings layer is not a v1 deliverable.

> TODO(wiki): there is no dedicated ADR for an *in-app* second-brain wiki feature; it's described as the dogfood target in `WIKI.md` / `STATUS.md` but not yet scoped. Link a future ADR here when one lands.

## Where this concept lives

- **Writes the substrate:** [[vault-writer]] (markdown + per-meeting git) · [[audio-store]] (opt-in WAV).
- **Reads the substrate:** [[rag]] (embedder + offset-only index) · [[pluggable-retrieval]] (built-in vs external) · [[external-rag-client]] · [[llm-egress]] (extraction).
- **Surfaced to the user:** [[ui-shell]] (transcript, Ask panel scope toggle, citations).
- **The promise it embodies:** [[local-first-guarantee]] (the vault never egresses to be embedded).
- **Decision history:** [[vault-rag-decisions]] (ADR-0032/0033/0034).
- **Terms:** [[glossary]] (vault, offset-only, chunk, `utterance_id`, ANE, e5).

## Governing ADRs

- [ADR-0015](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0015-transcript-vault-persistence.md) — Transcript persistence to the vault; **Accepted**. Markdown format, auto-save on `capture.stop`, local-only git, vault-is-sacred. Writer moved from Electron main to the engine in Phase 5 (per ADR-0016).
- [ADR-0032](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0032-vault-rag-architecture.md) — Vault-wide RAG: engine-side on-device CoreML embeddings + brute-force retrieval, **offset-only** app-data index (never the vault), FSEvents freshness; **Accepted**.
- `STATUS.md` — the Phase 0–7 roadmap and current state (Phase 7, ~60%).
- `docs/wiki/WIKI.md` — the wiki schema; names this wiki as the dogfood for the in-app second-brain.
- `CLAUDE.md` — hard rules #2 (vault is the only place for transcripts/PII) and #4 (the vault is sacred; all changes via git).

## Invariants

- **The vault is plain, Obsidian-compatible markdown** the user owns, at `~/Documents/vault/hark` — *outside* the repo (`CLAUDE.md`, ADR-0015).
- **The vault is sacred:** never auto-deleted or auto-rewritten; all changes are git commits so history is recoverable (`CLAUDE.md` rule #4, ADR-0015 §4). Git is **local-only** — no remote, no push.
- **Nothing user-content lands outside the vault:** the RAG index and caches live in `~/Library/Application Support/Hark/`, never in the vault (`CLAUDE.md` rule #2, ADR-0032).
- **RAG reads the vault live and never caches note text** (offset-only index): a deleted/edited note takes effect at the next retrieve; stale offsets are skipped (ADR-0032).
- **The whole-vault embedder is always local** — a cloud embedder would egress every note (ADR-0032 local-indexing invariant; see [[local-first-guarantee]]).
- **The project wiki and the in-app feature share one pattern and one link syntax** (Karpathy LLM-wiki + Obsidian `[[wikilinks]]`, per `WIKI.md`).
