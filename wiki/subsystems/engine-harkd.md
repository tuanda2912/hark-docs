---
type: subsystem
title: Engine / harkd — streaming session daemon
status: current
sources: [ADR-0003, ADR-0005, ADR-0008, ADR-0012, ADR-0019, ADR-0036, engine/Sources/Harkd/EngineSession.swift, engine/Sources/Harkd/SlidingWindow.swift, engine/Sources/Harkd/HarkdCommand.swift, engine/Sources/HarkBench/main.swift]
updated: 2026-06-05
tags: [engine, streaming, swift, actor, finalization]
---

# Engine / harkd — streaming session daemon

The long-lived Swift sidecar that owns the whole per-meeting lifecycle: an
`EngineSession` **actor** wiring capture → VAD → 30 s / 5 s sliding window →
WhisperKit (ANE) → reconciliation → WebSocket emit, with single-window
backpressure, plus an offline diarization + vault-write pass at `capture.stop`.
It is the *real* engine the [[electron-main|Electron main]] process spawns; the
`hark-capture` / `hark-engine` CLIs are batch test tools that share the same
libraries.

> Why Swift, why a separate process: [[foundations]] — ADR-0003 picked Swift +
> WhisperKit over Rust/Python once Windows scope was cut; the engine runs as its
> own signed binary for ANE access + crash isolation.

## Code map

*Verified against the knowledge-graph slice (commit 8efdfde, 2026-06-05). Reference only — the narrative above is the source of truth for behaviour.*

**Layers:** Engine Core & Audio Capture · Streaming Daemon & Transcription

**Files:**

- `engine/Sources/Harkd/HarkdCommand.swift` → entry point for the harkd daemon: binds the WebSocket server and writes `engine.port` immediately, loads WhisperKit behind the running server, wires `EngineSession`, handles SIGINT/SIGTERM shutdown.
- `engine/Sources/Harkd/EngineSession.swift` → harkd's brain: the actor wiring Capture → VAD → SlidingWindow → WhisperKit → WebSocket emit, owning the full session lifecycle, dispatching all inbound commands, and running post-stop diarization, dedup, vault-write, and speaker-enrollment.
- `engine/Sources/HarkBench/main.swift` → Phase 0 RTF harness: slides a 30 s/5 s-hop window over an audio file, measures per-window wall-clock, emits a PASS/FAIL RTF report as JSON to stdout and `engine/Results/`.
- `engine/Sources/HarkEngine/HarkEngine.swift` → Phase 1 batch transcription CLI (`hark-engine`): runs WhisperKit over an audio file and emits structured JSON segments matching the `segment.final` shape (speaker/translation as null).
- `engine/Sources/HarkCore/HarkPaths.swift` → single authoritative resolver for rebuildable app-data dirs (`~/Library/Application Support/Hark`, `Models/`, `index/`), enforcing CLAUDE.md hard rule #2 (caches never land in the vault).
- `engine/Sources/HarkCore/WAVWriter.swift` → streaming WAV writer for 16 kHz mono Int16 PCM: placeholder RIFF header, append-on-arrival, patch size fields on close.
- `engine/Sources/HarkCore/Heartbeat.swift` → `startHeartbeat()`, a cancellable Task that prints an elapsed-time ticker to stderr during long no-progress steps (e.g. ANE compile).
- `engine/Sources/HarkCore/ProgressRenderer.swift` → in-place terminal progress bar (percent + MB/throughput/ETA), throttled to ~10 redraws/sec via a serial queue.

**Key types & functions:**

- `EngineSession` (class/actor) — the session actor: dispatches capture/bookmark/speaker/summary/translation/rag commands, drives the sliding-window hot path, runs flush-on-stop diarization/dedup/persist/speaker-matching (L39–2493).
- `EngineSession.handleInbound` — top-level inbound WS dispatcher: decodes the envelope type and routes to per-command methods (L342–389).
- `EngineSession.runTranscription` — per-hop driver: WhisperKit over the latest window, normalize to session time, reconcile vs `UtteranceLedger`, emit partial/final frames (L1081–1294).
- `EngineSession.flushOnStop` — capture-stop finalization: drain in-flight transcription, diarize, dedup + collapse re-emissions, persist, emit `meeting.saved`/`meeting.transcript` (L1295–1413).
- `EngineSession.commitDecision` — pure static commit-watermark decision (ADR-0019): finalize a region exactly once behind the monotonic `committedUpTo` (L1492–1531).
- `EngineSession.collapseReemissions` — pure static at-stop pass collapsing time-gated re-emissions of the same sentence while preserving identical text spoken far apart (L1561–1629).
- `EngineSession.transcriptUtterances` — pure static map from deduped, speaker-labeled vault utterances to the `meeting.transcript` payload (L1692–1706).
- `EngineSession.runDiarizationPass` — runs the offline Diarizer over full session audio, assigns exclusive speaker segments by overlap → "Speaker N" labels (L1987–2243).
- `FinalizedUtterance` (struct) — value type for a committed utterance carried through the at-stop dedup, collapse, and speaker-labeling passes (L2494–2534).
- `HarkdCommand` (struct) — `AsyncParsableCommand` booting the daemon: parses `--port`/`--port-file`/`--verbose`, starts server, writes port file, loads model, blocks on shutdown signals (L35–221).
- `ModelProgressThrottle` (class) — rate-limit gate in front of the model-progress actor hop: drops per-byte/per-percent floods but never a phase transition (L257–315).
- `WSDelegateAdapter` (class) — bridges NIO `WebSocketDelegate` connect/disconnect/message callbacks onto the `EngineSession` actor via Task hops (L343–359).
- `HarkPaths` (enum) — `appSupportDir()`/`modelsDir()`/`indexDir()` create-if-missing helpers for sanctioned app-support locations (L13–43).
- `WAVWriter` (class) — streaming WAV file: init writes 44-byte header, `append()` writes Int16 LE, `close()` patches RIFF/data sizes idempotently (L33–117).
- `ProgressRenderer` (class) — `@unchecked Sendable` consumer of Foundation `Progress` from any thread, redraws serialized through a `DispatchQueue` (L25–114).
- `startHeartbeat` (func) — cancellable Task writing `"[ N s elapsed ] <label>…"` to a `FileHandle` on a fixed interval until cancelled (L16–31).
- `HarkEngineCommand` (struct) — `AsyncParsableCommand` for `hark-engine`: loads WhisperKit, transcribes the input, writes the JSON `EngineReport` (L136–316); `EngineReport` (L109–117) / `EngineSegment` (L75–108) are the Codable output models, `EngineSegment` matching `segment.final` with speaker/translation null in Phase 1.
- `HarkBench` helpers — `detectChip` (sysctl chip name, L110–128), `percentile` (RTF p50/p95/p99, L158–167), `gitShortSha` (stamps the result filename, L169–191).

**Pinned by tests:**

- `engine/Tests/HarkCaptureTests/WAVWriterTests.swift` → round-trips `HarkCore.WAVWriter`: writes Int16 samples, then asserts the 44-byte header and payload byte count.

**Connections:**

- `depends_on` → [[subsystems/whisperkit-asr|WhisperKit ASR & sliding window]] (`SlidingWindowBuffer` / `UtteranceLedger`)
- `calls` → [[subsystems/whisperkit-asr|WhisperKit ASR & sliding window]] (HarkBench → `loadWhisperKit`)
- `depends_on` → [[subsystems/diarization|Offline diarization]] (`Diarizer`)
- `calls` → [[subsystems/diarization|Offline diarization]] (`runDiarizationPass` → `Diarizer`)
- `depends_on` → [[subsystems/vault-writer|Vault writer]] (`VaultWriter`)
- `depends_on` → [[subsystems/speaker-enrollment|Speaker enrollment]] (`SpeakerStore`)
- `depends_on` → [[subsystems/rag|Vault RAG]] (`RagIndexer`)
- `depends_on` → [[subsystems/wire-protocol|Wire protocol]] (`HarkdWebSocketServer`)
- `implements` → [[subsystems/wire-protocol|Wire protocol]] (`WSDelegateAdapter` : `WebSocketDelegate`)
- ⇐ `calls` [[subsystems/whisperkit-asr|WhisperKit ASR & sliding window]] (`loadWhisperKit` → `startHeartbeat`)
- ⇐ `depends_on` [[subsystems/whisperkit-asr|WhisperKit ASR & sliding window]] (`loadWhisperKit` → `ProgressRenderer`)
- ⇐ `depends_on` [[subsystems/audio-store|Meeting audio store]] (`AudioStore` → `WAVWriter`)

> Note: engine Swift `import`s aren't resolved by the graph, so these edges come from symbol-level call/dependency analysis, not module imports.

## What it does

`harkd` is a single executable target that imports `HarkCapture` and `HarkCore`
as in-process libraries and runs the full live pipeline in **one process, one
backpressure domain** — no IPC on the hot path (ADR-0008 §Decision 2). The
process boundary that matters is engine ↔ UI, which is the
[[wire-protocol|WebSocket contract]].

**Boot order (ADR-0012):** serve before you load. `HarkdCommand.run`
(`engine/Sources/Harkd/HarkdCommand.swift`):

1. Bind the Swift NIO WebSocket server on `127.0.0.1` (ephemeral port by
   default), then write `~/Library/Application Support/Hark/engine.port` as
   **JSON** `{port, pid, version}` — so the UI can discover `harkd`
   *immediately*, before the slow model load (port-file format = ADR-0008
   §Open-Q #2; lazy serve = ADR-0012).
2. Load WhisperKit `large-v3-turbo` (download + ANE compile, ~90 s cold)
   *behind* the running server; the embedder ([[rag|vault RAG]]) loads
   concurrently in a detached Task, and the offline diarizer loads after
   WhisperKit. All three are **non-fatal** — a failed load degrades only its own
   capability, never capture.
3. `attachModel(_:name:)` injects the pipeline and broadcasts `meta.ready`;
   until then `capture.start` is rejected with a **recoverable**
   `ENGINE_WARMING_UP` (clients retry).
4. Park on SIGINT/SIGTERM; on signal, close clients, delete the port file,
   exit 0.

**Permissions are lazy + per-source (ADR-0012):** `harkd` never gates on
permissions at startup. Mic is requested at `capture.start` only when the mic
source is on (`PermissionGate.requestMicrophone()`); system audio is requested
inside the Process Tap backend. Both grant **live** (no relaunch); a denial
becomes a recoverable WS error (`MIC_DENIED`), never a process exit. (Contrast
the `hark-capture` CLI, which keeps a fail-fast preflight — see
[[audio-capture]].)

## The hot path

`EngineSession` is modelled as a Swift `actor`, so every state mutation
serializes on the actor's executor without explicit locks (the in-source Java
analogue: a `@Service` bean holding the whole session lifecycle). The capture
pump fires its `floatFrameSink` on a background `DispatchQueue` and bounces each
batch into the actor via `Task { await ingestFrames(...) }`.

```
CapturePipeline pump ──floatFrameSink──► Task { await ingestFrames }
  ├─ (if diarizer) append raw frames → sessionAudio   (continuous, pre-VAD)
  ├─ VAD.classify(frames) → .speech | .silence        (silence dropped)
  ├─ window.append(speechFrames, sessionTime)
  └─ window.popHopIfReady() → Task { await runTranscription }
        ├─ whisperKit.transcribe(window)              (30 s window each hop)
        ├─ map window-relative seg times → absolute session time
        ├─ reconcile vs UtteranceLedger (commit watermark)
        └─ emit segment.partial / segment.final / segment.superseded
```

- **VAD gate** drops silence so the ANE never wastes cycles transcribing
  silence (which Whisper hallucinates captions for). Session time advances on a
  wall clock even during dropped silence, so emitted segment timestamps stay on
  the real timeline. See [[vad]].
  > TODO(wiki): ADR-0008 §3 specifies **Silero CoreML** as the VAD. The shipped
  > engine uses an energy-based `EnergyVAD` (the `capture.started` frame reports
  > `vad: "energy-v0"`). The Silero CoreML decision is not yet realized in code;
  > [[vad]] should be the source of truth for which VAD actually runs.
- **Sliding window** = 30 s buffer, 5 s hop, **speech-only** samples
  (`SlidingWindowBuffer`, `engine/Sources/Harkd/SlidingWindow.swift`). Every hop
  re-transcribes the whole 30 s, so each audio span is decoded ~6×. The buffer
  carries per-speech-batch anchors so window-relative segment offsets map back to
  absolute session time. Geometry validated in Phase 0 (ADR-0005). See
  [[whisperkit-asr]].

## Backpressure — single window, never queue

`ADR-0008 §3`, enforced in `ingestFrames`: if a transcription job is already in
flight (`transcribeInFlight == true`) when a new hop is ready, the engine **drops
the hop** rather than queueing, and broadcasts a `warning` with
`code: "rtf_high"`. Never more than one outstanding window. Phase 0 measured RTF
≈ 0.075 on M4 (ADR-0005) — ~13× real-time — so this rule is a defensive
fallback that should fire ~never on M-series, not a routine path.

## Finalization — the commit watermark (ADR-0019 → ADR-0036)

This is the subtlest part of the engine and the subject of its own concept page,
[[streaming-finalization]] (decision history in
[[streaming-finalization-decisions]]). The short version:

- **Identity (unchanged, ADR-0009):** `UtteranceLedger.resolve` matches a new
  segment to an existing utterance by **max-denominator interval overlap**
  (overlap ÷ longer interval ≥ 0.5), so boundary jitter keeps an id but coarse
  re-segmentation mints a fresh one.
- **Region commit (ADR-0019):** maintain a monotonic `committedUpTo` watermark.
  Each hop, finalize **exactly once** the segments whose `t_start` lies in
  `(committedUpTo, commitHorizon]`, where `commitHorizon = windowStartSessionTime
  + hopSeconds` — the oldest hop-second of speech, about to age out and never be
  re-decoded. The hot region (after the watermark) keeps flowing
  `segment.partial`. The pure decision is `EngineSession.commitDecision`
  (`.finalize` / `.partial` / `.skipAlreadyCommitted`), shared with the unit
  tests. Advancing to `max(commitHorizon, maxCommittedEnd)` lets a long sentence
  consume its full span so its tail isn't re-committed as overlapping fragments.
- **Export-only growth (ADR-0036):** when a fuller re-decode of an
  already-FINALIZED line arrives, `UtteranceLedger.extendFinalizedIfGrown`
  (conservative time + text-prefix gate) grows the **retained** row in place —
  recovering the tail into the **saved** transcript — but does **not** re-broadcast
  a `segment.final`. The user's chosen contract: *"live clean, export recovers
  it"* — a finalized line never rewrites under you live; completeness lands in the
  saved file and the post-stop `meeting.transcript` swap.

Backstops kept as defense-in-depth: ADR-0018 `segment.superseded` retraction
(now rare for finals) and an at-stop time-gated `collapseReemissions` dedup.

## Stop → drain → diarize → vault

`dispatchCaptureStop` runs atomically on the actor: it stops the pipeline,
**snapshots** the live state (`ledger` / `window` / `committedUpTo` / `sessionId`
/ start) into locals, acks + broadcasts `capture.stopped`, then wipes
session-scoped fields — and hands the snapshot to a detached `flushOnStop` Task.
(The snapshot is load-bearing: the wipe runs before the Task does, so reading
`self.ledger` would see `nil` and lose the tail.) `flushOnStop`, all off the
live path and best-effort:

1. `flushTranscriptionDrain` — one last decode of the residual buffer, gated on
   `overlapsFinalized` (what was *actually* finalized), not the watermark.
2. `finalizeHotRegion` — deterministically finalize every live ledger entry
   above the watermark from its stored text (no re-transcription). This is the
   ADR-0019 content-loss fix for the last ~30 s tail.
3. `dedupedFinalizedUtterances()` — collapse the append-only finalized log
   (drop superseded, last-write-wins per uid, time-gated `collapseReemissions`),
   sorted by `t_start`.
4. `runDiarizationPass` — FluidAudio offline diarization over the **continuous**
   `sessionAudio`, labelling each utterance "Speaker N" by max time-overlap;
   optional auto-match against enrolled voiceprints. See [[diarization]] /
   [[speaker-enrollment]].
5. `persistMeeting` — write the markdown via `VaultWriter`, optionally persist
   audio (`keepAudio` gate), emit `meeting.transcript` then `meeting.saved`,
   retain a `SavedMeetingSnapshot` for post-stop edits. See [[vault-writer]] /
   [[audio-store]].

Diarization/audio/RAG are all **nil-tolerant**: a missing or failed capability
degrades that feature only and never blocks capture or the vault write.

## Other commands on the actor

`handleInbound` decodes the envelope and dispatches: `capture.start/stop/pause/
resume`, `bookmark.create`, `speaker.rename` (re-render + git-commit the saved
file; enroll voiceprints when `rememberSpeakers` is on), `summary.write` and
`translation.write` (the engine only *persists* — generation happens in
[[electron-main]], the egress chokepoint, per [[egress-governance]]), and
`rag.retrieve`. Full frame catalog in [[wire-protocol]].

## Key files

| File | Role |
|---|---|
| `engine/Sources/Harkd/HarkdCommand.swift` | CLI entry, serve-before-load boot, port file, model/diarizer/RAG loads, signal shutdown, NIO→actor delegate adapter |
| `engine/Sources/Harkd/EngineSession.swift` | The actor: hot path, backpressure, reconciliation, commit watermark, stop drain, diarization pass, vault persist, all command handlers |
| `engine/Sources/Harkd/SlidingWindow.swift` | `SlidingWindowBuffer` (30 s / 5 s, speech-only, time anchors) + `UtteranceLedger` (overlap identity, supersession, grow-in-place, prune) |
| `engine/Sources/HarkBench/main.swift` | Phase 0 RTF harness (ADR-0005) — same 30 s/5 s geometry, speed-only, writes `engine/Results/*.json` |

## How it connects

- **Capture** → in-process `CapturePipeline` (`HarkCapture`); see [[audio-capture]].
- **VAD / ASR / window** → [[vad]], [[whisperkit-asr]].
- **UI** → all I/O over the loopback WebSocket: [[wire-protocol]]; the Electron
  side is [[electron-main]] / [[engine-service]].
- **Post-stop** → [[diarization]], [[speaker-enrollment]], [[vault-writer]],
  [[audio-store]].
- **Vault search** → [[rag]] (`rag.retrieve`, background index).
- **Egress** → translation/summary text is generated in Electron main; the
  engine only writes ([[egress-governance]], [[local-first-guarantee]]).

## Governing ADRs

- [ADR-0003](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0003-swift-whisperkit-engine.md) — Swift + WhisperKit engine, sidecar process model.
- [ADR-0005](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0005-phase-0-rtf-validated.md) — Phase 0 RTF validated (RTF ≈ 0.075 on M4); 30 s/5 s geometry.
- [ADR-0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md) — `harkd` name, Swift NIO, in-process capture, VAD-gated sliding window, single-window backpressure.
- [ADR-0012](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0012-harkd-lazy-permissions-startup.md) — serve-before-model, lazy per-source permissions, `ENGINE_WARMING_UP`.
- [ADR-0019](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0019-region-based-finalization.md) — commit-watermark "finalize each region exactly once".
- [ADR-0036](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0036-grow-in-place-finalization.md) — export-only grow-in-place (amends ADR-0019; live clean, export recovers).

## Invariants

- **One process, one backpressure domain.** Capture, VAD, window, ASR run
  in-process; never more than one transcription in flight; drop, never queue
  (ADR-0008).
- **Serve before model.** The WS server + port file come up before the model;
  `capture.start` is gated on `modelReady` with a recoverable error (ADR-0012).
- **`committedUpTo` is monotonic.** No audio region is finalized twice
  (ADR-0019); a region's start, once behind the watermark, is never re-emitted.
- **Live stream is discrete; the saved file is complete.** Export-only growth
  never re-broadcasts a finalized line (ADR-0036).
- **Privacy: the actor sees transcript text but never logs it.** All stderr is
  state/progress only. Audio and transcripts leave RAM only via the vault write;
  no network from the engine except the explicit RAG/embedder/model downloads
  (CLAUDE.md hard rules #1–#3; [[threat-model]], [[local-first-guarantee]]).
- **Optional capabilities are nil-tolerant.** A missing diarizer / audio store /
  RAG indexer degrades only its own feature; it never blocks capture or the
  vault write.

See also [[overview]] for the subsystem map and [[glossary]] for terms
(`utterance_id`, RTF, commit watermark, …).
