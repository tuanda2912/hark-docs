---
type: decision-digest
title: Streaming & finalization (ADR-0008/0009/0018/0019/0036)
status: current
sources: [ADR-0008, ADR-0009, ADR-0018, ADR-0019, ADR-0036]
updated: 2026-06-05
tags: [decisions, streaming, finalization, utterance-id, wire-protocol]
---

# Streaming & finalization (ADR-0008/0009/0018/0019/0036)

How Hark's **live pipeline** is built and, harder, how it **stabilizes text** as
WhisperKit re-segments the same audio ~6 times per span (30 s window, 5 s hop).
Five ADRs, dated 2026-05-27 to -06-04: the Phase 3 streaming architecture
([0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md)), the `utterance_id`
overlap rule v2 ([0009](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0009-utterance-id-overlap-rule-v2.md)), the
`segment.superseded` retraction signal ([0018](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0018-utterance-supersession-signal.md)),
region-based commit-watermark finalization
([0019](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0019-region-based-finalization.md)), and export-only
grow-in-place which **amends 0019** ([0036](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0036-grow-in-place-finalization.md)).
All **Accepted, none superseded** — 0009/0018/0019/0036 form one refinement chain
on the same problem. The concept page is [[streaming-finalization]]; the live
daemon is [[engine-harkd]], the ASR layer [[whisperkit-asr]], the message contract
[[wire-protocol]]. See [[glossary]] for `utterance_id`, RTF, commit watermark.

> **The through-line:** WhisperKit re-segments the full 30 s buffer every hop, so
> the same sentence appears in different *shapes* across passes. 0009 keeps
> *identity* from drifting across content (mint a fresh id when shapes differ);
> 0018 adds a way to *retract* a fragment that a fuller pass subsumed; 0019 moves
> *finalization* off a per-segment heuristic onto a once-per-region watermark
> (making 0018 a backstop); 0036 then *re-biases* 0019 from "no duplicates" toward
> "no lost words" by recovering grown tails into the **saved** transcript only.

## The decisions

### ADR-0008 — Phase 3 streaming architecture
- **Status:** Accepted (2026-05-27). Not superseded.
- **Decision:** four coupled choices for the live pipeline. (1) **WS server = Swift
  NIO** (`swift-nio` + `swift-nio-extras`), no HTTP framework; binds an ephemeral
  loopback port written to `~/Library/Application Support/Hark/engine.port`. (2)
  **In-process capture** — `harkd` imports `HarkCapture` + `HarkCore`, no IPC on the
  hot path; the real isolation boundary is engine↔UI. (3) **VAD-gated sliding
  window** — Silero CoreML gates frames before WhisperKit, **30 s window / 5 s hop**,
  drop oldest unprocessed window + emit `warning` `rtf_high` if RTF > 1. (4) **Binary
  name = `harkd`** (daemon convention).
- **Why:** Vapor drags ~15 deps for a single localhost endpoint (NIO needs 3);
  Foundation has no WS *server*. Two-process capture/engine adds IPC tax without
  buying isolation that matters. No-VAD wastes ANE on silence (Whisper hallucinates
  captions on silence).
- **Open questions it left:** Silero CoreML source/checksum, `engine.port` format
  (leaned JSON for forward-compat), and **replacement-segment id semantics** —
  resolved by 0009.
- **Embodied by:** [[engine-harkd]], [[whisperkit-asr]], [[vad]], [[audio-capture]],
  [[wire-protocol]], [[electron-main]] (spawns `harkd`).
- → [../decisions/0008-phase-3-streaming-architecture.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md)

### ADR-0009 — utterance_id overlap rule v2 (max-denominator + prune)
- **Status:** Accepted (2026-05-28). Not superseded — **extended by [ADR-0018](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0018-utterance-supersession-signal.md)**
  (adds the retraction this rule never had) and **refined by 0019** (changes only
  *when* a segment becomes final, not this identity rule).
- **Decision:** two changes to `UtteranceLedger` in
  `engine/Sources/Harkd/SlidingWindow.swift`. (1) Score the overlap of a new segment
  against an existing entry as `overlap / max(segLen, eLen)`, threshold **0.5** —
  "same utterance iff overlap covers ≥ half of the *longer* one." (2)
  `prune(beforeSessionTime:)` drops entries whose `tEnd` is before the window's left
  edge and returns them so a closing `segment.final` can be emitted for non-finalized
  orphans.
- **Why:** the v1 `min`-denominator rule (commit `be31c52`) scored **engulfment** at
  1.0 — a coarse new segment swallowing "Okay." would re-key it into a sentence about
  API security. `max`-denominator makes engulfment score `shorter/longer` (small), so
  a fresh id is minted instead. **Identity must never drift across content.**
- **Accepted cost:** aggressive re-segmentation mints *more* ids — only the leftmost
  piece keeps the original `utterance_id`; the rest become orphans. This is the gap
  0018 closes.
- **Embodied by:** [[engine-harkd]], [[whisperkit-asr]], [[wire-protocol]],
  [[engine-service]] (the renderer keys live captions on `utterance_id`).
- → [../decisions/0009-utterance-id-overlap-rule-v2.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0009-utterance-id-overlap-rule-v2.md)

### ADR-0018 — `segment.superseded` retraction signal
- **Status:** Accepted (2026-06-01). Not superseded. **Extends 0009**; later made a
  **backstop** by 0019; gate reused by 0036.
- **Decision:** add one Engine→UI frame **`segment.superseded`**, payload
  `{ utterance_id, superseded_by }` (snake_case). The engine emits it when a later,
  **time-overlapping**, more-complete re-segmentation extends an earlier fragment:
  the UI **deletes** the old id from its segment map and the at-stop vault writer
  **filters it out**. One signal fixes both surfaces (live map + saved file).
- **The load-bearing gate:** supersession requires **time-overlap AND prefix/superset
  (extension)** — *never text-similarity alone*. A non-overlapping repeat of the same
  words (drills, call-and-response, language lessons) has zero overlap and is
  **structurally exempt**. Dropping the time gate would eat legitimate repeats — the
  exact failure 0009 flagged.
- **Why a new frame, not changed finalization timing:** the partial→final lifecycle
  (`segment.final` is terminal) is the riskiest, already-validated surface; 0018 is
  *additive* — a post-final event about an already-emitted fragment, never a mutation
  of a live partial.
- **Privacy:** carries only two opaque ids over the existing localhost WS — no text,
  no audio, no PII; never rewrites committed vault history (immutable per ADR-0015 /
  `CLAUDE.md` rule #4). See [[threat-model]].
- **Embodied by:** [[wire-protocol]], [[engine-service]], [[ui-shell]],
  [[vault-writer]], [[diarization]] (superseded fragments drop before at-stop
  speaker assignment).
- → [../decisions/0018-utterance-supersession-signal.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0018-utterance-supersession-signal.md)

### ADR-0019 — region-based finalization (commit watermark)
- **Status:** Accepted (2026-06-01). **Amended by [ADR-0036](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0036-grow-in-place-finalization.md)** (export-only
  grow-in-place — see below). **Refines 0009** (only finalization changes); **makes
  0018 a backstop** rather than the primary cleanup.
- **Decision:** finalize **each audio region exactly once** behind a monotonic
  `committedUpTo` watermark, replacing the per-segment "older-zone + text-stable"
  heuristic. Each hop: compute `commitHorizon = windowStartSessionTime + hopSeconds`
  (the oldest hop's worth of speech, about to age out and never re-decoded); finalize
  segments with `committedUpTo < tStart <= commitHorizon` (**a segment commits when
  its `t_start` commits**); advance `committedUpTo = max(commitHorizon,
  maxCommittedEnd)`. At `capture.stop`, drain everything past the watermark. **No wire
  change** — same `segment.partial`/`final`/`superseded`. Partials in the still-hot
  region (`> committedUpTo`) are **unchanged** — they grow in place per 0009.
- **Why:** an on-device 200 s clip emitted **129 finals** (94 after dedup) — `"Let's
  do it."` finalized **4×** — because re-segmentation + 0009's fresh-id minting
  finalized one sentence 3–4 times. The duplicates were produced *at the source*; the
  post-hoc nets (0018 + at-stop `collapseReemissions`) only chased them imperfectly. A
  region behind the watermark *structurally cannot* be finalized twice.
- **Refinement baked into 0019 (long-sentence boundary-overlap):** advancing only to
  `commitHorizon` left a long sentence's tail `(commitHorizon, tEnd]` uncommitted, so
  later hops re-covered it as overlapping fragments (vault `2026-06-01-1858.md`, line
  40 vs 43/46/49/52). Fix: advance to `max(commitHorizon, max committed tEnd)` so a
  long segment consumes its full span (`.skipAlreadyCommitted` for anything starting
  inside it). Took a 214 s clip **94 → 39 finals**.
- **Accepted cost:** the final's text is the *first-past-horizon* decode (well-settled
  after ~5 prior passes, but not the last possible one); an overlapping interjection
  starting *inside* a committed long span is dropped. The latter is the gap 0036 had
  to weigh against.
- **Embodied by:** [[engine-harkd]], [[whisperkit-asr]]. Impl in
  `engine/Sources/Harkd/EngineSession.swift` (`runTranscription`,
  `flushTranscriptionDrain`, `committedUpTo`); tests in `CommitWatermarkTests.swift`.
- → [../decisions/0019-region-based-finalization.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0019-region-based-finalization.md)

### ADR-0036 — export-only grow-in-place (amends 0019)
- **Status:** Accepted (2026-06-04), implemented (on-device confirmation pending).
  **Amends 0019**; **refines 0018** (reuses its conservative gate).
- **Decision:** re-bias finalization from "strict no-duplicates" toward
  **"completeness first"** — but split live vs export. When a fuller re-decode of an
  already-**finalized** utterance arrives, recover the grown tail into the **SAVED**
  transcript while keeping the **LIVE** view as discrete, stable lines (no rewrite).
  The user's explicit choice: **"live clean, export recovers it."**
- **Mechanism:** new `UtteranceLedger.extendFinalizedIfGrown(tStart:tEnd:text:)`
  matches a finalized, non-superseded entry on **time-containment AND text-prefix
  containment AND actual growth** (0018's gate, re-aimed at finalized rows). The
  reconcile loop tries it *before* `resolve`; on a match `growRetainedFinalized` updates
  the **retained** `finalizedUtterances` row in place (keeps `tStart`, grows `tEnd` +
  text, advances the watermark) but **does NOT re-broadcast** `segment.final`. So the
  live stream keeps the discrete short line; the fuller text reaches only the saved
  transcript and the post-stop `meeting.transcript` swap.
- **Why:** under 0019's strict watermark a SHORT decode finalized first, then the GROWN
  re-decode (same start, now behind the watermark) was `.skipAlreadyCommitted` and its
  tail **silently dropped** — verified in vault `2026-06-04-0904.md` (truncated at
  `"…beginning."`). **For a transcription product, dropping spoken words is the worst
  failure** — worse than an occasional duplicate.
- **Accepted cost:** live can lag the saved file (the late tail appears only at Stop);
  a *rephrased* start (no clean prefix) still won't match and its tail can drop — rare,
  and the conservative prefix gate is deliberate (better to miss an extension than
  merge two distinct utterances). No wire/renderer change.
- **Embodied by:** [[engine-harkd]], [[vault-writer]], [[translation]] (the saved
  transcript + its translation are now complete). Impl in
  `engine/Sources/Harkd/SlidingWindow.swift` + `EngineSession.swift`;
  `CommitWatermarkTests.swift` (191 tests, 4 new).
- → [../decisions/0036-grow-in-place-finalization.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0036-grow-in-place-finalization.md)

## Supersession & amendment map

- **0009 → extended by 0018** (retraction signal it lacked), **refined by 0019**
  (finalization timing; identity rule unchanged).
- **0019 → amended by 0036** (grown tails recovered into the saved transcript).
- **0018 → made a backstop by 0019** (should fire rarely for finals), **gate reused by
  0036**.
- Nothing here is superseded — these are *layers* on one problem, each citing the next.

## Invariants these lock in

- **30 s window / 5 s hop, VAD-gated** (0008). The commit horizon reads `hopSeconds`
  from the buffer, so geometry changes follow automatically (0019).
- **Identity never drifts across content** — a fresh `utterance_id` is minted when
  segment shapes differ beyond the 0.5 max-overlap threshold (0009).
- **`segment.final` is terminal** for an `utterance_id`; once finalized, no later
  partial with that id arrives (0009 → preserved by 0018 and 0019).
- **A region is finalized exactly once** — nothing at/before `committedUpTo` is ever
  re-finalized; the watermark is monotonic (0019).
- **Supersession is gated on time-overlap AND prefix/superset, never text alone**
  (0018) — loosening to text-only requires a new ADR + hostile-input review.
- **Live clean, export recovers it** — a finalized live line never rewrites; grown
  text lands only in the saved transcript / post-stop swap (0036).
- **No transcript text or audio leaves the machine, nothing new persists** — every
  signal here is in-RAM state or opaque ids over the existing localhost WS; vault
  history stays immutable. See [[threat-model]], [[local-first-guarantee]].

## See also

- [[streaming-finalization]] (the concept) · [[engine-harkd]] · [[whisperkit-asr]] ·
  [[wire-protocol]] · [[engine-service]] · [[glossary]]
- Related digests: [[foundations]], [[capture-audio]], [[diarization-speakers]],
  [[translation]].
