---
type: concept
title: Egress governance
status: current
sources: [0029, 0031, docs/design/06-architecture-overview.md]
updated: 2026-06-30
tags: [privacy, egress, redaction, llm, governance]
---

# Egress governance

The policy governing what may cross the network boundary, and how each crossing is made
transparent. This is the rulebook the [[llm-service]] code implements; the broader promise it
serves is the [[local-first-guarantee]].

## The single chokepoint

Every outbound LLM byte goes through the Electron main process's provider layer — never the
Swift engine (which stays audited network-free), never the sandboxed renderer (`0029`). One
chokepoint means one place to audit. Calls are **user-invoked only** — no background or
automatic egress (`0029`).

## Local vs cloud — the first fork

Governance branches on where the provider points (`0031` §1):

- **Local provider** (OpenAI-compatible with a `localhost`/`127.0.0.1` base URL) → send the
  **full transcript, no redaction**. It never leaves the Mac: full quality, **zero egress**.
- **Cloud provider** (Anthropic, or an OpenAI-compatible remote base URL) → **redact before
  send**.

## Redaction (cloud only, ON by default)

v1 redaction is regex + known-name collapse, replacing each match with a typed placeholder and
counting per category (`0031` §2): emails, phone numbers, money/currency amounts, long digit
runs (≥ 7 digits → IDs/cards/accounts), URLs, plus the meeting's **known speaker display-names**
collapsed to their labels (`"Tuan"` → `"Speaker 1"`). The counts drive the on-screen receipt and
the activity log.

**Honest limitation:** arbitrary names spoken in free text are **not** auto-detected — there is
no NER yet. The receipt and log state exactly what was redacted and must not imply more; full NER
name redaction is backlog (`0031` §3).

## Never sent, ever

Audio and voiceprints **never** leave the machine — only (redacted-if-cloud) transcript text
(`0031` §5; `06-architecture-overview.md` §Trust boundaries). Main has no audio path into a
provider (`0029`).

## Transparency — the cloud-call log

Every action (summarize, future Q&A/translation) is logged locally to
`cloud-calls.json`: timestamp, action, provider, model, **egress (cloud|local)**, char counts,
redaction total, status, optional cost. **Transcript content is never logged — metadata only.**
Local actions are logged too (marked `egress: local`) so the user sees the full picture
(`0031` §4). Surfaced in Settings → Privacy.

See [[threat-model]] for the adversary view and [[privacy-data-control]] for consent.
