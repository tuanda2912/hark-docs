---
type: subsystem
title: Speaker enrollment — voiceprint store
status: current
sources: [ADR-0020, ADR-0026, ADR-0027, engine/Sources/Harkd/SpeakerEnrollment.swift, engine/Sources/Harkd/EngineSession.swift]
updated: 2026-06-05
tags: [speakers, diarization, privacy, biometric, vault]
---

`SpeakerStore` persists **one JSON voiceprint per person** — a 256-dim, L2-normalized
WeSpeaker centroid — under `vault/.speakers/<uuid>.json`, **enrolled when the user names
a "Speaker N" post-stop** and **cosine-matched** against that set in future meetings to
auto-apply the name. Entirely local, gitignored, and **gated by the `remember_speakers`
opt-in** (ADR-0027): when off there is **zero `.speakers/` I/O** — no enroll, no match.

## Code map

_Grounded in the understand-anything graph (commit 8efdfde, 2026-06-05, code-only)._

**Layer:** Streaming Daemon & Transcription.

**Files:**
- `engine/Sources/Harkd/SpeakerEnrollment.swift` — Local voiceprint store and matcher
  (ADR-0026): persists a per-person 256-dim centroid under `vault/.speakers/` when the user
  names a speaker post-stop, then auto-recognizes that voice in future meetings via cosine
  distance — never networked, never logged.

**Key types & functions:**
- `SpeakerStore` (class, Lx 81–332) — Sendable struct over a directory of JSON voiceprint
  files: enrolls named speakers, lists enrolled speakers, and matches a query centroid to the
  nearest enrolled speaker by cosine distance.
- `EnrolledSpeaker` (class, Lx 56–80) — Codable record of one enrolled person: display name
  plus the accumulated voiceprint samples used to build the matching centroid.

**Pinned by tests:**
- `engine/Tests/HarkdTests/SpeakerEnrollmentTests.swift` — XCTest suite for the local
  voiceprint store and matcher (`SpeakerStore`, ADR-0026): enroll/auto-match against a temp
  `.speakers` dir plus env-threshold parse/clamp, using synthetic float vectors only.
- `engine/Tests/HarkdTests/SpeakerRenameTests.swift` — Regression XCTest suite for the
  post-save speaker-rename relabel and re-render path (`EngineSession.applySpeakerNames` +
  `VaultWriter.renderMarkdown`), pinning that renaming re-renders the already-written vault
  markdown with chosen display names.

**Connections:**
- ⇐ depends_on [[subsystems/engine-harkd|Engine / harkd]] (`EngineSession` → `SpeakerStore`).

> The graph slice records no outbound edges (Swift `import`/call resolution is partial); the
> richer cross-links in **How it connects** below are drawn from the source and ADRs.

## What it does

The offline diarizer (see [[diarization]]) labels speakers anonymously per meeting
("Speaker 1", "Speaker 2"…). Without memory, the same people get re-named every meeting
(the [[diarization]] post-save rename, ADR-0020). Enrollment closes that loop:

- **Enroll on naming.** When the user renames an anonymous "Speaker N" post-stop
  (`speaker.rename`, ADR-0020), the engine stores that speaker's per-meeting diarizer
  centroid as a voiceprint. Naming is the *deliberate* enroll trigger (ADR-0026) — the
  durable replacement for the rejected live-diarization idea (ADR-0025, see [[diarization-speakers]]).
- **Auto-match on the next meeting.** In `runDiarizationPass`, each clustered speaker's
  centroid is matched against the enrolled set by **cosine distance**; a hit within the
  threshold **auto-applies** the enrolled name everywhere (vault body, `meeting.transcript`,
  roster) and populates the roster's `matchedName` + `confidence`.
- **Auto-apply, correctable.** A confident match is applied automatically (the user asked
  for automatic over suggest-and-confirm); a wrong name is fixed by re-tagging, which
  re-enrolls. Conservative by default — a wrong name is worse than "Speaker N".

This is a **post-hoc relabel layered on the unchanged diarizer** — the offline pipeline
has no known-speaker pre-seed (only the rejected streaming `SpeakerManager` does, ADR-0026
§Alternatives), so matching never touches the clusterer.

## Key files

- `engine/Sources/Harkd/SpeakerEnrollment.swift` — the store + matcher. `SpeakerStore`
  is a `Sendable` **`struct`, not an `actor`**: it holds no mutable in-memory state, reads
  the directory fresh on every call, and writes atomically (temp → `.atomic` rename, same
  pattern as [[vault-writer]]). On-disk model: `EnrolledSpeaker` (`id`/UUID, `name`,
  `embedding_dim` = 256, `embedding_space` = `"offline-wespeaker-v1"`, `centroid`,
  `samples[]`, `created_at`/`updated_at`, `meetings_seen`) and `EnrolledSample`
  (`vector`, `meeting_id`, `duration_sec`, `added_at`). `Codable` with snake_case keys so
  the file is human-readable when a user inspects the vault.
  - `loadAll()` — reads `<vault>/.speakers/`; a missing dir = nobody enrolled (`[]`, never
    throws); a malformed file is skipped (logged by *count*, never content).
  - `enroll(name:centroid:meetingId:durationSec:)` — L2-normalizes the input; case-/
    whitespace-insensitive name match merges into the existing person (append the sample,
    recompute `centroid` as the normalized mean of all samples, bump `meetings_seen`),
    else creates a new `<uuid>.json`. Returns nil for a garbage vector (empty / zero-
    magnitude / wrong dim — validated via `SpeakerUtilities.validateEmbedding`).
  - `match(centroid:)` — scans the enrolled set (only same-`embedding_space` entries),
    returns the closest within `threshold` as a `Match { name, confidence, distance }`
    where `confidence = 1 − distance`, clamped to `[0,1]`. nil = no voice close enough →
    stays "Speaker N".
  - `resolveThreshold(_:log:)` — parses + clamps `HARK_ENROLL_THRESHOLD` to
    `[0.05, 0.90]`, default **0.45 cosine distance**. Cosine space, **not** the diarizer's
    0.6 *Euclidean* clustering threshold. Logs the value only (never a name/vector).
- `engine/Sources/Harkd/EngineSession.swift` — the single call site (an `actor`):
  - `runDiarizationPass` — takes each `speakerId`'s un-normalized 256-dim centroid from
    `DiarizationResult.speakerDatabase`, normalizes it, retains it keyed by the **display
    label** for a possible later enroll, and (if the gate allows) calls `match`. A confident
    hit remaps "Speaker N" → the enrolled name across body/transcript/roster.
  - `enrollFromRename(names:snapshot:)` — fires on `speaker.rename`; for each
    `currentLabel → newName` with a retained centroid and ≥ `enrollMinDurationSec` (= 4.0 s)
    of speech, calls `speakerStore.enroll`. Off the live path; never blocks the `ack`.
  - `voiceprintAccessAllowed(rememberSpeakers:)` — the pure privacy gate (just returns the
    flag) consulted by *both* the auto-match and the enroll path.

## How it connects

- **[[diarization]]** — the upstream source of voiceprints. The enrollment store consumes
  the diarizer's per-speaker centroid (`DiarizationResult.speakerDatabase`) and reuses
  `SpeakerUtilities.cosineDistance` / `validateEmbedding` rather than DIY similarity math.
  Auto-match rewrites the "Speaker N" labels diarization produced; enroll-on-rename rides
  the same post-save rename mechanism (ADR-0020).
- **[[vault-writer]]** — the meeting `.md` is always saved on `capture.stop`; rename
  re-renders that file from the retained `SavedMeetingSnapshot` and re-commits it.
  `SpeakerStore.write` calls `VaultWriter.ensureSpeakersGitignored(vaultRoot:)` every time
  it creates the dir, so a voiceprint can never become git-committable even if no meeting
  was saved first (idempotent; `VaultWriter` also asserts this during the save commit).
- **[[engine-harkd]]** / **[[wire-protocol]]** — `capture.start` carries `keep_audio` +
  `remember_speakers` (both default false); `meeting.saved`'s roster carries the nullable
  `matchedName` + `confidence` fields built for exactly this (ADR-0020/0026 — no contract
  change). The `speaker.rename` UI→engine command is the enroll trigger.
- **[[audio-store]]** — the sibling opt-in artifact (`keep_audio` → `vault/.audio/`,
  ADR-0027 slice B); same nil-tolerant, off-the-live-path discipline.
- **[[privacy-data-control]]** / **[[threat-model]]** / **[[privacy-egress]]** — voiceprints
  are biometric data; this subsystem is the enforcement point for the `remember_speakers`
  opt-in gate. See [[diarization-speakers]] for the enrollment ADR digest and
  **[[glossary]]** for *voiceprint* / *centroid* / *embedding space*.

## Governing ADRs

- [ADR-0020](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0020-post-save-speaker-relabeling.md) — post-save `speaker.rename`
  (the rename mechanism enrollment hangs off; flagged enrollment as deferred to Phase 5.1).
- [ADR-0026](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0026-speaker-enrollment.md) — speaker enrollment itself: storage
  shape, enroll-on-naming, post-hoc cosine auto-match, auto-apply + correctable,
  `HARK_ENROLL_THRESHOLD`.
- [ADR-0027](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0027-privacy-data-control-model.md) — the `remember_speakers`
  (and `keep_audio`) opt-in model; voiceprints default OFF, gitignored, never synced,
  user-deletable.

All three are **Accepted / current** (no supersession).

## Invariants (must stay true)

- **Opt-in is load-bearing.** When `remember_speakers` is false, `voiceprintAccessAllowed`
  returns false and **zero `.speakers/` I/O happens** — enroll skipped, auto-match skipped,
  the speaker stays "Speaker N" (ADR-0027). Absent flag ⇒ false.
- **Voiceprints never leave the machine** (hard rule #5) and are **never networked / sent
  to any API**. Pure local filesystem; no new dependency, no network socket.
- **No PII in filenames** — the file stem is a UUID, never the name (ADR-0026).
- **`.speakers/` is always gitignored** — `write` self-asserts the rule via
  `VaultWriter.ensureSpeakersGitignored` on every dir-create, regardless of call order.
- **Never log names or vectors** (hard rules #3/#5) — log lines carry counts + distances
  + the resolved threshold only.
- **Conservative threshold, exposed as a knob** — default 0.45 cosine distance, clamped to
  `[0.05, 0.90]` via `HARK_ENROLL_THRESHOLD`; a wrong auto-name is worse than "Speaker N".
- **Only deliberate renames enroll.** An auto-matched speaker's display label is already
  the enrolled name, so it is intentionally absent from `centroidForLabel` — we never
  re-enroll a name we just auto-applied; only a user rename of an anonymous "Speaker N"
  enrolls.
- **Enroll only a substantial cluster** — gated on ≥ `enrollMinDurationSec` (= 4.0 s) of
  speech so a noisy tiny cluster isn't stored.
- **Embedding space is stamped + checked** — `match` only compares same-`embedding_space`
  entries (`"offline-wespeaker-v1"`), so a future model/space change can't silently corrupt
  a centroid by mixing incompatible vectors.
- **Failure is non-blocking** — a load/match/enroll failure never blocks the diarization
  pass, the vault `.md` write, or the rename `ack`; the speaker simply stays anonymous.

## Open items (from the ADRs)

> TODO(wiki): final match threshold + multi-sample averaging policy await on-device tuning
> across real mics — cross-mic/cross-room matching is the classic hard part (ADR-0026).
> Retroactive re-match of *past* meetings when a new voiceprint is enrolled is deferred;
> current scope is forward-only (next meeting onward).
