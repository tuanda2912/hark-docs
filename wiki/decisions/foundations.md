---
type: decision
title: Founding choices (Electron, macOS-only, Swift+WhisperKit, no cloud ASR, MIT)
status: current
sources: ["0001", "0002", "0003", "0004", "0013"]
updated: 2026-06-30
tags: [decision, architecture, foundations, privacy, license]
---

# Decision — founding choices

The five decisions that fix Hark's shape. They chain: macOS-only (`0002`) unlocked the Swift engine
(`0003`), which made Electron (`0001`) and no-cloud-ASR (`0004`) coherent.

## macOS-only scope (`0002`)
v1 targets **Apple Silicon macOS only** — Windows, Linux, iOS, Android are out, not deferred (`0002`
§Decision). Cross-platform was a force multiplier of complexity for a solo developer; the primary user is
on a Mac and Apple Silicon makes on-device ASR production-grade. Intel Macs are refused at install. This
freed the stack to use Apple-only tools.

## Swift + WhisperKit engine (`0003`)
The engine is a **Swift binary**: WhisperKit `large-v3-turbo` on the ANE for ASR, ScreenCaptureKit / Core
Audio Process Taps for system audio, AVAudioEngine for mic, Silero (CoreML) VAD, FluidAudio diarization,
Swift NIO WebSocket server (`0003` §Decision). It runs as a **separate sidecar** managed by Electron — not
in-process Node. Chosen over a Rust engine (whose only justification, Windows reuse, died with `0002`) and
over Python (packaging pain). See [[swift-engine-sidecar]], [[engine-harkd]].

## Electron over Tauri (`0001`)
The UI shell is **Electron + Angular 21**, not Tauri 2 or native SwiftUI (`0001` §Decision). Tauri's
Rust-backend advantage was moot once the engine became a separate Swift binary, leaving only WKWebView
quirks against an Angular UI; SwiftUI's ramp cost was too high for v1. Tradeoff: ~200 MB bundle / ~150 MB
idle RAM, accepted because WhisperKit holds ~1.5 GB anyway.

## No cloud ASR (`0004`)
**Transcription is on-device, always — no Soniox / AssemblyAI / Deepgram / Whisper API, ever** (`0004`
§Decision). "Audio never leaves your Mac" is the product's whole differentiator and unlocks PDPA / GDPR /
corporate-policy use cases. The **only** outbound channel is the user-invoked Claude API edge (summary,
Q&A, high-quality translation), carrying transcript **text** — never audio (see [[llm-egress]]).

## MIT license (`0013`)
Hark is licensed **MIT**, `Copyright (c) 2026 Dang Anh Tuan` (`0013` §Decision) — simplest, App-Store-safe
(unlike GPL), aligned with the indie-Swift ecosystem and vendored MIT deps. Revisit Apache-2.0 / a CLA if
meaningful outside contributors arrive.

See [[capture-audio]] for the capture detail these choices enable.
