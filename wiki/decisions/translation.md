---
type: decision-digest
title: Translation (ADR-0035/0037)
status: current
sources: [ADR-0035, ADR-0037]
updated: 2026-06-05
tags: [translation, llm, egress, privacy]
---

# Translation (ADR-0035/0037)

The two ADRs that pin Hark's **arbitrary-target** translation. ADR-0035 added §3 — live, per-segment translation into any non-English language by reusing the **already-configured LLM and the audited egress chokepoint** (zero new model, zero new socket; a local model ⇒ zero egress). ADR-0037 then **removed the live-during-capture form** (it was brittle, timeout-prone on small local models, and churned against the finalization watermark) and made translation an **on-demand, post-stop action only** — the structured per-utterance Translate panel is now the single surface. The post-stop *structured* path from 0035 is retained; its *live* form is superseded (**0035→0037**). The engine `task: .translate` plumbing and main's `translateSegment` + cloud-log roll-up are left **dormant, not deleted**, so reviving live translation later is cheap. For the running code, see [[llm-egress]], [[llm-service]], [[retrieval-service]] (TranslationJobService), and [[vault-writer]]; for why it's gated, [[egress-governance]].

## At a glance

| ADR | Title | Status | Supersession |
|---|---|---|---|
| 0035 | Live translation to an arbitrary target — per-segment LLM (opt-in) | Accepted — **superseded in part by 0037** | The **live (translate-during-capture) form is superseded by 0037**; the post-stop *structured* per-utterance path is RETAINED and is now the only surface |
| 0037 | Defer live translation — translation is an on-demand, post-stop action only | Accepted (on-device confirmation pending) | **Supersedes 0035** (the live portion only); builds on 0036, 0031, 0029 |

## ADR-0035 — Live translation to an arbitrary target (per-segment LLM)

[../decisions/0035-live-translation-arbitrary-target.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0035-live-translation-arbitrary-target.md) · 2026-06-03 · **Accepted, superseded in part by 0037**

Translation §1 (end-of-meeting → any language, `llm.translate`) and §2 (live → English, WhisperKit `task: .translate`) had shipped. §3 was the remaining gap: **live captions translated into an arbitrary non-English target** (e.g. a Thai meeting showing live Vietnamese). §1 already covers end-of-meeting → any language; §2 already covers live → English (Whisper's `.translate` can only produce English). So §3 = "as the meeting runs, show each finalized line translated into a chosen non-English language" — genuinely hard on-device with no clean winner. The wire + UI were half-ready: `capture.start.translation` carried `{enabled, mode, target_lang}`, `segment.translation` existed on the wire, and `TranscriptLine` already rendered a translation under the original.

Three options weighed:

- **A. Local MT model (NLLB-200 CoreML, ANE)** — zero egress, 200 languages, engine-native like the RAG embedder, **but ~3.2 GB** (5× the speech model, 28× the embedder) plus autoregressive seq2seq per-segment decode latency. **Deferred.**
- **B. Apple Translation framework (`TranslationSession`)** — free, on-device, system models, macOS 14.4 floor, **but architecturally blocked**: it is a *purely SwiftUI* API (only vendable via `.translationTask` on a SwiftUI view, no standalone initializer), and Hark has **no SwiftUI anywhere** (headless Swift-NIO daemon + Electron/Angular UI). Adopting it would mean bolting a hidden SwiftUI/NSApplication host onto the daemon. **Deferred** (open question: re-check whether macOS 26 added a non-UI initializer).
- **C. Per-segment translation via the already-configured LLM** — **zero new infrastructure**: reuses the provider layer ([[llm-egress]]), the egress governance ([[egress-governance]], ADR-0031), and the `segment.translation` + `TranscriptLine` plumbing. A **local model (Ollama/llama.cpp) ⇒ zero egress**; a cloud model ⇒ per-segment egress + cost + per-segment redaction, so it must be **opt-in + egress-disclosed** and is best paired with a local model. **Chosen.**

**Decision:** implement §3 as **Option C** — opt-in per-segment LLM translation of **finalized segments only** (never partials, to bound the call count) — and defer A and B. Orchestrated in the **renderer → main** (the egress chokepoint), exactly like §1: cloud redacts each line first and logs metadata-only; local model = zero egress. The **engine stays network-free** (it only emits the original text; it does NOT translate for arbitrary targets). The saved transcript stays the **original** — live arbitrary translations were a live-view nicety.

As built (key invariants, all now dormant under 0037):

- **Renderer-orchestrated, engine untouched.** `LiveTranslationService` (renderer) listened on `EngineService.segmentFinalized$` (fired ONLY on `segment.final`, never partials, never the post-stop transcript swap), called main's `llm.translateSegment` per finalized line, and wrote the result back via `EngineService.setSegmentTranslation` (filling `segment.translation`, shown under the original by `TranscriptLine`). No engine change, no new model shipped.
- **Egress chokepoint reuse.** `translateSegment` forked identically to `summarize`/`translate`: LOCAL (loopback) → send the line as-is, zero egress; CLOUD → `redact(line, knownNames)` first. `knownNames` is empty live (diarization is post-stop), so the regex detectors do the scrubbing. **privacy-auditor: PASS** (matches the previously-audited path line-for-line).
- **Aggregated cloud-log, not per-line.** Live translation can fire hundreds of times per meeting, which would flood the 500-entry cap and churn the JSON. So per-segment egress is **rolled up in memory** (`recordLiveTranslate`) and flushed as ONE metadata-only `translate-live` entry (`flushLiveTranslate`) — summed in/out chars + redaction total + a line COUNT, never content. Flushed on provider/model/egress change, a 50-line threshold, stop/toggle-off, before any other LLM action, and `before-quit`. *Accepted gap (LOW):* a hard crash between flushes drops ≤~49 lines' worth of *metadata* only — content is never at risk.
- **Auto-translate + save on Stop (background, chunked, added 2026-06-04).** Because live per-segment translation is not itself persisted (post-stop re-segmentation discards live `segment.translation`), when live translation was active at stop the renderer auto-translated the **clean** post-stop transcript via `TranslationJobService` — ~24-line chunks translated sequentially in the background, progress %, persisted via `EngineService.writeTranslation` (single vault writer + git commit), queued by `session_id`. This `TranslationJobService` is the piece that **survives into 0037**.
- **Mutual exclusion + lock.** §3 (non-English picker) was mutually exclusive with §2 (`→ EN`) and locked during capture (chosen before Start). The lock was a UX choice, not a privacy requirement. English was excluded from the §3 picker (§2's on-device path is strictly better); lines already in the target language were skipped.

References inside the ADR: ADR-0029 (egress chokepoint in main), ADR-0031 (redaction + metadata-only log). Status note: the ADR was **not** marked shipped on the build alone — on-device confirmation was pending when 0037 removed the live form.

## ADR-0037 — Defer live translation; on-demand post-stop only

[../decisions/0037-defer-live-translation.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0037-defer-live-translation.md) · 2026-06-04 · **Accepted (implemented, on-device confirmation pending)** · **supersedes ADR-0035** (live portion only); builds on ADR-0036, ADR-0031, ADR-0029

In practice both *live* flavours proved expensive to iterate and brittle to use:

1. **Hard to test** — needs a real capture, a real model, and live speech (slow, timing-dependent, interacts with the finalization watermark of ADR-0019).
2. **Timeout-prone** on a small local model (the realistic M1/16 GB setup): per-line LLM calls during a live meeting either lag the captions or time out.
3. **Messy live view** — interleaving a translated line under each original *while* the finalization watermark retracts/supersedes lines ([[streaming-finalization]], ADR-0009/0019) produced a churny, half-translated, mis-ordered transcript.

Meanwhile the thing the user actually wants — **a faithful translated transcript in the saved note** — is better served *after* the meeting stops, when the transcript is clean, deduped, diarization-labeled, and stable (the structured per-utterance render from ADR-0036, which is cheap to test deterministically).

**Decision:** **remove live translation from the product and put it in the backlog. Translation becomes an on-demand, post-stop action only.** Concretely:

- **UI removed** — the `→ EN` toggle (§2), the `→ translate…` arbitrary-target picker (§3), the per-line live `translation` binding in the transcript, and the `maybeAutoTranslateOnStop` auto-trigger are all gone from the controls bar.
- **Orchestrator removed** — `LiveTranslationService` is deleted, along with the renderer hooks only it used: `EngineService.segmentFinalized$` and `EngineService.setSegmentTranslation`.
- **On-demand path is now canonical** — the **Translate panel** (opened from the saved-meeting card) is the single translation surface. It was rewired from the legacy whole-transcript *blob* path (`LlmService.translate` → `EngineService.writeTranslation` → engine `appendTranslation`) to the **structured background job**: `TranslationJobService` → `translateSegment` per utterance → `EngineService.writeTranslationLines` → engine `appendTranslationStructured`. The engine renders the `## Transcript — <lang>` section from its OWN retained per-utterance structure (label + wall-clock), a byte-for-byte structural mirror of the original (ADR-0036). Progress shows in the existing non-blocking banner; on completion the section is committed to the note ([[vault-writer]]).
- **Engine plumbing left DORMANT, not deleted** — the engine still understands `capture.start`'s `translation:{…}` (the `task: .translate` path) and `translation.write`'s legacy `translation` blob; main still hosts `translateSegment` + the aggregated cloud-log. Nothing in the UI drives the live paths now (`capture.start` never sends `translateToEnglish`; the panel uses the structured `lines` path). Left in place deliberately so reviving live translation is cheap.

**Why on-demand post-stop is the right shape:** faithful output (the structured render mirrors speaker labels, wall-clock, and blockquote formatting — the blob path drifted line counts); cheaper, calmer egress (local = zero; cloud redacts each line + records **one** aggregated metadata-only cloud entry per ADR-0031, not one per line, and not mid-meeting where the user can't review it); deterministically testable; honest local-vs-cloud disclosure **before** the user presses Translate.

**Consequences / accepted negatives:** (1) **No real-time translated captions** — a user who wanted to *read* a translation live no longer can; explicitly deferred, not abandoned. (2) **Dormant dead-ish code** — the engine `task: .translate` path, the legacy `translation` blob (`appendTranslation` + `LlmService.translate` + `EngineService.writeTranslation`), and `meetingSaved$` remain but are UI-unused; a later cleanup ADR may prune the legacy blob path if live translation isn't revived. (3) **Cloud-log label** — the aggregated post-stop entry still uses the live-translation roll-up (`flushLiveTranslate`); the label is a metadata string, accurate enough, refine if it confuses.

**Backlog (when live translation returns):** ship an on-device non-English model (NLLB or Apple Translation) so §3 needs no cloud and no per-line LLM latency; decouple live translation from the finalization watermark (translate only stable, committed lines, debounced); re-introduce the `→ EN` / `→ target` controls + `LiveTranslationService` (git history has the removed implementation).

## Where these decisions live in the code

- **The provider + egress fork** (`translateSegment` / `summarize` / `translate`, the loopback local-vs-cloud test, redaction, and the metadata-only cloud-log) lives in main — see [[llm-egress]] and [[egress-governance]] (ADR-0029/0031). The renderer facade is [[llm-service]].
- **The structured post-stop job** — `TranslationJobService` (chunked, sequential, progress-tracked, queued by `session_id`) — is orchestrated from the renderer; see [[retrieval-service]] (RetrievalService & TranslationJobService).
- **Persistence** of the `## Transcript — <lang>` section (engine `appendTranslationStructured`, single vault writer + git commit) is [[vault-writer]].
- **The removed live path** depended on the streaming finalization watermark; see [[streaming-finalization]] for why interleaving under a retracting watermark was the visual problem 0037 cites.
- Terms like utterance_id, finalization watermark, redaction, and `segment.translation` are in [[glossary]].

> TODO(wiki): confirm the exact repo-relative paths for `TranslationJobService`, the Translate panel, and main's `translateSegment` (the ADRs name `ui/src/app/components/translate-panel.component.ts` and the removed `ui/src/app/services/live-translation.service.ts`, but do not pin the surviving service/main file paths) — fill in when the [[llm-egress]] / [[retrieval-service]] subsystem pages are deepened with code detail.

## See also

[[llm-egress]] · [[llm-service]] · [[retrieval-service]] · [[vault-writer]] · [[egress-governance]] · [[streaming-finalization-decisions]] · [[glossary]]
