---
type: decision
title: Streaming & finalization decisions
status: current
sources: ["docs/decisions/0008-phase-3-streaming-architecture.md", "docs/decisions/0009-utterance-id-overlap-rule-v2.md", "docs/decisions/0018-utterance-supersession-signal.md", "docs/decisions/0019-region-based-finalization.md", "docs/decisions/0036-grow-in-place-finalization.md"]
updated: 2026-06-30
tags: [decision, streaming, finalization, utterance, whisperkit]
---

# Streaming & finalization decisions

The decision trail behind [[streaming-finalization]] and the [[streaming-daemon]].

## `0008` — Phase 3 streaming architecture
Four coupled choices for the live pipeline: **Swift NIO** for the WebSocket server (not Vapor — wrong
tool for a single-endpoint localhost sidecar); **in-process shared library** (`harkd` imports
`HarkCapture` + `HarkCore`, no IPC on the hot path); **Silero VAD gating before WhisperKit**; and a
**30s window / 5s hop** sliding window (drop oldest if RTF > 1). The binary is named `harkd` (`0008`).

## `0009` — utterance-identity rule v2 (max-denominator overlap)
WhisperKit re-segments the whole 30s buffer every hop, shifting boundaries by 1–3s. Identity is keyed
on **interval overlap `/ max(segLen, eLen)`**, threshold 0.5. The `max` denominator fixes **engulfment**
(`min` scored a coarse segment swallowing a short one as 1.0, mutating `"Okay."` into an unrelated
sentence). Adds `prune(beforeSessionTime:)` so the ledger stays bounded to ~30s of recent activity. The
rule lives in `UtteranceLedger.resolve`/`prune` (`0009`).

## `0018` — `segment.superseded` retraction signal
Extends `0009`. `0009` mints fresh IDs liberally but **never retracts** the older fragment when a longer
re-decode extends it. Add one wire frame `segment.superseded {utterance_id, superseded_by}` — the engine
retracts, the UI deletes, the at-stop writer filters. Gated on **time-overlap AND prefix/superset, never
text-similarity alone**, so legitimate repeats (same words at a different, non-overlapping time) are
structurally exempt (`0018`).

## `0019` — region-based finalization (commit watermark)
Refines `0009`; makes `0018` a backstop. The old "older-zone + text-stable" rule finalized a sentence
3–4× (a verified run: 129 finals for a ~200s clip). Replace with a monotonic **commit watermark**:
finalize each audio region **exactly once** when its start crosses `commitHorizon =
windowStartSessionTime + hopSeconds`, then advance `committedUpTo = max(commitHorizon, maxCommittedEnd)`
so a long sentence consumes its full span (a refinement that fixed long-sentence tail re-coverage).
Partials for the hot region are unchanged. No wire-contract change (`0019`).

## `0036` — export-only grow-in-place finalization
Amends `0019`. Region-commit could silently **drop the grown tail** of a long utterance (a short decode
commits, the fuller re-decode lands behind the watermark, gets skipped — verified content loss in
`2026-06-04-0904.md`). Re-bias to **completeness first**: `extendFinalizedIfGrown` grows the *retained*
(saved) transcript row in place — matched on time-containment + text-prefix — but **does not
re-broadcast** a `segment.final`. "Live clean, export recovers it": the live view stays discrete and
stable; the saved file and post-stop swap get the complete text (`0036`).

Pipeline geometry lives in [[streaming-daemon]]; the mechanics in [[streaming-finalization]].
