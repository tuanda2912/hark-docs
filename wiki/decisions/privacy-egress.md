---
type: decision
title: Privacy & egress decisions
status: current
sources: [0004, 0027, 0029, 0030, 0031]
updated: 2026-06-30
tags: [decision, privacy, egress, llm, security]
---

# Decisions — privacy & egress

The cluster of ADRs that together define how user content may (and may not) leave the Mac. They
are the recorded form of the [[local-first-guarantee]]; the policy is [[egress-governance]] and
the code is [[llm-service]].

## 0004 — No cloud ASR, ever

Transcription happens **entirely on-device** (WhisperKit); no cloud ASR (Soniox, AssemblyAI,
Deepgram, OpenAI Whisper API, …) for any reason. The hybrid "scrub audio before send" option is
rejected as incoherent — *you can't pseudonymize audio* (`0004` §Decision/Alternatives). The only
outbound content path is the explicit Claude API edge, text only. This ADR exists to **end the
recurring discussion permanently** (`0004` §Context).

## 0027 — Privacy & data-control model

Three sensitive artifacts, each user-governed: transcripts (always), **audio** (opt-in, sync off),
**voiceprints** (opt-in, sync off). Explicit informed-consent opt-in at onboarding; engine
enforces via `keep_audio` / `remember_speakers` flags (default false); audio + voiceprints are
gitignored (`0027`). See [[privacy-data-control]].

## 0029 — LLM provider layer & egress

LLM calls originate in the **Electron main** process — never the Swift engine (keeps it audited
network-free), never the sandboxed renderer (key never enters DevTools context). A provider-agnostic
`LlmProvider` interface with Anthropic-native + OpenAI-compatible implementations (local = zero
egress); **no vendor SDK** (raw `fetch`). Load-bearing invariants: text only, single chokepoint,
user-invoked only, every call logged, PII redaction ON by default before cloud send (`0029`).

## 0030 — API key storage

The key is encrypted with Electron `safeStorage` (macOS Keychain-derived) and stored as ciphertext
in `llm-keys.json`, **separate from `prefs.json`**, decrypted **in main only**. The renderer can
set/clear/query `hasKey` but **never read the key back**; if encryption is unavailable, fail
gracefully — **never** fall back to plaintext (`0030`). `keytar` rejected (native dep);
plaintext rejected (insecure).

## 0031 — Content egress governance

The first time user content leaves the machine. **Local vs cloud is the first fork:** local →
full transcript, no redaction, zero egress; cloud → redact before send (regex + known-name
collapse, ON by default), honestly documented as *not* full NER. Every action is logged
**metadata-only** to `cloud-calls.json`. The summary is written back to the vault **through the
engine** (`summary.write`), keeping the vault a single-writer (`0031`).

See [[threat-model]] and [[electron-main]].
