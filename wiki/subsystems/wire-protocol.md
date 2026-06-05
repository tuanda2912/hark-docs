---
type: subsystem
title: Wire protocol — harkd↔UI WebSocket contract
status: current
sources: [ADR-0008, engine/Sources/Harkd/WebSocketServer.swift, engine/Sources/Harkd/WireProtocol.swift, ui/src/app/services/engine.types.ts]
updated: 2026-06-05
tags: [engine, ui, protocol, ipc]
---

A Swift NIO localhost-only (`127.0.0.1`) WebSocket server and the versioned JSON
envelope it carries — `meta.*` / `capture.*` / `segment.*` / `warning` / `error` /
`meeting.*` / `rag.*` frames plus UI→engine commands — with **snake_case on the
wire** mirrored byte-for-byte by the renderer's TypeScript types.

## What it does

This is the single data boundary between the Swift engine ([[engine-harkd]]) and the
Angular renderer ([[engine-service]]). Everything the UI learns about a meeting
arrives as a JSON text frame over one loopback WebSocket; everything the user asks
the engine to do leaves as a JSON command frame on the same socket. There is no other
IPC channel between the two processes.

Two halves:

1. **The transport** — a Swift NIO WebSocket server bound to `127.0.0.1` on an
   ephemeral port, single client, no auth (ADR-0008 §1). See
   `engine/Sources/Harkd/WebSocketServer.swift`.
2. **The envelope + payloads** — a versioned JSON envelope wrapping typed payloads,
   defined once in Swift (`WireProtocol.swift`) and mirrored once in TypeScript
   (`engine.types.ts`). The two files are a hand-maintained lockstep pair.

## Code map

A two-sided contract spanning both runtimes — the Swift definition and the TypeScript
mirror must agree byte-for-byte.

**Layers:** `Streaming Daemon & Transcription` (Swift) + `UI Renderer (Angular)` (TS).

**Files**

- `engine/Sources/Harkd/WebSocketServer.swift` — localhost-only WebSocket server on
  Swift NIO: binds `127.0.0.1`, rejects non-loopback, upgrades HTTP GET to WebSocket,
  runs the NIO handler chain, and dispatches one-JSON-message-per-text-frame to a
  weakly-held `EngineSession` via the `WebSocketDelegate`.
- `engine/Sources/Harkd/WireProtocol.swift` — JSON envelope + payload Codables: the
  versioned `WireEnvelope` wrapper, every outbound event payload (`meta.*`,
  `capture.*`, `segment.*`, `meeting.*`, `rag.*`, `warning`, `error`), and every
  inbound command.
- `ui/src/app/services/engine.types.ts` — the TS mirror: frame/segment/speaker/
  meeting-saved type definitions, wire constants, and `LANGUAGE_CHOICES`.

**Key types & functions**

- `HarkdWebSocketServer` (class) — the NIO server: binds the loopback channel on an
  ephemeral or specified port, installs the WS upgrade handler chain, exposes the bound
  port and a weak delegate. `WebSocketServer.swift (L202–289)`
- `HarkdWSAppHandler` (class) — `ChannelInboundHandler` at the tail: decodes inbound
  text frames, runs the server-initiated heartbeat ping, forwards
  connect/message/disconnect to the delegate. `WebSocketServer.swift (L89–184)`
- `WebSocketClient` (class) — per-connection handle wrapping the NIO channel; the
  engine uses it to send/broadcast frames. `WebSocketServer.swift (L52–88)`
- `WebSocketDelegate` (protocol) — called on connect, inbound text, disconnect;
  implemented by the adapter that hops events onto the `EngineSession` actor.
  `WebSocketServer.swift (L40–51)`
- `WireEnvelope` (generic Encodable) — carries `v`, `id`, `type` (`ns.action`),
  ISO-8601-ms timestamp, and a typed payload; every outbound message wraps it.
  `WireProtocol.swift (L51–82)`
- `SegmentPayload` (Encodable) — `segment.partial`/`segment.final` body:
  `utterance_id`, timing, text, speaker, translation. `WireProtocol.swift (L184–212)`
- `MetaModelProgressPayload` (Encodable) — `meta.model_progress`; `fraction` encodes as
  JSON `null` during indeterminate ANE-compile so the UI shows a spinner, not 0%.
  `WireProtocol.swift (L141–160)`
- `CaptureStartCommand` (Decodable) — inbound `capture.start`: source toggles
  (mic/system) and translation request options. `WireProtocol.swift (L417–451)`

**Pinned by tests:** none in this slice.

**Connections**

- ⇐ `imports` [[subsystems/engine-service|EngineService]] (the renderer's WS client; consumer of `engine.types.ts`)
- ⇐ `imports` [[subsystems/retrieval-service|RetrievalService & TranslationJobService]]
- ⇐ `imports` [[subsystems/ui-shell|UI shell]] (app + ask/attendees/meeting-saved/post-meeting/settings components)
- ⇐ `depends_on` / `implements` [[subsystems/engine-harkd|Engine / harkd]] (`HarkdCommand` drives the server; `WSDelegateAdapter` implements `WebSocketDelegate`)

## The envelope

Every message — engine→UI event, UI→engine command, ack, error — carries the same
shape (`WireProtocol.swift`, `WireEnvelope<Payload>`):

```json
{ "v": 1, "id": "uuid-or-null", "type": "ns.action",
  "ts": "ISO-8601-with-ms", "payload": { ... } }
```

- **`v`** — `WIRE_PROTOCOL_VERSION` (currently `1`, `WireProtocol.swift:20`). Bumped
  only on a breaking change; the UI hard-fails on a mismatch. The TS side pins
  `readonly v: 1` so a future bump is a compile error until the renderer is updated.
- **`id`** — correlation ID. Present on UI commands and on the engine's matching
  `ack` / `error` / `rag.results` reply; `null` on unsolicited events. This is how
  request/response is multiplexed over one socket.
- **`type`** — `namespace.action` string the dispatcher switches on
  (`meta.hello`, `capture.start`, `segment.partial`, …).
- **`ts`** — ISO-8601 UTC with milliseconds (`yyyy-MM-dd'T'HH:mm:ss.SSS'Z'`,
  formatted manually because `ISO8601DateFormatter` drops fractional seconds —
  `WireProtocol.swift:32`).
- **`payload`** — the typed body for that `type`.

### snake_case on the wire (the one invariant that hurts)

Swift property names are camelCase (Swift idiom); the **wire form is snake_case**.
The conversion happens at the encoder/decoder, not in the struct:

- Outbound: `encodeWireMessage` sets `keyEncodingStrategy = .convertToSnakeCase`
  (`WireProtocol.swift:69`). So `modelLoaded` → `model_loaded`, `tStart` → `t_start`,
  `notePath` → `note_path`.
- Inbound: `decodeInbound` sets `keyDecodingStrategy = .convertFromSnakeCase`
  (`WireProtocol.swift:96`). So `keep_audio` → `keepAudio`, `session_id` →
  `sessionId`.
- The TS interfaces in `engine.types.ts` therefore use the **snake_case** field
  names verbatim (`readonly model_loaded: string`, `readonly t_start: number`) — they
  describe the wire, not the Swift structs.

Two consequences worth remembering:

- **Dictionary keys and string values are NOT transformed** — only struct *property
  names* are. So `speaker.rename`'s `names: [String:String]` keys (`"Speaker 1"`),
  the `phase`/`state` literal values, summary/translation body strings, all pass
  through verbatim.
- **Optionals serialize as explicit JSON `null`, not dropped keys.** With
  `.convertToSnakeCase` the synthesized encoder would *omit* a nil value, so payloads
  with nullable fields (`SegmentPayload`, `MeetingSavedPayload`, `MeetingSpeaker`,
  `MetaModelProgressPayload`, `RagIndexStatusPayload`) hand-write `encode(to:)` and
  call `encodeNil(forKey:)`. This lets the UI distinguish "absent value" (`null`)
  from "forgotten field". The TS mirror types use `T | null` for exactly these.

### Inbound is decoded in two passes

A command's payload type isn't known until `type` is read, but Swift `Decodable`
needs a static type. So the engine decodes the header first
(`decodeHeader` → `InboundEnvelopeHeader`, `WireProtocol.swift:102`), switches on
`type`, then decodes the typed `payload` (`decodeInbound` → `InboundPayload<T>`).
A payload that doesn't match its declared shape throws → mapped to a
`protocol_mismatch` error frame.

## Frame catalog

### Engine → UI events (`id: null`)

| `type` | Payload struct / TS interface | Notes |
|---|---|---|
| `meta.hello` | `MetaHelloPayload` | First frame on connect — `engine_version`, `protocol_version`, `model_loaded` (`"(loading)"` if the model isn't ready yet), `capabilities[]`. |
| `meta.ready` | `MetaReadyPayload` | Pushed once the model finishes loading; lets an early client drop its "warming up" state without polling. |
| `meta.model_progress` | `MetaModelProgressPayload` | First-run cold-start progress (`phase`, `fraction` nullable, `detail`) while WhisperKit + diarizer download/ANE-compile. Additive; `meta.ready` stays the terminal signal. |
| `meta.heartbeat` | `MetaHeartbeatPayload` | App-level metrics (`rtf_current`, `ring_buffer_fill_sec`). Distinct from NIO's protocol-level ping. |
| `capture.started` | `CaptureStartedPayload` | `session_id`, `sample_rate_hz`, `channels`, `model`, `vad`, `started_at`. |
| `capture.stopped` | `CaptureStoppedPayload` | `session_id`, `duration_sec`. |
| `segment.partial` / `segment.final` | `SegmentPayload` | Same struct both ways. Partials carry only `utterance_id`; finals add the stable `segment_id`. See [[streaming-finalization]]. |
| `segment.superseded` | `SegmentSupersededPayload` | Retraction: drop `utterance_id`; replaced by `superseded_by` (or `""` = stranded orphan, ADR-0019). See below. |
| `warning` | `WarningPayload` | `code` (e.g. `rtf_high`), `message`, `severity`. |
| `error` | `ErrorPayload` | `code`, `message`, `recoverable`, `action`. Also the failure reply to a command (correlated by `id`). |
| `meeting.transcript` | `MeetingTranscriptPayload` | Once at `capture.stop`, JUST BEFORE `meeting.saved` — the deduped, "Speaker N"-labeled utterances exactly as written to the vault, so the UI can replace its messy live partials. See [[diarization]], [[vault-writer]]. |
| `meeting.saved` | `MeetingSavedPayload` | Once after stop+diarize+write — `vault_path`, `audio_path` (nullable, privacy-gated), `speakers[]`, `stats`. See [[audio-store]], [[privacy-data-control]]. |
| `rag.results` | `RagResultsPayload` | Reply to `rag.retrieve` (correlated by `id`): top-K `chunks`, score-descending. See [[rag]]. |
| `rag.index_status` | `RagIndexStatusPayload` | Unsolicited index-build state (`state`, `indexed_count`, `total` nullable). |
| `ack` | `AckPayload` (empty) | Generic success reply; the matching `id` is in the envelope. |

### UI → Engine commands (carry `id` for ack/error correlation)

| `type` | Command struct / TS interface | Notes |
|---|---|---|
| `capture.start` | `CaptureStartCommand` | `sources` (mic/system), `translation`, `language` hint, plus privacy gates `keep_audio` / `remember_speakers` — both default to the privacy-safe `false` when absent (ADR-0027). See [[audio-capture]], [[speaker-enrollment]]. |
| `capture.stop` | (no payload) | Stops the session; triggers the post-stop diarize+write that emits `meeting.transcript` then `meeting.saved`. |
| `bookmark.create` | `BookmarkCreateCommand` | `t` (seconds since start), optional `label`. Replies `bookmark.created`. |
| `speaker.rename` | `SpeakerRenameCommand` | `session_id` + `names` map (current label → new name). Re-renders the saved vault file; plain `ack` / `error`, no dedicated frame. See [[vault-writer]]. |
| `summary.write` | `SummaryWriteCommand` | `session_id` + `summary`. Engine PERSISTS only; the text was generated in Electron main, the egress chokepoint. See [[llm-egress]], [[egress-governance]]. |
| `translation.write` | `TranslationWriteCommand` | `session_id` + `lang` + EITHER `lines[]` (preferred, per-utterance, engine re-renders) OR `translation` (legacy whole blob). Neither → `protocol_mismatch`. See [[translation|translation decisions]], [[retrieval-service]]. |
| `rag.retrieve` | `RagRetrieveCommand` | `query` + optional `k` / `scope`. Engine embeds locally + cosine-ranks; replies `rag.results`. Engine never calls a model. See [[rag]], [[pluggable-retrieval]]. |

> The TS `EngineCommand` union (`engine.types.ts:431`) enumerates the seven sendable
> commands. `meeting.*` and `meta.*` have no command counterpart — they are
> engine→UI only.

### The `segment.superseded` empty-string subtlety

`superseded_by` normally carries the newer `utterance_id` that replaced this one
(ADR-0018). The **empty string `""`** is a distinct meaning (ADR-0019 stranded-partial
fix): "retracted as a stale orphan whose span was already committed under other ids —
no single successor." The engine emits the empty form when a non-finalized,
non-superseded ledger entry is pruned behind the commit watermark (a synthetic
`segment.final` there would re-emit already-committed audio). The UI handler only
deletes `utterance_id` and **ignores** `superseded_by`, so the empty form is safe to
consume identically. Both the Swift and TS docs flag this as a lockstep invariant.

## The transport (Swift NIO)

`engine/Sources/Harkd/WebSocketServer.swift`:

- **`HarkdWebSocketServer.bind(port:)`** — `ServerBootstrap` bound to `host:
  "127.0.0.1"`; pass `0` for an ephemeral port, returns the actually-bound port.
  `TCP_NODELAY` on (caption latency > throughput); one IO thread (one localhost
  client). The bound port is what [[electron-main]] reads from the port file to
  connect (see [[engine-harkd]] / [[engine-service]] for the handshake end-to-end).
- **Loopback-only enforcement** — the bind address *is* the access control. The
  upgrade handler `shouldUpgrade` accepts any HTTP GET and returns empty extra
  headers; no host-header or auth check, because the contract is "loopback only, no
  auth" (ADR-0008 §1). The contract path is `/v1` but the engine does not gate on it
  (a misroute simply yields no WS frames).
- **Handler chain** —
  `HTTPServerProtocolUpgrader → WSFrameDecoder → AggregatingHandler → HarkdWSAppHandler`.
  `HarkdWSAppHandler` (one per channel) maps NIO frame events onto the
  `WebSocketDelegate` (`clientDidConnect` / `clientDidDisconnect` / `clientDidSend`),
  implemented by `EngineSession` in [[engine-harkd]]. On connect the engine
  immediately sends `meta.hello`.
- **One text frame == one JSON message**, UTF-8. Fragmented text frames are
  reassembled (`partialText` accumulator). **Binary frames are silently ignored** —
  the contract is JSON text only, and logging them would be a payload-content leak
  vector.
- **Heartbeats** — NIO protocol-level ping/pong is liveness only (the handler replies
  pong to inbound ping, unmasked, since server→client frames must not be masked).
  App-level metrics ride the separate `meta.heartbeat` frame.
- **`WebSocketClient.send(_:)`** — bytes → `ByteBuffer` → text `WebSocketFrame`,
  flushed on the channel's EventLoop. The engine holds these handles to push frames.

## How it connects to other subsystems

- **[[engine-harkd]]** — owns the server, implements `WebSocketDelegate`, produces
  every engine→UI frame, and consumes every command.
- **[[engine-service]]** — the renderer's WebSocket client; the consumer of
  `engine.types.ts`. Maintains the `utterance_id`-keyed `DisplayedSegment` map and
  `ConnectionState` / `CaptureState` machines defined at the bottom of the types file.
- **[[electron-main]]** — spawns harkd, reads the bound port from the port file, and
  hands the URL to the renderer. The port file (ADR-0008 §"engine.port") is JSON, not
  a bare integer — see [[engine-harkd]].
- **[[rag]]** — the `rag.retrieve` → `rag.results` / `rag.index_status` frames are
  this subsystem's slice of the vault retrieval path.
- **[[streaming-finalization]]** — the `segment.partial` / `segment.final` /
  `segment.superseded` lifecycle and `utterance_id` stability are governed there.
- **[[preload-security]]** — the renderer never touches the socket directly; main
  brokers it behind the contextBridge. The wire's loopback-only stance is part of the
  [[threat-model]] / [[local-first-guarantee]].

## Governing ADRs

- **[ADR-0008](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0008-phase-3-streaming-architecture.md)** (Accepted) —
  chose Swift NIO for the WS server, defined loopback-only / no-auth, the JSON
  envelope, and the original `segment.partial`/`segment.final` model. Full digest:
  [[streaming-finalization-decisions]].
- **[ADR-0009](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0009-utterance-id-overlap-rule-v2.md)** — `utterance_id`
  stability + the mint-fresh-id-on-re-segmentation rule that `segment.superseded`
  exists to retract.
- **[ADR-0018](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0018-utterance-supersession-signal.md)** — the
  `segment.superseded` frame and `superseded_by`.
- **[ADR-0019](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0019-region-based-finalization.md)** — the empty-string
  `superseded_by` stranded-partial semantics.
- **[ADR-0036](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0036-grow-in-place-finalization.md)** — grow-in-place
  finalization (latest in the finalization line; see [[streaming-finalization]]).
- **ADR-0027** — the `keep_audio` / `remember_speakers` privacy gates carried by
  `capture.start`. See [[privacy-egress]], [[privacy-data-control]].
- **ADR-0029 / ADR-0031** — summary/translation are generated at the Electron-main
  egress chokepoint, then handed to the engine via `summary.write` /
  `translation.write` for vault persistence only. See [[egress-governance]].
- **ADR-0032 / ADR-0033** — the `rag.*` frames. See [[vault-rag-decisions]].

> The catalog's source-of-truth pointer in both code files is
> `vault/docs/design/08-websocket-api-contract.md`, which lives in the user's vault
> (outside this repo). The ADRs above are the in-repo canonical decisions.

## Invariants (must stay true)

1. **The Swift structs and the TS interfaces are a lockstep pair.** A frame "exists"
   only when the Swift `Encodable`/`Decodable` *and* its TS interface *and* both
   handlers agree. Use the `add-wire-frame` skill / harkd-wire-expert agent when
   touching either side so none of the four edit points drifts.
2. **camelCase in Swift, snake_case on the wire, snake_case in TS.** The conversion is
   the encoder's job (`.convertToSnakeCase` / `.convertFromSnakeCase`), never manual.
3. **Nullable fields serialize as explicit JSON `null`, never as dropped keys** —
   hand-written `encode(to:)` + `encodeNil` on every payload with optionals.
4. **`v` is pinned.** `WIRE_PROTOCOL_VERSION = 1` in Swift, `readonly v: 1` in TS; a
   bump is a deliberate, coordinated breaking change and the UI hard-fails on
   mismatch.
5. **Loopback only, no auth.** The server binds `127.0.0.1`; the bind address *is* the
   access control. No non-loopback connection is ever accepted (ADR-0008 §1).
6. **No payload content is ever logged.** `WireProtocol.swift` and
   `WebSocketServer.swift` log only lifecycle (connect/close/error) to stderr — never
   message bytes. Binary frames are dropped without logging. This upholds the
   [[threat-model]] hard rules.
7. **String values and dictionary keys pass through untransformed** — only struct
   property names get snake_cased. Body text (summaries, translations), `phase`/
   `state` literals, and rename map keys are verbatim.

## See also

[[engine-harkd]] · [[engine-service]] · [[electron-main]] · [[rag]] ·
[[streaming-finalization]] · [[glossary]]
