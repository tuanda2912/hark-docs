---
type: subsystem
title: VAD — voice activity detection
status: partial
sources: [ADR-0008, engine/Sources/Harkd/VAD.swift]
updated: 2026-06-05
tags: [engine, vad, streaming]
---

A `VAD` protocol with an energy-based default — `EnergyVAD`: a per-frame RMS state machine plus ~800 ms hangover — that gates which frames enter the sliding window so silence never reaches WhisperKit. It's deliberately a drop-in so a Silero CoreML VAD (the ADR-0008 design) can replace it without touching the windowing driver.

## Code map

**Layer:** Streaming Daemon & Transcription.

**Files:**

- `engine/Sources/Harkd/VAD.swift` → the `VAD` protocol plus an initial energy-based `EnergyVAD` with hangover (RMS over 100 ms frames, silence/speech state machine), so a Silero CoreML implementation can drop in later without touching the sliding-window driver.

**Key types & functions:**

- `protocol VAD` — abstracts frame-batch voice-activity classification so the pipeline can swap the energy gate for Silero CoreML later. (Lines 39–54.)
- `struct EnergyVAD` — energy-based VAD with hangover: computes per-frame RMS and runs a silence/speech state machine with a hangover count so word-internal stop consonants don't terminate an utterance. (Lines 55–92.)

**Pinned by tests:** none in this slice.

**Connections:** no cross-edges captured in the graph (engine Swift imports aren't resolved). VAD is consumed by the `EngineSession` windowing loop in [[subsystems/engine-harkd|Engine / harkd]] / [[subsystems/whisperkit-asr|WhisperKit ASR & sliding window]] even though no edge was recorded.

## What it does

The VAD sits between [[audio-capture]] and [[whisperkit-asr]] in the [[engine-harkd]] pipeline (`capture → VAD → window → WhisperKit → WS emit`). It classifies each incoming audio frame as `.speech` or `.silence`; only speech frames accumulate into the sliding window. The motivating problem (ADR-0008 §Decision 3): Whisper **hallucinates captions on silent input**, so feeding it silence wastes ANE cycles, burns battery, and floods the UI with low-confidence garbage. Gating at the input stage is cheaper and cleaner than post-filtering by confidence.

The shipped implementation is an **energy gate with hangover**, not the Silero CoreML VAD the ADR specifies — see [Deviation from ADR-0008](#deviation-from-adr-0008) below. Hence this page's `status: partial`.

### How `EnergyVAD` works

`engine/Sources/Harkd/VAD.swift` defines two pieces:

- `enum VADState { case speech; case silence }` — the per-frame verdict.
- `protocol VAD { mutating func classify(_ frames: [Float]) -> VADState }` — the seam. `classify` takes a Float32 frame batch at 16 kHz mono and may carry state across calls (the energy impl tracks hangover; a future Silero impl could track smoothing).

`struct EnergyVAD` is the default. Per call it:

1. Computes the **RMS** of the frame batch (`computeRMS`: √(Σf² / n)).
2. If RMS ≥ `speechThreshold` (default `0.01`) → mark `inSpeech`, reset the silence run, return `.speech`.
3. If below threshold **and already in speech** → increment a silence counter; keep returning `.speech` until `hangoverFrames` (default `8`) consecutive sub-threshold frames elapse, then flip to `.silence`.
4. If below threshold and not in speech → `.silence`.

Tuning (from the source's tuning notes):

- `speechThreshold = 0.01` (linear-amplitude RMS) sits below conversational speech (~0.05–0.2) and above the room-tone noise floor (~0.001–0.005). Verified empirically against the Phase 2 smoke-test Vietnamese clip.
- `hangoverFrames = 8` × 100 ms = **~800 ms tail**. The frame size is documented as 100 ms = 1600 samples at 16 kHz. The hangover bridges within-utterance pauses ("uh … what I meant was") so a 50 ms stop consonant doesn't chop a sentence, while still marking end-of-turn inside a normal conversational gap.

> TODO(wiki): the 100 ms / 1600-sample frame size is asserted in the source comments, but the actual frame length is set by the caller (the windowing driver in [[engine-harkd]]) — `EnergyVAD.classify` itself accepts any-length batch. Confirm the driver feeds 100 ms frames; if not, the hangover wall-clock math shifts.

## Key files

| File | Role |
|---|---|
| `engine/Sources/Harkd/VAD.swift` | The `VAD` protocol, `VADState`, and `EnergyVAD` (RMS state machine + hangover). |

> TODO(wiki): the call site that instantiates `EnergyVAD` and feeds frames into it (the sliding-window driver) lives in the harkd session code; pin the exact file/function when [[engine-harkd]] is deepened.

## How it connects

- **Upstream — [[audio-capture]]:** consumes the resampled 16 kHz mono Float32 stream produced by `HarkCapture`. The format contract (16 kHz mono Float32) is what both the energy gate and any future Silero model expect (ADR-0008 §Decision 3 "Must remain true").
- **Downstream — [[whisperkit-asr]]:** only `.speech` frames feed the 30s/5s sliding window; silence is dropped before any WhisperKit call. This is what keeps hallucinated captions out of `segment.partial`/`segment.final`. See [[streaming-finalization]] for how those windows reconcile into final segments.
- **Host — [[engine-harkd]]:** the daemon owns the `capture → VAD → window → WhisperKit → WS emit` loop in a single process (ADR-0008 §Decision 2, in-process shared library). The VAD runs on the hot path with zero IPC tax.

## Governing ADRs

- **[ADR-0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md)** — Phase 3 streaming architecture. §Decision 3 mandates VAD-gated windowing and specifies **Silero VAD via CoreML** as the intended implementation; §Open questions #1 flags that a canonical Silero CoreML bundle may not exist and pre-accepts either shipping ONNX + Runtime Swift bindings or a `coremltools` conversion. Digest: [[streaming-finalization-decisions]] (ADR-0008/0009/0018/0019/0036).

## Deviation from ADR-0008

ADR-0008 §Decision 3 chose **Silero CoreML**. The shipped Phase 3 cut instead uses `EnergyVAD`, behind the `VAD` protocol, as a deliberate drop-in placeholder. Rationale recorded in `VAD.swift`:

1. The energy gate already catches the worst hallucination case — **steady silence** — which is the failure ADR-0008 §3 actually motivates.
2. Phase 4 dogfooding will reveal whether hallucinations during *low-energy speech* are a real problem; if so, Silero gets adopted with data driving the choice.
3. It avoids committing to ONNX Runtime as a transitive dependency before we know we need it — every dependency that opens a network or system surface is an ADR per `CLAUDE.md` hard rule #6.

This is a deviation, not a contradiction: the protocol seam preserves the ADR's design intent (Silero is the next upgrade). It is **not** a superseding decision — no new ADR has reversed ADR-0008's choice; the energy gate is an interim implementation under the same architecture.

> TODO(wiki): if/when an ADR formalizes "EnergyVAD is the shipped default, Silero deferred," cite it here and flip `status`.

## Invariants

- **Silence never reaches WhisperKit.** Only `.speech`-classified frames may enter the sliding window. This is the whole point of the subsystem (anti-hallucination, ADR-0008 §Decision 3).
- **Input is 16 kHz mono Float32.** Both `EnergyVAD` and the intended Silero model assume this format; it's the [[audio-capture]] output contract (ADR-0008 §Decision 3 "Must remain true").
- **The `VAD` protocol is the only seam.** Swapping `EnergyVAD` for a Silero CoreML impl must require no change to the windowing driver — that drop-in property is the reason the protocol exists.
- **`classify` may be stateful.** Callers must reuse a single `EnergyVAD` instance across frames (the hangover counter lives in the struct); constructing a fresh one per frame would break end-of-turn detection.

## See also

- [[whisperkit-asr]] — the sliding window that consumes gated frames.
- [[audio-capture]] — Process Taps / ScreenCaptureKit / mic source feeding the 16 kHz stream.
- [[streaming-finalization]] — partial → final segment reconciliation downstream.
- [[glossary]] — RTF, utterance_id, and other terms used here.
