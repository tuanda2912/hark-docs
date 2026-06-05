---
type: subsystem
title: Audio capture — Process Taps, ScreenCaptureKit & mic
status: current
sources: [ADR-0006, ADR-0007, ADR-0011, engine/Sources/HarkCapture/CoreAudioProcessTap.swift, engine/Sources/HarkCapture/CapturePipeline.swift, engine/Sources/HarkCapture/PermissionGate.swift, engine/Sources/HarkCapture/SystemAudioCapturing.swift, engine/Sources/HarkCapture/SystemAudioTap.swift, engine/Sources/HarkCore/WAVWriter.swift]
updated: 2026-06-05
tags: [capture, core-audio, permissions, privacy]
---

# Audio capture — Process Taps, ScreenCaptureKit & mic

Captures **system audio** (Core Audio Process Taps, opt-in; ScreenCaptureKit, default) plus the **microphone**, resamples each source to 16 kHz mono Float32, time-aligns them in per-source FIFOs, and mixes via sum + `tanh(x * 0.9)` soft-clip into one **16 kHz mono PCM s16le** stream. That stream feeds either a WAV file, a live Float32 sink for [[engine-harkd]], or both. Getting Process Taps to actually deliver audio in a non-GUI process took an entire debug saga — see [[capture-audio]] / ADR-0011.

## Code map

**Layer:** Engine Core & Audio Capture.

**Files**

- `engine/Sources/HarkCapture/CapturePipeline.swift` — orchestrates the capture path: mic + system-audio backends → per-source `Resampler` → FIFO → 100ms pump → `Mixer` → optional WAV writer and Float-frame streaming sink for harkd.
- `engine/Sources/HarkCapture/CoreAudioProcessTap.swift` — selectable (`HARK_CAPTURE_BACKEND=tap`) system-audio backend over macOS 14.4+ Core Audio Process Taps: builds a global tap + private aggregate device, runs a dedicated CFRunLoop for HAL notifications, delivers PCM from a realtime IOProc.
- `engine/Sources/HarkCapture/SystemAudioTap.swift` — **default** system-audio backend over ScreenCaptureKit (`SCStream`): captures audio under the Screen Recording TCC grant via a deliberately tiny no-op video stream, copying audio `CMSampleBuffer`s to `AVAudioPCMBuffer`s.
- `engine/Sources/HarkCapture/SystemAudioCapturing.swift` — protocol abstracting the two system-audio backends so `CapturePipeline` can swap them via a one-line factory change.
- `engine/Sources/HarkCapture/MicCapture.swift` — microphone capture via `AVAudioEngine`: installs a tap on the input node and forwards native-format PCM to a closure on the Core Audio thread.
- `engine/Sources/HarkCapture/Resampler.swift` — wraps `AVAudioConverter` to convert arbitrary-input PCM to 16 kHz mono Float32, reporting the actual converted frame count.
- `engine/Sources/HarkCapture/Mixer.swift` — sums two 16 kHz mono Float32 streams, applies tanh soft-clip, scales to Int16, and tracks frames-written / per-source underrun / peak-amplitude stats.
- `engine/Sources/HarkCapture/PermissionGate.swift` — TCC gate: pure preflight checks plus active requests for Microphone and Screen Recording, and a dev-only private-SPI path (`dlopen` TCC) for `kTCCServiceAudioCapture` behind `HARK_ENABLE_TCC_SPI`.
- `engine/Sources/HarkCaptureCLI/HarkCaptureCLI.swift` — entry point for the `hark-capture` CLI: an `AsyncParsableCommand` that gates permissions, builds a `CapturePipeline` from `--mic-only`/`--system-only`/`--output` flags, and stops cleanly on SIGINT or `--duration`.

**Key types & functions**

- `CapturePipeline` (class) — wires mic/system capture to resampling, FIFO buffering, the 100ms pump, soft-clipping mix, and WAV/streaming sinks; emits a per-second JSON heartbeat with underrun and peak stats. *Lx30–L295.*
- `CapturePipeline.Options` (struct) — config: which sources to capture, optional WAV output URL, optional Float-frame sink, pump/underrun frame sizes. *Lx37–L58.*
- `SystemAudioCapturing` (protocol) — declares `sourceFormat` plus `start(onBuffer:)`/`stop()`; the seam both system-audio backends conform to. *Lx30–L44.*
- `SystemAudioTap` (class) — `SCStreamOutput`-conforming `SystemAudioCapturing` backend (ScreenCaptureKit), latches the delivered format on the first buffer. *Lx54–L397.*
- `CoreAudioProcessTap` (class) — `SystemAudioCapturing` backend over Core Audio Process Taps; manages tap/aggregate/IOProc lifecycle, the dedicated HAL run loop, and TCC audio-capture permission, with `HARK_TAP_DEBUG` diagnostics. *Lx74–L626.*
- `MicCapture` (class) — wraps an `AVAudioEngine` input tap; exposes native source format and start/stop delivering `AVAudioPCMBuffer`s to a `BufferHandler`. *Lx14–L42.*
- `Resampler` (class) — wraps `AVAudioConverter`; failable init builds the 16 kHz mono target, `convert()` handles rate conversion and channel downmix. *Lx12–L61.*
- `Mixer` (class) — mixes one aligned chunk from each enabled source into Int16 PCM, counting underruns only for enabled-but-missing sources and updating `Stats`. *Lx14–L63.*
- `PermissionGate` (enum) — namespace exposing `check()`, `ensureGranted()`, `requestMicrophone()`, and the dev-only private-SPI audio-capture preflight/request. *Lx22–L163.*
- `PermissionGate.Status` (struct) — mic/screen grant flags with derived `allGranted` and an exit code; extension prints a human-readable report. *Lx23–L29.*
- `HarkCapture` (struct, CLI) — `AsyncParsableCommand` defining flags and `run()`: permission preflight/request, mutual-exclusion validation, pipeline start/stop, final stats. *Lx19–L128.*
- `OneShotResume` (class, CLI) — lock-guarded helper that resumes a `CheckedContinuation` exactly once so the SIGINT source and duration timer can race safely. *Lx133–L150.*

**Pinned by tests**

- `engine/Tests/HarkCaptureTests/HarkCaptureTests.swift` — placeholder smoke test asserting the `HarkCapture` target compiles before the per-component capture tests land.

**Connections**

No cross-subsystem edges are resolved in this slice — the engine's Swift module imports (`HarkCore`'s `WAVWriter`, the harkd consumer of the Float-frame sink) aren't traced by the graph. The prose links below ([[engine-harkd]], [[vad]], [[vault-writer]], [[audio-store]]) carry the real connections.

## What it does

The capture stack lives in the `HarkCapture` Swift module and converts two heterogeneous, independently-clocked audio sources into the single mono 16 kHz stream the rest of the engine expects.

- **Two sources, two Core Audio threads.** Mic and system tap each fire callbacks on their own realtime Core Audio thread, delivering buffers in whatever native format the device negotiated (typically 48 kHz stereo Float32 for the tap).
- **Per-source resample → FIFO.** Each buffer is resampled to 16 kHz mono Float32 and appended (under a lock) to that source's FIFO.
- **Pump + mix.** A 100 ms-cadence pump (`pumpFrames = 1600`) pulls a chunk from each FIFO, sums sample-wise, soft-clips with `tanhf((mic + sys) * 0.9)`, and fans the result out to the WAV writer (after Int16 quantization) and/or the live Float32 sink.
- **One mixed file, never per-channel.** The output is a single mono WAV (ADR-0006 Decision 2), not L/R-split — diarization uses voice embeddings, not channel identity (see [[diarization]]).

## Key files (repo-relative)

| File | Role |
|---|---|
| `engine/Sources/HarkCapture/CoreAudioProcessTap.swift` | System-audio backend via Core Audio Process Taps (`HARK_CAPTURE_BACKEND=tap`). Builds the tap, the aggregate device, the IOProc, and the dedicated HAL run loop. |
| `engine/Sources/HarkCapture/SystemAudioTap.swift` | The **default** system-audio backend (ScreenCaptureKit `SCStream`, `capturesAudio=true`). |
| `engine/Sources/HarkCapture/MicCapture.swift` | Microphone source. |
| `engine/Sources/HarkCapture/Mixer.swift` | Stats + Int16 mix for the WAV path (underrun counters, peak amplitude, frames written). |
| `engine/Sources/HarkCapture/CapturePipeline.swift` | Orchestrator: resamplers, per-source FIFOs, the 100 ms pump, the mix, the heartbeat, and backend selection (`makeSystemBackend`). |
| `engine/Sources/HarkCapture/PermissionGate.swift` | TCC preflight + active request: mic, screen recording, and the private-SPI `kTCCServiceAudioCapture` path for dev tap builds. |
| `engine/Sources/HarkCore/WAVWriter.swift` | Streaming RIFF WAV writer (44-byte header, patch-on-close), hard-coded to 16 kHz mono s16le. |

## How it connects to other subsystems

- **[[engine-harkd]]** — `harkd` drives `CapturePipeline` with `outputURL = nil` and a `floatFrameSink`, consuming the mixed Float32 frames live without ever touching disk. The pump callback runs on the pump queue, so harkd offloads heavy work (VAD, ASR) downstream.
- **[[vad]]** — the live Float32 stream is the input to voice-activity detection; capture itself does no gating, it just emits a continuous mixed stream.
- **[[vault-writer]]** — when a WAV *is* written, it is the per-meeting audio artifact that lands in the vault audio store (see [[audio-store]]); the streaming-only mode bypasses this entirely.
- **[[threat-model]]** / [[local-first-guarantee]] — capture is the most privacy-sensitive surface. The tap reads only **rendered output** and never opens the Bluetooth microphone, so BT headphones stay in hi-fi A2DP mode (no A2DP→HFP downgrade) — the whole user-facing reason Process Taps mattered (ADR-0011). Audio stays local; nothing leaves the machine here.
- **[[capture-audio]]** — the decision digest for ADR-0006 / 0007 / 0011 that governs every choice on this page.

## Governing ADRs

- **[ADR-0006](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0006-phase-2-capture-architecture.md)** — picks Core Audio Process Taps (macOS 14.4+ floor), the 16 kHz mono s16le mix shape with `tanh(x * 0.9)` soft-clip, and the original fail-fast permission preflight. **§3 (Permission UX) superseded by ADR-0007.**
- **[ADR-0007](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0007-active-permission-request.md)** — supersedes ADR-0006 §3 only: *actively request* missing TCC permissions on first run so the macOS system dialog appears, instead of just preflighting and exiting. `--check-permissions` keeps pure-preflight semantics (scripts must never prompt).
- **[ADR-0011](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0011-process-tap-system-audio-gotchas.md)** — reaffirms + amends ADR-0006 §Decision 1: documents the four-bug saga and the exact recipe that made Process Taps deliver audio. Builds on ADR-0007 (one root cause was a TCC service the gate never requested).

## The Process-Tap recipe (the four non-negotiables)

Per ADR-0011 and `CoreAudioProcessTap.swift`, **all four** must hold or you get `noErr` from every call and total silence:

1. **`kTCCServiceAudioCapture` with a stable signed identity.** This is a *third* TCC service, distinct from Microphone and Screen Recording. It only sticks for a signed binary launched via `open` (LaunchServices attributes the grant to the bundle, not the parent terminal). Dev builds request it through the private TCC SPI (`dlopen`/`dlsym` of `TCCAccessRequest`) behind `HARK_ENABLE_TCC_SPI=1` in `PermissionGate`; production ships a signed `.app` with `NSAudioCaptureUsageDescription` and uses the public prompt.
2. **A real, running `CFRunLoop` on a dedicated thread**, with `kAudioHardwarePropertyRunLoop` pointed at it. `AudioDeviceStart` is asynchronous; the HAL delivers its start completion on a `CFRunLoop`. A GUI app gets this free from its main run loop; a CLI/daemon parked in `dispatch_main()` does not, so the device stays `isRunning=0`. (Setting the property to `NULL` was observed to be a **no-op on macOS 26** — only a genuinely running loop worked.)
3. **A correctly composed aggregate device.** The default **output device** is both `MainSubDevice` and the sole entry in `SubDeviceList` (it provides the clock); the tap rides in `TapList` with drift compensation. **All boolean keys must be real `CFBoolean`s** (Swift `true`/`false`) — an `Int` `1`/`0` becomes a `CFNumber` and reads as `false` (e.g. `TapAutoStart` silently never auto-started).
4. **`isExclusive` left unset on the `CATapDescription`.** It lets the tap *bind* (one input stream) but silently prevents the aggregate from ever *starting*. `isPrivate = true` is fine and **is** set (private tap, a privacy win) — on-device testing isolated `isExclusive` as the sole culprit (resolved open question, 2026-05-31).

The diagnostic that cracked it: a `dbgAggregateState` readback (`HARK_TAP_DEBUG=1`) of `isAlive`, `isRunning`, `inputStreams`, `activeSubDevices` right after `AudioDeviceStart` — a composed-but-not-running device (`isRunning=0`) collapsed the search space. ADR-0011's lesson: *when Core Audio returns `noErr` and does nothing, instrument the object state before changing more code.*

## Invariants (must stay true)

- **Engine input contract is mono 16 kHz PCM s16le.** The whole pipeline downmixes/resamples to this; `WAVWriter` hard-codes the header to 1 channel, 16000 Hz, 16-bit. Any future stereo path revisits ADR-0006 §Decision 2.
- **Soft-clip, never hard-clip.** Mixing is `tanhf((mic + sys) * 0.9)` — hard clipping at ±1.0 distorts loud overlaps and tanks Whisper accuracy (ADR-0006).
- **Tap reads rendered output only.** Never opens the Bluetooth mic; BT stays in hi-fi output mode (ADR-0011). Audio never leaves the machine from this layer (rule #1, [[threat-model]]).
- **`--check-permissions` never triggers a prompt.** Pure preflight (`PermissionGate.check`) only; the active-request path (`ensureGranted`) is for the interactive first-run flow (ADR-0007).
- **Default system backend is ScreenCaptureKit; Process Taps are opt-in (`HARK_CAPTURE_BACKEND=tap`).** SCK is the proven path and "must never regress"; the tap path is retained as the Apple-intended API and the BT-headphones win, but the default flip is a separate future decision (ADR-0011 open question).
- **A source falling behind never kills the recording.** When a FIFO has fewer than `underrunGraceFrames` (1600) buffered, the pump emits silence for the lagging source and bumps the underrun counter; the meeting continues.
- **`isExclusive` stays unset on the tap description**, permanently. It is the single flag that stops the aggregate from starting.

## Known limitations & caveats

- **Echo loops** (laptop speakers picked up by the laptop mic) are indistinguishable from real overlap — users should wear headphones (ADR-0006).
- **Clock drift** between the two hardware sources (~1 sample/sec, ≈225 ms over an hour) is accepted untreated for now; the mach-time drift-correction fix is out of Phase 2 scope (`CapturePipeline.swift` header).
- **TCC attribution caveat (dev builds).** For an unsigned CLI the mic/screen prompt attributes to the *parent terminal* (Terminal/iTerm/Ghostley/VS Code shell), not to `hark-capture`. The grant works; only the label is off. Fixed by shipping a signed `.app` (ADR-0007).
- **Screen Recording requires a terminal relaunch** after the first grant (TCC inherits parent-process trust) — the gate prints a re-run hint and exits non-zero (ADR-0007).
- **Private-SPI smell.** The `kTCCServiceAudioCapture` request goes through Apple's *unpublished* TCC framework via `dlopen`/`dlsym` — dev-only, behind `HARK_ENABLE_TCC_SPI=1`, and slated for deletion once the signed-bundle public path lands (`PermissionGate.swift`).
- **macOS-version sensitivity is real** — the `NULL`-run-loop no-op on macOS 26 proves HAL behavior shifts between releases; the SCK backend is the insurance (ADR-0011).

## See also

[[capture-audio]] · [[engine-harkd]] · [[vad]] · [[audio-store]] · [[vault-writer]] · [[threat-model]] · [[glossary]]
