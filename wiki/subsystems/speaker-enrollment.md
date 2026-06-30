---
type: subsystem
title: Speaker enrollment & matching
status: current
sources: ["docs/decisions/0026-speaker-enrollment.md", "docs/decisions/0020-post-save-speaker-relabeling.md", "docs/decisions/0016-phase-5-diarization.md", "engine/Sources/Harkd/SpeakerEnrollment.swift"]
updated: 2026-06-30
tags: [engine, speaker, enrollment, embeddings, vault, privacy]
---

# Speaker enrollment & matching

Enrollment makes named speakers **persist across meetings**: name someone once, and their voice is
auto-recognized next time (`0026`). It is Phase 5.1 — the durable replacement for the rejected
live-diarization idea (`0025`).

## The voiceprint
A voiceprint is the offline [[diarization]] pass's **256-dim per-speaker centroid**
(`DiarizationResult.speakerDatabase`), L2-normalized (`0026` §Decision;
`engine/Sources/Harkd/SpeakerEnrollment.swift`). The offline pipeline has no known-speaker pre-seed,
so matching is a **post-hoc relabel** layered on the unchanged diarizer (`0026` §Context).

## Storage
One JSON file per enrolled person at `vault/.speakers/<uuid>.json` — `{ name, centroid (256-dim,
L2-normalized), samples[], embeddingSpace, createdAt, updatedAt, meetingsSeen }` (`0026` §Decision).
The filename is a **UUID, never the name** (no PII in filenames). The directory is **gitignored**
(`.speakers/` already excluded — `0016`) and never networked (CLAUDE.md rule #5). `SpeakerEnrollment`
is a stateless `struct` over this directory, asserting the gitignore rule itself every time it creates
the dir, and it logs counts/distances only — never names or vectors (rule #3).

## Enroll on naming
When the user names a speaker post-stop via `speaker.rename` (see [[streaming-finalization]] and `0020`),
that speaker's offline centroid is persisted as a voiceprint, retained via an extended
`SavedMeetingSnapshot` (`0026` §Decision). If the name matches an existing person the sample is appended
to `samples[]` and the centroid recomputed as their mean. A minimum speaker duration (~4s) gates
enrollment so a noisy 2-second cluster is not stored.

## Auto-match
In `EngineSession.runDiarizationPass`, each clustered speaker's centroid is matched against the enrolled
set via FluidAudio's `SpeakerUtilities.cosineDistance`. If the best match is within
`HARK_ENROLL_THRESHOLD` (conservative cosine-space default — **not** the offline 0.6 Euclidean
threshold), the enrolled name is **auto-applied** and the roster's `matchedName` + `confidence`
(`1 − distance`) populate (`0026` §Decision). Matching is **auto-apply, correctable**: a wrong name is
worse than `Speaker N`, so it starts strict; the user can re-tag to correct, which updates the
enrollment.

> TODO: cross-mic / cross-room matching threshold + averaging policy still need on-device tuning before
> auto-apply is fully trustworthy (`0026` §Tradeoffs).

The embedder model itself is loaded via `EmbedderLoader.swift`. Decision trail: [[diarization-speakers]].
