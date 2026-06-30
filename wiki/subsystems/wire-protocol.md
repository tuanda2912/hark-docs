---
type: subsystem
title: WebSocket wire protocol (engine ↔ UI)
status: current
sources: [docs/design/08-websocket-api-contract.md, docs/decisions/0024-onscreen-transcript-back-annotation.md, docs/decisions/0022-first-run-model-load-progress.md]
updated: 2026-06-30
tags: [wire-protocol, websocket, engine, ipc, contract]
---

# WebSocket wire protocol (engine ↔ UI)

The localhost WebSocket between the Swift engine ([[streaming-daemon]]) and the Electron UI
([[ui-renderer]]). It is the **only** IPC channel between them — kept disciplined so both sides
don't drift (`docs/design/08-websocket-api-contract.md`).

## Connection
- Endpoint `ws://127.0.0.1:{PORT}/v1`; port is ephemeral, written to
  `~/Library/Application Support/Hark/engine.port`, read by the UI (see [[preload-security]]).
- **No auth** — loopback only; the engine rejects non-loopback connections.
- JSON, one message per frame, UTF-8. UI reconnects with exponential backoff (200ms → 5s cap).

## Envelope
Every message: `{ v, id, type, ts, payload }`. `v` is the protocol version (hard-fail on mismatch via
`meta.protocol_mismatch`); `id` correlates request/response (`null` for unsolicited events); `type` is
a dot-namespaced action (`docs/design/08-websocket-api-contract.md` §Message envelope).

## Directions
- **UI → Engine = commands** (verbs): `capture.start`, `capture.stop`, `capture.pause`/`resume`,
  `bookmark.create`, `speaker.rename`. Acked with `ack` or `error{code,message}`.
- **Engine → UI = events**: `capture.started`/`stopped`, `segment.partial` (in-progress, replaced in
  place), `segment.final` (locked at VAD boundary), `term.detected`, `warning`, `error`
  (`docs/design/08-websocket-api-contract.md` §Message catalog).

## Diarization is post-stop
Live `segment.final` always ships `speaker: null` — diarization runs as a batch pass at stop. The
engine then fires **`meeting.transcript`** once (just before `meeting.saved`) carrying the deduped,
`"Speaker N"`-labeled utterances, byte-for-byte the vault body; the UI treats it as a **full
replacement** of the displayed transcript (`0024`; contract §`meeting.transcript`). `meeting.saved`
carries the roster + `vault_path` + stats; `speaker.rename` re-renders that file post-save.

## Cold-start readiness
`meta.hello` reports `model_loaded` (`"(loading)"` until ready); `meta.ready` is the **terminal**
readiness signal the UI gates Start on; `meta.model_progress` (additive, throttled, snapshot-replayed
to late clients) drives the first-run loader — determinate bar when `fraction` is numeric, spinner
when `fraction` is explicit `null` (`0022`; contract §Meta). `meta.heartbeat` runs every 5s; 3 missed
⇒ dead connection.

## Deliberately NOT on the wire
Audio, speaker embeddings, Claude API calls, and vault file contents. Claude egress is owned by
[[electron-main]] directly (engine = audio, main = network); the UI reads vault files via Node `fs`
(`docs/design/08-websocket-api-contract.md` §What is NOT in this protocol). See [[local-first-egress]].
