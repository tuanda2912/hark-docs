---
type: subsystem
title: LlmService — renderer model-provider facade
status: current
sources: [ADR-0029, ADR-0031, ADR-0035, ADR-0037, ui/src/app/services/llm.service.ts, ui/src/app/services/llm.types.ts]
updated: 2026-06-05
tags: [llm, privacy, renderer, egress, translation]
---

A thin, signals-based renderer facade over `window.hark.llm` that **never makes a
network call and never reads back a stored API key**. It consumes an `LlmStatus`
(`configured` / `hasKey` / `config`) and result objects from main, exposes
`summarize` / `translate` / `ask` / `translateSegment`, and **degrades gracefully**
(every bridge call is guarded for `window.hark?.llm`, so `configured()` stays
`false`) when run outside Electron (`ng serve`, no preload).

## Code map

> Grounded in the understand-anything graph (commit `8efdfde`, 2026-06-05, code-only).

- **Layer:** UI Renderer (Angular).
- **Files:**
  - `ui/src/app/services/llm.service.ts` — service wrapping the Claude/LLM bridge for
    summarization, translation (batch and per-segment), in-meeting Q&A, connection
    testing, and credential/config management.
  - `ui/src/app/services/llm.types.ts` — type definitions for the LLM bridge:
    provider/config shapes, summary and translation results, redaction receipts, ask
    responses, and cloud call-log entries.
- **Key types & functions:**
  - `class LlmService` (`llm.service.ts`, L34–305) — injectable LLM facade exposing
    reactive status/summary/translation signals and async methods (summarize,
    translate, translateSegment, ask, test) backed by the hark preload bridge.
- **Pinned by tests:** none in this slice.
- **Connections:**
  - ⇐ imports/calls [[subsystems/ui-shell|UI shell]] (`app.component.ts`,
    `settings-panel.component.ts`, `summary-panel.component.ts`,
    `translate-panel.component.ts`, `meeting-saved-toast.component.ts` — also imports
    `llm.types.ts`)
  - ⇐ imports/calls [[subsystems/retrieval-service|RetrievalService & TranslationJobService]]
    (`translation-job.service.ts`)
  - ⇐ imports [[subsystems/engine-service|EngineService]] (imports `llm.types.ts`)

## What it does

`LlmService` (`ui/src/app/services/llm.service.ts`, `@Injectable({ providedIn: 'root' })`)
is the renderer's read model for the LLM provider. The provider HTTP, the API key,
the cloud/local fork, PII redaction, and the cloud-call log all live in the Electron
**main** process (the single egress chokepoint — [[llm-egress]], `ADR-0029`). This
service is the sandboxed-renderer projection of that: it ships text **down** to main
over IPC and reads non-secret **status + results** back. It is the Java/Spring
analogue of a `@Service` wrapping a remote client and exposing a read model the UI
binds to.

Two hard properties, both load-bearing for the threat model ([[threat-model]]):

- **No network from the renderer.** Every method delegates to `window.hark.llm.*`;
  the renderer CSP stays loopback-only and nothing here opens a socket (`ADR-0029`).
- **The key never round-trips back.** `setApiKey(key)` sends a key *down* to main
  (which encrypts it via `safeStorage` — key storage is `ADR-0030`, see
  [[privacy-data-control]]); the renderer only ever learns the resulting
  `hasKey: boolean` from the returned `LlmStatus`. The key never enters the
  renderer/DevTools context.

### Status projection (signals)

A single private `signal<LlmStatus | null>` (`_status`) holds the latest snapshot
from main; three `computed` signals project it:

- `configured` — `_status()?.configured ?? false`. **Computed by main and consumed
  as-is** (the renderer does NOT re-derive it). This is the gate the Ask panel reads.
- `hasKey` — drives the "key saved" indicator.
- `config` — the current non-secret `LlmConfig` (`provider`, `model`, optional
  `baseUrl`), or `null`.

The `?? false` / `?? null` defaults are exactly what makes it degrade gracefully
outside Electron: with no preload, `refresh()` is a no-op, `_status` stays `null`,
and `configured()` stays `false` rather than throwing.

### Actions

| Method | Sends main | Returns | In-flight signal | Result signal |
|---|---|---|---|---|
| `summarize(req)` | transcript text + `knownNames` | `SummarizeResult` | `summarizing` | `summary` |
| `translate(req)` | transcript text + `targetLang` + `knownNames` | `TranslateResult` | `translating` | `translation` |
| `ask(req)` | `question` + (`transcript` \| `context[]`) + `knownNames` | `AskResult` | `asking` | — (transient) |
| `translateSegment(req)` | ONE line + `targetLang` | `TranslateSegmentResult` | — | — |

Conventions shared by all four: text only ever crosses (never audio/voiceprints —
rules #1/#5); each **resolves a result, never throws** (`{ ok: false, detail }` on
any failure, including the no-bridge case) so a panel only ever renders a result;
each toggles its in-flight signal in a `finally`. `summarize`/`translate` retain
their result in a signal (with `resetSummary()` / `resetTranslation()` to clear a
stale prior-meeting value when a panel reopens); `ask` is **transient** (the answer
is not retained in a service signal and nothing is persisted this slice).

Connection plumbing: `refresh()` (pull initial status — called fire-and-forget in
the constructor), `setConfig()`, `setApiKey()`, `clearApiKey()` (each stores the
returned status), and `test()` (probes the provider, toggling `testing` around the
call and storing the verdict in `testResult`).

### Cloud-call log (read-only)

`cloudLog: signal<CloudCallLogEntry[]>` mirrors main's `cloud-calls.json`, refreshed
via `refreshCloudLog()`. Every entry is **metadata only** — `ts`, `action`,
`provider`, `model`, `egress: 'cloud' | 'local'`, in/out **char counts**,
`redactionTotal`, `status` — **never transcript content** (`ADR-0031`). Both cloud
and local actions are recorded (local marked `egress: 'local'`) so the user sees the
full picture. Surfaced read-only in Settings → Privacy. This is the renderer face of
[[egress-governance]].

## Key files

- `ui/src/app/services/llm.service.ts` — the facade (signals + bridge calls).
- `ui/src/app/services/llm.types.ts` — the IPC contract types, kept in lockstep with
  main's bridge in `ui/src/main/**` (a field "exists" only if both sides agree).
  Defines `LlmProviderId` (`'anthropic' | 'openai-compatible'`), `LlmConfig`,
  `LlmStatus`, `LlmTestResult`, the `*Req`/`*Result` shapes (results discriminated on
  `ok`), `RedactionCounts`, and `CloudCallLogEntry`.

## How it connects

- **[[preload-security]] → `window.hark.llm`** is the contextBridge surface this
  service calls; everything is guarded for its absence.
- **[[llm-egress]]** is the main-process other half — provider HTTP, key
  `safeStorage`, the cloud/local fork, redaction, and the cloud-call log. This
  service holds none of that; it is a pure projection.
- **[[ui-shell]]** consumes the status signals (the Settings provider panel, the Ask
  panel's `configured` gate, the privacy activity-log view).
- **[[retrieval-service]]** — `TranslationJobService` is the **only** caller of
  `translateSegment` / `flushLiveTranslate` today (the post-stop background job,
  below). `RetrievalService` feeds `ask(req)` its `context[]` for vault-scope Q&A.
- **[[engine-service]]** is the separate WebSocket client to `harkd`; it persists
  results to the vault (the engine is the single vault writer / git owner —
  `ADR-0031` §6). `LlmService` itself never writes the vault.
- **[[engine-harkd]]** stays **network-free** — it only emits original transcript
  text and never translates for arbitrary targets (`ADR-0029`, `ADR-0035`).

## `translateSegment` / `flushLiveTranslate` — the post-stop survivors

These two methods were built for **live** per-segment translation (`ADR-0035` §3:
translate each finalized caption into a non-English target via the LLM, since
WhisperKit's on-device `.translate` only produces English). `ADR-0037` **superseded
the live portion** — the `→ EN` toggle, the arbitrary-target picker, the per-line
live binding, and the `LiveTranslationService` orchestrator were all removed.

What remains: `translateSegment` is now driven **only** by `TranslationJobService`
([[retrieval-service]]), the on-demand **post-stop** background job that translates
the saved transcript one utterance at a time. `flushLiveTranslate()` commits main's
in-memory per-line egress roll-up to **one aggregated** metadata-only cloud-log entry
(never one row per line — that would flood the 500-entry cap), called when the job
finishes or aborts. The method names still say "live" — a documented, accurate-enough
metadata label, not a live path (`ADR-0037` Consequences #3). See [[translation]] for
the decision history.

> Note: the `llm.types.ts` doc comment on `TranslateSegmentReq` still describes the
> *live* bilingual-view use (`ADR-0035`); the actual caller is the post-stop job per
> `ADR-0037`. The type shape is unchanged.

## Governing ADRs

- [ADR-0029](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0029-llm-provider-layer-egress.md) — LLM calls originate in
  Electron main, never the renderer/engine; key isolated in main; renderer CSP
  unchanged. (Accepted.)
- [ADR-0031](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0031-content-egress-redaction-log.md) — local-vs-cloud fork,
  PII redaction (cloud only), metadata-only cloud-call log. (Accepted.)
- [ADR-0035](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0035-live-translation-arbitrary-target.md) — per-segment LLM
  translation + the `translateSegment` path. (**Superseded in part** by ADR-0037 — the
  live portion; the post-stop path is retained.)
- [ADR-0037](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0037-defer-live-translation.md) — live translation removed
  and deferred; translation is on-demand post-stop only. (Accepted — implemented,
  on-device confirmation pending.)

Related: `ADR-0030` (key `safeStorage` — see [[privacy-data-control]]).

## Invariants (must stay true)

1. **No network call from this service.** Every method delegates to
   `window.hark.llm.*`; the renderer never opens a socket (`ADR-0029`).
2. **The API key never round-trips back to the renderer.** `setApiKey` only sends
   down; only `hasKey` (a boolean in `LlmStatus`) comes back (`ADR-0029`/`ADR-0030`).
3. **Text only — never audio or voiceprints.** Every `*Req` carries transcript/line
   text and language/name hints; no audio path exists (rules #1/#5).
4. **`configured` is consumed, not re-derived.** Provider readiness is main's
   computation; the renderer reads the flag as-is (`llm.types.ts`).
5. **Graceful degradation.** Every bridge call is guarded for `window.hark?.llm`;
   outside Electron actions resolve `{ ok: false }` and `configured()` stays `false`.
6. **Actions resolve, never throw.** Callers always get a result object to render.
7. **`llm.types.ts` stays in lockstep with main.** A field exists only if both the
   renderer type and the main bridge agree (see [[wire-protocol]] for the analogous
   harkd↔UI lockstep rule).
8. **The cloud-call log is metadata only — never content** (`ADR-0031`), and live
   per-utterance egress is aggregated into one entry via `flushLiveTranslate`.

See also [[glossary]] for terms (`egress`, `utterance_id`, redaction categories).
