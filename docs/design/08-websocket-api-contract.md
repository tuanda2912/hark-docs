---
title: WebSocket API Contract — Engine ↔ UI
owner: Dev
status: draft
last_updated: 2026-05-24
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

#### `speaker.tag` (UI → Engine)

User assigns a real name to an unlabeled speaker.

```json
{
  "type": "speaker.tag",
  "payload": {
    "session_id": "uuid",
    "speaker_label": "Speaker 2",
    "name": "Bob Smith"
  }
}
```

**Response:** `ack`, then engine writes `vault/.speakers/bob-smith.json`, retroactively renames segments in the meeting file, git commits.

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
