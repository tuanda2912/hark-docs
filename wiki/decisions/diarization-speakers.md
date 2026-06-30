---
type: decision
title: Diarization & speaker decisions
status: current
sources: ["docs/decisions/0016-phase-5-diarization.md", "docs/decisions/0017-diarization-offline-pipeline.md", "docs/decisions/0025-no-live-diarization-v1.md", "docs/decisions/0026-speaker-enrollment.md", "docs/decisions/0020-post-save-speaker-relabeling.md"]
updated: 2026-06-30
tags: [decision, diarization, speaker, enrollment, fluidaudio]
---

# Diarization & speaker decisions

The decision trail behind [[diarization]] and [[speaker-enrollment]].

## `0016` — Phase 5: FluidAudio, offline, engine-owned write
Add **on-device, offline, post-meeting** diarization using **FluidAudio** (CoreML/ANE), with
**anonymous `Speaker N` labels only** in v1. The pass runs at `capture.stop` over the full session
audio held in RAM as mono 16 kHz `Float` (~230 MB for a 60-min meeting). This also **activates the
ADR-0015 migration**: the Swift engine becomes the sole vault writer and emits `meeting.saved`. Online
diarization was rejected — a second ANE model would threaten the live caption budget and churn identity
against the locked `segment.final` contract (`0016`).

## `0017` — offline `OfflineDiarizerManager`, not the streaming manager
Supersedes `0016`'s **pipeline choice only**. `0016` reached for FluidAudio's *streaming*
`performCompleteDiarization`, which on-device gave 69 segments for 239 utterances. Switch to the
**offline `OfflineDiarizerManager`** (VBx global clustering over overlapping windows). ~2.5× lower DER
(offline ≈10.6% vs streaming ≈26.2% on AMI SDM), ~60–70× realtime — a manager swap inside the existing
dependency, no new license or network surface (`0017`).

## `0025` — no live diarization in v1
A prototyped streaming `LiveDiarizer` failed decisively on real audio: a 5-person remote meeting
(system audio) collapsed all speakers into one. The *accurate offline* pass also got 2/5 on the same
clip — so the limiter is **the audio** (one mixed, VoIP-codec-compressed stream), not the threshold.
Decision: **no live labels**; labels appear only after `capture.stop`. Invest in enrollment instead. The
prototype is preserved on `experimental/live-diarization` (`0025`).

## `0026` — speaker enrollment (Phase 5.1)
Store a voiceprint when the user names a speaker, then auto-recognize that voice in future meetings.
Voiceprint = the offline pass's 256-dim centroid, L2-normalized, stored at `vault/.speakers/<uuid>.json`
(gitignored, never networked — rule #5). Auto-match post-stop via `SpeakerUtilities.cosineDistance`
within `HARK_ENROLL_THRESHOLD`; **auto-apply, correctable**. Chosen over suggest-and-confirm per user
preference, mitigated by a conservative threshold (`0026`). Implemented in [[speaker-enrollment]].

## `0020` — post-save speaker relabeling
Diarization labels skew (a 2-person interview rendered ~28 of 31 lines as `Speaker 1`). Because the
live transcript carries no speaker labels (`speaker: nil`), relabeling is necessarily **post-save**:
`speaker.rename {session_id, names}` re-renders the same markdown from the retained `SavedMeetingSnapshot`
(not find/replace) and re-commits to git. Count-proof for any number of speakers; the meeting is always
saved on stop first (`0020`).

Pipeline detail lives in [[diarization]]; finalization in [[streaming-finalization]].
