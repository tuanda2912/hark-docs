---
type: subsystem
title: RetrievalService & TranslationJobService — renderer orchestrators
status: current
sources: [ADR-0032, ADR-0033, ADR-0034, ADR-0035, ADR-0036, ADR-0037, ui/src/app/services/retrieval.service.ts, ui/src/app/services/translation-job.service.ts]
updated: 2026-06-05
tags: [renderer, rag, retrieval, translation, egress, privacy]
---

# RetrievalService & TranslationJobService — renderer orchestrators

Two small Angular renderer services that **orchestrate** without ever touching a socket or the network themselves:

- **`RetrievalService`** forks a vault-scope Ask between the **built-in engine index** (over the WebSocket, [[engine-service]]) and a **user-run external loopback retrieval service** (via Electron main's client, [[external-rag-client]]) per `prefs.rag.backend` — both backends return the **same `RagResultChunk` shape**, so the Ask panel renders either identically (ADR-0033/0034).
- **`TranslationJobService`** runs on-demand **post-stop** transcript translation as a one-utterance-at-a-time **background job**, persisting through the engine's single vault writer (ADR-0037, building on ADR-0036).

Both are thin: they pick a path and shuttle data; the privacy-governed work (egress, redaction, vault writes) lives downstream and is unchanged regardless of which path they pick. See [[pluggable-retrieval]] and [[translation]].

## Code map

_Grounded in the understand-anything graph (commit 8efdfde, 2026-06-05, code-only)._

**Layer:** UI Renderer (Angular).

**Files:**

- `ui/src/app/services/retrieval.service.ts` — thin service that routes vault retrieval either to an external RAG bridge or to the engine's built-in retrieval depending on the configured backend.
- `ui/src/app/services/translation-job.service.ts` — service running a single queued post-stop translation job: translates transcript utterances one at a time via the LLM and writes the grown-in-place lines back through the engine.

**Key types & functions:**

- `class RetrievalService` (retrieval.service.ts, Lx–Ly: L22–L56) — injectable retrieval dispatcher choosing between an external bridge and the engine's `retrieve` method based on the preferences RAG backend.
- `class TranslationJobService` (translation-job.service.ts, Lx–Ly: L54–L139) — injectable job runner that queues translation requests, drains them sequentially via `LlmService.translateSegment`, tracks progress in a signal, and persists results through `EngineService.writeTranslationLines`.

**Pinned by tests:** none in the slice.

**Connections:**

- imports → [[subsystems/engine-service|EngineService]]
- calls → [[subsystems/engine-service|EngineService]]
- imports → [[subsystems/wire-protocol|Wire protocol]]
- imports → [[subsystems/llm-service|LlmService]]
- calls → [[subsystems/llm-service|LlmService]]
- imports → [[subsystems/ui-shell|UI shell]] (PreferencesService)
- ⇐ imports [[subsystems/ui-shell|UI shell]]
- ⇐ calls [[subsystems/ui-shell|UI shell]]

## What they do

### RetrievalService — the backend switch

`ui/src/app/services/retrieval.service.ts` is the renderer-side `RetrievalBackend` selector from ADR-0033. A vault-scope Ask needs top-K chunks from *somewhere*; the user chooses where at onboarding / Settings, stored in `prefs.rag.backend`:

- **`isExternal()`** — a `computed` signal, `true` when `prefs.ragBackend() === 'external'`. Drives the Ask panel's backend label and which channel `retrieve()` uses.
- **`retrieve(query, { k?, scope? })`** — returns `Promise<readonly RagResultChunk[]>`:
  - **built-in** (default) → `this.engine.retrieve(...)` — the engine's local CoreML index over the loopback WebSocket (`rag.retrieve` → `rag.results`, the one request/reply exchange on the wire; ADR-0032, [[rag]], [[engine-service]]).
  - **external** → `window.hark.rag.retrieve(...)` — main's loopback-guarded client to a user-run local retrieval service (ADR-0034, [[external-rag-client]]).
  - If external is chosen but the `window.hark.rag` bridge is absent (outside Electron, or an old main without the rag surface), it **throws** `'external retrieval backend unavailable'` rather than silently falling back to the engine the user opted out of.

The service **hides the fork**: the Ask host calls `retrieve()` and gets chunks regardless of backend. Neither path is a remote call — built-in is loopback WS, external is loopback-guarded in main — and the downstream redact→LLM→citations path ([[llm-egress]]) is identical either way.

### TranslationJobService — post-stop background translation

`ui/src/app/services/translation-job.service.ts` is the canonical translation surface after ADR-0037 removed live translation. When the user opens the Translate panel on a saved-meeting card and picks a target language, it translates the **clean, stable post-stop transcript** as a non-blocking background job:

- **`start(sessionId, lang, texts, knownNames)`** — enqueues a job. `texts` is one entry per saved-transcript utterance, *in the order the engine saved them*, so the engine can zip `translated[i]` with its retained `utterance[i]`. No-op on empty input / blank language. Returns immediately; progress shows via signals.
- **Per-utterance loop** — translates each line **one at a time** (not the whole blob). Per-utterance is deliberate: progress is smooth (one step per line) and a small local model adheres better to a short input than to a giant prompt. Each line goes through `LlmService.translateSegment` ([[llm-service]]).
- **Progress signals** — `job` (a readonly `TranslationJobState`: `sessionId`, `lang`, `total`, `done`, `phase`, optional `detail`) and `percent` (a `computed` 0–100). Drives the existing non-blocking banner.
- **On completion** — sends the **ordered** translated lines to the engine via `EngineService.writeTranslationLines(sessionId, lang, out)`. The engine renders the `## Transcript — <lang>` section from its **own retained per-utterance structure** (label + wall-clock + blockquote), zipping in these lines — a byte-for-byte **structural mirror** of the original, not a divergent reconstruction (ADR-0036, [[vault-writer]]). It then calls `LlmService.flushLiveTranslate()` to commit the aggregated cloud-log roll-up.
- **Failure** — a single line failure **aborts the whole job** (`phase: 'error'`, content-free `detail`) — a partial translation written to the vault would be misleading. A model returning nothing falls back to the original line so the section never has a blank entry.
- **Job queue** — a second meeting stopping while one is translating runs *after* (`queue` + a `running` re-entrancy guard in `drain()`); each writes its own `session_id`, so neither is lost. `dismiss()` clears the finished/errored banner but is a no-op while a job is running.

## Key files

- `ui/src/app/services/retrieval.service.ts` — the `RetrievalBackend` fork (built-in WS vs external bridge).
- `ui/src/app/services/translation-job.service.ts` — the post-stop background translation job runner + queue.
- `ui/src/app/services/engine.service.ts` — provides `retrieve()` (built-in path) and `writeTranslationLines()` (the structured persist). See [[engine-service]].
- `ui/src/app/services/llm.service.ts` — provides `translateSegment()` + `flushLiveTranslate()`. See [[llm-service]].
- `ui/src/app/services/preferences.service.ts` — `ragBackend()` signal the switch reads (`prefs.rag.backend`).
- `ui/src/app/services/engine.types.ts` — `RagResultChunk` (`text`, `note_path`, `heading_path`, `char_start`, …), the shared shape both backends return.

## How it connects

```
                 Ask panel (vault scope)                Translate panel (saved card)
                        │                                         │
                        ▼                                         ▼
                 RetrievalService                        TranslationJobService
                 (prefs.rag.backend)                     (per-utterance loop + queue)
                  ┌──────┴───────┐                         │              │
          builtin │              │ external                │ per line     │ on done
                  ▼              ▼                          ▼              ▼
        EngineService.retrieve   window.hark.rag    LlmService          EngineService
        (WS rag.retrieve →       .retrieve          .translateSegment   .writeTranslationLines
         rag.results)            (main loopback     → main (egress      → engine renders
         → engine local index     client)            chokepoint)          ## Transcript — <lang>
        engine-service           external-rag-client    llm-service /         from retained structure
        rag                                             llm-egress            vault-writer
```

- **[[engine-service]]** — the built-in retrieval path (`rag.retrieve`/`rag.results` over the WebSocket) and the structured-translation persist (`writeTranslationLines`).
- **[[external-rag-client]]** — the external retrieval path: `window.hark.rag.retrieve` → IPC → main's loopback-guarded `fetch` client (HTTP or minimal MCP-over-HTTP, ADR-0034).
- **[[rag]]** — the built-in CoreML embedder + brute-force index the engine path queries.
- **[[llm-service]]** / **[[llm-egress]]** — `translateSegment` forks through main, the egress chokepoint: local model ⇒ zero egress; cloud model ⇒ per-line redaction + an aggregated metadata-only log entry flushed via `flushLiveTranslate`.
- **[[vault-writer]]** — the engine is the single vault writer + git committer; the job never writes the vault itself.
- **[[ui-shell]]** — both services are `providedIn: 'root'` Angular services consumed by panels in the renderer shell.
- **[[preload-security]]** — `window.hark.rag` is exposed across the contextBridge; the external fork degrades honestly when the surface is absent.

## Governing ADRs

- **[ADR-0032](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0032-vault-rag-architecture.md)** — built-in vault RAG (engine CoreML embedder + brute-force index + `rag.retrieve`/`rag.results`). This is the built-in retrieval backend. See [[vault-rag-decisions]] / [[rag]].
- **[ADR-0033](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0033-pluggable-retrieval-backend.md)** — the `RetrievalBackend` abstraction: built-in (default) **or** external local service, user-chosen. The fork `RetrievalService` implements in the renderer. See [[pluggable-retrieval]].
- **[ADR-0034](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0034-external-retrieval-transport.md)** — the external transport (hand-rolled loopback HTTP + minimal MCP-over-HTTP in main, no SDK) and where the branch lives: renderer picks per `prefs.rag.backend`, main is the external client only. Both produce the same `RagResultChunk`. See [[external-rag-client]].
- **[ADR-0035](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0035-live-translation-arbitrary-target.md)** — *superseded in part by ADR-0037.* Introduced per-segment LLM translation and the background `TranslationJobService` (originally a ~24-line-chunk job persisting via `writeTranslation`). The job mechanism is retained; the live portion was removed.
- **[ADR-0036](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0036-grow-in-place-finalization.md)** — export-only grow-in-place finalization: the saved transcript's retained per-utterance structure the engine zips translated lines into (the structural mirror). See [[streaming-finalization]].
- **[ADR-0037](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0037-defer-live-translation.md)** — *supersedes ADR-0035's live portion.* Translation is now an on-demand, post-stop action only. Rewired the Translate panel from the legacy blob path (`writeTranslation`/`appendTranslation`) to the structured per-utterance job (`TranslationJobService` → `translateSegment` per line → `writeTranslationLines` → engine `appendTranslationStructured`). See [[translation]].

## Invariants

1. **No socket, no network in either service.** Both are pure orchestrators; the WebSocket lives in [[engine-service]], the external client + egress live in main. Code review of any change here must keep it that way.
2. **Identical chunk shape across backends.** Built-in and external retrieval both return `readonly RagResultChunk[]`; the Ask host renders either without knowing the backend. External chunks carry `char_start/char_end = 0` (jump-to-source by offset is built-in-only, ADR-0034) — a shape-level difference, not a render fork.
3. **No silent fallback.** When external is chosen but unavailable, `retrieve()` throws — it never silently queries the engine the user opted out of (ADR-0033's loopback-only, user-choice contract).
4. **Translation persists only via the engine.** `TranslationJobService` writes the vault solely through `EngineService.writeTranslationLines`; the engine remains the single vault writer + git committer ([[vault-writer]], CLAUDE.md rule #2/#4).
5. **Order is load-bearing.** `texts[i]` must match the engine's saved utterance order so `translated[i]` zips with `utterance[i]`; the engine supplies label + wall-clock, the job supplies only the translated body (the structural mirror, ADR-0036).
6. **Abort over partial.** A single line failure aborts the whole job — a half-translated section in the sacred vault would mislead.
7. **Egress stays governed downstream.** Per-line translation goes through main's chokepoint: local ⇒ zero egress; cloud ⇒ per-line redaction + ONE aggregated metadata-only log entry (`flushLiveTranslate`), never per-line log rows ([[egress-governance]], [[llm-egress]]).

> TODO(wiki): the aggregated cloud-log entry for a post-stop job still reuses the live-translation roll-up label in main (ADR-0037 consequence #3) — accurate as metadata, but a candidate refinement if the `translate-live` label confuses. See [[glossary]].
