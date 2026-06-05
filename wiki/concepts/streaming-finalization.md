---
type: concept
title: Streaming finalization
status: current
sources: [ADR-0008, ADR-0009, ADR-0018, ADR-0019, ADR-0036, engine/Sources/Harkd/SlidingWindow.swift, engine/Sources/Harkd/EngineSession.swift]
updated: 2026-06-05
tags: [streaming, finalization, utterance-id, whisperkit, sliding-window, engine]
---

The engine re-transcribes a **30 s sliding window every 5 s hop** (ADR-0008), so each span of audio is decoded ~6 times, each pass with slightly different WhisperKit segment boundaries. "Streaming finalization" is the set of rules that turn that noisy stream of re-decodes into **stable text** the UI and the vault can trust: `utterance_id` keys partial→final replacement, the v2 **max-denominator** overlap rule stops one re-segmentation from hijacking another's UUID, **supersession** retracts a fragment once a fuller decode subsumes it, **region-based finalization** commits each audio region *exactly once* behind a monotonic watermark, and **grow-in-place** recovers dropped tails into the saved transcript only. The rules live in the [[engine-harkd]] daemon's `UtteranceLedger` + `EngineSession`, ride the [[wire-protocol]] `segment.*` frames, and are consumed by [[engine-service]] on the renderer side.

## The problem these rules solve

WhisperKit doesn't transcribe a stream — it transcribes a buffer. The [[whisperkit-asr]] sliding window hands it a fresh 30 s buffer on every 5 s hop, and WhisperKit re-segments the *whole* buffer each time, routinely shifting segment boundaries by **1–3 seconds** between consecutive passes (ADR-0009 §Context). Naively keying identity on `t_start` (the original 100 ms-bucket rule) gave the same utterance 4+ different UUIDs across windows. Everything below is the machinery that makes a chaotic re-decode loop *look* like a calm, growing transcript — live captions that grow in place, then settle, with no flicker and (since ADR-0036) no lost words in the export.

All of it lives inside `EngineSession`'s actor, which serialises every mutation; `UtteranceLedger` is deliberately **not** thread-safe on its own (`engine/Sources/Harkd/SlidingWindow.swift` header).

## Rule 1 — `utterance_id` keys partial→final replacement

Each window emits its newest speech as `segment.partial` first (live captions), then the same `utterance_id` is re-emitted as the next window refines it — a **replace-in-place** in the UI's segment map. When the region settles, one `segment.final` is emitted for that `utterance_id` and it is **terminal**: no further partial with that id ever arrives (ADR-0009 §Assumptions). The renderer ([[engine-service]]) upserts partials by id and treats the final as the close. This lifecycle was validated early and is treated as **locked** — ADR-0018 and ADR-0019 both go out of their way to layer on top of it rather than reopen it.

## Rule 2 — the v2 max-denominator overlap rule (no UUID hijacking)

Identity across passes is resolved by **interval overlap**, not timestamp equality (`UtteranceLedger.resolve`, `engine/Sources/Harkd/SlidingWindow.swift`). Two segments are "the same utterance" iff:

```
overlap_seconds / max(segLen, entryLen) >= 0.5
```

The **`max` denominator is the v2 fix** (ADR-0009). The original v1 rule (commit `be31c52`) used `min`, which had an **engulfment hole**: when a coarse new pass produced one long segment fully containing a short old entry, `overlap == shorter`, so the score was `1.0` no matter how unrelated the text — letting `"Okay."` get hijacked in place into `"the scheme where they provide the secure so that's the stack okay…"`. With `max`, engulfment scores `shorter / longer`, which falls below 0.5 whenever the lengths differ, so a **fresh UUID is minted** instead. The consciously-accepted price: aggressive re-segmentation mints more ids than v1 did — only the leftmost piece keeps the original UUID; the others become orphans (ADR-0009 §Consequences). **Identity drift across content is worse than extra ids**, and that is the trade this rule makes. The threshold lives in one place, `UtteranceLedger.overlapThreshold`.

`resolve` never matches a **finalized** or **superseded** entry (emitting a partial after a final confuses the UI), and `prune(beforeSessionTime:)` drops entries whose `tEnd` falls behind the window's left edge — bounding the ledger to ~30 s of recent activity so `resolve` stays O(active utterances).

## Rule 3 — supersession retracts subsumed fragments

The mint-liberally rule leaves a gap: when a later pass produces a longer segment that *extends* an earlier fragment of the same speech, the longer segment correctly gets a fresh id (overlap-of-longer is small) — and the short fragment is **never retracted**. On continuous narration that surfaces one sentence as several stacked, growing fragments, and post-stop diarization can even split them across speakers. ADR-0018 adds the `segment.superseded` [[wire-protocol]] frame (`{ utterance_id, superseded_by }`) so the engine can **retract** the older id: the UI deletes it from its live map, and the at-stop [[vault-writer]] filters it from the retained set.

**Supersession is gated on TIME-OVERLAP *and* a text-PREFIX relationship — never text alone** (`UtteranceLedger.detectSupersession`):

1. **Time containment** — the old interval sits (approximately) inside the new one: `newStart <= old.tStart + 1.5 s` (start slack) **and** `newEnd >= old.tEnd - 0.75 s` (end slack), absorbing WhisperKit's 1–3 s boundary jitter.
2. **Text containment** — the old entry's *normalized* text (lowercased, trimmed, whitespace-collapsed, punctuation-stripped) is a **prefix** of the new one's, and the two differ.

The time gate is **load-bearing**: a legitimately repeated phrase at a *different, non-overlapping* time (a teacher repeating a sentence, a chant, a drill) has zero time overlap and is therefore **structurally exempt** — no heuristic can wrongly merge it. Dropping the time gate to text-only is explicitly forbidden without a new ADR (ADR-0018 §"Must remain true"). The retraction is forward-only: it touches the in-flight live map and the at-write retained set, **never** vault files already committed (vault immutability, [[threat-model]] / `CLAUDE.md` rule #4). Events are drained via `UtteranceLedger.drainSupersessions()` and broadcast by `drainAndEmitSupersessions` in `EngineSession`.

## Rule 4 — region-based finalization commits each region exactly once

Even with supersession as a backstop, finalizing per-segment-text-stability still produced **duplicate finals**: a verified ~200 s clip emitted 129 finals (94 after dedup), `"Let's do it."` finalized 4×, because each re-segmented shape minted a fresh id and got finalized separately (ADR-0019 §Context). The duplicates were produced *at the source* — the finalization decision — and chased imperfectly afterward.

ADR-0019 fixes it at the source with a monotonic **commit watermark** `committedUpTo` (`EngineSession.runTranscription` + the pure, unit-tested `EngineSession.commitDecision`):

- **Commit horizon** = `windowStartSessionTime + hopSeconds` — the oldest `hop` seconds of speech in the window, the slice about to age out and never be re-transcribed. Anchored on the window's *left edge* because the speech-only buffer may not be full, and the left edge is the one timeline point always known exactly (deliberately conservative — errs toward committing later).
- **Finalize exactly once** each segment whose start lies in `(committedUpTo, commitHorizon]`. **Straddle rule:** a segment is committed when its `t_start` is committed, using *this* (most-refined) hop's text.
- **Advance** `committedUpTo = max(commitHorizon, maxCommittedEnd)`, where `maxCommittedEnd` is the farthest `t_end` finalized this hop. This is the **2026-06-01 refinement** for long sentences: a sentence whose `t_start` straddles the horizon is emitted with its full text, so its whole span must be consumed — otherwise its tail gets re-committed as overlapping fragments on later hops (the boundary-overlap bug; verified in vault `2026-06-01-1858.md`, line 40 vs 43/46/49/52). Audio at/before the watermark is `.skipAlreadyCommitted` and never re-emitted — **a region cannot be finalized twice.**
- **Partials are unchanged** for the hot region (`> committedUpTo`): live captions still grow in place by `utterance_id` (Rules 1–2). Only *when* a segment becomes final changed.

At `capture.stop`, a drain (`flushTranscriptionDrain` → `finalizeHotRegion`) finalizes everything still ahead of the watermark, deterministically from the ledger's stored partial text — *not* by asking WhisperKit to re-decode the residual buffer (the fragile path that dropped the last ~30 s on device). Result on a 214 s clip: 94 → 39 finals, ~one per sentence. No wire-contract change — still `segment.partial` / `segment.final` / `segment.superseded`. ADR-0019 demotes ADR-0018's supersession to a **backstop** that should now fire rarely or never for finals, kept as defense-in-depth.

## Rule 5 — grow-in-place recovers dropped tails (export only)

Region-commit optimized for *no duplicates* — but at the cost of **content loss** on long multi-clause utterances (ADR-0036). A hop finalizes a SHORT decode (`"So, but this is just the beginning."`); the watermark advances past its start; a later hop re-decodes the GROWN version (same start, fuller text) → `resolve` skips finalized entries → fresh id → start behind the watermark → `.skipAlreadyCommitted` → **the grown tail is silently dropped from the saved transcript** (verified: `meetings/2026-06-04-0904.md` truncates at `"…beginning."`). For a transcription product, dropping spoken words is the worst failure — worse than a duplicate.

ADR-0036 re-biases from "strict no-duplicates" to **"completeness first," via export-only growth**, on the user's explicit choice: **"live clean, export recovers it."** `UtteranceLedger.extendFinalizedIfGrown` reuses ADR-0018's conservative gate (time-containment + text-PREFIX + actually-grew), re-aimed at **finalized, non-superseded** entries; the reconcile loop tries it **before** `resolve`. On a match, `growRetainedFinalized` updates the **retained** `finalizedUtterances` row in place (keeps the original `tStart`, grows `tEnd` + text) and advances the watermark — but **does NOT re-broadcast** a `segment.final`. So:

- **Live view** is built from broadcast `segment.final` frames → unchanged → the discrete short line never rewrites under the user.
- **Saved transcript** + the post-stop `meeting.transcript` swap are built from `finalizedUtterances` → grown → complete.

The prefix gate means two genuinely-different utterances never merge (same protection as ADR-0018). Accepted residual: a tail whose *start* gets rephrased (old text no longer a clean prefix) can still be dropped — rarer, and the conservative gate is deliberate (better to miss an extension than merge two utterances).

> **Stale-number note for code readers:** a few comments in `SlidingWindow.swift` / `EngineSession.swift` label the grow-in-place / content-loss fix "ADR-0020". The canonical ADR is **ADR-0036** (the export-only grow-in-place decision); ADR-0020 is a different (diarization-area) decision. The comment numbers are stale, not the logic. — see [ADR-0036](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0036-grow-in-place-finalization.md).

## How the rules layer (read order)

| Layer | Mechanism | Lives in | Governs |
|---|---|---|---|
| Identity | max-denominator overlap, fresh-id mint, prune | `UtteranceLedger.resolve` / `prune` | which re-decode is "the same utterance" |
| Live lifecycle | partial upsert → terminal final, by `utterance_id` | `emitSegment`, renderer map | live captions grow in place |
| Retraction | `segment.superseded` (time + text-prefix gate) | `detectSupersession` / `drainSupersessions` | drop a subsumed fragment from live + at-stop |
| Finalization | commit watermark, finalize-once per region | `commitDecision`, `committedUpTo` | one `segment.final` per audio region |
| Completeness | export-only grow-in-place | `extendFinalizedIfGrown` / `growRetainedFinalized` | saved transcript holds the full text |

Each later layer **preserves** the earlier ones: ADR-0019 keeps ADR-0009's partial identity rule verbatim; ADR-0036 keeps ADR-0019's watermark and ADR-0018's gate, adding only the export-side growth.

## Where this concept lives

- **The daemon that runs it:** [[engine-harkd]] (`UtteranceLedger`, `EngineSession`).
- **What feeds it:** [[whisperkit-asr]] (the 30 s/5 s window + re-segmentation that creates the noise these rules tame).
- **The frames it rides:** [[wire-protocol]] (`segment.partial` / `segment.final` / `segment.superseded`).
- **Who consumes it:** [[engine-service]] (renderer map: upsert partials by id, final is terminal, supersede deletes).
- **Decision history:** [[streaming-finalization-decisions]] (ADR-0008/0009/0018/0019/0036).
- **Terms:** [[glossary]] (utterance_id, RTF, sliding window, commit watermark).

## Governing ADRs

- [ADR-0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md) — Phase 3 streaming architecture; **Accepted**. The 30 s window / 5 s hop and VAD-gated re-transcription that make finalization necessary.
- [ADR-0009](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0009-utterance-id-overlap-rule-v2.md) — utterance-id v2 max-denominator overlap + prune; **Accepted** (extended by ADR-0018, refined by ADR-0019; the identity rule itself is unchanged).
- [ADR-0018](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0018-utterance-supersession-signal.md) — `segment.superseded` retraction; **Accepted**. Now a backstop under ADR-0019.
- [ADR-0019](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0019-region-based-finalization.md) — region-based commit-watermark finalization; **Accepted**. Refines ADR-0009 (finalization only); amended by ADR-0036.
- [ADR-0036](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0036-grow-in-place-finalization.md) — export-only grow-in-place; **Accepted** (on-device confirmation pending). Amends ADR-0019, reuses ADR-0018's gate.

## Invariants

- **`segment.final` is terminal.** Once a `utterance_id` is finalized, no partial with that id ever arrives again (ADR-0009 §Assumptions); the renderer relies on this.
- **Identity never drifts across content.** The max-denominator rule mints a fresh id rather than let an existing one mutate across unrelated text (ADR-0009). Extra ids are the accepted price.
- **Supersession is gated on time-overlap AND text-prefix — never text alone.** Loosening to text-only would eat legitimate repeats and requires a new ADR + hostile-input review (ADR-0018).
- **Each audio region is finalized exactly once.** `committedUpTo` is monotonic; nothing at/before the watermark is ever re-finalized (ADR-0019).
- **Grow-in-place is export-only.** A finalized line never rewrites in the live view; the fuller text reaches only `finalizedUtterances` (saved transcript + post-stop swap), with **no** `segment.final` re-broadcast (ADR-0036).
- **No retroactive vault rewrite.** Retraction and growth touch the in-flight map and the at-write retained set only; committed vault files stay immutable (`CLAUDE.md` rule #4).
- **Geometry assumption.** Window = 30 s, hop = 5 s, and WhisperKit boundaries drift by O(seconds) not O(tens of seconds). If the geometry changes, the horizon (which reads `hopSeconds` from the buffer) and prune cutoff follow automatically (ADR-0009 / ADR-0019).
