---
type: decision
title: Capture architecture (system audio + mic, process tap, permissions)
status: current
sources: ["0006", "0007", "0011", "0012", "engine/Sources/HarkCapture/CoreAudioProcessTap.swift", "engine/Sources/HarkCapture/PermissionGate.swift"]
updated: 2026-06-30
tags: [decision, engine, audio, capture, permissions, coreaudio]
---

# Decision — capture architecture

How Hark records a meeting: **system audio** (the meeting app's output) plus the **microphone**, mixed
into one 16 kHz mono stream the engine transcribes.

## System-audio API and macOS floor (`0006` §Decision 1)
Use **Core Audio Process Taps** (`CATapDescription` + aggregate-device API), with a **macOS 14.4+** floor.
Rejected: ScreenCaptureKit audio-only ("audio inside a display-capture framework" smell — but kept as a
selectable fallback backend, `0011`), and virtual-audio-device kexts (hard no in a privacy product).

## Mix output shape (`0006` §Decision 2)
Both sources resample to 16 kHz mono Float32, time-align in a ring buffer, sum sample-wise, **soft-clip via
`tanh(x * 0.9)`**, convert to Int16, and write one WAV (PCM s16le). Two-channel / two-file options were
rejected because FluidAudio diarization uses voice embeddings, not channel identity, and the engine ingests
mono (`0006`).

## Making Process Taps actually deliver audio (`0011`)
On macOS 26 the tap returned `noErr` everywhere yet wrote a **0-byte WAV**. Four things are all required
(`0011` §Decision; impl `engine/Sources/HarkCapture/CoreAudioProcessTap.swift`):
1. Request the **`kTCCServiceAudioCapture`** TCC service (a *third* service, not Mic or Screen Recording),
   with a stable signed identity launched via `open`.
2. Run a real `CFRunLoop` on a dedicated thread and point `kAudioHardwarePropertyRunLoop` at it —
   `AudioDeviceStart` is async.
3. Build the aggregate device correctly (output device as clock; CFBoolean keys, not `Int`).
4. Do **not** set `isExclusive` on the tap (`isPrivate = true` is fine). The breakthrough was a runtime
   `kAudioDevicePropertyDeviceIsRunning` readback, not more docs. Bonus: tapping only rendered output keeps
   **Bluetooth headphones in hi-fi** (no A2DP→HFP downgrade).

## Permission UX
- **CLI (`hark-capture`):** actively *requests* missing mic / screen permissions on first run rather than
  only preflighting, so it behaves like a normal macOS app (`0007`, superseding `0006` §3). `--check-permissions`
  keeps pure preflight for scripts.
- **Daemon (`harkd`):** does **not** gate at startup; it serves before the model loads and acquires
  permissions lazily, per source, at `capture.start` — all granting live, no relaunch (`0012`).
  Implemented in `engine/Sources/HarkCapture/PermissionGate.swift`.

See [[engine-harkd]], [[engine-service]], [[whisperkit-asr]], [[foundations]].
