---
type: concept
title: Streaming utterance finalization
status: current
sources: ["docs/decisions/0009-utterance-id-overlap-rule-v2.md", "docs/decisions/0019-region-based-finalization.md", "docs/decisions/0036-grow-in-place-finalization.md", "docs/decisions/0018-utterance-supersession-signal.md", "docs/decisions/0008-phase-3-streaming-architecture.md"]
updated: 2026-06-30
tags: [engine, streaming, finalization, utterance, whisperkit]
---

# Streaming utterance finalization

The [[streaming-daemon]] runs a **30s window with a 5s hop**: every hop re-transcribes the *entire*
30s buffer, so each span of audio is seen by WhisperKit ~6 times with slightly different segmentation
(`0008` §3, `0019` §Context). Three problems follow — unstable identity, duplicate finals, and dropped
tails — each solved by a separate rule.

## 1. Stable utterance identity (`0009`)
WhisperKit shifts segment boundaries by 1–3s across hops, so naive keying mints many IDs for one
utterance. The `UtteranceLedger` keys identity on **interval overlap scored as `overlap / max(segLen,
eLen)`** with a 0.5 threshold: two intervals are the same utterance iff their overlap covers at least
half of the *longer* one. The `max` denominator (vs an earlier `min`) kills **engulfment** — a coarse
new segment swallowing a short old one no longer scores 1.0, so `"Okay."` can never mutate in place into
an unrelated sentence (`0009` §Decision). Old entries are pruned once they age out of the window.

## 2. Finalize each region exactly once (`0019`)
The old "older-zone + text-stable" rule finalized the same sentence 3–4× as it got re-segmented.
`0019` replaces it with a monotonic **commit watermark** (`committedUpTo`, session-relative seconds):
each hop computes a `commitHorizon = windowStartSessionTime + hopSeconds` (the oldest slice about to
leave the window) and finalizes, exactly once, segments whose start lies in `(committedUpTo,
commitHorizon]`. A region's start, once committed, is **never re-finalized** — duplicates die at the
source. A refinement advances the watermark to `max(commitHorizon, maxCommittedEnd)` so a long sentence
consumes its full span and its tail isn't re-covered as overlapping fragments (`0019` §Long-sentence).
Partials for the still-hot region (`> committedUpTo`) keep updating in place per the `0009` identity rule.

## 3. Recover dropped tails — export-only growth (`0036`)
Region-commit optimized for *no duplicates* but could silently **drop the grown tail** of a long
utterance: a short decode finalizes and advances the watermark, then the fuller re-decode lands behind
the watermark and is skipped. `0036` re-biases to **"completeness first"** via
`UtteranceLedger.extendFinalizedIfGrown`: a fuller re-decode of an already-finalized entry (matched on
time-containment **AND** text-prefix containment) grows the **retained** transcript row in place — but
**does not re-broadcast** a `segment.final`. So the saved file / post-stop swap get the complete text
while the **live view stays discrete and stable** ("live clean, export recovers it").

## Supersession backstop (`0018`)
`segment.superseded {utterance_id, superseded_by}` retracts an earlier fragment when a later,
**time-overlapping**, prefix-extending re-decode subsumes it — the UI deletes it, the writer filters it
out. Gated on **time-overlap + prefix/superset, never text-similarity alone**, so legitimate repeats are
never eaten (`0018` §Decision). Under `0019` this fires rarely; it stays as defense-in-depth.

After stop, [[diarization]] and [[speaker-enrollment]] attach speakers. See
[[streaming-finalization-decisions]] for the full trail.
