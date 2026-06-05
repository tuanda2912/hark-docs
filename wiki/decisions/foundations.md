---
type: decision-digest
title: Foundations (ADR-0001/0002/0003/0004/0005/0013)
status: current
sources: [ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0013]
updated: 2026-06-05
tags: [decisions, stack, scope, privacy, license]
---

# Foundations (ADR-0001/0002/0003/0004/0005/0013)

The six bedrock decisions that fix Hark's shape, all dated 2026-05-24 to -05-31
and all **Accepted** (none superseded): **Electron** over Tauri for the UI shell
([0001](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0001-electron-over-tauri.md)), **macOS-only / Apple-Silicon**
scope ([0002](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0002-macos-only-scope.md)), a **Swift + WhisperKit**
engine over Rust ([0003](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0003-swift-whisperkit-engine.md)), **no
cloud ASR ever** ([0004](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0004-no-cloud-asr.md)), **Phase 0 RTF
validated** at ~0.075 ([0005](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0005-phase-0-rtf-validated.md)), and
the **MIT license** ([0013](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0013-mit-license.md)). These are locked —
`CLAUDE.md`'s "Don't re-debate" list points straight here. See [[overview]] for
the map and [[glossary]] for terms like RTF and ANE.

> One causal chain runs through five of these: dropping cross-platform scope
> (0002) removed the reason for a Rust engine, which reopened both the shell
> question (→ 0001 Electron) and the engine question (→ 0003 Swift), and 0005
> empirically confirmed 0002/0003/0004 were safe to build on.

## The decisions

### ADR-0001 — Electron over Tauri 2 for the UI shell
- **Status:** Accepted (2026-05-24). Not superseded.
- **Decision:** **Electron + Angular 21** for the desktop shell.
- **Why:** Tauri's only strategic pull was "Rust everywhere," which evaporated once
  the engine became a separate Swift binary (0003). What remained was WKWebView's
  Safari quirks against an Angular UI with no offsetting win. Full SwiftUI was
  rejected for v1 on ramp cost (revisit at v1.5).
- **Tradeoffs accepted:** ~200 MB bundle, ~150 MB idle RAM — noise next to
  WhisperKit's ~1.5 GB. Electron's security model (strict CSP, `contextIsolation`
  on, `nodeIntegration` off) must be enforced; see [[preload-security]] and
  [[electron-main]].
- → [../decisions/0001-electron-over-tauri.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0001-electron-over-tauri.md)

### ADR-0002 — macOS-only scope for v1
- **Status:** Accepted (2026-05-24). Not superseded.
- **Decision:** v1 is **macOS-only, Apple Silicon (M-series)**. Windows, Linux,
  iOS, Android are **out** — not deferred. Intel Macs are refused at install with
  a clear error.
- **Why:** cross-platform is a complexity multiplier for a solo evenings-and-
  weekends developer, the primary user is on a Mac, and Apple Silicon ASR is now
  production-grade. A web/PWA path was rejected because browsers can't capture
  system audio (kills the Zoom/Teams use case); iOS rejected for the same capture
  gap. See [[audio-capture]].
- **Enables:** free choice of best-in-class Apple tools → 0003.
- → [../decisions/0002-macos-only-scope.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0002-macos-only-scope.md)

### ADR-0003 — Swift + WhisperKit engine (over Rust + whisper.cpp)
- **Status:** Accepted (2026-05-24). Not superseded.
- **Decision:** the engine is a **single Swift sidecar binary** managed by the
  Electron main process. ASR = WhisperKit `large-v3-turbo` on the **Apple Neural
  Engine**; system audio = ScreenCaptureKit / CoreAudio Process Taps; mic =
  AVAudioEngine; VAD = Silero CoreML; diarization = FluidAudio; local translation =
  NLLB-200; WS server = Swift NIO (or Vapor, decided at Phase 3).
- **Why:** with Windows reuse gone (0002), Rust's portability premium vanished and
  whisper.cpp Metal is ~30–40% slower than WhisperKit on ANE. Python rejected on
  macOS packaging pain; in-process Node rejected because WhisperKit has no JS
  bindings and WASM Whisper is ~5× slower. Engine-in-own-process buys crash
  isolation and a stable signed binary for the capture permission.
- **Embodied by:** [[engine-harkd]], [[whisperkit-asr]], [[audio-capture]],
  [[vad]], [[diarization]]. UI↔engine is the [[wire-protocol]].
- → [../decisions/0003-swift-whisperkit-engine.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0003-swift-whisperkit-engine.md)

### ADR-0004 — No cloud ASR, ever
- **Status:** Accepted (2026-05-24). Not superseded.
- **Decision:** transcription is **entirely on-device** (WhisperKit). No Soniox /
  AssemblyAI / Deepgram / Azure / Google / OpenAI Whisper API — for any reason.
  The *only* outbound content path is the explicit Claude API edge (summary,
  in-meeting Q&A, high-quality translation), user-invoked, and **only transcript
  text crosses — never audio**.
- **Why:** "audio never leaves your Mac" is the trust differentiator and the whole
  reason Hark exists; cloud ASR makes that sentence a lie. Audio can't be
  pseudonymized (voice is identifying), so the "scrub before send" hybrid is
  incoherent. This ADR exists to **end the discussion permanently** — point future
  sessions here.
- **Embodied by:** [[threat-model]], [[local-first-guarantee]],
  [[egress-governance]], [[llm-egress]]. Maps to `CLAUDE.md` hard rule #1.
- → [../decisions/0004-no-cloud-asr.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0004-no-cloud-asr.md)

### ADR-0005 — Phase 0 RTF validated → proceed
- **Status:** Accepted (2026-05-26). Not superseded.
- **Decision:** the go/no-go gate **passed**; the planned stack proceeds with no
  fallback. Phase 1 unblocked.
- **The numbers:** RTF avg **0.0747** (6.7× under the < 0.50 target), p95 0.0828,
  cold start 1.67s warm / 2.22s first launch (≤ 5.0s target). Measured on an Apple
  M4 / 16 GB, model `large-v3-v20240930_626MB`, a 255s English LibriVox sample, 46
  sliding 30s/5s-hop windows. Harness: `engine/Sources/HarkBench/main.swift`; raw
  results under `engine/Results/`. This empirically validates the assumptions in
  0002/0003/0004 — future ADRs cite it instead of re-litigating WhisperKit.
- **Honest scope limits:** English-only sample (Thai↔English code-switch
  unmeasured), **WER not measured** (speed only), one hardware point (M4), one of
  five fixture cases. Fallbacks if it had *failed* (Q5 quant, medium model,
  ANE-only, or revisiting cloud ASR) are filed for posterity, not on the table.
- **Embodied by:** [[whisperkit-asr]]. See [[glossary]] for RTF.
- → [../decisions/0005-phase-0-rtf-validated.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0005-phase-0-rtf-validated.md)

### ADR-0013 — MIT License
- **Status:** Accepted (2026-05-31). Not superseded.
- **Decision:** Hark is **MIT-licensed**; a root `LICENSE` carries
  `Copyright (c) 2026 Dang Anh Tuan`. Vendored third-party skills under
  `.claude/skills/` keep their own upstream MIT license (© Paul Hudson).
- **Why:** simplest, most-recognized license; aligned with the indie-Swift norm and
  with already-vendored MIT deps; **App-Store-safe**. Apache-2.0 rejected for now
  (its patent grant is largely theoretical for a solo integrator and adds
  ceremony); GPL rejected as App-Store-incompatible; "no license" defeats the
  open-source goal. MIT preserves all author options (dual-license / closed
  commercial build later).
- **Revisit trigger:** meaningful outside contributors → reconsider Apache-2.0 or a
  CLA, and supersede this ADR then.
- → [../decisions/0013-mit-license.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0013-mit-license.md)

## Invariants these lock in

- **No cloud ASR. Audio never leaves the machine** except the explicit, user-
  invoked Claude API text edge (0004; `CLAUDE.md` rule #1). See [[threat-model]].
- **macOS-only, Apple Silicon** — no cross-platform abstraction layer; Intel
  refused at install (0002).
- **Engine = a separate signed Swift binary** over a loopback WS, never in-process
  (0001 + 0003). If the engine ever moves into the shell process, 0001's calculus
  flips.
- **The stack is empirically grounded** (0005), not aspirational — RTF has ~6×
  headroom on M4.

## See also

- [[overview]] · [[engine-harkd]] · [[whisperkit-asr]] · [[threat-model]] ·
  [[local-first-guarantee]] · [[glossary]]
- Related digests: [[capture-audio]], [[streaming-finalization-decisions]],
  [[packaging-distribution]], [[ui-onboarding]].
