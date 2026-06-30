---
type: subsystem
title: Audio store (meeting-audio persistence)
status: current
sources: [docs/design/06-architecture-overview.md, "engine/Sources/Harkd/AudioStore.swift", "engine/Sources/Harkd/EngineSession.swift"]
updated: 2026-06-30
tags: [engine, audio, storage, vault, privacy]
---

# Audio store

`AudioStore` is opt-in meeting-audio persistence to the vault (`engine/Sources/Harkd/AudioStore.swift`,
ADR-0027). It writes the full-meeting **16 kHz mono PCM** — the same continuous buffer the post-stop
diarization pass already holds in RAM — to `<vaultRoot>/.audio/<meeting-id>.wav`, but **only** when the
session opted in via `keep_audio`.

## The privacy gate
When `keepAudio` is off (the default), `persist(...)` returns before touching the filesystem: **zero
`.audio/` I/O** — no directory, no temp file (`AudioStore.swift`, the load-bearing privacy gate). The
gate is a pure static `audioPersistenceAllowed(keepAudio:)` so a test asserts the same definition
production runs. Audio is PII: it lives only under `vault/.audio/`, parallel to `.speakers/` and **never**
inside the git-tracked `meetings/` dir. The store asserts the `.audio/` `.gitignore` rule (via
`VaultWriter.ensureAudioGitignored`) the moment it creates that directory, so meeting audio can never
become git-committable (`AudioStore.swift` HARD RULES). Per the threat model, audio is the one thing that
never leaves the Mac (`docs/design/06-architecture-overview.md` §Trust boundaries).

## How it writes
`persist` is **atomic**: the WAV is written to a temp name in the same dir, then renamed into place, so a
crash mid-write never leaves a half file. The Float `-1..1` buffer is converted to Int16 LE with the
capture Mixer's `*32767` + clamp (no re-soft-clip — the mixed stream is already tanh-limited)
(`AudioStore.swift`). The `meetingId` is the same basename as the meeting's markdown so `.wav` ↔ `.md`
correlate (e.g. `2026-06-02-1436.wav` ↔ `.md`).

## Lifecycle
`AudioStore` is a `Sendable` struct with no mutable state. Its single call site is [[engine-service]]
(`EngineSession`, an actor), invoked **off the live path** — at stop, after the markdown write — exactly
like `VaultWriter` and `SpeakerStore` (`AudioStore.swift` header). Best-effort: a failure logs a count +
duration + meeting id only (never audio content, hard rule #3) and returns nil; it never throws into the
stop lifecycle.

See [[whisperkit-asr]], [[vad]], [[engine-harkd]].
