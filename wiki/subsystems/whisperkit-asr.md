---
type: subsystem
title: WhisperKit ASR (large-v3-turbo on the ANE)
status: current
sources: [docs/design/06-architecture-overview.md, docs/design/07-data-flows.md, "engine/Sources/HarkCore/ModelLoader.swift", "engine/Sources/Harkd/SlidingWindow.swift", "engine/Sources/Harkd/EngineSession.swift", "0003", "0005"]
updated: 2026-06-30
tags: [engine, asr, whisperkit, ane, transcription]
---

# WhisperKit ASR

On-device transcription runs **WhisperKit (Argmax) with the `large-v3-turbo` CoreML bundle on the Apple
Neural Engine** — never cloud (`0003` §Decision; `0004`). Turbo is large-v3 with a 4-layer decoder
(vs 32), ~6× faster decode for almost no accuracy loss; the pinned variant string is
`large-v3-v20240930_626MB` (`engine/Sources/HarkCore/ModelLoader.swift`).

## Model load
`loadWhisperKit` is a two-phase load (`engine/Sources/HarkCore/ModelLoader.swift`): **Phase A** downloads
the ~626 MB bundle (first run only, with a progress bar); **Phase B** prewarms + compiles to the ANE +
loads — the compile exposes no progress fraction, so a `optimizing_speech` heartbeat pulses every ~1.5 s
so the UI never sits silent. Phase 0 measured cold start at 1.67 s warm / 2.22 s first launch on an M4
(`0005` §The numbers). The daemon loads the model **behind** the running WebSocket server, so the port is
discoverable before the model is ready (`engine/Sources/Harkd/HarkdCommand.swift`); see [[engine-harkd]].

## Sliding window
ASR runs over a **30 s window with a 5 s hop**, fed only frames the [[vad]] flags as speech
(`engine/Sources/Harkd/SlidingWindow.swift` header; `docs/design/06-architecture-overview.md` §Component
view). Each hop transcribes the latest 30 s; new tail segments emit as `segment.partial`, then
`segment.final` once the next window confirms them. Cross-window utterance identity uses an overlap score
`overlap / max(segLen, eLen) ≥ 0.5` to survive WhisperKit's 1–3 s boundary jitter (`SlidingWindow.swift`).

## RTF backpressure
Phase 0 measured **RTF ≈ 0.075 on M4** (`0005`), 6.7× under the < 0.5 target, so backpressure is a
defensive fallback, not a routine path. If a transcription job is already in flight when a new hop is
ready, the older window is dropped (never queue more than one outstanding) and a `warning code:"rtf_high"`
frame is emitted (`engine/Sources/Harkd/EngineSession.swift` header; `docs/design/07-data-flows.md`
§Backpressure rule). The UI surfaces it as a yellow banner.

See [[vad]], [[engine-service]], [[swift-engine-sidecar]].

> TODO: WER on noisy / Thai-English code-switch audio is unmeasured (`0005` §What this does NOT validate).
