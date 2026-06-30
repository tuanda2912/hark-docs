---
type: subsystem
title: LLM provider service
status: current
sources: [0029, 0030, 0031, "graph: Privacy & LLM Egress"]
updated: 2026-06-30
tags: [llm, egress, provider, keystore, security]
---

# LLM provider service

The provider clients in the [[electron-main]] process that own Hark's single outbound channel.
This is the code implementing [[egress-governance]]; it sits within the broader [[llm-egress]]
subsystem. All files under `ui/src/main/llm/`.

## The provider abstraction

`provider.ts` defines the `LlmProvider` interface (`testConnection`, `complete`, a stubbed
`stream`) and a `makeProvider(config, key)` factory. Two implementations (`0029` §Decision):

- `anthropic.ts` — `AnthropicProvider`, POST `https://api.anthropic.com/v1/messages`, `x-api-key`
  + `anthropic-version: 2023-06-01`. The stable system prompt is sent with
  `cache_control: { type: 'ephemeral' }` for prompt-caching (`0031`).
- `openai-compatible.ts` — `OpenAiCompatibleProvider`, configurable `baseUrl` covering cloud
  (OpenAI / OpenRouter / Gemini-compat) **and** local zero-egress backends (Ollama / LM Studio /
  llama.cpp). The `Authorization: Bearer` header is attached **only when a key exists**, so a
  local no-auth endpoint still works (`0029`).

**No vendor SDK** — both use Node's built-in global `fetch` against documented REST endpoints,
avoiding SDK telemetry and supply-chain/native-dep surface (`0029` §Decision).

## Privacy invariants in code

- **Never logged:** the key, the request body, the response body. The only log line is a
  content-free status (`provider.ts`, `anthropic.ts` headers note `0029`).
- **Error messages are status-derived only.** `detailForStatus(status)` maps numeric HTTP status
  to a short message (401/403 → "Invalid API key", 404 → "Model not found", …); the response body
  — which could carry content — is never read into an error (`provider.ts`).
- **Text only.** `CompleteReq` is `{ system, user, maxTokens }` — there is no audio path into a
  provider (`0029`; `provider.ts` doc comment).

## Key storage (Keychain)

`keystore.ts` implements `0030`: the API key is encrypted with Electron `safeStorage` (on macOS
the key derives from the **Keychain**) and the base64 ciphertext is stored in a file **separate
from `prefs.json`** — `~/Library/Application Support/Hark/llm-keys.json`, one entry per provider.
`getKey()` decrypts **in main only** to inject into the auth header; it is never bridged to the
renderer (which gets only `hasKey: boolean`). If `safeStorage.isEncryptionAvailable()` is false,
it **throws `KeyStorageUnavailableError`** rather than falling back to plaintext (`0030` §Decision).

## Redaction + audit log

`redaction.ts` is the pure regex + known-name-collapse redactor for cloud egress (`0031` §2 — see
[[egress-governance]] for the rules). `cloud-log.ts` appends one metadata-only `CloudCallLogEntry`
per action to `cloud-calls.json` (capped to ~500 entries); it has no transcript/prompt/response
field — lengths and counts only (`0031` §4).

See [[local-first-guarantee]] and [[threat-model]].
