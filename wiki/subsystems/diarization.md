---
type: subsystem
title: Diarization (FluidAudio offline pass)
status: current
sources: ["docs/decisions/0016-phase-5-diarization.md", "docs/decisions/0017-diarization-offline-pipeline.md", "docs/decisions/0025-no-live-diarization-v1.md", "engine/Sources/Harkd/Diarizer.swift", "docs/design/07-data-flows.md"]
updated: 2026-06-30
tags: [engine, diarization, fluidaudio, speaker, offline]
---

# Diarization (FluidAudio offline pass)

Diarization answers *who* spoke each line. In Hark it is an **on-device, offline, post-meeting**
pass — it never runs during capture (`0016`, `0025`).

## When it runs
The pass fires only at `capture.stop`, over the **full session audio** held in RAM as mono 16 kHz
`Float` (`0016` §5). It is invoked from `EngineSession.flushOnStop` and never touches the live
transcription path (`engine/Sources/Harkd/Diarizer.swift`). This keeps the <1.5s caption budget free
of a second CoreML model competing with WhisperKit on the ANE (`0016` §Alternatives).

## Pipeline — offline, not streaming
The library is **FluidAudio** (CoreML / Apple Neural Engine, fully on-device), pinned to a stable tag
(`0016` §1). `0016` originally called FluidAudio's streaming `performCompleteDiarization`, but `0017`
**superseded that pipeline choice**: on-device it produced visibly wrong attribution (69 diarization
segments for 239 utterances) because the streaming manager flattens fast A→B→A exchanges inside its
10s non-overlapping chunks (`0017` §Context).

The engine now uses FluidAudio's **`OfflineDiarizerManager`** — a VBx pipeline: overlapping windows →
VBx **global** clustering → overlap-aware segmentation → exclusive-segment reconstruction (`0017`).
`Diarizer.swift` is a thin `actor` wrapping one `OfflineDiarizerManager`, calling `process(audio:)` and
returning FluidAudio's `DiarizationResult` whose `.segments` are exclusive (non-overlapping)
`TimedSpeakerSegment`s. This cut diarization error ~2.5× (offline ≈10.6% DER vs streaming ≈26.2% on
AMI SDM) at ~60–70× realtime — a 1-hour meeting diarizes in ~1 minute (`0017` §Why).

## Assignment & labels
Each final segment is assigned a speaker by **time-overlap** against the diarization segments
(`0016` §2; `07-data-flows.md` §2). v1 emits **anonymous `Speaker N` labels only** — no live labels,
no naming during capture (`0016` §3, `0025`). Naming and cross-meeting recognition are layered on top
in [[speaker-enrollment]]; corrections happen via [[streaming-finalization]]'s post-save relabeling
(`0020`).

The model `DiarizerLoader.swift` loads the FluidAudio CoreML weights, cached under
`~/Library/Application Support/Hark/` (`0016` §1). Weights download once from HuggingFace over HTTPS,
then run fully offline (`0017` §Privacy). See [[diarization-speakers]] for the decision trail.
