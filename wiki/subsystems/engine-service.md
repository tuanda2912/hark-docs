---
type: subsystem
title: EngineService — renderer WebSocket client
status: current
sources: [ADR-0009, ADR-0010, ADR-0017, ADR-0018, ADR-0019, ADR-0020, ADR-0027, ADR-0036, ui/src/app/services/engine.service.ts, ui/src/app/services/engine.types.ts]
updated: 2026-06-05
tags: [ui, engine, protocol, signals, state]
---

The renderer's single owner of the harkd WebSocket: it parses each envelope, projects
engine state into Angular signals, maintains a `utterance_id`-keyed segment Map
(partial upsert / final flip / superseded delete / `meeting.transcript` swap), sends
fire-and-forget commands, runs the one `rag.retrieve` request/reply with a 15 s
timeout, and owns the speaker→color mapping.

## Code map

_Grounded in the understand-anything graph (commit 8efdfde, 2026-06-05, code-only)._

**Layer:** UI Renderer (Angular).

**Files:**

- `ui/src/app/services/engine.service.ts` — core service managing the WebSocket
  connection to the harkd Swift sidecar: dispatches wire frames into signals (capture,
  heartbeat, segments, bookmarks, meeting-saved), sends commands, and handles RAG
  retrieval round-trips.

**Key types & functions:**

- `EngineService` (class, Lx179–886) — injectable engine bridge: connects to harkd over
  WebSocket, exposes reactive signals for connection/capture/transcript state, sends
  capture/bookmark/rename/summary/translation commands, and resolves RAG retrieval
  requests.

**Pinned by tests:** none in slice.

**Connections** (this is a hub — ~21 raw cross-edges collapse to these):

- _Depended on by the UI shell_ — ⇐ imports/calls [[subsystems/ui-shell|UI shell]]
  (`app.component`, `attendees-panel`, `meeting-saved-toast`, `post-meeting-review`,
  `settings-panel`, `speaker-tagging`, `summary-panel`, `translate-panel`).
- _Depended on by retrieval/translation orchestrators_ — ⇐ imports/calls
  [[subsystems/retrieval-service|RetrievalService & TranslationJobService]]
  (`retrieval.service`, `translation-job.service`).
- _Speaks the wire contract_ — imports → [[subsystems/wire-protocol|Wire protocol]]
  (`engine.types.ts`).
- _LLM payload types_ — imports → [[subsystems/llm-service|LlmService]] (`llm.types.ts`).
- _Persisted prefs (privacy gates)_ — imports → [[subsystems/ui-shell|UI shell]]
  (`preferences.service.ts`).

## What it does

`EngineService` is a `providedIn: 'root'` Angular `@Injectable` — the renderer's one
client of the harkd loopback WebSocket ([[wire-protocol]]). ADR-0010 §5 fixed this
shape: the **renderer connects to the WebSocket directly** (browser-native
`WebSocket`), keeping all protocol logic in one place rather than forwarding frames
over IPC from Electron main. The service comment puts it in Java/Spring terms: a
`@Service` with two concerns — connection lifecycle (a `WebSocketHandler`) and a
derived in-memory projection (a denormalized read model).

It does five things:

1. **Connect** — discover the port via the preload-exposed `window.hark.getEnginePort()`
   ([[preload-security]], [[electron-main]]), open `ws://127.0.0.1:<port>/v1`, and only
   transition to `connected` once the server's `meta.hello` arrives (proves protocol
   compatibility).
2. **Parse + dispatch** — `dispatchFrame` JSON-parses each text frame into a
   `WireEnvelope` and `switch`es on `env.type`.
3. **Project state into signals** — connection, capture, heartbeat, hello, readiness,
   model-progress, last-error, RAG index status, bookmarks, last-meeting-saved.
4. **Maintain the segment Map** — the `utterance_id`-keyed read model the live
   transcript renders from.
5. **Send commands + the one request/reply** — fire-and-forget UI→engine commands, plus
   the single id-correlated `rag.retrieve` exchange.

It also owns the **speaker→color** mapping, shared so the Attendees panel and the
transcript agree on a speaker's color.

The service is consumed by the [[ui-shell]] (the transcript panel, top bar, Attendees,
Ask, meeting-saved card) and orchestrated alongside [[llm-service]] and
[[retrieval-service]].

## Key files

- `ui/src/app/services/engine.service.ts` — the service itself.
- `ui/src/app/services/engine.types.ts` — the TypeScript envelope + payload + command
  types, a hand-maintained byte-for-byte mirror of `engine/Sources/Harkd/WireProtocol.swift`
  (snake_case on the wire). See [[wire-protocol]] for the contract and the four-edit-point
  discipline.

## The segment Map — the live read model

The heart of the service is `segmentsMap: Map<string, DisplayedSegment>`, keyed by
`utterance_id`. Angular signals can't observe a `Map` mutation, so the service pairs it
with a `_segmentsTick` counter signal: handlers mutate the map then bump the tick, and a
`computed()` `segments()` signal reads the tick and returns
`Array.from(map.values()).sort((a,b) => a.tStart - b.tStart)` — the ordered list the
`@for` transcript renders. Four operations write the map:

### 1. Partial upsert / final flip (`applySegment`)

`segment.partial` and `segment.final` both carry a `SegmentPayload` and both route
through `applySegment(payload, isFinal)`. Semantics are **replace-by-`utterance_id`**:

- A new `utterance_id` adds a row.
- A later partial with the *same* `utterance_id` overwrites it in place — the live line
  grows where it sits. This stability across partial→partial→final is the engine's
  `UtteranceLedger` guarantee (ADR-0009: max-denominator overlap rule, fresh ID only on a
  materially different shape — see [[streaming-finalization]] and [[diarization]] for
  the engine side).
- A `segment.final` with that id mutates the row and flips `isFinal: true`. By contract
  `segment.final` is **terminal** — no further partial with that id arrives (ADR-0009
  §Assumptions; preserved by the region-commit watermark, ADR-0019).

> The live partial/final lifecycle the UI relies on is owned by the engine's
> finalization model. ADR-0019 (region-based, finalize each audio region once behind a
> `committedUpTo` watermark) and ADR-0036 (export-only grow-in-place) are **engine-side
> and additive to this path**: ADR-0036 explicitly does *not* re-broadcast a grown
> `segment.final`, so a finalized live line **never rewrites under the user** — the
> grown tail reaches only the saved transcript and the post-stop swap. From
> EngineService's seat, finals stay discrete; "live clean, export recovers it."

### 2. Superseded delete (`segment.superseded`)

`segment.superseded` carries `{ utterance_id, superseded_by }` (ADR-0018). The handler
**deletes** `utterance_id` from the map and bumps the tick; it **ignores
`superseded_by`** — the replacement utterance arrives (or already has) via its own
`segment.*` frames through the normal upsert path. The delete is **idempotent**: a
delete for an id the map no longer holds is a no-op (`Map.delete` returns `false`, so the
tick isn't even bumped), satisfying ADR-0018's "idempotent and order-tolerant on the UI
side" invariant. `superseded_by === ""` (a stranded orphan with no single successor,
ADR-0019's stranded-partial fix) is handled identically because the handler only ever
deletes the retracted id. Under ADR-0019 this signal is now a **backstop** — region-commit
means it should fire rarely or never for finals.

### 3. Post-stop transcript swap (`meeting.transcript` → `applyMeetingTranscript`)

Emitted once at `capture.stop`, just before `meeting.saved` (ADR-0021 era; see
[[vault-writer]]). Live `segment.final` frames ship `speaker: null` because diarization
([[diarization]], ADR-0017) is a **post-stop batch pass**, so the live transcript has no
speaker labels. On `meeting.transcript` the service **clears the map and repopulates it**
from `payload.utterances`, each row keyed by its stable `u.id`, set `isFinal: true`, with
the diarization-assigned `speaker` set. This swaps the messy live partials/dupes for the
deduped, labeled transcript that matches the saved vault file, so every on-screen line
shows its speaker. The payload has no `t_end`/`language`/`translation`, so the service
synthesizes `tEnd = tStart` (the line is point-anchored for sort/bookmark range) and
nulls language/translation. View-only — connection and capture state are untouched.

### 4. Clear (`clearTranscript`)

The "New meeting" / clear-screen reset: clears the segment map (+ tick), the bookmark
list, the retained `meeting.saved` card, and the last-error banner. It does **not** touch
the socket, readiness, or capture state, and never touches vault files. It runs
automatically at the top of `startCapture()` so a previous meeting's segments don't bleed
into the new session — but pause/resume must **not** call it (only `startCapture` begins a
new session).

## Engine state → signals

`dispatchFrame` projects engine frames onto read-only signals the UI binds to:

| Signal | Set by | Notes |
|---|---|---|
| `connection` | open/close, `meta.hello` | `idle → connecting → connected → disconnected/error`. `connected` only on `meta.hello`. |
| `capture` | `capture.started` / `capture.stopped`, command optimism | `idle → starting → running → stopping`. An `error` mid-`starting` reverts to `idle`. |
| `heartbeat` | `meta.heartbeat` | RTF + ring-buffer fill (powers a health indicator). |
| `hello` | `meta.hello`, kept fresh by `meta.ready` | engine version, protocol version, model name, capabilities. |
| `ready` | `meta.ready`, or `meta.hello` when `model_loaded !== "(loading)"` | gates the Start affordance; reset to `false` on socket close so a reconnect re-gates. |
| `modelProgress` | `meta.model_progress` | drives the "Preparing Hark" cold-start overlay; cleared on `meta.ready` and on close (see [[ui-onboarding]]). |
| `lastError` | `error` (non-RAG) | inline error banner; cleared when capture starts again. |
| `ragIndexStatus` | `rag.index_status` | Ask-panel vault-index indicator (`building`/`ready`); reset to `null` on close (see [[rag]], [[retrieval-service]]). |
| `bookmarks` | `bookmark.created` | per-session bookmark list. |
| `lastMeetingSaved` | `meeting.saved` | retained roster + stats + `vault_path` + `audio_path`, so a late-mounting component still shows the saved card. |

Signals carry *latest-value* state; an RxJS `Subject` carries *discrete events* signals
would collapse — `errors$`, `warnings$`, `bookmarkCreated$`, `meetingSaved$`. `ack` is
received but currently only structurally acknowledged (v1 ignores it beyond the
request/reply correlation below). Unknown `type`s are ignored for forward compatibility.

On socket **close** the handler re-gates everything that a stale connection must not
leave lingering: `ready → false`, `modelProgress → null`, `ragIndexStatus → null`, and it
**rejects every in-flight `rag.retrieve`** (their reply can never arrive).

## Commands — fire-and-forget + the one request/reply

All UI→engine commands go through `send(cmd, id?)`, which guards `socket.readyState ===
OPEN` (pushing a `NOT_CONNECTED` onto `errors$` otherwise) and `JSON.stringify`s the
frame. The fire-and-forget commands:

- **`startCapture`** — builds the `capture.start` payload. Defaults both sources on
  (`mic`/`system`), forwards an optional `language`, and **always** sends the privacy
  gates `keep_audio` + `remember_speakers` from the user's persisted choice (ADR-0027,
  [[privacy-data-control]]) — defaulting to `false` (privacy-first; absent reads as false
  engine-side anyway). `translateToEnglish` adds a `translation: { enabled, mode: 'live',
  target_lang: 'en' }` block. Calls `clearTranscript()` first, then sets `capture` to
  `starting`.
- **`stopCapture`**, **`createBookmark`** — trivial pushes.
- **`renameSpeakers`** (`speaker.rename`, ADR-0020) — `{ session_id, names }`; no-op for an
  empty map. Followed by an **optimistic** local update (below). The engine `ack`s on
  success and emits an `error` on failure via the existing channel — there is no
  dedicated success frame (ADR-0020 §Negative).
- **`writeSummary`** (`summary.write`), **`writeTranslation`** / **`writeTranslationLines`**
  (`translation.write`) — persist generated content back through the engine, which is the
  sole vault writer ([[vault-writer]]); orchestrated by [[llm-service]] /
  [[retrieval-service]].

### The one request/reply: `rag.retrieve` (15 s timeout)

The socket is otherwise fire-and-forget; `retrieve(query, opts)` is the **single
request/reply exchange** (ADR-0032/0033 era, see [[rag]]). It mints a unique id
(`rag-${++ragSeq}`), parks a `{ resolve, reject, timeout }` in `pendingRag`, and sends the
`rag.retrieve` frame **with** that envelope id. Resolution paths:

- `rag.results` with the matching id → resolve with `payload.chunks` (`takePendingRag`
  clears the timeout and unparks).
- An **id-correlated** `error` frame → reject *that* promise, and **stop** — a scoped
  failure (e.g. `RAG_UNAVAILABLE`) the Ask panel renders inline, deliberately **not**
  pushed to the global `errors$`/`lastError` banner.
- **Timeout** after `RAG_RETRIEVE_TIMEOUT_MS = 15_000` → reject `vault search timed out`
  (a cold-built index query is sub-second; 15 s is a generous ceiling so a hung engine
  surfaces an honest error, not a stuck spinner).
- **Socket close** → `rejectAllPendingRag` fails all in-flight retrievals.

`retrieve` rejects synchronously if the socket isn't `OPEN`, and short-circuits an empty
query to `[]`. The id-correlation key is the same envelope `id` mechanism the wire
protocol uses for `ack` ([[wire-protocol]]).

## Optimistic speaker rename

`applyOptimisticRename(sessionId, names)` reflects a `speaker.rename` **before** the
engine acks, so every reader of `lastMeetingSaved()` (Attendees panel, saved card)
updates reactively. It is the **single source of truth** for the optimistic update —
surfaces must not keep a divergent copy. A `session_id` guard enforces ADR-0020's MVP
scope (**only the most-recently-saved meeting is renameable**); a mismatched id is a no-op
on both roster and transcript. It does two things:

1. **Roster** — for each renamed speaker, advance both `label` and `matched_name` to the
   new name (so a follow-up edit's key is the new name, matching the engine's own
   relabeling).
2. **Displayed transcript** — relabel every segment whose `speaker` was renamed, so the
   on-screen lines (and their colors) move with the roster.

If the engine later rejects, an `error` frame arrives on the existing channel — this is an
optimistic projection, not a guarantee.

## Speaker → color (single source of truth)

One mapping shared by the Attendees panel and the transcript so a speaker's color matches
everywhere within a meeting. `speakerColorFor(label)` returns `var(--sp-N)` cycling six
muted palette tokens (`--sp-1`..`--sp-6`), keyed by `speakerIndexFor(label)`:

- **Roster order wins** — the label's index in `lastMeetingSaved().speakers`. Because a
  rename advances the roster `label` *and* the relabeled transcript rows carry that same
  new label, both still resolve to the same palette slot after a rename.
- **Fallback** (no roster yet, or a label not in it) — first-appearance order among the
  displayed segments (sorted by `tStart`), so the live transcript still colors
  consistently before any `meeting.saved` roster exists.
- A `null` label returns `var(--text-3)`.

## How it connects to other subsystems

- **[[wire-protocol]]** — the only contract this service speaks; `engine.types.ts` is the
  TS half. Every frame here mirrors a Swift `WireProtocol.swift` type.
- **[[electron-main]] / [[preload-security]]** — supply the engine port and the
  `window.hark` bridge (LLM, RAG, prefs, tray, mic permission). EngineService never makes
  a direct network call beyond the loopback WS.
- **[[ui-shell]]** — consumes the signals + `Subject`s to render the transcript, top bar,
  Attendees, Ask, and saved card.
- **[[llm-service]] / [[retrieval-service]]** — orchestrators that call `retrieve(...)`
  (vault chunks) and the `*.write` commands; egress goes through main's `llm.*`, never
  this service ([[egress-governance]]).
- **[[diarization]]** — its post-stop labels arrive as `meeting.transcript` / the
  `meeting.saved` roster; this service swaps and relabels.
- **[[tray]]** — fed via `setTrayState` / `onTrayAction` (defined on `window.hark`).

## Governing ADRs

- **ADR-0010** ([Phase 4 UI scaffold](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0010-phase-4-ui-scaffold.md)) — Angular
  21 + signals + `EngineService` holding the WS; renderer connects directly to the socket.
- **ADR-0009** ([utterance-id overlap rule v2](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0009-utterance-id-overlap-rule-v2.md))
  — the `utterance_id` stability the upsert/final keying relies on; `segment.final` is
  terminal.
- **ADR-0018** ([supersession signal](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0018-utterance-supersession-signal.md))
  — the `segment.superseded` retraction the delete-handler implements (idempotent).
- **ADR-0019** ([region-based finalization](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0019-region-based-finalization.md))
  — region-commit watermark; makes supersession a backstop; live partial/final flow
  unchanged. Source of the `superseded_by === ""` stranded-orphan case.
- **ADR-0036** ([export-only grow-in-place](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0036-grow-in-place-finalization.md))
  — engine-side, deliberately **no live re-broadcast**: a finalized live line never
  rewrites; completeness lands in the saved transcript / the `meeting.transcript` swap.
- **ADR-0017** ([offline diarization pipeline](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0017-diarization-offline-pipeline.md))
  — why live `segment.final` ships `speaker: null` and labels arrive post-stop.
- **ADR-0020** ([post-save speaker relabeling](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0020-post-save-speaker-relabeling.md))
  — `speaker.rename` + the optimistic update + the most-recent-meeting-only MVP scope.
- **ADR-0027** ([privacy & data-control model](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0027-privacy-data-control-model.md))
  — `keep_audio` / `remember_speakers` gates always sent from the user's persisted choice,
  default false.

## Invariants

- **One socket, one owner.** EngineService is the renderer's sole WebSocket client; all
  protocol logic lives here (ADR-0010).
- **`connected` only on `meta.hello`.** Opening the socket isn't enough — the hello frame
  proves protocol compatibility.
- **Segment map is keyed by `utterance_id`.** Partial = upsert, final = upsert + flip
  `isFinal`, superseded = delete, `meeting.transcript` = clear + repopulate.
- **`segment.final` is terminal**, and (post-ADR-0036) a finalized live line never rewrites
  — grown tails reach only the saved/post-stop transcript.
- **Superseded delete is idempotent**; `superseded_by` is ignored (incl. `""`).
- **`rag.retrieve` is the only request/reply.** Everything else is fire-and-forget; a
  RAG-scoped `error` rejects its promise and never hits the global banner.
- **All in-flight RAG promises are rejected on socket close** (and on timeout) — no hung
  spinners.
- **Privacy gates are always sent explicitly** from the user's persisted choice, never
  silently defaulted on the wire (ADR-0027).
- **`applyOptimisticRename` is the single source of truth** for the optimistic rename;
  the `session_id` guard scopes it to the most-recently-saved meeting (ADR-0020 MVP).
- **One speaker→color mapping** shared across surfaces; roster order wins, first-appearance
  is the fallback.

## See also

[[wire-protocol]] · [[ui-shell]] · [[llm-service]] · [[retrieval-service]] ·
[[streaming-finalization]] · [[diarization]] · [[ui-onboarding]] · [[glossary]]
