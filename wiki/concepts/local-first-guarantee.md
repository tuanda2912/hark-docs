---
type: concept
title: Local-first guarantee
status: current
sources: [docs/design/06-architecture-overview.md, 0004, 0029]
updated: 2026-06-30
tags: [privacy, local-first, egress, architecture]
---

# Local-first guarantee

Hark's load-bearing invariant: **everything stays on the Mac except one outbound channel** — the
Claude API, text-only, never audio. This page states the guarantee; [[egress-governance]] is the
policy enforcing it and [[llm-service]] is the code.

> This is a sibling to the existing [[local-first-egress]] page, which frames the same boundary
> from the threat-model angle; this page focuses on what "local-first" *means* here.

## The boundary

Per `docs/design/06-architecture-overview.md` §Trust boundaries:

- Everything inside Hark stays on the Mac.
- The vault is on local disk. The user *may* place it in iCloud Drive — that is **their** choice;
  Hark never pushes it anywhere.
- **The Claude API edge is the only outbound channel.** It carries **transcript text and vault
  excerpts**, never audio.

## What "local-first" means concretely

- **No cloud ASR, ever** — transcription runs entirely on-device via WhisperKit. Cloud ASR
  (Soniox, AssemblyAI, Deepgram, OpenAI Whisper API, …) is rejected permanently because *"you
  can't pseudonymize audio — voice is inherently identifying"* (`0004` §Decision/Alternatives).
  This decision *is* the product: "Audio never leaves your Mac" is the single sentence that
  distinguishes Hark from every competitor (`0004` §Consequences).
- **The engine never opens an outbound socket.** The Swift engine (`harkd`) is audited
  loopback-only; LLM calls originate in the [[electron-main]] process, not the engine and not the
  sandboxed renderer (`0029` §Decision). See [[swift-engine-sidecar]].
- **Local = zero egress is a real option.** A local OpenAI-compatible provider (Ollama / LM Studio
  / llama.cpp on `localhost`) keeps even the LLM features fully on-device; cloud becomes one
  *option*, not the only path (`0029`).

## Works anywhere

Because transcription is on-device, Hark works on a plane, in a SCIF, on hotel WiFi — forever, with
no subscription dependency (`0004` §Consequences). The tradeoff accepted: a ~5–10% WER gap versus
proprietary cloud models, taken for the trust win (`0004`).

See [[threat-model]] for the adversaries and [[privacy-data-control]] for the consent model.
