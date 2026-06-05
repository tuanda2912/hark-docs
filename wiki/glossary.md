---
type: glossary
title: Glossary
status: current
sources: [CLAUDE.md, ADR-0005, ADR-0008, ADR-0009, ADR-0019, ADR-0032, ADR-0034]
updated: 2026-06-05
tags: [glossary, reference]
---

Definitions of Hark's load-bearing terms. Each entry cites the ADR or code path that
makes the claim true; follow the `[[wikilinks]]` for the full subsystem/concept page.
See [[overview]] for the map and [[foundations]]/[[streaming-finalization-decisions]]/[[vault-rag-decisions]]
for the decision digests these terms come from.

## Pipeline & engine

**RTF (real-time factor)** — wall-clock seconds to transcribe ÷ seconds of audio. The
go/no-go metric for the whole stack. The target is **RTF < 0.5**; [ADR-0005](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0005-phase-0-rtf-validated.md)
measured **0.0747 avg** (p95 0.0828) for WhisperKit `large-v3-turbo` on the Apple Neural
Engine (M4), ~6.7× under threshold, which unblocked every downstream phase. RTF > 1 means
the engine is falling behind real time and triggers the backpressure rule (drop oldest
unprocessed window, emit `warning` `rtf_high` — [ADR-0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md) §3).

**ANE (Apple Neural Engine)** — the on-chip ML accelerator on Apple Silicon. The
acceleration thesis behind the whole "no cloud ASR" bet: WhisperKit's CoreML bundle runs
on the ANE, which is what makes RTF ~0.075 possible ([ADR-0005](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0005-phase-0-rtf-validated.md)).
VAD, diarization embeddings, and the RAG embedder ([ADR-0032](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0032-vault-rag-architecture.md))
all target the ANE too.

**WhisperKit** — Argmax's open-source Swift wrapper around OpenAI's Whisper, running as a
CoreML model on the ANE. Hark pins `large-v3-turbo` ([ADR-0005](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0005-phase-0-rtf-validated.md)).
It is the ASR core fed by the sliding window. See [[whisperkit-asr]].

**FluidAudio** — the Swift library Hark uses for speaker diarization (and the
speaker-embedding model behind voiceprints). Hark runs its **`OfflineDiarizerManager`** (a
VBx global-clustering pipeline), *not* its streaming `DiarizerManager` — the streaming path
gave ~2.5× the error on device ([ADR-0017](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0017-diarization-offline-pipeline.md),
superseding the entry-point named in [ADR-0016](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0016-phase-5-diarization.md)).
See [[diarization]].

**VAD (voice activity detection)** — Silero VAD via CoreML, applied to the resampled 16 kHz
mono Float32 stream *before* WhisperKit. Only speech frames accumulate into the sliding
window, so the ANE never burns cycles transcribing silence (which Whisper hallucinates text
for). [ADR-0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md) §3. See [[vad]].

**harkd** — the long-lived Swift daemon (Unix `d`-for-daemon naming) that runs the full live
pipeline in one process: capture → VAD → sliding window → WhisperKit → JSON segments over a
localhost WebSocket. Imports `HarkCapture` + `HarkCore` in-process (no IPC inside the engine);
the real process boundary is engine↔UI. Spawned by Electron main. [ADR-0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md)
(Decisions 2 & 4). See [[engine-harkd]] and [[electron-main]].

**engine.port** — the file `harkd` writes its chosen ephemeral loopback port to, at
`~/Library/Application Support/Hark/engine.port`. It is **JSON, not a bare integer** (chosen
for forward-compat fields like pid/build version — [ADR-0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md)
Decision 1 + Open Question #2). Electron main reads it to connect; a common footgun is
parsing it as a bare number. See [[electron-main]] and [[wire-protocol]].

## Streaming finalization

**utterance_id** — the stable identity a segment keeps across consecutive WhisperKit window
passes, so the UI can replace a `segment.partial` in place instead of duplicating it.
Identity is decided by interval overlap scored as `overlap / max(segLen, eLen)` with a 0.5
threshold (the **max-denominator** rule), which prevents a coarse new segment from
"engulfing" an unrelated short one ([ADR-0009](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0009-utterance-id-overlap-rule-v2.md)).
The rule lives in `UtteranceLedger` in `engine/Sources/Harkd/SlidingWindow.swift`. See
[[streaming-finalization]].

**Commit watermark** (`committedUpTo`) — a monotonic session-relative timestamp marking the
audio that has already been finalized and will never be re-emitted. The core of
**region-based finalization**: each hop commits segments whose `t_start` lies in
`(committedUpTo, commitHorizon]`, then advances `committedUpTo = max(commitHorizon, maxCommittedEnd)`.
Audio at or before the watermark cannot be finalized twice. [ADR-0019](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0019-region-based-finalization.md),
in `engine/Sources/Harkd/EngineSession.swift`.

**Supersession** (`segment.superseded`) — a retraction signal the engine sends when a
previously-emitted segment should be withdrawn/replaced. Introduced by ADR-0018 as the cleanup
for growing/duplicated finals; under [ADR-0019](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0019-region-based-finalization.md)'s
commit watermark it became a **backstop** (defense-in-depth) rather than the primary cleanup,
since regions now finalize exactly once. See [[streaming-finalization]].

**Grow-in-place** — the live-caption behaviour where a partial caption updates/extends under a
stable `utterance_id` as later window passes refine it, instead of spawning new lines. Applies
to the "hot region" after `committedUpTo`; unchanged by region-based finalization
([ADR-0019](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0019-region-based-finalization.md) §"Partials are unchanged").
> TODO(wiki): the export-only "grow-in-place" of [ADR-0036](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0036-grow-in-place-finalization.md)
> (per-utterance translation) is a related but distinct usage — confirm against ADR-0036 when that page lands.

## Audio capture

**Process Tap** — macOS Core Audio's per-process audio tap API, used to capture system/loopback
audio (e.g. the other side of a call) without a virtual driver. [ADR-0011](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0011-process-tap-system-audio-gotchas.md)
("Making Core Audio Process Taps actually capture system audio") records the gotchas — notably
that `isExclusive` stops the aggregate device from starting, and that running by path (vs `open`)
breaks TCC. See [[audio-capture]] and the `test-tap` skill.

**TCC (Transparency, Consent, and Control)** — macOS's privacy-permission subsystem (microphone,
screen/audio recording, etc.). Capture and `harkd` request these permissions lazily at use time
([ADR-0012](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0012-harkd-lazy-permissions-startup.md)); launching the signed app via
`open` (not by binary path) is required for TCC to attribute permissions correctly
([ADR-0011](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0011-process-tap-system-audio-gotchas.md)). See [[audio-capture]].

## Diarization & speakers

**Diarization** — "who spoke when": partitioning the meeting audio into per-speaker segments.
Hark does it **offline, once, at `capture.stop`** over the full session audio (not live), via
FluidAudio's offline VBx pipeline ([ADR-0017](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0017-diarization-offline-pipeline.md),
[ADR-0025](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0025-no-live-diarization-v1.md)). See [[diarization]].

**Voiceprint** — a stored speaker voice embedding (256-dim, L2-normalized) captured when a
speaker is *named*, so future meetings can auto-match that speaker. Built from the **accurate
offline** centroid (not the flaky live path). Stays strictly local in `vault/.speakers/` —
gitignored, user-deletable, **never sent to any API** (CLAUDE.md hard rule #5,
[ADR-0026](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0026-speaker-enrollment.md)). See [[speaker-enrollment]].

## Privacy & egress

**Egress** — any content leaving the machine over the network. Hark's default is **zero
egress**; the only sanctioned path is the explicit Claude/LLM API call the user invokes
(summary, high-quality translation, Q&A — CLAUDE.md hard rule #1). All egress is funneled
through a single chokepoint in Electron main ([ADR-0029](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0029-llm-provider-layer-egress.md)).
See [[egress-governance]] and [[llm-egress]].

**Redaction** — the scrub step applied to text *before* it is sent to a cloud LLM, with the
redaction logged. For vault Q&A, only the redacted top-K retrieved chunks + the question ever
leave; a local LLM means zero egress ([ADR-0031](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0031-content-egress-redaction-log.md),
[ADR-0032](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0032-vault-rag-architecture.md)). See [[egress-governance]].

**Loopback guard** — the privacy gate on the external-retrieval client: before any `fetch`, the
endpoint host MUST be `localhost` / `127.0.0.1` / `::1` (the same check as `isLocalEgress`). A
non-loopback endpoint is **refused** — it never reaches the network, because retrieval results
are vault content flowing back in ([ADR-0034](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0034-external-retrieval-transport.md)).
See [[external-rag-client]] and [[threat-model]].

## Vault RAG

**RAG (retrieval-augmented generation)** — answer a question by first *retrieving* relevant
vault chunks, then handing only those (+ the question) to an LLM. Hark's vault Q&A:
renderer → `rag.retrieve` (engine, local) → top-K chunks → `llm.ask` (main, redact) → answer +
citations ([ADR-0032](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0032-vault-rag-architecture.md)). See [[rag]] and
[[pluggable-retrieval]].

**Embedder** — the on-device CoreML model (on the ANE) that turns text into a vector for
semantic search. v1 default is the **384-dim multilingual** `multilingual-e5-small`
(VI/TH/EN audience); `bge-small-en-v1.5` is the English-optimized alternative. The embedder is
**never a cloud endpoint** (indexing embeds the whole vault), and **changing it forces a full
re-index** (vectors are embedder-specific) ([ADR-0032](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0032-vault-rag-architecture.md)).
See [[rag]].

**Offset-only index** — the RAG index stores **pointers only**, never raw note text:
`meta.jsonl` carries `chunk_id, note_path, heading_path, char_start, char_end, content_hash`.
At query time the engine reads the snippet **live from the vault** at those offsets, skipping any
chunk whose file is missing or whose hash changed. So deleting a note erases its content
everywhere (nothing lingers in the app-data cache) and stale offsets are never trusted. Stored in
`~/Library/Application Support/Hark/index/` (`vectors.bin` + `meta.jsonl` + `manifest.json`) — a
rebuildable cache, **never the vault** ([ADR-0032](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0032-vault-rag-architecture.md),
schema_version 2). The vector store itself is brute-force in-memory cosine (exact KNN, <80 ms/query),
not sqlite-vec for v1. See [[rag]].

**Vault** — the user's sacred markdown second-brain at `~/Documents/vault/hark`, **outside this
repo**. It is the only place transcripts/audio/PII may be written; it is git-versioned and never
auto-deleted or auto-rewritten (CLAUDE.md hard rules #2/#4). The RAG indexer reads it but writes
only to app-data. See [[vault-writer]] and [[markdown-second-brain]].

## UI

**Squircle** — the rounded-square silhouette of macOS app icons; Hark's Dock icon is the
`#0E1116` squircle with the `#7AA9D6` teal "Heard ripples" mark (`ui/build/icon.icns`, commit
`8efdfde`). See [[tray]].

**Template image** — a macOS menu-bar (tray) glyph supplied as a monochrome+alpha PNG with
`setTemplateImage(true)`; the OS recolors it for light/dark menu bars. Hark's tray uses idle
(hollow dot + ripples) and recording (filled dot + ripples) template images that echo the Dock
icon (`ui/src/main/tray.ts`, commit `8efdfde`). See [[tray]].

---

### See also

- Decision digests: [[foundations]] · [[capture-audio]] · [[streaming-finalization-decisions]] ·
  [[diarization-speakers]] · [[privacy-egress]] · [[vault-rag-decisions]] · [[translation]] ·
  [[packaging-distribution]] · [[ui-onboarding]]
- Concepts: [[threat-model]] · [[local-first-guarantee]] · [[egress-governance]] ·
  [[streaming-finalization]] · [[pluggable-retrieval]] · [[privacy-data-control]] ·
  [[markdown-second-brain]]
