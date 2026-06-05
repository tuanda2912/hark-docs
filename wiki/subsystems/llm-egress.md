---
type: subsystem
title: LLM provider layer & egress governance
status: current
sources: [ADR-0029, ADR-0030, ADR-0031, ADR-0035, ADR-0037, ui/src/main/llm/index.ts, ui/src/main/llm/provider.ts, ui/src/main/llm/anthropic.ts, ui/src/main/llm/openai-compatible.ts, ui/src/main/llm/keystore.ts, ui/src/main/llm/redaction.ts, ui/src/main/llm/cloud-log.ts, ui/src/main/llm/types.ts]
updated: 2026-06-05
tags: [privacy, llm, egress, electron, main]
---

The **only** outbound-network surface for user content in the whole app, living
**entirely in the Electron main process**. A provider-agnostic layer (Anthropic-native
+ OpenAI-compatible, raw `fetch`, **no vendor SDK**) where the first decision on every
call is **local-loopback (zero egress) vs cloud (regex + known-name redaction)**. Keys
are encrypted at rest via `safeStorage`; every action — cloud *or* local — appends one
**metadata-only** entry to `cloud-calls.json` and **never** the content.

## Code map

> Grounded in the understand-anything graph (commit `8efdfde`, 2026-06-05, code-only).

**Layer:** Privacy & LLM Egress.

**Files:**

- `ui/src/main/llm/index.ts` — orchestrator for all main-process LLM operations: config/key management, summarize, whole-transcript and per-segment translation, this-meeting/vault Q&A, enforcing the redact-before-cloud and metadata-only logging egress discipline.
- `ui/src/main/llm/provider.ts` — defines the `LlmProvider` abstraction (`testConnection`/`complete`/`stream`), the shared request/result types, network timeout constants, and a factory that builds the concrete provider from config.
- `ui/src/main/llm/anthropic.ts` — Anthropic Messages API provider using Node's built-in `fetch` (no vendor SDK), exposing `testConnection` and a non-streaming `complete()` with content-free, status-derived error messages.
- `ui/src/main/llm/openai-compatible.ts` — OpenAI-compatible chat-completions provider over a configurable `baseUrl`, covering cloud endpoints (OpenAI/Gemini/OpenRouter) and local loopback servers (Ollama/LM Studio/llama.cpp) with optional auth.
- `ui/src/main/llm/redaction.ts` — PII redactor that collapses emails, phones, money, numbers, URLs, and known roster names to category placeholders before cloud egress, returning the redacted text plus per-category counts.
- `ui/src/main/llm/keystore.ts` — per-provider API key store encrypting secrets at rest via Electron `safeStorage`, persisted with restrictive file permissions; the plaintext key never crosses the contextBridge (ADR-0030).
- `ui/src/main/llm/cloud-log.ts` — persists a rolling, metadata-only activity log of cloud/local LLM calls to app data via atomic rename, capped at a max entry count so transcript content is never written.
- `ui/src/main/llm/types.ts` — locked main-process IPC contract for the LLM subsystem: provider config/status, summarize/translate/ask request and result shapes, redaction counts, and the metadata-only cloud-call log entry.

**Key types & functions:**

- `isLocalEgress` (`index.ts` L212–225) — determines whether a config's endpoint is a loopback (localhost) target, which means zero egress and skips redaction.
- `setConfig` (`index.ts` L91–109) — validates untrusted IPC config input, persists the non-secret LLM config to `prefs.json`, returns the recomputed status.
- `testConnection` (`index.ts` L148–168) — decrypts the stored key, builds the configured provider, runs its cheap live validation call, returns a content-free ok/detail result.
- `summarize` (`index.ts` L244–336) — markdown meeting summary: redacts transcript for cloud (full-text local), calls the provider, appends a metadata-only cloud-log entry.
- `translate` (`index.ts` L374–467) — translates an assembled transcript to a target language with the same redact-on-cloud / full-on-local discipline and logging.
- `recordLiveTranslate` (`index.ts` L520–553) — accumulates per-segment live-translation metadata into a rolling aggregate, flushing to the cloud log when provider/egress changes so the 500-entry log isn't flooded.
- `translateSegment` (`index.ts` L599–667) — translates a single finalized live segment, redacting the line on cloud, recording it into the aggregated live-translate roll-up rather than logging per call.
- `ask` (`index.ts` L762–904) — answers a question grounded in the meeting transcript or retrieved vault chunks, redacting both the question and each grounding text for cloud egress, logging metadata only.
- `logCloudCall` (`index.ts` L919–942) — builds a timestamped, metadata-only `CloudCallLogEntry` from call parameters and appends it to the persistent log.
- `makeProvider` (`provider.ts` L108–126) — factory constructing the concrete `LlmProvider` (Anthropic or OpenAI-compatible) from config + optional decrypted key, using lazy requires to break a circular import.
- `detailForStatus` (`provider.ts` L134–151) — maps a numeric HTTP status to a short, content-free, human-readable detail string so error messages never leak bodies or secrets.
- `AnthropicProvider` (`anthropic.ts` L29–220) — `LlmProvider` for `api.anthropic.com` using `x-api-key` auth; `testConnection` + `complete()`, extracting assistant text and mapping non-ok HTTP to status-derived errors.
- `OpenAiCompatibleProvider` (`openai-compatible.ts` L28–211) — `LlmProvider` targeting any `/v1/chat/completions`-style endpoint; normalizes the base URL, probes the models endpoint, performs a non-streaming `complete()` with status-derived errors.
- `redact` (`redaction.ts` L76–118) — runs the category detectors plus known-name substitution and returns the redacted string with per-category and total replacement counts.
- `getKey` (`keystore.ts` L118–134) — decrypts and returns the stored API key via `safeStorage`, returning `undefined` when no key exists or encryption is unavailable.
- `setKey` (`keystore.ts` L141–149) — encrypts a provider's key via `safeStorage` and writes it to disk, throwing `KeyStorageUnavailableError` when OS encryption is unavailable.
- `readStore` (`keystore.ts` L54–85) — reads and parses the encrypted key store, tolerating a missing/corrupt file by returning an empty store.
- `writeStore` (`keystore.ts` L89–103) — persists the key store atomically with `0600` permissions (temp-file write, chmod, rename) so secrets are never world-readable mid-write.
- `KeyStorageUnavailableError` (`keystore.ts` L30–35) — error thrown when `safeStorage` is unavailable, signaling a key cannot be securely stored.
- `appendCloudCall` (`cloud-log.ts` L116–128) — appends one `CloudCallLogEntry`, trims the log to capacity, writes it back atomically, swallowing errors so logging never breaks an LLM call.
- `normalizeEntry` (`cloud-log.ts` L71–98) — coerces an untrusted on-disk value into a well-formed `CloudCallLogEntry`, defaulting missing/malformed fields so reads never throw.
- `readFile` (`cloud-log.ts` L41–66) — reads and parses the cloud-log file, tolerating a missing or corrupt file by returning an empty, normalized entry list.

**Pinned by tests:** none in the slice.

**Connections:**

- ⇐ imports [[subsystems/electron-main|Electron main]] (`main.ts` → `index.ts` / `types.ts`)
- ⇐ imports [[subsystems/preload-security|Preload security]] (`preload.ts` → `types.ts`)
- imports → [[subsystems/electron-main|Electron main]] (`index.ts` → `prefs.ts`)

## What it does

Five Phase-6 user actions route through this layer: meeting **summary**, this-meeting
**Q&A**, **vault-scope Q&A** (RAG-grounded), whole-transcript **translation**, and a
now-dormant per-segment **live translation**. All of them are text-in / text-out and
all of them share one egress discipline (`ui/src/main/llm/index.ts`):

1. **Resolve config** from `prefs.llm` (provider + model + optional `baseUrl`).
2. **Fork on egress** — `isLocalEgress(config)`: an `openai-compatible` provider whose
   `baseUrl` hostname is `localhost` / `127.0.0.1` / `::1` is **local**; everything else
   (Anthropic always, or a remote OpenAI-compatible base) is **cloud**. An
   unparseable/missing `baseUrl` is treated as **cloud** — the safe default, never
   under-redact.
3. **Local** → send the full text as-is, **zero egress**, redaction counts all zero.
   **Cloud** → `redact(text, knownNames)` first, send only the redacted text.
4. **Decrypt the key** (main-only) and inject it into the provider auth header.
5. **Call the provider** via `complete()` (raw `fetch`).
6. **Log one metadata-only entry** to `cloud-calls.json` — lengths, redaction total,
   egress kind, status — **never the transcript, prompt, answer, or key**.

The renderer never makes any of these calls: it goes over IPC to main, which is the
single chokepoint. See [[llm-service]] for the renderer-side facade and [[preload-security]]
for why the key can never cross the bridge.

## Key files

- `ui/src/main/llm/index.ts` — the main-process facade. Owns `getStatus` / `setConfig` /
  `setApiKey` / `clearApiKey` / `testConnection` and the action functions `summarize`,
  `ask` (meeting **and** vault scope), `translate`, `translateSegment`. The single place
  that ever calls `keystore.getKey` to decrypt a key. `computeConfigured` encodes the
  locked contract: `anthropic` needs `hasKey && model`; `openai-compatible` needs
  `baseUrl && model` (**key optional** — a local endpoint needs none). `isLocalEgress`
  lives here and is the egress fork.
- `ui/src/main/llm/provider.ts` — the `LlmProvider` interface (`testConnection`,
  `complete`, an unimplemented `stream` stub) + `makeProvider` factory +
  `detailForStatus` (HTTP-status → short, **body-free** message) + the three timeout
  constants (`LLM_REQUEST_TIMEOUT_MS` 15s discovery, `LLM_COMPLETE_TIMEOUT_MS` 60s
  interactive, `LLM_LONG_COMPLETE_TIMEOUT_MS` 10min for whole-transcript ops on a slow
  local model).
- `ui/src/main/llm/anthropic.ts` — `AnthropicProvider`. `POST https://api.anthropic.com/v1/messages`,
  `x-api-key` + `anthropic-version: 2023-06-01`. Prompt-caches the stable system block
  (`cache_control: { type: 'ephemeral' }`).
- `ui/src/main/llm/openai-compatible.ts` — `OpenAiCompatibleProvider`. `testConnection`
  probes `GET {baseUrl}/models`; `complete` posts `{baseUrl}/chat/completions`.
  `Authorization: Bearer <key>` attached **only when a key exists**, so a no-auth local
  Ollama / LM Studio / llama.cpp endpoint works. Covers cloud (OpenAI / OpenRouter /
  Gemini-compat) and local backends with one class.
- `ui/src/main/llm/keystore.ts` — `safeStorage`-encrypted key store (ADR-0030).
- `ui/src/main/llm/redaction.ts` — the pure regex + known-name redactor (ADR-0031 §2).
- `ui/src/main/llm/cloud-log.ts` — the metadata-only `cloud-calls.json` writer (§4).

## Provider abstraction — no SDK, raw fetch (ADR-0029)

`LlmProvider` has two implementations behind `makeProvider(config, key?)`. **No vendor
SDK** (`@anthropic-ai/sdk`, `openai`) — Node's built-in global `fetch` against the
documented REST endpoints. The reason is privacy and audit surface: SDKs carry possible
telemetry + native/transitive deps + supply-chain surface; raw `fetch` keeps the egress
small, auditable, and free of any new socket beyond the one the user invoked. The cost,
accepted in the ADR, is that we parse SSE streaming ourselves if/when `stream()` lands
(today it throws `notImplemented`).

**Why main, not the engine, not the renderer:**

- **Not the engine** — `harkd` is the audited "never opens an outbound socket" process
  and the most privileged (holds TCC audio). Adding an HTTP client there is the wrong
  place. See [[engine-harkd]] / [[threat-model]].
- **Not the renderer** — keeps the renderer CSP loopback-only with **no per-provider
  domain whitelisting**, and the **API key never enters the renderer / DevTools
  context**. See [[preload-security]].

`detailForStatus` is shared by both providers so failure messages are provably
**body-free**: `401/403 → "Invalid API key"`, `404 → "Model not found"`, `429 → rate
limited`, `≥500 → "Provider error (n)"`, else `"HTTP n"`. It deliberately does **not**
use `res.statusText`, because the OpenAI-compatible provider points at arbitrary
user-configured endpoints and a hostile server could stuff content into the status line.
Both providers concatenate response text tolerantly (`extractText` returns `''` on a
malformed body rather than surfacing it) and abort via `AbortController` on timeout.

## Key storage — safeStorage, main-only (ADR-0030)

`keystore.ts` encrypts the API key with Electron **`safeStorage`** (on macOS the
encryption key is derived from the **Keychain**) and stores the base64 ciphertext in
`~/Library/Application Support/Hark/llm-keys.json` — a file **separate from
`prefs.json`** so a credential never sits in the config file. One entry per provider, so
a user can keep an Anthropic key and an OpenAI key and switch without re-entering.

Hard invariants (privacy-audited surface):

- **`getKey()` decrypts only in main**, only to inject into a provider's `Authorization`
  / `x-api-key` header at call time. It is **never** bridged to the renderer
  ([[preload-security]]). The renderer can `setApiKey` / `clearApiKey` / read
  **`hasKey: boolean`** — but can **never read the key back**.
- The key is **never logged**, plaintext or ciphertext.
- If `safeStorage.isEncryptionAvailable()` is false → **throw** `KeyStorageUnavailableError`
  and write **nothing**. We **never** fall back to plaintext; the action surfaces a clear
  "Key storage unavailable" instead.
- Writes are atomic-ish (temp-file + rename, `chmod 0600` best-effort), mirroring the
  prefs writer.
- A ciphertext bound to a different app identity / machine fails to decrypt → treated as
  **no key** (the accepted ADR-0030 "negative"), not a leak.

`keytar` (native Keychain module) was **rejected** — extra native dep to build / codesign
/ notarize; `safeStorage` is built into Electron and already uses the Keychain.

## Egress governance — local-vs-cloud, redaction, the log (ADR-0031)

**1. Local vs cloud is the first fork** (above) — local sends the full text, zero
egress, full quality; cloud redacts first.

**2. Redaction (`redaction.ts`, cloud only, ON by default).** A **pure** string→string
function — never logs, never persists, never touches the network. Regex passes run in a
**load-bearing fixed order** so categories don't double-count: `url` → `email` → `money`
(`$/€/£/¥`) → `phone` (≈7+ digits) → `number` (`\b\d{7,}\b` for IDs/cards/accounts) →
`name`. Names are the meeting's **known speaker display-names** (from the roster),
de-duped, sorted longest-first, word-boundary + case-insensitive, collapsed to `[name]`.
Returns per-category counts that drive the on-screen receipt + the log.

**3. Honest limitation — no overclaim.** Arbitrary names spoken in free text are **not**
auto-detected (**no NER yet** — that's BACKLOG). The receipt + log state exactly what was
redacted and must not imply more. ADR-0031 §3 is explicit about this gap.

**4. Cloud-call log (`cloud-log.ts`, transparency).** Every action — **cloud and local**
— appends one `CloudCallLogEntry` to `~/Library/Application Support/Hark/cloud-calls.json`:
`{ ts, action, provider, model, egress: 'cloud'|'local', inChars, outChars,
redactionTotal, status, detail? }`. **Metadata only — there is no transcript / prompt /
response / key field on the shape at all.** `inChars` is the length of the text *actually
sent* (the redacted text, for cloud). Local actions are logged too (`egress: 'local'`) so
the user sees the full picture. Capped to the most recent **500** entries; atomic-ish
write; a write failure is logged content-free, **never** thrown (a failed log write must
not lose a summary the user actually got). Surfaced in Settings → Privacy. See
[[privacy-data-control]].

**5. Never sent:** audio, voiceprints — only (redacted-if-cloud) transcript text. Main
has **no audio path** into a provider (rules #1, #5).

**6. Persistence goes through the engine.** Summaries / translations main generates are
written to the meeting `.md` by the **engine** ([[vault-writer]]) via wire commands
(`summary.write`, `translation.write`) — main **never** writes the vault behind the
engine's back (ADR-0031 §6). Two writers to the sacred vault would break the single-owner
git rule (#4).

### Per-action specifics

- **`summarize`** — fork; cloud redacts the whole transcript; `LLM_LONG_COMPLETE_TIMEOUT_MS`;
  logs `action: 'summary'`.
- **`ask`** — meeting **or** vault scope. The **question is user content too**, so on the
  cloud path the question and the transcript (or **each** retrieved vault chunk) are
  redacted **independently** and their counts **summed** into the receipt. Vault scope
  builds a numbered `[1] … [2] …` Sources block (`buildVaultUserMessage`) the model cites
  against; logs `action: 'qa'` or `'qa-vault'`. Vault chunks come from the engine's local
  RAG index — see [[external-rag-client]] / [[rag]] / [[retrieval-service]].
- **`translate`** — whole-transcript, structure-preserving, line-for-line; cloud redacts;
  `LLM_LONG_COMPLETE_TIMEOUT_MS`; logs `action: 'translate'`.
- **`translateSegment`** — one finalized caption line; same fork. Does **not** log
  per-call (a long meeting would flood the 500-cap and evict the summary/qa rows that
  matter); instead it accumulates into an in-memory roll-up (`recordLiveTranslate`)
  flushed as **one** `action: 'translate-live'` entry (`flushLiveTranslate`) — summed
  in/out chars + redaction total + a content-free line **count** in `detail`. Flushed on:
  a provider/model/egress change, a 50-line threshold, the renderer's stop signal, **before
  any other LLM action** (so the log stays chronological — note `summarize`/`ask`/`translate`
  all call `flushLiveTranslate()` first), and on `before-quit`. Accepted gap (LOW): a hard
  crash between flushes drops ≤~49 lines of **metadata** — the egress already happened; only
  the local accounting is lost, **never content**.

## Status — live translation is dormant (ADR-0035 → ADR-0037)

`translateSegment` and the `translate-live` roll-up are the **superseded-in-part**
remnant of live per-segment translation. **ADR-0035** introduced opt-in per-finalized-line
LLM translation (Option C — reuse this layer; reject a 3.2 GB NLLB model and the
SwiftUI-only Apple `TranslationSession`). **ADR-0037** then **removed the live feature**
(timeout-prone on small local models, churny against the finalization watermark) and made
translation an **on-demand, post-stop action only**: the renderer-side `LiveTranslationService`
was deleted and the Translate panel rewired to a structured background job that calls
`translateSegment` per utterance and persists a mirrored `## Transcript — <lang>` section.

**The main-process plumbing here is deliberately left DORMANT, not deleted** —
`translateSegment` + `flushLiveTranslate` still exist so reviving live translation later
is cheap. The post-stop job reuses them; ADR-0037 notes the aggregated entry still uses
the `translate-live` label (accurate-enough metadata; refine if it confuses). See
[[translation]] and [[retrieval-service]] (the `TranslationJobService` orchestrator).

> TODO(wiki): `LlmProvider.stream()` is still an unimplemented stub — all actions use the
> non-streaming `complete()`. Streaming the summary over IPC with backpressure is an
> ADR-0029 open question, not yet built.

## How it connects to other subsystems

- **[[electron-main]]** — registers the `ipcMain.handle` channels that delegate straight
  to `index.ts`; hosts `flushLiveTranslate()` on `before-quit`.
- **[[preload-security]]** — the contextBridge exposes `setApiKey` / `clearApiKey` /
  `hasKey` and the action invokers, but **never** a key-read. This layer's main-only key
  decrypt is the reason the bridge surface is shaped that way.
- **[[llm-service]]** — the renderer-side `LlmService` facade that calls these over IPC
  and renders the egress receipt.
- **[[external-rag-client]]** / **[[rag]]** / **[[retrieval-service]]** — vault-scope Q&A
  redacts each retrieved chunk here before a cloud send; the `TranslationJobService`
  drives the post-stop translation job through `translateSegment`.
- **[[vault-writer]]** — receives the generated summary / translation as plain markdown to
  persist (ADR-0031 §6); main never writes the vault directly.
- **[[engine-harkd]]** — stays network-free; emits only original transcript text, never
  translates for arbitrary targets, and persists what main generates.
- **[[translation]]** — the decision-digest covering ADR-0035/0037 (live → on-demand).
- **[[egress-governance]]** / **[[threat-model]]** / **[[local-first-guarantee]]** /
  **[[privacy-data-control]]** — the cross-cutting concepts this subsystem embodies.

## Governing ADRs

- **[ADR-0029](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0029-llm-provider-layer-egress.md)** (Accepted) — LLM calls
  originate in **Electron main**, never the engine, never the renderer; provider-agnostic
  (`LlmProvider` × {Anthropic, OpenAI-compatible}); **no vendor SDK** (raw `fetch`); the
  single egress chokepoint; user-invoked only; every call logged metadata-only; text-only
  (no audio path); local = zero egress.
- **[ADR-0030](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0030-api-key-storage.md)** (Accepted) — API key encrypted via
  **`safeStorage`** (macOS Keychain-derived), main-only, in `llm-keys.json` separate from
  `prefs.json`; renderer gets `hasKey` only; fail-closed if encryption unavailable;
  `keytar` rejected.
- **[ADR-0031](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0031-content-egress-redaction-log.md)** (Accepted) —
  local-vs-cloud fork; cloud redaction (regex + known-name collapse, ON by default);
  honest "no NER" limitation; the metadata-only `cloud-calls.json` log; summary persisted
  **through the engine**.
- **[ADR-0035](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0035-live-translation-arbitrary-target.md)** (**Superseded in
  part** by [ADR-0037](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0037-defer-live-translation.md) — the *live* portion)
  — per-segment LLM translation of finalized segments reusing this layer (Option C);
  deferred NLLB + Apple Translation. The post-stop structured path it introduced is
  retained.
- **[ADR-0037](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0037-defer-live-translation.md)** (Accepted) — **removed live
  translation**, made translation on-demand post-stop only; `translateSegment` + the
  aggregated cloud-log are left **dormant** in main for cheap revival.

Digest pages: [[privacy-egress]] (0027/0028/0029/0030/0031), [[translation]] (0035/0037).

## Invariants (must stay true)

1. **Single chokepoint.** Every outbound LLM byte of user content passes through
   `ui/src/main/llm/index.ts` in **main**. The engine never opens an outbound socket; the
   renderer never makes a cloud call (CSP unchanged, loopback-only).
2. **Text only.** Main has **no audio path** into a provider. Audio + voiceprints never
   leave (rules #1, #5).
3. **User-invoked only.** No background / automatic calls — every egress traces to an
   explicit user action.
4. **Local = zero egress.** A loopback OpenAI-compatible endpoint sends the full text
   with **no redaction**; nothing leaves the Mac. An unparseable/missing `baseUrl` defaults
   to **cloud** (never under-redact).
5. **Cloud always redacts.** Anthropic and any remote OpenAI-compatible base run
   `redact()` first. The question and each vault chunk are redacted independently in Q&A.
6. **Key isolation.** The key is decrypted **only in main**, only into an auth header at
   call time; never bridged to the renderer, never logged (plaintext or ciphertext), never
   in `prefs.json`. Fail-closed if `safeStorage` is unavailable — never plaintext.
7. **Metadata-only logging.** `cloud-calls.json` (and provider `console.log` lines) carry
   lengths, counts, ids, status — **never** a transcript, prompt, response, body, or key.
   `detailForStatus` failure messages are derived from the numeric HTTP status only.
8. **No vendor SDK / no new socket.** Raw `fetch` to documented REST endpoints; the only
   outbound socket is the user-configured provider endpoint, opened only on an explicit
   action (rule #6).
9. **Vault writes stay single-owner.** Main never writes the vault; generated text is
   handed to the engine to persist (ADR-0031 §6).

## See also

[[electron-main]] · [[preload-security]] · [[llm-service]] · [[external-rag-client]] ·
[[egress-governance]] · [[threat-model]] · [[local-first-guarantee]] ·
[[privacy-data-control]] · [[translation]] · [[privacy-egress]] · [[vault-writer]] ·
[[glossary]]
