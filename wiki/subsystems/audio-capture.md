---
type: subsystem
title: Audio capture & engine core
status: current
sources: [docs/design/06-architecture-overview.md, "graph: Engine Core & Audio Capture"]
updated: 2026-06-30
tags: [engine, audio, capture, swift]
---

# Audio capture & engine core

The capture layer of the Swift engine: it pulls **system audio** (ScreenCaptureKit) and the **microphone**
(AVAudioEngine), mixes and resamples to 16 kHz, and feeds the ASR pipeline (`docs/design/06-architecture-overview.md`
§Component view: Swift Engine).

## Files (graph layer "Engine Core & Audio Capture")
- `engine/Sources/HarkCapture/CapturePipeline.swift` — the capture orchestration.
- `engine/Sources/HarkCapture/CoreAudioProcessTap.swift` — system-audio tap.
- `engine/Sources/HarkCapture/MicCapture.swift` — microphone input.
- `engine/Sources/HarkCapture/Mixer.swift` — mix + 16 kHz resample.
- `engine/Sources/HarkCapture/PermissionGate.swift` — ScreenCaptureKit/mic permission gating.
- `engine/Sources/HarkCore/{HarkPaths,Heartbeat,ModelLoader,WAVWriter,ProgressRenderer}.swift` — shared core
  (paths, liveness heartbeat, CoreML model loading, WAV output).
- `engine/Sources/HarkCaptureCLI/HarkCaptureCLI.swift`, `engine/Sources/HarkBench/main.swift` — CLI + bench harnesses.

## Notes
- **Backpressure:** if WhisperKit can't keep up (RTF > 1), the ring buffer drops the oldest unprocessed audio
  and emits a warning over the WebSocket; the UI shows a yellow banner.
- **Permissions** are per-binary on macOS — a reason for the [[swift-engine-sidecar]] split.
- Output flows to [[streaming-daemon]] (ASR + diarization).

> Graph file lists are derived; verify against source before relying on a specific symbol.
