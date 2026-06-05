---
type: decision-digest
title: Diarization & speakers (ADR-0016/0017/0020/0024/0025/0026)
status: current
sources: [ADR-0016, ADR-0017, ADR-0020, ADR-0024, ADR-0025, ADR-0026]
updated: 2026-06-05
tags: [diarization, speakers, enrollment, privacy]
---

How Hark answers *who said what*: offline FluidAudio diarization run at `capture.stop`, anonymous **Speaker N** labels written engine-side, post-save user rename, on-screen back-annotation at stop, **no live diarization in v1**, and cross-meeting speaker enrollment by voiceprint.

This cluster builds on the engine-owned vault write ([[vault-writer]]) and the offline-at-stop pipeline ([[diarization]]); the durable cross-meeting layer is [[speaker-enrollment]]. The "labels only after stop" shape is a deliberate privacy/honesty stance — see [[privacy-data-control]] and the [[glossary]] for `Speaker N`, DER, VBx, centroid.

## The arc at a glance

Diarization is **offline, post-meeting, engine-owned** (0016). The *pipeline* inside that shape was swapped from FluidAudio's streaming manager to its offline VBx `OfflineDiarizerManager` (0017, supersedes 0016 §2 only). Because labels exist only after the file is written, the user corrects them with a **post-save rename** (0020) and the on-screen transcript gets **back-annotated at stop** (0024). On-device testing then killed the *live* diarization experiment outright (0025), redirecting the effort into **speaker enrollment** — voiceprints that auto-recognize known voices in future meetings (0026).

## ADR-0016 — Phase 5 diarization: FluidAudio, offline pass, engine-owned write

[../decisions/0016-phase-5-diarization.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0016-phase-5-diarization.md)

- **Status:** Accepted, but its **pipeline choice (§2) is superseded by [ADR-0017](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0017-diarization-offline-pipeline.md)** — the streaming `performCompleteDiarization` entry point was replaced by the offline VBx `OfflineDiarizerManager`. **Everything else in 0016 still stands.**
- **What stands:** on-device, offline, **post-meeting** diarization via **FluidAudio** (CoreML/ANE, pinned tag); **anonymous "Speaker N" labels only** in v1 (enrollment + naming deferred to Phase 5.1); the **Swift engine becomes the sole vault writer**, running diarization at `capture.stop` then writing the markdown and emitting `meeting.saved` — this activated the ADR-0015 migration (the Electron-main writer was never built, so no two-writer interregnum). Full-session audio is held in RAM as mono 16 kHz `Float` (~230 MB / 60-min meeting), a transient buffer discarded after the write, never persisted outside the vault.
- `segment.speaker` is **provisional/absent during the meeting** and resolved only after `meeting.saved`, keeping the live path on the locked `segment.final` + stable-`utterance_id` contract ([ADR-0009] / [[streaming-finalization]]) untouched.
- **Privacy:** model cache in `~/Library/Application Support/Hark/` (rule #2); embeddings stay local (rule #5); first-run is a public-weight HuggingFace download, not content exfiltration (rule #6). See [[threat-model]].

## ADR-0017 — Offline `OfflineDiarizerManager` (VBx), not the streaming manager

[../decisions/0017-diarization-offline-pipeline.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0017-diarization-offline-pipeline.md)

- **Status:** Accepted. **Supersedes ADR-0016 §2 (pipeline choice only).**
- **Decision:** swap the at-stop pass from FluidAudio's **streaming `DiarizerManager`** (`performCompleteDiarization`, the "legacy online diarizer") to its **offline `OfflineDiarizerManager`** — VBx global clustering over overlapping windows → powerset/overlap-aware segmentation → exclusive-segment reconstruction. Same library, same dependency pin, same models.
- **Why:** the streaming manager's 10 s non-overlapping chunks flatten quick A→B→A exchanges — on-device it produced **69 diarization segments for 239 utterances**. The offline pipeline is the matched tool for batch-at-stop: **~2.5× lower DER** on FluidAudio's own AMI SDM benchmark (offline ≈ 10.6 %, streaming ≈ 26.2 %, intra-library/same scoring), running **~60–70× realtime** so cost is irrelevant for a batch pass.
- **Caveat noted in-ADR:** FluidAudio's headline DER uses a lenient protocol (collar 0.25 s, `ignoreOverlap = true`) — trust the *intra-FluidAudio* ranking, not cross-tool absolute numbers.
- Rejected: tuning the streaming knobs (can't beat the architecture), sherpa-onnx/ONNX (integration cost, no accuracy gain), pyannote directly (unshippable Python + gated weights), Sortformer (streaming-only, 4-speaker cap), DIY per-utterance embedding (reinvents VBx worse), Apple frameworks (no diarization), cloud (threat model). Detail in [[diarization]].

## ADR-0020 — Post-save speaker relabeling (in-app rename)

[../decisions/0020-post-save-speaker-relabeling.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0020-post-save-speaker-relabeling.md)

- **Status:** Accepted.
- **Decision:** the meeting is **always saved on `capture.stop`** (never risk losing a recording); the engine retains the just-saved structured data (`SavedMeetingSnapshot`). A new UI→engine command `speaker.rename {session_id, names:{label:name}}` lets the user assign real names; the engine **re-renders the same markdown file from the retained structured data** (not find/replace) and **re-commits** to git. MVP scope: only the **most-recently-saved** meeting is renameable.
- **Why this shape:** the live transcript carries no speaker labels (`segment.final` ships `speaker: nil`), so labels exist only after the post-stop pass — relabeling is necessarily **post-save**. Re-render-from-structured-data is idempotent and avoids corrupting a transcript line literally containing "Speaker 1".
- **Count-proof** by design: works for 2 or 20 speakers, sidestepping the rejected "pin `HARK_DIAR_NUM_SPEAKERS`" hack and giving the user recourse when the diarizer is confidently wrong (on test clips, ~28 of 31 lines collapsed to `Speaker 1`).
- **Privacy:** names live only in the vault + in-memory snapshot; `session_id` is an equality guard (the payload carries no path and cannot redirect the write — the engine uses the snapshot's stored `vaultPath`); `meeting.saved` still broadcasts anonymous labels. See [[vault-writer]], [[privacy-data-control]].

## ADR-0024 — On-screen transcript speaker back-annotation at stop

[../decisions/0024-onscreen-transcript-back-annotation.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0024-onscreen-transcript-back-annotation.md)

- **Status:** Accepted.
- **Decision:** add an additive engine→UI frame **`meeting.transcript`** `{ session_id, utterances: [{ id, t_start, text, speaker }] }`, emitted at stop **just before `meeting.saved`**, carrying the **same deduped, "Speaker N"-labeled utterances written to the vault**. The UI **replaces** its live transcript with this set: every line shows its speaker (colored via one centralized `speakerColorFor(label)` mapping shared with the Attendees roster), the messy live partials/duplicates are cleaned up, and **renames propagate** (relabel/recolor every line for that speaker).
- **Honest behavior preserved:** no speaker labels *during* capture (we don't know yet); fully attributed *at* stop. `meeting.saved` stays the **roster** source; `meeting.transcript` is the **per-line** source.
- **Known tradeoff:** the frame carries no per-line `t_end` (UI synthesizes `tEnd = tStart`), and it isn't snapshot-replayed to a client connecting after stop. See [[wire-protocol]] for the frame, [[engine-service]]/[[ui-shell]] for the renderer side.

## ADR-0025 — No live speaker diarization in v1

[../decisions/0025-no-live-diarization-v1.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0025-no-live-diarization-v1.md)

- **Status:** Accepted.
- **Decision:** **do not ship live diarization in v1.** Speaker labels appear **only after `capture.stop`** (offline pass + the 0024 back-annotation); tagging is post-stop only. Showing confidently-wrong live labels is worse than showing none.
- **Why (on-device evidence, 2026-06-02):** a live 5-person remote meeting (system audio) collapsed all speakers into one (`provisional speakers=1`) even at threshold 0.55. The tell-tale: the *accurate offline* VBx pass on the **same** audio also under-clustered (2 speakers for 5 people) — so the limiter is **the audio, not the live threshold**. Root cause is fundamental: a remote meeting via system audio is one mixed, VoIP-codec-compressed stream (the codec smears the voice characteristics diarization needs). Cloud tools only diarize live because they get a separate stream per participant via the meeting API — Hark has no auto-join/meeting-API integration (out of scope), so only the mixed stream exists.
- **Instead, invest in enrollment (→ ADR-0026):** voiceprints stored on naming, auto-matched post-stop on the *accurate* offline pipeline.
- The prototype is **preserved (not deleted)** on the `experimental/live-diarization` branch (commit `b4fc64e`), for revisiting if per-participant capture or materially better on-device streaming diarization appears. Relates to [[audio-capture]], [[diarization]].

## ADR-0026 — Speaker enrollment: auto-recognize known voices (Phase 5.1)

[../decisions/0026-speaker-enrollment.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0026-speaker-enrollment.md)

- **Status:** Accepted. The durable replacement for the rejected live-diarization idea (0025).
- **Storage:** `vault/.speakers/<uuid>.json`, one file per person — `{ name, centroid (256-dim, L2-normalized), samples[], embeddingSpace, createdAt, updatedAt, meetingsSeen }`. Local, **gitignored** (per ADR-0016), never networked (rule #5); the filename is a UUID so there's **no PII in filenames**.
- **Enroll on naming:** when the user names a speaker post-stop (`speaker.rename`), persist that speaker's offline centroid as a voiceprint (via an extended `SavedMeetingSnapshot`); merge into the existing person on name match (append to `samples[]`, recompute centroid); gate on a minimum speaker duration (~4 s).
- **Auto-match post-stop:** in `runDiarizationPass`, match each clustered speaker's centroid against the enrolled set via FluidAudio's public `SpeakerUtilities.cosineDistance`; within `HARK_ENROLL_THRESHOLD` (conservative default, **cosine** space), **auto-apply** the enrolled name and populate the roster's `matchedName` + `confidence` (`1 − distance`) — wire fields built nullable for exactly this, so **no contract change**.
- **Auto-apply, correctable** (user's explicit preference over suggest-and-confirm): a confident match applies automatically; re-tagging corrects it and updates the enrollment. The offline pipeline has no known-speaker pre-seed (that's the streaming `SpeakerManager` we don't use), so matching is a **post-hoc relabel** layered on the unchanged diarizer.
- **Tradeoff:** cross-mic/cross-room matching is the classic hard part — threshold + multi-sample averaging need on-device tuning before auto-apply is trustworthy; voiceprints are sensitive data at rest (local, gitignored, user-deletable). See [[speaker-enrollment]], [[privacy-data-control]].

> TODO(wiki): an audio-playback Post-Meeting Review screen (verify-by-ear per-utterance tagging) is floated as an open question in ADR-0026 but needs persisting meeting audio — a separate privacy/storage ADR not yet written.

## Invariants this cluster must keep true

- Diarization stays a **post-stop** pass off the live caption path — it never contends with WhisperKit on the ANE during capture (ADR-0009 contract intact). If live diarization ever lands, ADR-0024's whole flow is revisited.
- The meeting is **always saved on stop**; rename/enrollment are optional refinements that re-render + re-commit (vault stays plain markdown in local git, recoverable history).
- `meeting.transcript` reuses the **exact deduped/labeled vault set** — never a re-derived set; on-screen == saved file.
- Voiceprints and embeddings **never leave the device** (rule #5): only `vault/.speakers/` (gitignored), matching runs in the engine, the UI receives names/confidence only.

## Related pages

[[diarization]] · [[speaker-enrollment]] · [[vault-writer]] · [[engine-service]] · [[wire-protocol]] · [[privacy-data-control]] · [[threat-model]] · [[streaming-finalization]] · [[audio-capture]] · [[glossary]]

See also the neighboring digests: [[streaming-finalization-decisions]] (the `segment.final`/utterance-id contract diarization preserves) and [[foundations]] (ADR-0015 vault persistence, whose writer migration ADR-0016 activated).
