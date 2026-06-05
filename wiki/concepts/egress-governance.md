---
type: concept
title: Egress governance
status: current
sources: [ADR-0029, ADR-0030, ADR-0031, ADR-0034, ui/src/main/llm/index.ts, ui/src/main/rag/loopback.ts]
updated: 2026-06-05
tags: [privacy, llm, egress, security]
---

# Egress governance

> All outbound LLM bytes pass through a single chokepoint in **Electron main** (raw
> `fetch`, no SDK): a **cloud** call redacts PII and writes a metadata-only
> `cloud-calls.json` receipt; a **loopback/local** model is **zero egress**; the
> **renderer** never networks and never reads the key; the **engine** stays
> network-free.

This is the concept that makes [[threat-model|CLAUDE.md rule #1]] (*"audio/content
leaves the machine only through an explicit, user-invoked path"*) and the
[[local-first-guarantee]] enforceable rather than aspirational. Every byte of user
content that *can* leave goes through one auditable place.

## The four invariants

1. **One process owns egress — Electron main.** LLM calls originate in the Node main
   process, *never* the Swift engine and *never* the sandboxed renderer (`ADR-0029`).
   The engine ([[engine-harkd]]) keeps its audited "never opens an outbound socket"
   property; the renderer keeps its loopback-only CSP. Main is handed *text only* — it
   has **no audio path** to a provider, so audio + voiceprints never leave (rules #1,
   #5).
2. **Local = zero egress; cloud = redacted + logged.** The first fork on every action
   is local-vs-cloud (`ADR-0031` §1). A **local** provider (OpenAI-compatible pointed
   at a loopback host) gets the **full transcript, no redaction** — it never leaves the
   Mac. A **cloud** provider gets PII-redacted text only.
3. **The renderer never networks and never reads the key.** The renderer calls main
   over IPC and gets results streamed back; it can `setApiKey`/`clearApiKey`/query
   `hasKey: boolean` but can **never read the key back** across the bridge (`ADR-0030`,
   and see [[preload-security]]).
4. **Every outbound action is logged — metadata only.** Every summarize / Q&A /
   translate (cloud *or* local) appends one entry to `cloud-calls.json`: timestamp,
   action, provider, model, `egress: cloud|local`, char counts in/out, redaction total,
   status. **Transcript content is NEVER logged** (`ADR-0031` §4).

## How a cloud call flows (chokepoint internals)

The chokepoint is `ui/src/main/llm/index.ts` — the comment at its head states the
invariant outright: *"Per ADR-0029, EVERY outbound LLM byte passes through here."*
Each action (`summarize`, `ask`, `translate`, `translateSegment`) follows the same
discipline:

1. **Decide egress** — `isLocalEgress(config)` returns true only for an
   `openai-compatible` provider whose `baseUrl` host is `localhost` / `127.0.0.1` /
   `::1`. Anthropic is always cloud; an unparseable / missing `baseUrl` is treated as
   **cloud** — the safe default, *never under-redact*.
2. **Decrypt the key in main only** — `keystore.getKey(provider)`; the plaintext stays
   in scope, is injected into the provider's `Authorization` / `x-api-key` header, and
   is **never logged, never returned** (`ADR-0030`).
3. **Fork: redact or pass-through** — cloud goes through `redact(text, knownNames)`;
   local sends as-is with all-zero redaction counts. For `ask`, the *question* is user
   content too, so on the cloud path both question and transcript (or each vault chunk)
   are redacted independently and their counts summed into the receipt.
4. **Call via raw `fetch`** — `makeProvider(config, key).complete(...)`. **No vendor
   SDK** (`ADR-0029`) — avoids SDK telemetry + supply-chain surface and keeps the egress
   small and auditable; the cost is parsing SSE streaming ourselves.
5. **Log metadata only** — `logCloudCall(...)` stamps a `CloudCallLogEntry` with
   lengths and the redaction total — `inChars` is the length of the text *actually
   sent* (redacted, for cloud), never the raw content. On error it logs a
   `status: 'error'` entry (no content) and returns a content-free `{ ok: false, detail }`.

## What gets redacted (cloud only, v1)

Regex-replaced with typed placeholders (`ADR-0031` §2): emails, phone numbers,
money/currency amounts, long digit runs (≥ 7 digits → IDs / cards / accounts), URLs,
plus the meeting's **known speaker display-names** collapsed to their roster labels
(`"Tuan"` → `"Speaker 1"`). The system prompts tell the model to preserve placeholders
like `[name]` / `[email]` / `[amount]` verbatim.

> **Honest limitation (do not overclaim):** arbitrary names spoken in free text are
> **not** auto-detected — there's no NER yet (`ADR-0031` §3). The on-screen receipt and
> the activity log state exactly what was redacted and must not imply more. Full NER
> name redaction is BACKLOG. See [[privacy-data-control]].

## Live per-segment translation — the roll-up exception

`translateSegment` (per [[translation]], ADR-0035) follows the same egress fork but does
**not** write one log entry per line — that would flood the 500-entry log cap on a long
meeting and churn the JSON file every finalized line. Instead it accumulates a
metadata-only in-memory roll-up (`recordLiveTranslate`) flushed to ONE `translate-live`
entry — on provider/model/egress change, on a 50-line threshold, when the renderer
signals live translation stopped, before any other LLM action (chronological order), and
on app quit. Still **metadata only**: summed lengths, redaction total, and a content-free
line count in `detail`.

## External RAG: the loopback guard

The same egress discipline covers the **external retrieval backend** ([[external-rag-client]],
`ADR-0034`). Retrieval *results are vault content flowing back into Hark*, so a remote
backend would put vault content on the network. The external client lives in main
(`ui/src/main/rag/`), is hand-rolled with raw `fetch` (no MCP SDK — same no-SDK grain as
`ADR-0029`), and gates every request behind `assertLoopbackEndpoint` in
`ui/src/main/rag/loopback.ts`: before *any* `fetch`, the endpoint host MUST be
`localhost` / `127.0.0.1` / `::1` (the same host set as `isLocalEgress`). A non-loopback
or unparseable endpoint is **refused with a content-free error — it never reaches the
network**. The backend only does *local retrieval* and **never sees the API key**; the
downstream redact → LLM → log path is untouched regardless of backend (built-in
retrieves in the engine, external in main — see [[pluggable-retrieval]]).

## Where this is embodied

| Aspect | Lives in |
|---|---|
| Egress chokepoint, raw-fetch provider layer, redaction fork, cloud log | [[llm-egress]] · `ui/src/main/llm/index.ts` |
| Renderer-side facade (IPC only, never networks, never reads key) | [[llm-service]] |
| Key storage (`safeStorage` / Keychain, main-only, `hasKey` across bridge) | `ADR-0030` · [[preload-security]] |
| Engine stays network-free (no outbound socket) | [[engine-harkd]] |
| Loopback-guarded external retrieval client | [[external-rag-client]] · `ui/src/main/rag/loopback.ts` |
| Decision history | [[privacy-egress]] |

## Governing ADRs

- [ADR-0029](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0029-llm-provider-layer-egress.md) — egress originates in
  main, provider-agnostic, raw `fetch` / no SDK, single chokepoint. **Accepted.**
- [ADR-0030](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0030-api-key-storage.md) — API key in Electron `safeStorage`
  (Keychain), main-only, never readable by the renderer. **Accepted.**
- [ADR-0031](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0031-content-egress-redaction-log.md) — local-vs-cloud fork,
  PII redaction (cloud only), metadata-only `cloud-calls.json` log. **Accepted.**
- [ADR-0034](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0034-external-retrieval-transport.md) — external retrieval is
  a loopback-guarded raw-`fetch` client in main (no MCP SDK). **Accepted.**

Related: [ADR-0027](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0027-privacy-data-control-model.md) (privacy model),
[ADR-0033](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0033-pluggable-retrieval-backend.md) (pluggable backend),
[ADR-0032](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0032-vault-rag-architecture.md) (built-in RAG). See also
[[glossary]] for *egress*, *redaction*, *cloud-call log*, *loopback*.
