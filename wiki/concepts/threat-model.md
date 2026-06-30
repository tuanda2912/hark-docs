---
type: concept
title: Threat model
status: current
sources: [docs/design/06-architecture-overview.md, docs/qa/09-test-strategy.md]
updated: 2026-06-30
tags: [privacy, threat-model, security, egress]
---

# Threat model

The threats Hark designs against, each with its mitigation. From
`docs/design/06-architecture-overview.md` §Threat model summary. This is the adversary-side view
of the [[local-first-guarantee]]; the policy that enforces it is [[egress-governance]].

## Threat → mitigation

| Threat | Mitigation |
|---|---|
| Closed-source binary captures and exfiltrates audio | Hark is open-source (planned); the audio path is auditable; a `privacy-auditor` agent runs each release |
| Network attacker MITMs the Claude API call | No TLS pinning — the Anthropic SDK handles cert validation; transport is trusted to Anthropic |
| Local malware reads the vault | **Out of scope** — the vault is plain files; securing the disk is the user's responsibility (FileVault recommended) |
| API key leaks to logs or commits | Stored in Keychain, never written to disk in plaintext, never logged; `privacy-auditor` greps for `sk-ant-` patterns in code |
| User accidentally records a confidential conversation | Pause button always visible; ⌘⇧S kills capture instantly; redact-before-send on by default |
| Speaker fingerprint reverse-engineered to identify someone | Embeddings stay local, never networked — the trust boundary is the disk they live on |

(`docs/design/06-architecture-overview.md` §Threat model summary.)

## What is deliberately *not* defended

Two rows above are explicitly out of scope, and the design says so:

- **Local malware / disk theft** — the vault is plaintext markdown; Hark does not encrypt it.
  Disk security is delegated to the OS (FileVault) and the user (`06-architecture-overview.md`
  §Threat model summary).
- **Penetration testing** — deferred while the attack surface is local-only; there is no server
  component in v1 (`docs/qa/09-test-strategy.md` §Out of scope for testing).

## How the model is checked

The model is not just prose — it is exercised before every release by the privacy checklist
(`docs/qa/09-test-strategy.md` §Privacy checklist): static greps for `sk-ant-` literals and for
`fetch`/`URLSession` outside approved paths, plus a runtime `tcpdump`/Little Snitch pass
asserting the **only** outbound destinations are the Anthropic API (user-invoked) and a first-run
model download. A failure here blocks the release.

See also [[privacy-data-control]] for the consent model governing the sensitive artifacts these
threats target.
