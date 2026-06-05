---
type: subsystem
title: Offline speaker diarization
status: current
sources: [ADR-0016, ADR-0017, ADR-0024, ADR-0025, engine/Sources/Harkd/Diarizer.swift, engine/Sources/Harkd/DiarizerLoader.swift, engine/Sources/Harkd/EngineSession.swift]
updated: 2026-06-05
tags: [engine, diarization, speakers, privacy]
---

A post-stop **batch** pass (never live) using FluidAudio's `OfflineDiarizerManager` (pyannote-community-1 segmentation + WeSpeaker embeddings + VBx global clustering) that labels finalized utterances by max **time-overlap** with anonymous `Speaker N` tags. Live `segment.final` ships `speaker: nil`; the labels are back-annotated to the on-screen transcript and written to the vault only at `capture.stop`.

## Code map

> Grounded in the understand-anything graph (commit 8efdfde, 2026-06-05, code-only).

**Layer:** Streaming Daemon & Transcription.

**Files:**

- `engine/Sources/Harkd/Diarizer.swift` — Thin actor wrapping FluidAudio's `OfflineDiarizerManager`, confining the loaded CoreML models to one isolation domain; runs a whole-meeting offline diarization pass only from `EngineSession.flushOnStop`.
- `engine/Sources/Harkd/DiarizerLoader.swift` — Downloads (one-time from HuggingFace) and loads FluidAudio's offline diarization CoreML models into Hark's app-support models dir, then builds a ready `OfflineDiarizerManager`.

**Key types & functions:**

- `Diarizer` (class, `Diarizer.swift` Lx22–46) — Actor owning an `OfflineDiarizerManager`; its `diarize(_:sampleRate:)` method runs FluidAudio's offline VBx pipeline over 16 kHz mono audio and returns exclusive speaker segments.
- `LoadedDiarizer` (class, `DiarizerLoader.swift` Lx36–208) — Result wrapper around a ready `OfflineDiarizerManager` with cold-start timing, produced by the loader's two-phase download-then-build flow.

**Pinned by tests:** none in slice.

**Connections:**

- ⇐ depends_on [[subsystems/engine-harkd|Engine / harkd]] (`EngineSession` → `Diarizer`)
- ⇐ calls [[subsystems/engine-harkd|Engine / harkd]] (`runDiarizationPass` → `Diarizer`)

(No outbound code edges in slice — Swift `import` resolution into FluidAudio / `EngineSession`-side orchestration is captured as inbound edges only.)

## What it does

Diarization answers *who said what*. Hark runs it as a **single offline pass at `capture.stop`**, over the full session audio held in RAM — it never touches the live caption path. The flow inside [[engine-harkd]]:

1. During capture, every mixed 16 kHz mono Float frame (pre-VAD, **including silence**) is appended to a continuous `sessionAudio` buffer, so its sample timeline maps 1:1 to wall-clock session time. Each live `segment.final` ships with `speaker: nil` (`EngineSession.emitSegment`, marked `// Phase 5`).
2. At stop, `flushOnStop` drains the transcription tail, dedups the finalized utterances, then calls `runDiarizationPass(audio:utterances:)`.
3. The pass runs FluidAudio's offline pipeline over the audio → an exclusive (non-overlapping) set of `TimedSpeakerSegment`s, maps each cluster's `speakerId` to a stable `Speaker N` ordinal in first-seen order, then labels each utterance by the diarization segment with the **greatest temporal overlap** (`matchSpeaker`).
4. `persistMeeting` writes the labeled markdown ([[vault-writer]]), then broadcasts `meeting.transcript` (per-line back-annotation, ADR-0024) immediately before `meeting.saved` (the roster).

This is the design the docs always specified: a post-processing pass, not a live one (ADR-0016 §2). It is **anonymous-only in v1** — `Speaker 1`, `Speaker 2`, … No live "who's speaking" indicator exists, by deliberate choice (ADR-0025). Cross-meeting auto-recognition of named voices (Phase 5.1) is layered on top via [[speaker-enrollment]].

### The pipeline (why offline, not streaming)

ADR-0016 first reached for FluidAudio's **streaming** `DiarizerManager` (`performCompleteDiarization`). On-device that produced visibly wrong attribution — ~69 coarse segments for 239 utterances, rapid A→B→A exchanges flattened into one ~5–10 s cluster. ADR-0017 superseded the **pipeline choice** (only) and switched to `OfflineDiarizerManager`:

- **Overlapping windows → VBx global clustering → overlap-aware (powerset) segmentation → exclusive-segment reconstruction.** Global clustering reasons across the whole meeting at once; the streaming manager's 10 s non-overlapping chunks structurally cannot.
- **~2.5× lower DER** on FluidAudio's own AMI SDM benchmark (offline ≈ 10.6% vs streaming ≈ 26.2%, same scoring protocol, intra-library-comparable — see ADR-0017's caveat on cross-tool absolute DER).
- **~60–70× realtime** on Apple Silicon, so the batch-at-stop cost is effectively free.

The finer, exclusive segments are exactly what make the `matchSpeaker` max-overlap assignment accurate on back-and-forth — the "straddle" ambiguity case (one segment spanning a speaker change) drops toward zero, visible in the `HARK_DIAR_DEBUG=1` ambiguity summary.

### Assignment rule

`matchSpeaker(forUtteranceStart:end:diarSegments:ordinals:)` walks every diarization segment, computes interval overlap `max(0, min(end, segEnd) − max(start, segStart))`, and assigns the utterance the `Speaker N` of the **single max-overlap** segment. Overlap must be strictly `> 0` — an utterance overlapping nothing gets `Speaker ?` (unattributed; **not** added to the attendee roster). The helper also tracks the best overlap from a *different* speaker (the runner-up) purely for the debug ambiguity flag; the label decision uses only the chosen segment.

## Key files

| File | Role |
|---|---|
| `engine/Sources/Harkd/Diarizer.swift` | Thin `actor` wrapping `OfflineDiarizerManager`. `diarize(_:sampleRate:)` calls `manager.process(audio:)` and returns FluidAudio's `DiarizationResult` (exclusive `TimedSpeakerSegment`s). Confined to its own actor isolation so model state never races the live [[engine-harkd]] session actor. |
| `engine/Sources/Harkd/DiarizerLoader.swift` | One-time HuggingFace download + CoreML compile via `OfflineDiarizerModels.load(from:)`, then builds a ready `OfflineDiarizerManager`. Lives in the Harkd target (not HarkCore) so FluidAudio doesn't link into the non-diarizing CLIs. Also `makeDiarizerConfigFromEnv` (the `HARK_DIAR_*` knobs). |
| `engine/Sources/Harkd/EngineSession.swift` | Orchestration: `sessionAudio` buffering in `ingestFrames`, `runDiarizationPass`, `matchSpeaker`, the `Speaker N` ordinal mapping, `meeting.transcript`/`meeting.saved` emission in `persistMeeting`, and the `speaker: nil` live emit in `emitSegment`. |

### Configuration knobs (`DiarizerLoader.makeDiarizerConfigFromEnv`)

Defaults are FluidAudio's tuned `OfflineDiarizerConfig.default`; the loader exposes only the two levers that matter for a 1:1 meeting and logs one config line per run:

- **`HARK_DIAR_THRESHOLD`** → `clustering.threshold` (default 0.6, clamped to `(0, √2]≈1.414`). Speaker-**count** lever. EUCLIDEAN distance on unit-normalized embeddings — **not** the streaming pipeline's cosine 0.7 (different scale). Lower = more clusters; higher = fewer.
- **`HARK_DIAR_NUM_SPEAKERS`** → `clustering.numSpeakers` (default `nil`/auto, clamped `[1,20]`). When set, forces exactly that many speakers (VBx constrained via `withSpeakers(exactly:)`), bypassing the threshold auto-estimate.
- **`HARK_DIAR_DEBUG=1`** → dumps the full diar-segment table + per-utterance overlap/ambiguity lines to stderr (diagnostics only; no behavior change).

min/maxSpeakers, the VBx Fa/Fb warm-start, segmentation step ratio, embedding `excludeOverlap`, and `exclusiveSegments` are intentionally **not** exposed — they're the community-1 tuned defaults.

## How it connects

- **Host — [[engine-harkd]]:** `runDiarizationPass` is invoked only from `EngineSession.flushOnStop`, after `pipeline.stop()`. The pass is a separate `Diarizer` actor so the session actor stays responsive while it `await`s the result. The diarizer is `nil`-tolerant everywhere — a missing or failed-to-load diarizer never blocks capture or stop; those utterances just get `Speaker ?`.
- **Output — [[vault-writer]]:** the labeled `[VaultWriter.Utterance]` (tStart + `Speaker N` label + text) is written to the meeting markdown, and the engine is the **sole** writer (ADR-0016 §4 activated the ADR-0015 migration). The same labeled set drives the `meeting.transcript` wire frame.
- **On-screen back-annotation — [[engine-service]] / [[ui-shell]]:** because live `segment.final` carried `speaker: nil`, the UI's transcript is speaker-less during the meeting; at stop the engine emits `meeting.transcript { session_id, utterances:[{id, t_start, text, speaker}] }` just before `meeting.saved`, and the UI **replaces** its live transcript with this clean, labeled set (ADR-0024). Frame mechanics live in [[wire-protocol]].
- **Enrollment — [[speaker-enrollment]]:** Phase 5.1 (ADR-0026) reuses the same `DiarizationResult`. The pass extracts each cluster's 256-dim WeSpeaker centroid from `result.speakerDatabase`, normalizes it, and — gated on the session's `remember_speakers` opt-in — auto-matches against the enrolled voiceprint store (`speakerStore.match`), renaming a matched `Speaker N` to the enrolled name everywhere. Unmatched clusters keep their ordinal and retain their centroid for a possible enroll-on-rename.
- **Privacy gate — [[privacy-data-control]] / [[threat-model]]:** the auto-match short-circuits when `remember_speakers` is off, so there is **zero** `.speakers/` I/O on the privacy-safe default path. The full-session audio is a transient in-RAM working buffer, discarded after the pass; the only persisted artefact is the meeting `.md` (and, opt-in, the `.wav` via [[audio-store]]).

## Governing ADRs

See the [[diarization-speakers]] digest (ADR-0016/0017/0020/0024/0025/0026) for the full cluster. Directly governing this subsystem:

- **[ADR-0016](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0016-phase-5-diarization.md)** — Phase 5: FluidAudio, offline post-meeting pass, anonymous `Speaker N` in v1, engine-owned vault write, full-session audio in RAM. **Status: accepted, but its §2 pipeline choice (`performCompleteDiarization`) is superseded by ADR-0017** — the rest stands.
- **[ADR-0017](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0017-diarization-offline-pipeline.md)** — supersedes ADR-0016's **pipeline choice only**: use `OfflineDiarizerManager` (VBx global clustering) instead of the streaming `DiarizerManager`. ~2.5× lower DER, same library/dependency/pin. Accepted.
- **[ADR-0024](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0024-onscreen-transcript-back-annotation.md)** — the additive `meeting.transcript` frame that back-annotates the on-screen transcript at stop with the same deduped, labeled set written to the vault. Accepted.
- **[ADR-0025](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0025-no-live-diarization-v1.md)** — no live diarization in v1. The streaming prototype collapsed 5 speakers→1 on real mixed/VoIP-codec system audio; the *accurate* offline pass also got 2/5 on the same clip, proving the limiter is the audio (one mixed stream), not the threshold. Prototype preserved on `experimental/live-diarization` (`b4fc64e`). Accepted.

## Invariants

- **Strictly offline / post-stop.** `runDiarizationPass` is only ever called from `flushOnStop`, after capture stops. It must never touch the live transcription path — diarization never contends with WhisperKit on the ANE during capture (ADR-0017 "must remain true"; ADR-0009 live contract intact). See [[whisperkit-asr]].
- **Live emits `speaker: nil`.** During a meeting the engine genuinely doesn't know who's speaking; every live `segment.final` ships `speaker: nil` (ADR-0024 §Context). Labels are resolved only after `meeting.saved`.
- **`sessionAudio` is the continuous (pre-VAD) recording.** Unlike the speech-only sliding window, it retains every mixed frame including silence, so its sample index maps 1:1 to the wall-clock time the utterances are stamped against — that shared time axis is what makes the overlap assignment correct. Buffered only while a diarizer exists.
- **Diarizer failure is non-fatal.** No diarizer, <1 s of audio, or a `diarize` throw → every utterance gets `Speaker ?` and the meeting is **still written** (just unattributed). A failed diarizer load never blocks capture or stop.
- **`Speaker ?` is not a roster member.** An utterance overlapping no diarization segment is labeled `Speaker ?` and excluded from `attendees`. The roster is sorted by ordinal (`Speaker 1`, `Speaker 2`, …) regardless of who spoke first.
- **On-screen == saved file.** `meeting.transcript` reuses the *exact* deduped/labeled vault set — never a re-derived one — so the post-stop transcript pane matches the markdown body byte-for-byte (ADR-0024 invariant).
- **Model cache under Hark's dir.** Models cache at `~/Library/Application Support/Hark/Models/speaker-diarization-coreml/`, **never** FluidAudio's default dir (CLAUDE.md hard rule #2). The full-session audio buffer is never written outside the vault. See [[local-first-guarantee]].

## See also

- [[speaker-enrollment]] — the voiceprint store + auto-match that names anonymous clusters (Phase 5.1).
- [[vault-writer]] — where the labeled transcript lands as markdown + git.
- [[engine-harkd]] — the daemon hosting `flushOnStop` and the stop lifecycle.
- [[engine-service]] — the renderer client that applies `meeting.transcript` / `meeting.saved`.
- [[diarization-speakers]] — the ADR digest for the whole diarization + speakers cluster.
- [[privacy-data-control]] — the `remember_speakers` opt-in gate around enrollment.
- [[glossary]] — DER, VBx, utterance_id, `Speaker N`, and other terms used here.
