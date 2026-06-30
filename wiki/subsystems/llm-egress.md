---
type: subsystem
title: Privacy & LLM egress
status: current
sources: [docs/design/06-architecture-overview.md, "graph: Privacy & LLM Egress"]
updated: 2026-06-30
tags: [privacy, egress, llm, rag, security]
---

# Privacy & LLM egress

The code behind Hark's single outbound channel — the LLM provider clients and the local RAG bridge. This is
the subsystem that enforces the [[local-first-egress]] invariant in code (`docs/design/06-architecture-overview.md`
§Trust boundaries / Threat model).

## Files (graph layer "Privacy & LLM Egress")
- `ui/src/main/llm/anthropic.ts` — the Anthropic (Claude) client; text-only, user-invoked.
- `ui/src/main/llm/{provider,index,openai-compatible}.ts` — provider abstraction (+ OpenAI-compatible option).
- `ui/src/main/llm/keystore.ts` — Keychain-backed API key storage (never on disk in plaintext, never logged).
- `ui/src/main/llm/cloud-log.ts` — an audit log of what crossed the network boundary.
- `ui/src/main/rag/{index,http,loopback,mcp,parse,types}.ts` — local RAG retrieval (loopback HTTP / MCP) that
  grounds Q&A from the vault before any prompt is sent.

## Invariants (enforced here)
- **Text only, never audio** crosses to the Claude API.
- The API key lives in the **Keychain**; `privacy-auditor` checks for `sk-ant-` patterns in code.
- RAG runs **locally** (loopback / MCP) — retrieval never leaves the Mac; only the user-invoked prompt does.

See [[local-first-egress]] for the policy, this page for the implementation.
