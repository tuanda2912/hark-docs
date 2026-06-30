---
type: concept
title: Local-first & the single egress edge
status: current
sources: [docs/design/06-architecture-overview.md]
updated: 2026-06-30
tags: [privacy, local-first, egress, threat-model]
---

# Local-first & the single egress edge

Hark's load-bearing invariant: **everything stays on the Mac except one channel.**

## The boundary
Per `docs/design/06-architecture-overview.md` §Trust boundaries:
- Everything inside Hark stays on the Mac. The vault is on local disk (the user *may* put it in iCloud Drive —
  that's their choice; Hark never pushes it).
- **The Claude API edge is the only outbound channel.** It carries **transcript text and vault excerpts** —
  **never audio**, never embeddings.

## Threat model (selected mitigations)
From `06-architecture-overview.md` §Threat model summary:
- *Exfiltration via closed binary* → open-source (planned); auditable audio path; a `privacy-auditor` runs each release.
- *API key leak* → Keychain only, never logged; auditor greps for `sk-ant-`.
- *Accidental recording* → always-visible pause; ⌘⇧S kills capture instantly; redact-before-send on by default.
- *Speaker fingerprint re-identification* → embeddings stay local, never networked.

## Why it matters here
This is the rule the architecture serves, and it's why the egress code is isolated into one subsystem
([[llm-egress]]) and the privileged surfaces into one process ([[electron-main]]). Any change that crosses the
network boundary must be checked against this page.
