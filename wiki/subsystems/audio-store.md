---
type: subsystem
title: Meeting audio store
status: current
sources: [ADR-0027, ADR-0028, engine/Sources/Harkd/AudioStore.swift, engine/Sources/HarkCore/WAVWriter.swift]
updated: 2026-06-05
tags: [privacy, audio, vault, opt-in]
---

# Meeting audio store

`AudioStore` is the **opt-in** persistence path for the full-meeting **16 kHz mono PCM** — the *same* RAM buffer the offline diarization pass already holds (`capturedAudio`/`sessionAudio`). When the session enabled *Keep audio* (the `keep_audio` flag, default **off**), it writes that buffer to `<vaultRoot>/.audio/<meeting-id>.wav` via `HarkCore.WAVWriter`, reusing the meeting's **exact `.md` basename** so audio and notes correlate. When the gate is off it performs **zero `.audio/` I/O** — no directory, no temp, no file. It exists to feed the planned **Post-Meeting Review screen** (verify-by-ear: play a clip → assign the speaker). Governed by [[privacy-data-control]] (ADR-0027) and ADR-0028.

## Code map

*Grounded in the understand-anything graph (commit 8efdfde, 2026-06-05, code-only).*

- **Layer:** Streaming Daemon & Transcription.
- **Files:**
  - `engine/Sources/Harkd/AudioStore.swift` — opt-in meeting-audio persistence for harkd: when `keep_audio` is set, atomically writes the full-meeting 16 kHz PCM to `vault/.audio/<meeting-id>.wav` (gitignored, parallel to `.speakers/`), with a hard privacy gate that does zero I/O when off.
- **Key types & functions:**
  - `AudioStore` (class, `AudioStore.swift` Lx 35–137) — Sendable struct that persists opt-in meeting audio to the vault's `.audio/` folder via WAVWriter with atomic temp-then-rename, asserting the `.gitignore` rule and gating all I/O on `keepAudio`.
- **Pinned by tests:**
  - `engine/Tests/HarkdTests/AudioPersistenceTests.swift` — tests for opt-in meeting-audio persistence (`AudioStore`) and the `keep_audio` privacy gate (ADR-0027), driving the production store against a temp `.audio/` dir and proving the gate-off path touches nothing.
- **Connections:**
  - depends_on → [[subsystems/engine-harkd|Engine / harkd]] (`AudioStore` → `WAVWriter`)

## What it does

`AudioStore` lives in the `Harkd` module (`engine/Sources/Harkd/AudioStore.swift`) and is a stateless `Sendable struct` — like `SpeakerStore`, it holds no mutable in-memory state; the vault root is injected and every call writes atomically. Its single call site is `EngineSession` (an actor), which serializes it and invokes it **off the live path** at stop, after the markdown write — exactly like [[vault-writer]] and the speaker store (see [[speaker-enrollment]]).

The one public method, `persist(meetingId:samples:keepAudio:)`:

1. **Privacy gate first.** `guard Self.audioPersistenceAllowed(keepAudio:)` — returns `nil` *before touching the filesystem* when the session opted out. This is the load-bearing privacy gate: gate off ⇒ zero `.audio/` I/O.
2. **Skip empties.** `guard !samples.isEmpty` returns `nil` (nothing to write).
3. **Float → Int16.** `floatToInt16` scales the `-1..1` Float buffer by `*32767` and clamps to `[-32768, 32767]` — the **same** conversion the capture `Mixer` uses (see [[audio-capture]]). The mixed Float stream is already `tanh`-soft-limited to ±1, so it never re-limits, just scales + clamps the rare overshoot.
4. **Atomic write via `WAVWriter`.** Creates `.audio/`, asserts the gitignore rule (below), opens a unique temp file (`.<id>.<uuid>.wav.tmp`) in the same dir, appends Int16 samples, closes, then atomically renames into `<meeting-id>.wav` (`replaceItemAt` if a prior file exists, else `moveItem`). A crash mid-write never leaves a half file.
5. **Best-effort, never throws.** On any error it removes the temp file, logs a **count-only** line, and returns `nil` — it never throws into the stop lifecycle.
6. **Returns** the absolute `.wav` URL on success, `nil` otherwise.

`WAVWriter` (`engine/Sources/HarkCore/WAVWriter.swift`, reused from Phase 2 capture) is a streaming RIFF writer: it emits a 44-byte placeholder header hard-coded to **mono / 16000 Hz / 16-bit PCM**, appends Int16 LE samples as they arrive, then seeks back and patches the two RIFF size fields on `close()`. WAV (not AAC/Opus) was chosen so the file plays natively in the Chromium `<audio>` element with no transcode (ADR-0028) — at the cost of size (~1.9 MB/min, ~115 MB/hour).

## Key files (repo-relative)

| File | Role |
|---|---|
| `engine/Sources/Harkd/AudioStore.swift` | The opt-in store: the `keep_audio` privacy gate, Float→Int16 conversion, atomic temp+rename write, count-only logging. |
| `engine/Sources/HarkCore/WAVWriter.swift` | Streaming RIFF WAV writer (44-byte header, patch-on-close), hard-coded to 16 kHz mono s16le. Shared with [[audio-capture]]. |
| `engine/Sources/Harkd/EngineSession.swift` | The single call site (`persistMeeting`): invokes the store at stop, after the `.md` write, with the diarization buffer and the `.md` basename. *(see [[engine-harkd]])* |

## How it connects to other subsystems

- **[[vault-writer]]** — the store reuses the **exact stem** of the meeting's markdown file as the `.wav` basename (`2026-06-02-1436.wav` ↔ `2026-06-02-1436.md`, collision suffixes preserved), so audio correlates 1:1 with notes. It also calls `VaultWriter.ensureAudioGitignored(vaultRoot:)` to assert the `.audio/` `.gitignore` rule (idempotently) the moment it creates the dir — see invariants.
- **[[engine-harkd]]** — `EngineSession.persistMeeting` is the only caller; the buffer comes from the same `capturedAudio` the diarization pass consumes, so there is **zero extra memory and no re-capture** (ADR-0028).
- **[[diarization]]** — the persisted samples *are* the diarization input buffer. Caveat: that whole-meeting buffer is currently accumulated **only when the diarizer loaded**, so if diarization fails there's nothing to persist even with `keep_audio` on (ADR-0028 tradeoff, see below).
- **[[audio-capture]]** — provides the Float buffer shape (16 kHz mono, `tanh`-limited to ±1) and the `*32767`+clamp convention this store mirrors.
- **[[wire-protocol]]** — after a write, `meeting.saved` carries `audio_path` (Swift `audioPath: String?` ↔ JSON `audio_path`, explicit `null`, never dropped): the absolute path when written, `null` otherwise (ADR-0028).
- **[[ui-shell]]** — the renderer retains `audio_path` to power the Post-Meeting Review screen (the feature this store unblocks).
- **[[privacy-data-control]]** / [[threat-model]] / [[privacy-egress]] — audio is one of ADR-0027's three governed sensitive artifacts (transcript / **audio** / voiceprint); the `keep_audio` gate, vault-only storage, and gitignore are the privacy invariants embodied here. No network surface (pure local filesystem).

## Governing ADRs

- **[ADR-0027](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0027-privacy-data-control-model.md)** *(Accepted)* — the privacy & data-control model. Defines three sensitive artifacts each governed by the user; plumbs `keep_audio` (+ `remember_speakers`) through `capture.start`, both default **off**; audio persists **only when `keep_audio`**, stored in the vault, gitignored, never synced by default, deletable. Left the actual write path as `TODO(slice B)`.
- **[ADR-0028](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0028-meeting-audio-persistence.md)** *(Accepted)* — fills in slice B: write the already-buffered whole-meeting PCM as 16 kHz mono s16le WAV via `HarkCore.WAVWriter`, atomically, to a hidden gitignored `.audio/` at the vault root (parallel to `.speakers/`, **not** inside git-tracked `meetings/`), keyed by the `.md` stem; `meeting.saved` gains `audio_path`; gated identically to voiceprints (`audioPersistenceAllowed` mirrors `voiceprintAccessAllowed`), proven by `testGateOffMeansZeroAudioIO`.

## Invariants (must stay true)

- **Gate off ⇒ zero `.audio/` I/O.** `audioPersistenceAllowed(keepAudio:)` is consulted before any filesystem touch; when `false`, no directory, no temp, no file is created (ADR-0027/0028; `testGateOffMeansZeroAudioIO`). The pure gate is kept trivial + stateless so the test asserts the *same* definition production runs.
- **Audio lives ONLY under `vault/.audio/`** — parallel to `.speakers/`, **never** inside git-tracked `meetings/`, never under app-data, never networked (CLAUDE.md rule #2; ADR-0028).
- **`.audio/` is self-asserted into `.gitignore`** whenever the dir is created (`VaultWriter.ensureAudioGitignored`, idempotent), so meeting audio can never become git-committable even if no meeting `.md` was committed first.
- **The `.wav` basename equals the meeting's `.md` stem** (collision suffixes preserved) so audio and notes correlate 1:1.
- **Atomic write only** — temp file + rename on the same volume; `<meeting-id>.wav` only ever appears whole.
- **Never logs audio content** (CLAUDE.md rule #3) — log lines are sample count + duration + the meeting id only (the id is the same basename as the already-tracked `.md`, so it leaks nothing beyond the meeting itself).
- **Best-effort, never throws into stop** — a failure logs (count only) and returns `nil`; the stop lifecycle proceeds.
- **WAV header stays mono / 16000 Hz / 16-bit** — `WAVWriter` hard-codes it; the engine input contract is 16 kHz mono PCM s16le (shared with [[audio-capture]]).

## Known limitations & caveats

- **Audio only persists when the diarizer loaded.** The whole-meeting buffer is accumulated only when `diarizer != nil`; if diarization fails to load, there's no buffer to persist even with `keep_audio` on (the meeting also has no speaker labels in that case). Accepted v1 edge — decoupling buffering from diarizer-load is tracked in BACKLOG (ADR-0028).
- **WAV is large** (~1.9 MB/min; ~115 MB/hour). Acceptable for local v1; compression (AAC/Opus) is a deferred, tracked optimization (ADR-0028).
- **No retention / auto-delete policy yet** — purging audio after N days is a shared open question with ADR-0027.

## See also

[[privacy-data-control]] · [[vault-writer]] · [[engine-harkd]] · [[audio-capture]] · [[diarization]] · [[threat-model]] · [[privacy-egress]] · [[ui-shell]] · [[glossary]]
