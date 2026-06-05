---
type: subsystem
title: WhisperKit ASR & sliding window
status: current
sources: [ADR-0003, ADR-0005, ADR-0008, engine/Sources/Harkd/SlidingWindow.swift, engine/Sources/Harkd/EngineSession.swift, engine/Sources/HarkCore/ModelLoader.swift, engine/Tests/HarkdTests/UtteranceLedgerTests.swift, engine/Tests/HarkdTests/CommitWatermarkTests.swift]
updated: 2026-06-05
tags: [engine, asr, whisperkit, streaming, ane]
---

On-device speech-to-text via WhisperKit `large-v3-turbo` on the Apple Neural Engine, driven by a 30 s sliding window with a 5 s hop that re-transcribes overlap and emits `segment.partial` → `segment.final` keyed by `utterance_id`. Phase 0 measured RTF ~0.075 on M4 (ADR-0005), ~13× real-time.

## Code map

<sub>Grounded in the understand-anything graph slice (commit 8efdfde, 2026-06-05, code-only scope).</sub>

**Layer:** Engine Core & Audio Capture · Streaming Daemon & Transcription

**Files:**
- `engine/Sources/HarkCore/ModelLoader.swift` — shared two-phase WhisperKit loader: downloads model files with a progress bar (Phase A), then prewarms/compiles to the ANE with a heartbeat and structured progress pulses (Phase B), returning a timed `LoadedModel`.
- `engine/Sources/Harkd/SlidingWindow.swift` — speech-gated 30 s window with 5 s hop plus utterance reconciliation: accumulates VAD-passed frames, fires per-hop transcription, and resolves whether consecutive-window segments are the same utterance via overlap/max-denominator identity (ADR-0009), minting or preserving `utterance_id`s.

**Key types & functions:**
- `loadWhisperKit` — async: downloads (with `ProgressRenderer`) then compiles+loads a WhisperKit pipeline, forwarding both stderr progress and an optional structured `onProgress` sink for the harkd UI. (Lx 52–141)
- `LoadedModel` — result struct from `loadWhisperKit` carrying the WhisperKit pipe, model name/folder, and download/compile/total load timings. (Lx 22–29)
- `UtteranceLedger` — utterance identity ledger: resolves a segment to an existing or fresh `utterance_id` by overlap/max-denominator scoring, tracks finalization and supersession, and prunes orphans aging out of the active window. (Lx 90–433)
- `SlidingWindowBuffer` — ring-style audio buffer accumulating speech-gated frames into a 30 s window and popping the latest window for transcription once a 5 s hop is ready, mapping window offsets to absolute session time. (Lx 551–649)
- `resolve` — core identity resolver: scores a new segment's interval against existing ledger entries by overlap divided by the longer interval, returning the matched `utterance_id` or minting a fresh one. (Lx 151–199)
- `extendFinalizedIfGrown` — grows an already-finalized utterance in place when a later window produces a longer, overlapping version of the same text, returning its `utterance_id` for re-emission. (Lx 392–465)

**Pinned by tests:**
- `engine/Tests/HarkdTests/UtteranceLedgerTests.swift` — overlap-based identity rule (ADR-0009); reproduces the 2026-05-28 smoke-trace engulfment bug to pin that a fresh id is minted (not reassigned) when overlap/max(longer) falls below threshold.
- `engine/Tests/HarkdTests/CommitWatermarkTests.swift` — ADR-0019 region-based finalize-once model; exercises the pure `EngineSession.commitDecision` plus an in-test watermark-advance reimplementation, no live WhisperKit.
- `engine/Tests/HarkdTests/DedupTests.swift` — at-stop interval-based, time-gated re-emission collapse (`EngineSession.collapseReemissions`): repeats collapse while identical text spoken far apart survives.
- `engine/Tests/HarkdTests/ModelProgressTests.swift` — first-run load progress: `ModelProgressThrottle.decide` rate-limit (never drops a phase transition) and `MetaModelProgressPayload` encoding fraction as JSON `null` in the indeterminate state.

**Connections:**
- `calls` → [[engine-harkd|Engine / harkd]] (`loadWhisperKit` → `startHeartbeat`)
- `depends_on` → [[engine-harkd|Engine / harkd]] (`loadWhisperKit` → `ProgressRenderer`)
- ⇐ `calls` [[engine-harkd|Engine / harkd]] (`HarkBench/main.swift` → `loadWhisperKit`)
- ⇐ `depends_on` [[engine-harkd|Engine / harkd]] (`EngineSession` → `SlidingWindowBuffer`, `UtteranceLedger`)

> NOTE: The graph resolves cross-edges only within the engine Swift tree; the downstream `wire-protocol` / `vault-writer` / `translation` consumers described in "How it connects" are not edges the code-only graph captures.

## What it does

This is the transcription core of [[engine-harkd]] — the stage between [[audio-capture]] / [[vad]] and the [[wire-protocol]] `segment.*` frames. It turns a continuous 16 kHz mono Float32 speech stream into reconciled, time-stamped text:

1. **Model load** — `large-v3-turbo` Core ML bundle (Argmax) compiled to and run on the **Apple Neural Engine** (ADR-0003).
2. **Sliding window** — speech frames (VAD-gated) accumulate into a 30 s ring; every 5 s of new speech fires a transcription of the latest 30 s (ADR-0008 §3).
3. **Reconciliation** — because each audio span is re-decoded ~6× across hops, an `UtteranceLedger` keeps a stable `utterance_id` per spoken utterance so the UI can update captions in place rather than re-printing them.
4. **Streaming finalization** — hot-region text streams as `segment.partial`; a monotonic commit watermark promotes each region to `segment.final` exactly once. See [[streaming-finalization]] for the full state model.

Why this stack (vs Rust + whisper.cpp, Python, in-process Node, MLX): ADR-0003. The deciding factor was ANE acceleration — whisper.cpp Metal is ~30–40% slower on M-series, and WASM Whisper ~5× slower. Phase 0 (ADR-0005) then validated the central performance assumption empirically.

## Key files

- `engine/Sources/Harkd/SlidingWindow.swift` — two types:
  - `SlidingWindowBuffer` — the 30 s speech-only ring with a 5 s hop trigger (`append`, `popHopIfReady`). Holds a parallel **anchor table** mapping window-relative offsets back to absolute session time (`windowTimeToSessionTime`), because the buffer drops silence so buffer-seconds ≠ wall-clock-seconds.
  - `UtteranceLedger` — utterance identity across hops via interval-overlap scoring, plus supersession (ADR-0018) and grow-in-place logic (introduced ADR-0020, now **governed by ADR-0036** — export-only; see line below). The slice locates grow-in-place in `extendFinalizedIfGrown` (SlidingWindow.swift Lx 392–465).
- `engine/Sources/Harkd/EngineSession.swift` — the actor that wires it together: `ingestFrames` (VAD gate + hop trigger + backpressure), `runTranscription` (the WhisperKit call + reconciliation), `flushOnStop` / `finalizeHotRegion` (at-stop tail recovery).
- `engine/Sources/HarkCore/ModelLoader.swift` — `loadWhisperKit` two-phase load (download → ANE compile + load); `DEFAULT_MODEL_NAME = "large-v3-v20240930_626MB"`. Shared by `harkd`, the batch CLI, and the Phase 0 bench.

## The window mechanics (ADR-0008 §3)

- **Window 30 s, hop 5 s, sample rate 16 kHz** — set in `startCapture`: `SlidingWindowBuffer(windowSeconds: 30, hopSeconds: 5, sampleRate: 16_000)`.
- Only **speech** frames accumulate (VAD gates silence out — see [[vad]]). Whisper hallucinates captions on silence, so gating both saves ANE cycles and avoids flicker (ADR-0008 §3).
- Each hop re-transcribes the **whole 30 s** buffer. The newest ~5 s tail is fresh; the older ~25 s is overlap that gets re-decoded with fuller context.
- WhisperKit segment times are **window-relative**; `windowTimeToSessionTime` maps them to absolute session time via the anchor table so the UI can place captions on a timeline.

### Decode options
`runTranscription` builds `DecodingOptions(task: .transcribe | .translate, language: sessionLanguage, withoutTimestamps: false)`. `task: .translate` (Whisper's English-only translation) is wired but **not used in live mode** — live translation was removed (ADR-0037; see [[translation]]). `sessionLanguage` is `nil` for auto-detect or a source-language hint ("vi"/"en"…).

## Identity & finalization (where the subtlety lives)

WhisperKit re-segments coarsely between passes — it can shift a segment's boundaries by 1–3 s when it re-decodes the full 30 s buffer. So a naïve "same `t_start` bucket" identity check misses obvious matches.

- **Overlap identity** (ADR-0009): two segments are "the same utterance" iff `overlap / max(segLen, eLen) ≥ 0.5` — the **max-denominator** form. An earlier `min`-denominator revision (v1, commit be31c52) had an "engulfment hole": a long new segment fully containing a short old entry scored 1.0 regardless of text, so a stable `utterance_id` could drift across alien content. v2's max-denominator fixes that — engulfment scores `shorter/longer < 0.5`, minting a fresh id instead.
- **Commit watermark** (ADR-0019): `committedUpTo` is a monotonic session-time horizon. `commitDecision(segmentStart, committedUpTo, commitHorizon)` returns `.finalize` (commit once), `.partial` (still hot), or `.skipAlreadyCommitted`. This is what kills duplicate `segment.final` frames the old "older-zone" rule produced.
- **Supersession** (ADR-0018): when a grown re-decode extends an earlier fragment (time-containment **and** text-prefix), the old fragment is retracted via `segment.superseded`.
- **Grow-in-place** (ADR-0020, refined ADR-0036): a fuller re-decode of an already-finalized line extends the retained text. Per ADR-0036 this is now **export-only** — the live view keeps the discrete short line; the fuller text surfaces only in the saved transcript (`growRetainedFinalized`).
- **At-stop tail recovery** (ADR-0019): `finalizeHotRegion` deterministically finalizes every live ledger entry above the watermark from its stored text, rather than relying on WhisperKit re-producing segments from the residual buffer (the fragile path that dropped the last ~30 s).

The full partial→final lifecycle and these rules' interplay are the subject of [[streaming-finalization]] and the [[streaming-finalization-decisions]] digest (ADR-0008/0009/0018/0019/0036). This page covers them only as they touch the ASR window.

## Backpressure

`ingestFrames` enforces ADR-0008 §3's hard rule: if a transcription is already in flight when a new hop is ready, **drop the hop** (never queue) and broadcast `warning` with `code: "rtf_high"`. At Phase 0's measured RTF ~0.075 (ADR-0005) there is ~6× headroom, so this should fire ~never on M-series — it's a defensive floor, not a routine path.

## Performance (Phase 0 / ADR-0005)

| Metric | Measured (M4) | Threshold |
|---|---|---|
| RTF avg | **0.0747** | < 0.50 |
| RTF p95 | 0.0828 | < 0.50 |
| Cold start | 1.67 s warm / 2.22 s first | ≤ 5.0 s |

Validated on a 255 s English LibriVox sample, 46 windows at the production 30 s/5 s setting. What ADR-0005 explicitly does **not** validate: Thai↔English code-switch speed/WER, WER in general, hardware below M4 (M1 base estimated RTF ~0.15–0.22, still 2× under), and noisy multi-speaker audio. See [[foundations]].

## How it connects

- **Upstream:** [[audio-capture]] feeds 16 kHz mono Float32 frames; [[vad]] classifies speech/silence before the window. (See divergence note below.)
- **Hosted by:** [[engine-harkd]] — `EngineSession` is the actor; `runTranscription` runs on its executor.
- **Downstream (wire):** emits `segment.partial`, `segment.final`, `segment.superseded`, and `warning` frames per the [[wire-protocol]] contract.
- **Downstream (consumers):** finalized utterances feed [[diarization]] (post-stop) and the [[vault-writer]] markdown body; the same retained list backs on-demand [[translation]].
- **Governed by foundations:** [[foundations]] (ADR-0001–0005/0013), [[streaming-finalization-decisions]].

## Governing ADRs

- [ADR-0003](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0003-swift-whisperkit-engine.md) — Swift + WhisperKit engine (over Rust + whisper.cpp). **Accepted.**
- [ADR-0005](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0005-phase-0-rtf-validated.md) — Phase 0 RTF validated; proceed with the stack. **Accepted.**
- [ADR-0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md) — Phase 3 streaming architecture (harkd, Swift NIO, in-process capture, VAD-gated 30 s/5 s windowing). **Accepted.**
- Reconciliation/finalization that this window drives: ADR-0009 (overlap identity), ADR-0018 (supersession), ADR-0019 (commit watermark), ADR-0020/0036 (grow-in-place / export-only) — digested in [[streaming-finalization-decisions]].

## Invariants

- **Window 30 s, hop 5 s, 16 kHz mono Float32.** Production setting (ADR-0008 §3); the Phase 0 numbers (ADR-0005) only hold at this setting.
- **One outstanding transcription at a time.** Never queue; drop the oldest hop and emit `rtf_high` when RTF > 1 (ADR-0008 §3).
- **Each audio region is finalized exactly once** behind the monotonic `committedUpTo` watermark (ADR-0019) — no duplicate `segment.final`.
- **`utterance_id` is stable for the same utterance across hops** (overlap identity, ADR-0009) and is the key the UI replaces partials/finals on (see [[wire-protocol]]).
- **The transcription actor sees transcript text and MUST NOT log it.** Log lines are progress/state only (rule #2/#3 of the [[threat-model]]). All ASR runs on-device — no audio or text egress here.
- **`whisperKit` is touched only after `attachModel`.** `capture.start` is rejected with recoverable `ENGINE_WARMING_UP` until the model is loaded, so the WS port can come up before the slow ANE compile.

## Divergence from ADR-0008 (note)

> NOTE: ADR-0008 §3 specifies **Silero VAD via CoreML** as the gate. The current implementation uses an `EnergyVAD` (`vad: "energy-v0"` in `capture.started`, `EngineSession.swift`), not Silero. The 30 s/5 s windowing and backpressure are as specified; the VAD backend differs. Tracked on the [[vad]] page — that is the source of truth for the VAD divergence, not this page.

## See also

[[engine-harkd]] · [[vad]] · [[audio-capture]] · [[wire-protocol]] · [[streaming-finalization]] · [[streaming-finalization-decisions]] · [[foundations]] · [[glossary]] (RTF, `utterance_id`, hop, commit watermark)
