---
type: concept
title: Local-first guarantee
status: current
sources: [ADR-0002, ADR-0003, ADR-0004, CLAUDE.md]
updated: 2026-06-05
tags: [privacy, local-first, on-device, ane, asr, rag, egress]
---

Hark's core promise: speech-to-text, speaker recognition, RAG indexing, and storage are **100% on-device** — WhisperKit, FluidAudio, and `multilingual-e5-small` all run on the Apple Neural Engine, with no account, no telemetry, and no background sync. Content leaves the machine **only** when the user explicitly invokes the cloud-LLM edge ([[egress-governance]]); a fully local model means **zero egress**. This is the positive ("what *does* run locally and why") framing of the same rules the [[threat-model]] states as prohibitions.

## The idea

"Audio never leaves your Mac" is the single sentence that distinguishes Hark from Otter / Granola / Fireflies, and ADR-0004 exists specifically to keep it true forever: **no cloud ASR, ever, for any reason.** Transcription is on-device WhisperKit (ADR-0003). The same logic generalises past ASR — every primary signal Hark derives from your meeting is computed on the machine that captured it:

| Capability | On-device model / runtime | Lives in |
|---|---|---|
| Speech-to-text | WhisperKit `large-v3-turbo`, Core ML on the ANE | [[whisperkit-asr]] |
| Voice activity | Silero VAD, Core ML | [[vad]] |
| Speaker recognition | FluidAudio (Core ML pyannote port), ANE | [[diarization]] · [[speaker-enrollment]] |
| Vault RAG indexing | `multilingual-e5-small` (384-dim), Core ML on the ANE | [[rag]] |
| Translation (fast mode) | NLLB-200 distilled, Core ML bundle | [[translation]] |
| Storage | plain markdown + per-meeting git in the vault | [[vault-writer]] · [[audio-store]] |

All of these run inside the [[engine-harkd]] sidecar (ADR-0003), so the trust boundary is one signed Swift binary the OS grants capture permission to — not the Electron shell, not a Python runtime, not a browser tab.

**Why local is even *possible* here:** ADR-0002 cut Windows/Linux/mobile to go macOS-only on Apple Silicon, which freed the stack to use Apple's best first-party tools (ANE via Core ML, ScreenCaptureKit, AVAudioEngine). The macOS-only scope and the local-first guarantee are the same decision viewed from two angles: narrowing the platform is what *buys* production-grade on-device ML.

## What "local-first" forecloses

The guarantee is enforced by `CLAUDE.md` hard rules, not just intent:

- **Rule #1 — audio never leaves the machine.** The *only* outbound path for user content is the explicit Claude API edge (summary, in-meeting Q&A, high-quality translation), and even there **only transcript text** crosses — never audio (ADR-0004). The user must have invoked the action. See [[egress-governance]] for how that edge is gated, logged, and previewed.
- **Rule #2 — nothing written outside the vault.** Transcripts/audio/PII go only to `~/Documents/vault/hark`; model caches and prefs go to `~/Library/Application Support/Hark/`.
- **Rule #3 — no telemetry, no analytics, no crash reporters that exfiltrate content.** Local-only logs are fine.
- **Rule #5 — speaker enrollment data stays local.** Voiceprints in `vault/.speakers/` never go to any API.
- **Rule #6 — any new dependency that opens a network socket needs an ADR first.** No silent network calls.

A practical corollary: **a local model means zero egress.** Because vault RAG indexing embeds the *whole* vault, the embedder may **never** be a cloud endpoint — a cloud embedder would egress every note. ADR-0032 makes this the "hard local-indexing invariant," which is why the embedder is an on-device Core ML model on the ANE (see [[rag]]). The same reasoning rejects "audio scrubbing before cloud send" in ADR-0004: you can't pseudonymise voice, so there's no coherent middle ground — the signal stays local or the promise is a lie.

## Tradeoffs the guarantee accepts

Local-first is not free, and the ADRs name the costs so future sessions don't re-litigate them ([[foundations]]):

- **More engineering work** — Hark builds the Swift engine instead of integrating a vendor SDK (ADR-0004 / ADR-0003).
- **A quality ceiling** — local Whisper trails cloud WER by ~5–10%; FluidAudio diarization is less polished than Soniox's; fast-mode NLLB translation is genuinely lower quality. The translation gap is the user's to close via the opt-in Claude high-quality mode ([[translation]]).
- **Tied to the Apple-Silicon performance envelope** — accepted; the on-device story is what makes the product viable.

The payoff is the compliance posture: Hark works on a plane, in a SCIF, on hotel WiFi, forever, and clears PDPA / GDPR / corporate recording-policy objections that block the cloud competitors (ADR-0004).

## Where this concept lives

- **Stated as prohibitions:** [[threat-model]] (the hard rules as a threat surface).
- **The one allowed exception, governed:** [[egress-governance]] · [[llm-egress]] · [[privacy-data-control]].
- **Embodied in subsystems:** [[engine-harkd]], [[whisperkit-asr]], [[vad]], [[diarization]], [[speaker-enrollment]], [[rag]], [[vault-writer]], [[audio-store]].
- **Decision history:** [[foundations]] (ADR-0001/0002/0003/0004/0005/0013), [[privacy-egress]] (the egress edge), [[vault-rag-decisions]] (the local-indexing invariant).
- **Terms:** [[glossary]] (ANE, RTF, egress, e5).

## Governing ADRs

- [ADR-0002](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0002-macos-only-scope.md) — macOS-only / Apple Silicon scope; **Accepted**. The platform cut that makes on-device ML the best option.
- [ADR-0003](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0003-swift-whisperkit-engine.md) — Swift + WhisperKit engine on the ANE; **Accepted**. The runtime the guarantee runs on.
- [ADR-0004](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0004-no-cloud-asr.md) — No cloud ASR, ever; **Accepted**. "This decision IS the product."
- `CLAUDE.md` hard rules #1–#6 — the enforceable, non-negotiable form of the promise.

## Invariants

- **No cloud ASR.** Audio is transcribed only by on-device WhisperKit (ADR-0004). Audio never crosses any network boundary.
- **A local model means zero egress.** Any model that touches the *whole* vault (the RAG embedder) must be on-device; a cloud embedder is forbidden (ADR-0032 local-indexing invariant).
- **Content leaves only on explicit user action,** through the single Claude API edge, and only as **transcript text** — never audio, never voiceprints. See [[egress-governance]].
- **No account, no telemetry, no background sync.** Local-only logs; no analytics or content-exfiltrating crash reporters (`CLAUDE.md` rule #3).
- **Storage stays in the vault.** PII/transcripts/audio only under `~/Documents/vault/hark`; caches/prefs under `~/Library/Application Support/Hark/` (`CLAUDE.md` rule #2).
