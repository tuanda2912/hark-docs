---
title: WebSocket API Contract — Engine ↔ UI
owner: Dev
status: draft
last_updated: 2026-06-02
---

# WebSocket API Contract

The localhost WebSocket between the Swift engine and the Electron UI. This is the **only** IPC channel between them — keep it disciplined or both sides drift.

## Connection

- **Endpoint:** `ws://127.0.0.1:{PORT}/v1`
- **Port:** picked at engine startup from ephemeral range, written to `~/Library/Application Support/Hark/engine.port`. UI reads the file. Avoids port collisions across versions.
- **Auth:** none required (loopback only). Engine rejects non-loopback connections.
- **Protocol:** JSON messages, one per WebSocket frame. UTF-8.
- **Reconnect:** UI side, exponential backoff starting at 200ms, capped at 5s.

## Message envelope

Every message has these top-level fields:

```json
{
  "v": 1,
  "id": "uuid-v4-or-null",
  "type": "namespace.action",
  "ts": "2026-05-24T10:30:00.123Z",
  "payload": { /* type-specific */ }
}
```

- `v` — protocol version. Hard-fail on mismatch with a `meta.protocol_mismatch` event.
- `id` — correlation ID for request/response pairs. `null` for unsolicited events.
- `type` — dot-namespaced action name. See [Message catalog](#message-catalog).
- `ts` — ISO 8601 with milliseconds.
- `payload` — action-specific data.

## Direction conventions

- **UI → Engine:** commands (verb form: `capture.start`, `meeting.summarize`)
- **Engine → UI:** events (past-tense or descriptive: `segment.partial`, `capture.started`, `warning`)
- Commands are acknowledged with `{type: "ack", id: <req.id>}` or `{type: "error", id: <req.id>, payload: {code, message}}`

## Message catalog

### Lifecycle

#### `capture.start` (UI → Engine)

```json
{
  "type": "capture.start",
  "payload": {
    "sources": { "mic": true, "system": true },
    "translation": { "enabled": true, "mode": "fast", "target_lang": "en" }
  }
}
```

**Response:** `ack` then `capture.started` event with chosen sample rate, devices, model info.

#### `capture.stop` (UI → Engine)

```json
{ "type": "capture.stop", "payload": {} }
```

**Response:** `ack`, then `capture.stopped`, then (async) `meeting.saved`.

#### `capture.pause` / `capture.resume` (UI → Engine)

```json
{ "type": "capture.pause", "payload": {} }
```

**Response:** `ack`, then `capture.paused` / `capture.resumed` event.

#### `capture.started` (Engine → UI)

```json
{
  "type": "capture.started",
  "payload": {
    "session_id": "uuid",
    "sample_rate_hz": 16000,
    "channels": 1,
    "model": "whisperkit-large-v3-turbo",
    "vad": "silero-v5",
    "started_at": "2026-05-24T10:30:00Z"
  }
}
```

#### `capture.stopped` (Engine → UI)

```json
{
  "type": "capture.stopped",
  "payload": { "session_id": "uuid", "duration_sec": 2715 }
}
```

---

### Transcription stream

#### `segment.partial` (Engine → UI)

Emitted as WhisperKit refines an in-progress utterance. The UI replaces the last partial for the same `utterance_id`.

```json
{
  "type": "segment.partial",
  "payload": {
    "utterance_id": "uuid",
    "t_start": 12.34,
    "t_end": 15.67,
    "text": "We should consider the Camunda...",
    "language": "en"
  }
}
```

#### `segment.final` (Engine → UI)

Emitted when VAD ends the utterance. The UI locks this segment.

```json
{
  "type": "segment.final",
  "payload": {
    "utterance_id": "uuid",
    "segment_id": "uuid",
    "t_start": 12.34,
    "t_end": 18.90,
    "text": "We should consider the Camunda migration timing.",
    "language": "en",
    "speaker": "Speaker 2",
    "translation": { "text": "Wir sollten...", "lang": "de" }
  }
}
```

`speaker` is provisional during the meeting (acoustic cluster only); resolved to real names after `meeting.saved`.

#### `bookmark.create` (UI → Engine)

```json
{
  "type": "bookmark.create",
  "payload": { "t": 1234.5, "label": "decision" }
}
```

`label` is one of: `"plain" | "decision" | "question" | "todo"`. Default `"plain"`.

#### `bookmark.created` (Engine → UI)

```json
{
  "type": "bookmark.created",
  "payload": { "bookmark_id": "uuid", "t": 1234.5, "label": "decision" }
}
```

---

### Diarization & speaker matching

#### `meeting.transcript` (Engine → UI) — IMPLEMENTED

Fired **once** per meeting at `capture.stop`, after diarization + vault write,
**JUST BEFORE** [`meeting.saved`](#meetingsaved-engine--ui). It carries the
**deduped, "Speaker N"-labeled** final transcript — **byte-for-byte the same set
of utterances written to the vault markdown body** (built from the identical
`[VaultWriter.Utterance]` set the writer was handed; the engine does not re-derive
a different set). Its purpose is to let the UI **back-annotate speakers onto the
on-screen transcript**.

```json
{
  "type": "meeting.transcript",
  "payload": {
    "session_id": "uuid",
    "utterances": [
      { "id": "u0", "t_start": 12.34, "text": "We should consider the Camunda migration.", "speaker": "Speaker 1" },
      { "id": "u1", "t_start": 18.90, "text": "Agreed — let's revisit timing next sprint.", "speaker": "Speaker 2" }
    ]
  }
}
```

- **Why it exists — offline diarization.** Diarization is a **post-stop batch
  pass**, not a live one. Every live [`segment.final`](#segmentfinal-engine--ui)
  ships `speaker: null` (and `segment.partial` carries no speaker at all). So until
  this frame, speaker labels existed **only** in the written vault file and in the
  [`meeting.saved`](#meetingsaved-engine--ui) roster — never back on the live
  on-screen transcript. This frame closes that gap.
- **Full replacement, not a merge.** The UI treats `utterances` as a **complete
  replacement** of the displayed transcript for this `session_id`: it clears the
  live segment map and repopulates it from `utterances`, each rendered as a
  finalized line with its `speaker` set. It does **not** reconcile against the live
  `utterance_id`s.
- **`id` is fresh, NOT a live `utterance_id`.** Each `id` is an index-based stable
  key minted for this frame (`"u0"`, `"u1"`, … in chronological / `t_start` order)
  for the UI's `@for` track. It deliberately does **not** correspond to any live
  `utterance_id` from `segment.partial`/`segment.final`, because the live utterances
  were re-segmented and deduped on the way to the vault. Do not try to match these
  ids back to live segments — the live set is being thrown away and replaced.
- **Fields.** `id` (string), `t_start` (number, seconds since capture start),
  `text` (string), `speaker` (string — the `"Speaker N"` label). **All four are
  non-optional / non-nullable** on both sides — there is no `null` here (contrast
  `segment.final.speaker`, which is always `null` during a meeting). There is no
  `t_end` / `language` / `translation` on the wire; the UI point-anchors each line
  at `t_start` and leaves those null locally.
- **Relationship to `meeting.saved`.** Same `session_id` (and the same value the
  later [`speaker.rename`](#speakerrename-ui--engine--implemented) command targets),
  scoping the replacement to one meeting. `meeting.transcript` carries the **body**
  (the labeled lines); `meeting.saved`, sent immediately after, carries the
  **roster** (`speakers[]`), `vault_path`, and `stats`. The labels in
  `meeting.transcript.utterances[].speaker` are exactly the roster labels in
  `meeting.saved.speakers[].label`.
- **Wire-encoding note.** `session_id` ⇄ Swift `sessionId` and `t_start` ⇄ Swift
  `tStart` via the outbound encoder's `.convertToSnakeCase`; `id` / `text` /
  `speaker` / `utterances` are single-word and pass through unchanged. Because
  every field is non-optional, the synthesized Swift `encode(to:)` is sufficient —
  no explicit `encodeNil` is needed (unlike `segment.final` / `meeting.saved`'s
  nested nullables).
- **Not replayed on reconnect.** This is a one-shot event tied to a stop. The
  engine does **not** retain a snapshot to replay to a client that connects later
  (unlike `meta.model_progress`). A UI that reconnects after a meeting was saved
  re-derives that meeting's content by reading the vault file directly, not from
  this frame.

#### `meeting.saved` (Engine → UI)

Fired after stop, diarization, and vault write all complete.

```json
{
  "type": "meeting.saved",
  "payload": {
    "session_id": "uuid",
    "vault_path": "/Users/.../vault/hark/meetings/2026-05-24-q2-planning.md",
    "speakers": [
      { "label": "Speaker 1", "matched_name": "Alice Chen", "confidence": 0.91 },
      { "label": "Speaker 2", "matched_name": null, "confidence": null }
    ],
    "stats": { "segments": 142, "duration_sec": 2715, "rtf_avg": 0.31 }
  }
}
```

#### `speaker.rename` (UI → Engine) — IMPLEMENTED

Renames one or more speakers in an already-saved meeting. This is a **post-save**
operation: diarization runs as a post-`capture.stop` batch pass, so `"Speaker N"`
labels exist **only** in the written vault markdown (live `segment.final` frames
carry `speaker: null`). Renaming is therefore a re-render of that file with the
user's chosen display names, followed by a git commit.

```json
{
  "type": "speaker.rename",
  "payload": {
    "session_id": "uuid",
    "names": { "Speaker 1": "Alice", "Speaker 2": "Bob" }
  }
}
```

- `names` maps each speaker's **current** label (the key the engine knows — e.g.
  `"Speaker 1"`, or a previously-applied name on a second edit) to a new display
  name. The UI sends **only** the rows that actually changed; an empty map is a
  no-op (the UI suppresses the send entirely).
- `session_id` scopes the edit to one meeting. **MVP: only the single
  most-recently-saved meeting is renameable.** A mismatch returns
  `error{code:"MEETING_NOT_FOUND", recoverable:true}`.

**Wire-encoding note (load-bearing):** the engine decodes inbound with
`JSONDecoder.keyDecodingStrategy = .convertFromSnakeCase`. That strategy
transforms **struct property names only** — `session_id` → `sessionId` — but does
**not** touch the keys or values of a `[String:String]` dictionary. So the `names`
map keys pass through verbatim: `"Speaker 1"` stays `"Speaker 1"` (and a key that
happens to look like snake_case, e.g. `"speaker_one"`, would also pass through
unchanged). Verified empirically. The TS `payload.names: Record<string,string>`
and the Swift `SpeakerRenameCommand.names: [String:String]` are in exact lockstep.

**Response:** `ack` on success (the engine has re-rendered the same vault file in
place at its existing path and git-committed the change), or an `error` frame on
failure (`MEETING_NOT_FOUND` if `session_id` isn't the most-recent meeting;
`PROTOCOL_MISMATCH` for a malformed payload; `INTERNAL` if the rewrite/commit
fails). There is **no** dedicated inbound success frame — the UI keys off `ack`.

> **Supersedes the earlier `speaker.tag` sketch.** A never-implemented
> single-label `speaker.tag {session_id, speaker_label, name}` previously lived
> here. `speaker.rename` replaces it: it is **batch** (`names:{label:name}`),
> matches the shipped engine + UI code, and does **not** (yet) write
> `vault/.speakers/*.json` enrollment profiles — that voice-enrollment piece is
> deferred to Phase 5.1. Speaker rename in the MVP only rewrites the meeting's own
> markdown file.

---

### Term capture

#### `term.detected` (Engine → UI)

```json
{
  "type": "term.detected",
  "payload": {
    "term": "Camunda",
    "vault_path": "notes/camunda.md",
    "excerpt": "Camunda is a BPMN workflow engine we use for...",
    "t_start": 18.5
  }
}
```

UI renders an inline card next to the live transcript.

---

### Warnings & errors

#### `warning` (Engine → UI, unsolicited)

```json
{
  "type": "warning",
  "payload": {
    "code": "rtf_high" | "sck_lost" | "model_warmup" | "disk_low",
    "message": "Transcription falling behind (RTF=1.2)",
    "severity": "low" | "medium" | "high"
  }
}
```

#### `error` (Engine → UI, response or unsolicited)

```json
{
  "type": "error",
  "id": "req-id-if-response",
  "payload": {
    "code": "PERMISSION_DENIED" | "MODEL_LOAD_FAILED" | "DISK_FULL" | "INTERNAL",
    "message": "ScreenCapture permission required",
    "recoverable": true,
    "action": "open_system_settings"
  }
}
```

---

### Meta

#### `meta.hello` (Engine → UI on connect)

```json
{
  "type": "meta.hello",
  "payload": {
    "engine_version": "0.1.0",
    "protocol_version": 1,
    "model_loaded": "whisperkit-large-v3-turbo",
    "capabilities": ["translation.local", "translation.cloud", "diarization"]
  }
}
```

**`model_loaded` is `"(loading)"` until the model is ready.** harkd brings up the
WebSocket + writes the port file *before* the model finishes loading, so the very
first client to connect on a cold start sees `model_loaded: "(loading)"` here, and
then a separate `meta.ready` frame once load completes (see below). A client that
connects *after* the model is already loaded gets the real model name in
`meta.hello` and **no** `meta.ready`. The UI treats `model_loaded !== "(loading)"`
in `meta.hello` as "already ready". The `capabilities` array advertises only what
this build actually ships (current builds: `["diarization"]`; translation is not
built yet, so it is deliberately omitted — keep it honest).

#### `meta.ready` (Engine → UI, unsolicited)

```json
{ "type": "meta.ready", "payload": { "model_loaded": "whisperkit-large-v3-turbo" } }
```

Pushed once, the moment the model finishes loading, to **every already-connected
client** that saw `meta.hello.model_loaded === "(loading)"`. This is the
**terminal** readiness signal — the UI ungates Start on it. It also clears any
in-flight `meta.model_progress` (the warm-up overlay tears down). Not sent to
clients that connected after load (they already learned the model name from
`meta.hello`).

#### `meta.model_progress` (Engine → UI, unsolicited — cold-start warm-up)

Emitted **only** during a cold start, while harkd downloads and ANE-compiles the
speech (WhisperKit, ~626 MB) and diarizer (FluidAudio CoreML) bundles — i.e. in
the window *before* `meta.ready`. Drives the first-run "Preparing Hark" overlay so
a fresh install doesn't look hung. **Purely additive: it never affects readiness.**
`meta.ready` remains the single terminal readiness signal.

```json
{
  "type": "meta.model_progress",
  "payload": {
    "phase": "downloading_speech",
    "fraction": 0.42,
    "detail": "Downloading speech model"
  }
}
```

- `phase` (string) — a stable machine token, one of:
  `"downloading_speech" | "optimizing_speech" | "downloading_diarizer" | "optimizing_diarizer"`.
  It is a payload **value**, not a key, so the engine's `.convertToSnakeCase` key
  strategy leaves it untouched — the literal snake_case form on the wire is what is
  shown above.
- `fraction` (number **or `null`**) — `0..1` for the byte-counted **download**
  phases. **`null` for the ANE compile / optimize phases**, which expose no
  progress API. This distinction is **load-bearing**: the UI renders a determinate
  progress **bar** for a numeric `fraction` and an indeterminate **spinner** when
  `fraction` is `null`. The engine encodes the null case as an explicit JSON
  `"fraction": null` (not a dropped key — same explicit-`encodeNil` pattern as
  `SegmentPayload`/`meeting.saved`'s nested nullables), so the UI can tell
  "indeterminate" (`null`) apart from "absent". Do not let the key be omitted.
- `detail` (string) — a human-readable label to display, e.g.
  `"Downloading speech model"`. Display-only; do not parse it.

**Throttling:** the underlying loader callbacks (FluidAudio's per-byte download
callback, WhisperKit's per-1% callback) fire very frequently. The caller throttles
**before** the actor hop; `emitModelProgress` itself just snapshots + broadcasts.

**Snapshot replay to late clients:** the engine retains the most recent
`meta.model_progress` and replays it (once) to a client that connects mid-download,
right after `meta.hello`, so a UI opened part-way through a cold start sees the
current phase/fraction immediately instead of waiting for the next callback. Same
spirit as `meta.ready` being pushed to already-connected clients. The snapshot is
cleared once `meta.ready` fires; late progress callbacks arriving after readiness
are dropped (not re-broadcast, and they do not resurrect the snapshot).

**UI teardown:** the UI clears its `meta.model_progress` state — and thus the
overlay — on `meta.ready` and on socket close (a reconnect re-derives warm-up
state from a fresh `meta.hello`).

#### `meta.heartbeat` (bidirectional, every 5s)

```json
{ "type": "meta.heartbeat", "payload": { "rtf_current": 0.42, "ring_buffer_fill_sec": 1.2 } }
```

Engine includes live metrics; UI sends an empty payload. If 3 heartbeats are missed, the other side considers the connection dead.

---

## What is NOT in this protocol

Deliberately kept out:

- **Audio data.** Audio never leaves the engine process. Period.
- **Speaker embeddings.** Stay in the engine + vault. The UI gets names only.
- **Claude API calls.** Owned by Electron Main process directly, not proxied through the engine. Separation of concerns: engine = audio, main = network.
- **Vault file contents.** UI reads vault files directly via Node `fs`; engine writes them. They share a folder, not a channel.

## Versioning

- `v` field in envelope bumps on breaking change.
- Engine and UI ship together — protocol version is locked per release.
- If versions mismatch on connect (e.g., UI is newer than engine after a partial update), the side that detects it emits `meta.protocol_mismatch` and the UI prompts the user to restart.

## Related

- [Architecture overview](06-architecture-overview.md)
- [Data flows](07-data-flows.md) — flows that reference these message types
