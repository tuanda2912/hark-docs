---
type: subsystem
title: Voice Activity Detection (VAD)
status: current
sources: [docs/design/06-architecture-overview.md, docs/design/07-data-flows.md, "engine/Sources/Harkd/VAD.swift", "engine/Sources/Harkd/SlidingWindow.swift"]
updated: 2026-06-30
tags: [engine, vad, silero, asr, audio]
---

# Voice Activity Detection

VAD gates audio into ASR so [[whisperkit-asr]] only transcribes speech — silence never reaches the model.
The intended design is **Silero VAD via CoreML** (`docs/design/06-architecture-overview.md` §Component
view: Swift Engine), classifying each ~100 ms chunk as speech or silence before the sliding window.

## What ships today
The current implementation is an **energy-based VAD with hangover** behind a `VAD` protocol, not the Silero
CoreML model (`engine/Sources/Harkd/VAD.swift`). The protocol boundary lets the Silero path drop in later
without touching the sliding-window driver (`VAD.swift` header). The energy gate:

- Computes **RMS of each 100 ms frame** (1600 samples at 16 kHz).
- State machine: silence → speech when RMS crosses `speechThreshold` (default `0.01`); speech → silence
  after `hangoverFrames` (default 8 = 800 ms) consecutive sub-threshold frames. The hangover bridges
  within-utterance pauses so a 50 ms gap doesn't chop a sentence (`EnergyVAD` in `VAD.swift`).

The thresholds were tuned empirically against a Phase 2 Vietnamese smoke-test clip: `0.01` sits below
conversational speech (~0.05–0.2) and above room-tone floor (~0.001–0.005) (`VAD.swift` tuning notes).

## Why ship energy-gate first
The energy gate catches the worst Whisper-hallucination case (steady silence), which is what the Silero
design actually motivates; ONNX Runtime is avoided as a transitive dependency until dogfooding proves
low-energy-speech hallucinations are a real problem (`engine/Sources/Harkd/VAD.swift` header).

## In the pipeline
Speech-flagged frames accumulate into the **30 s window**; each hop fires a WhisperKit pass
(`engine/Sources/Harkd/SlidingWindow.swift`). VAD lives inside [[engine-service]]'s actor, which serializes
its state.

See [[whisperkit-asr]], [[audio-store]].

> TODO: Silero CoreML bundle path (ONNX+Runtime vs coremltools) is an open question per the source — not yet
> implemented.
