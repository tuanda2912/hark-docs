---
type: decision-digest
title: Capture & audio (ADR-0006/0007/0011)
status: current
sources: [ADR-0006, ADR-0007, ADR-0011]
updated: 2026-06-05
tags: [capture, core-audio, permissions, privacy]
---

# Capture & audio (ADR-0006/0007/0011)

The three ADRs that pin Hark's system-audio capture: **ScreenCaptureKit + Core Audio Process Taps + mic, mixed to 16 kHz mono with a macOS 14.4 floor** (0006), **actively request TCC permissions on first use** so the system dialog appears (0007, supersedes 0006 §3), and **the four-part Process-Tap recipe** that makes a non-GUI process actually deliver audio (0011, amends 0006 §Decision 1). For the running code, see [[audio-capture]]; for why it matters, [[threat-model]] / [[local-first-guarantee]].

## At a glance

| ADR | Title | Status | Supersession |
|---|---|---|---|
| 0006 | Phase 2 capture architecture | Accepted | §3 (Permission UX) **superseded by 0007**; §Decision 1 **amended by 0011** |
| 0007 | Actively request TCC permissions on first run | Accepted | **Supersedes 0006 §3** only |
| 0011 | Making Core Audio Process Taps actually capture | Accepted | **Reaffirms + amends 0006 §Decision 1**; builds on 0007 |

## ADR-0006 — Phase 2 capture architecture

[../decisions/0006-phase-2-capture-architecture.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0006-phase-2-capture-architecture.md) · 2026-05-26 · **Accepted**

Answers three coupled Phase-2 questions in one ADR (shared context, same data flow):

1. **System-audio API & macOS floor.** Use **Core Audio Process Taps** (`CATapDescription` + aggregate-device API), setting a **macOS 14.4+** floor. Rejected: ScreenCaptureKit audio-only ("audio inside a display-capture framework" smell — but pre-authorized as the fallback), prototyping both (not enough uncertainty), and BlackHole-style virtual devices (hard no on third-party kexts in a privacy product).
2. **Mix output shape.** Both sources resample to **16 kHz mono Float32**, time-align in a ring buffer, sum sample-wise, soft-clip via **`tanh(x * 0.9)`**, convert to Int16, write one **PCM s16le WAV**. Rejected: L/R two-channel (engine is mono; FluidAudio diarization doesn't need channel separation), two separate files (doubles disk, defers mixing), and hard-clip (distorts loud overlaps, tanks WER).
3. **Permission UX (original).** Fail-fast preflight: read mic + Screen Recording TCC state, print the System Settings path, exit code 3 on any miss; `--check-permissions` checks without capturing. **→ §3 superseded by ADR-0007.**

Must remain true (still binding): the engine input contract stays **mono 16 kHz PCM s16le**; soft-clip, never hard-clip. Known limitation: echo loops (laptop speakers → laptop mic) look like real overlap — wear headphones.

## ADR-0007 — Actively request TCC permissions on first run

[../decisions/0007-active-permission-request.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0007-active-permission-request.md) · 2026-05-26 · **Accepted** · **supersedes ADR-0006 §3 only**

The rest of ADR-0006 (floor, Process Taps, mix shape) is unchanged.

Phase-2 dogfooding showed the fail-fast preflight is hostile on first run: macOS only fires the "App X wants to access your microphone" dialog when an app **requests** the permission (`AVCaptureDevice.requestAccess` / `CGRequestScreenCaptureAccess`), never as a side effect of a preflight read. So `hark-capture` now **actively requests** any missing permission: read state → if mic missing, `requestAccess(for: .audio)` → if screen recording missing, `CGRequestScreenCaptureAccess()` → re-check → print the System Settings hint and exit 3 only if still missing. `--check-permissions` keeps **pure-preflight** semantics (scripts must never prompt).

Tradeoffs accepted: for an unsigned dev CLI the dialog **attributes to the parent terminal**, not to `hark-capture` (intrinsic to TCC's caller identification; fixed only by a signed `.app`); **Screen Recording requires a relaunch** after the first grant (TCC inherits parent-process trust), so the CLI prints a re-run hint and exits non-zero.

## ADR-0011 — Making Core Audio Process Taps actually capture system audio

[../decisions/0011-process-tap-system-audio-gotchas.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0011-process-tap-system-audio-gotchas.md) · 2026-05-31 · **Accepted** · **reaffirms + amends ADR-0006 §Decision 1**; builds on ADR-0007

The risk ADR-0006 flagged came due: on macOS 26, `hark-capture --system-only` wrote a **0-byte WAV** while every Core Audio call returned `noErr` — silence with no error to debug. After a four-hour saga (and a fully-built, working ScreenCaptureKit fallback held in reserve), the decision is to **keep Process Taps**. Getting them to deliver audio in a **non-GUI process requires all four** of the following — miss one and you get `noErr` everywhere plus silence:

1. **Request `kTCCServiceAudioCapture`** — a *third* TCC service, distinct from Microphone and Screen Recording, that ADR-0007's gate never knew to request. It only sticks with a **stable signed identity**: sign the binary (a free Apple Development cert suffices) and launch via `open` so LaunchServices attributes the grant to the bundle, not the parent terminal. Dev builds use the private TCC SPI behind `HARK_ENABLE_TCC_SPI=1`; production ships a signed `.app` with `NSAudioCaptureUsageDescription` and the public prompt.
2. **Run a real `CFRunLoop`** on a dedicated thread with `kAudioHardwarePropertyRunLoop` pointed at it. `AudioDeviceStart` is asynchronous; the HAL delivers its start-completion on a run loop. A GUI app gets this free; a CLI parked in `dispatch_main()` does not. (Setting the property to `NULL` was a **no-op on macOS 26** — only a genuinely running loop worked.)
3. **Build the aggregate device correctly** — default **output device** as both `MainSubDevice` and the sole `SubDeviceList` entry (it provides the clock), the tap in `TapList` with drift compensation, and **all boolean keys as real `CFBoolean`s** (Swift `true`/`false`, *not* `Int` `1`/`0`, which becomes a `CFNumber` and reads as false).
4. **Leave `isExclusive` unset** on the `CATapDescription`. It lets the tap *bind* but silently stops the aggregate from ever *starting*. (`isPrivate = true` is fine and **is** set — on-device testing 2026-05-31 isolated `isExclusive` as the sole blocker, so tap privacy was restored at no cost.)

The breakthrough was a `dbgAggregateState` readback (`HARK_TAP_DEBUG=1`) showing `isAlive=1 inputStreams=1 activeSubDevices=1 isRunning=0` — a composed-but-not-running device that collapsed the search space. **Lesson: when Core Audio returns `noErr` and does nothing, instrument the object state before changing more code.**

The whole saga mattered for one user-facing reason: tapping only the **rendered output** never opens the Bluetooth microphone, so BT headphones stay in hi-fi A2DP mode (no A2DP→HFP downgrade) — Process Taps are *better* than SCK here. SCK is **retained as a selectable backend** (`HARK_CAPTURE_BACKEND`; currently the default, `tap` opt-in) as a tested escape hatch.

Implementation: `engine/Sources/HarkCapture/CoreAudioProcessTap.swift`, `engine/Sources/HarkCapture/PermissionGate.swift`, `engine/scripts/sign-dev-bundle.sh`.

Open question (still open): **minimal-fix bisect not completed** — the working config has *both* the dedicated run loop and no `isExclusive`; strict necessity of the run loop once the flag is gone was not separately confirmed. The run loop is kept regardless (correct practice for a daemon servicing HAL notifications).

## Where these decisions live in the code

The running subsystem that embodies all three ADRs is [[audio-capture]] (the `HarkCapture` module); it feeds [[vad]] and [[engine-harkd]] live, or the WAV path into [[audio-store]] via [[vault-writer]]. The privacy framing is in [[threat-model]] and [[local-first-guarantee]] (audio never leaves the machine from this layer — rule #1). Terms like Process Tap, aggregate device, TCC, and A2DP/HFP are in [[glossary]].

## See also

[[audio-capture]] · [[vad]] · [[engine-harkd]] · [[privacy-egress]] · [[glossary]]
