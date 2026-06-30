---
type: decision
title: Live translation — deferred to on-demand post-stop
status: current
sources: [docs/decisions/0035-live-translation-arbitrary-target.md, docs/decisions/0037-defer-live-translation.md, docs/design/08-websocket-api-contract.md]
updated: 2026-06-30
tags: [decision, translation, deferred, llm, egress]
---

# Decision — live translation, arbitrary target, deferred

The arc of the translation feature: a per-segment LLM approach for arbitrary target languages
(`0035`), then a reversal removing **live** translation entirely in favour of an on-demand, post-stop
action (`0037`). The **current** decision is deferral — the live portion of `0035` no longer ships (its live target was retracted by `0037`).

## The original problem (`0035`)
Two translation pieces already shipped: §1 end-of-meeting → any language (LLM over the whole saved
transcript) and §2 live → English (free, on-device WhisperKit `task: .translate`). The open piece was
**§3: live translation to an arbitrary non-English target** — genuinely hard on-device. Options
weighed (`0035`):
- **A. Local NLLB-200 (CoreML)** — zero egress, 200 languages, but **~3.2 GB** (5× the speech model)
  and per-segment seq2seq latency. **Deferred.**
- **B. Apple `TranslationSession`** — free, on-device, but **SwiftUI-only API**; Hark has no SwiftUI
  (headless Swift-NIO engine + Electron UI), so it's architecturally incompatible. **Deferred.**
- **C. Per-segment via the already-configured LLM** — zero new infrastructure, reuses the
  [[llm-egress]] chokepoint; local model ⇒ zero egress, cloud ⇒ opt-in + per-line redaction. **Chosen**
  for §3.

`0035` implemented C: a renderer-orchestrated `LiveTranslationService` translated each **finalized**
segment (never partials) through main's egress path, with cloud sends rolled up into one
metadata-only `translate-live` cloud-log entry. The Swift engine was untouched — it still emits only
the original text.

## The reversal (`0037`, supersedes the live portion of `0035`)
Live translation proved **expensive to iterate and brittle to use**: hard to test (needs real capture
+ model + speech), timeout-prone on a small local model, and a **churny live view** as the
finalization watermark retracted/superseded lines while a translated line was interleaved under each
original (`0037` §Context). So:
- **Live translation is removed** — the `→ EN` toggle, the arbitrary-target picker, the per-line live
  binding, and `LiveTranslationService` are gone (`0037`).
- **Translation is now on-demand, post-stop only:** the Translate panel ([[ui-shell]]) is the single
  surface, running a **structured background job** that translates the clean, deduped,
  diarization-labeled transcript per-utterance and commits a `## Transcript — <lang>` section that
  mirrors the original (`0037`).
- **Engine plumbing is left dormant, not deleted** — `capture.start.translation`, the
  `segment.translation` wire field, and main's `translateSegment` remain so revival is cheap (`0037`;
  `docs/design/08-websocket-api-contract.md` documents the `translation` payload). See [[wire-protocol]].

## Net effect
No real-time translated captions today — a deliberate, deferred trade for a calmer transcript and a
faithful, testable saved output. Backlog: an on-device non-English model + decoupling live translation
from the finalization watermark (`0037` §Backlog). Egress governance throughout is [[local-first-egress]].
