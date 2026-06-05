---
type: concept
title: Threat model & privacy hard rules
status: current
sources: [CLAUDE.md, ADR-0004, ADR-0027, ADR-0029, ADR-0030, ADR-0031]
updated: 2026-06-05
tags: [privacy, threat-model, egress, security]
---

**Privacy is the product, not a feature.** Hark exists because its author doesn't trust
closed-source binaries listening to work calls — so the entire architecture is bent around
six non-negotiable rules. They live in `CLAUDE.md` ("Hard rules"), and every privacy ADR
either restates or operationalises one of them. This page is the index from each rule to the
subsystems and ADRs that *enforce* it.

> These are the same six rules verbatim in `CLAUDE.md`. The wiki digests them; the canonical
> text is `CLAUDE.md`. If a subsystem appears to violate one, the subsystem is wrong — not the
> rule.

## The six rules

### 1. Audio never leaves the machine — except one explicit, user-invoked LLM path

Transcription is 100% on-device (WhisperKit); there is **no cloud ASR, ever, for any reason**
([ADR-0004](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0004-no-cloud-asr.md)). The *only* outbound path for user content is
the Electron-main LLM layer for **summary**, **Q&A**, and **high-quality translation** — and
**only** when the user explicitly invokes the action. Even there, only **transcript text**
crosses the boundary; **audio never does** ([ADR-0029](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0029-llm-provider-layer-egress.md)).
The Swift engine `harkd` is audited **loopback-only and never opens an outbound socket**, so it
*cannot* be the leak. Embodied by [[llm-egress]], [[egress-governance]], [[engine-harkd]];
see [[local-first-guarantee]].

### 2. Nothing sensitive is written outside the vault

Transcripts, audio, and PII live only in `~/Documents/vault/hark`. Models cache + app data go
in `~/Library/Application Support/Hark/`. The vault is the **single writer's** territory: the
engine's [[vault-writer]] (`engine/Sources/Harkd/VaultWriter.swift`) is the *only* component
that writes meeting markdown — even an LLM summary is persisted by handing it back to the engine
via a `summary.write` wire command, never by main writing the vault behind the engine's back
([ADR-0031](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0031-content-egress-redaction-log.md) §6). The one deliberate exception
is **credentials**: the encrypted API key lives in app-data (`llm-keys.json`), not the vault —
it's a credential, not user content ([ADR-0030](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0030-api-key-storage.md)).
Embodied by [[vault-writer]], [[audio-store]].

### 3. No telemetry, no analytics, no content-exfiltrating crash reporters

Local-only logs are fine. This is why the LLM layer uses **raw `fetch` against documented REST
endpoints — no vendor SDK** — to avoid third-party SDK telemetry and supply-chain surface
([ADR-0029](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0029-llm-provider-layer-egress.md)). The cloud-call activity log
(`cloud-calls.json`) records **metadata only** — timestamp, action, provider, model, char
counts, redaction total, status — and **never the transcript content itself**
([ADR-0031](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0031-content-egress-redaction-log.md) §4). Embodied by
[[llm-egress]], [[egress-governance]], [[privacy-egress]].

### 4. The vault is sacred — never auto-deleted or auto-rewritten

All changes to vault files go through **git commits** so history is recoverable. Hark never
silently deletes or rewrites a user's notes. Centralising writes in [[vault-writer]] is the
mechanism: one owner, one git history. This is why ADR-0031 routes summaries through the engine
rather than letting Electron main append to markdown directly — two writers to a "sacred" store
would bypass the git-commit owner ([ADR-0031](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0031-content-egress-redaction-log.md)).
Embodied by [[vault-writer]].

### 5. Speaker enrollment data stays local

Voice embeddings in `vault/.speakers/` **never go to any API**. They are biometric
special-category data (GDPR; BIPA), so storing them at all is **opt-in** — the engine stores or
matches voiceprints **only when `capture.start` carries `remember_speakers: true`**, defaulting
false; absent flag ⇒ nothing sensitive stored
([ADR-0027](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0027-privacy-data-control-model.md)). Voiceprints are gitignored (never
travel via a vault git remote) and the LLM layer has **no path** to send them
([ADR-0029](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0029-llm-provider-layer-egress.md): "Audio + voiceprints never leave").
Embodied by [[speaker-enrollment]], [[privacy-data-control]].

### 6. Any new network socket needs an ADR

No silent network calls. Before adding any dependency that opens a network socket, it must be
documented as an ADR. The first — and so far only — outbound network in the app is the LLM
egress, and it got [ADR-0029](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0029-llm-provider-layer-egress.md) plus a pre-merge
privacy audit precisely because of this rule. Embodied by [[egress-governance]],
[[privacy-egress]].

## The three sensitive artifacts (the data-control matrix)

[ADR-0027](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0027-privacy-data-control-model.md) classifies everything Hark can store
and pins each to a default. This is rules #2 + #5 made concrete:

| Artifact | Purpose | Stored | Synced |
|---|---|---|---|
| Transcript (markdown) | the meeting notes | always (the product) | the user's vault, their choice |
| **Audio recording** | verify-by-ear playback | **opt-in** (`keep_audio`) — off by default | off by default |
| **Voiceprint** (`vault/.speakers/`) | recognise speakers across meetings | **opt-in** (`remember_speakers`) — off by default | off by default |

Both opt-ins are surfaced as an explicit informed-consent step at onboarding and toggleable in
**Settings → Privacy**, with delete actions. The `capture.start` flags default `false`, so a
skipped onboarding stores nothing sensitive. See [[privacy-data-control]], [[audio-store]],
[[speaker-enrollment]].

## How egress is actually governed

Rules #1/#3 are enforced at one chokepoint: **every outbound LLM byte goes through Electron
main's provider layer**, never the engine, never the sandboxed renderer
([ADR-0029](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0029-llm-provider-layer-egress.md)). On every call the first fork is
**local vs cloud** ([ADR-0031](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0031-content-egress-redaction-log.md)):

- **Local** provider (OpenAI-compatible on a `localhost` / `127.0.0.1` base URL) → full
  transcript, **no redaction, zero egress** — it never leaves the Mac.
- **Cloud** provider (Anthropic, or a remote OpenAI-compatible base) → **redact before send**:
  regex placeholders for emails, phones, money, long digit runs (≥7), URLs, plus collapsing the
  meeting's **known speaker display-names** to their labels.

Honest limitation, not overclaimed: arbitrary names in free speech are **not** auto-detected
(no NER yet) — the on-screen receipt and the log say exactly what was redacted, and no more
([ADR-0031](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0031-content-egress-redaction-log.md) §3). The API key is encrypted at
rest via Electron `safeStorage` (macOS Keychain), **decrypted only in main**, and the renderer
can only query `hasKey` — it can never read the key back across the bridge
([ADR-0030](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0030-api-key-storage.md)). See [[egress-governance]], [[llm-egress]],
[[preload-security]].

## Why this is defensible (not just nice)

Per [ADR-0004](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0004-no-cloud-asr.md), the no-cloud-ASR stance removes a class of
compliance objections — PDPA, GDPR, corporate group-recording policies, healthcare/legal
privilege — so users in regulated industries can use Hark where they can't use Otter / Granola /
Fireflies. "Audio never leaves your Mac" is the single sentence that differentiates Hark; cloud
ASR would make it a lie. The whole pipeline is open-source on the user's machine and auditable.

## Invariants (must stay true)

- `harkd` opens **no outbound socket** — loopback WebSocket only.
- The **only** content egress is Electron main's LLM layer, **text only**, **user-invoked only**.
- **Audio + voiceprints never** cross a network boundary, period — no code path exists.
- Nothing sensitive is written outside `~/Documents/vault/hark` (credentials in app-data are the
  one allowed credential-not-content exception).
- Vault mutations go through **one writer** ([[vault-writer]]) and a **git commit**; never
  auto-delete / auto-rewrite.
- `keep_audio` and `remember_speakers` default **false**; absent flag ⇒ nothing sensitive stored.
- The cloud-call log is **metadata-only** — never transcript content, never the key.
- New outbound socket ⇒ **new ADR first** (rule #6).

## Related

[[local-first-guarantee]] · [[egress-governance]] · [[privacy-data-control]] · [[privacy-egress]]
· [[llm-egress]] · [[preload-security]] · [[vault-writer]] · [[audio-store]] ·
[[speaker-enrollment]] · [[glossary]]
