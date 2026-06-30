# Hark wiki — index

The catalog. **Read this first.** Built by Cairn (`/cairn-rebuild`) from `docs/` + the 38 ADRs in the code
repo + the code graph — see [sources](sources.md).

## Start here
- [Overview](overview.md) — what Hark is + the architecture at a glance
- [Glossary](glossary.md) — load-bearing terms
- [New-contributor onboarding](onboarding.md)
- [Feature → file map](feature-map.md) — feature → capability → files (+ status, gaps)

## Concepts
- [Local-first & the single egress edge](concepts/local-first-egress.md)
- [Local-first guarantee](concepts/local-first-guarantee.md)
- [Threat model](concepts/threat-model.md)
- [Egress governance](concepts/egress-governance.md)
- [Privacy & data-control model](concepts/privacy-data-control.md)
- [The vault — a plain-markdown second brain](concepts/markdown-second-brain.md)
- [Pluggable retrieval backend](concepts/pluggable-retrieval.md)
- [Streaming utterance finalization](concepts/streaming-finalization.md)
- [Design system & visual brief](concepts/design-system.md)

## Subsystems
### Engine (Swift / harkd)
- [harkd daemon (engine binary)](subsystems/engine-harkd.md)
- [EngineSession (session service)](subsystems/engine-service.md)
- [Audio capture & engine core](subsystems/audio-capture.md)
- [Voice Activity Detection (VAD)](subsystems/vad.md)
- [WhisperKit ASR](subsystems/whisperkit-asr.md)
- [Streaming daemon & transcription](subsystems/streaming-daemon.md)
- [Diarization (FluidAudio offline pass)](subsystems/diarization.md)
- [Speaker enrollment & matching](subsystems/speaker-enrollment.md)
- [Audio store (meeting-audio persistence)](subsystems/audio-store.md)
- [Local RAG index (built-in backend)](subsystems/rag.md)
- [Vault writer (markdown + git)](subsystems/vault-writer.md)
### UI (Electron / Angular)
- [UI renderer (Angular)](subsystems/ui-renderer.md)
- [UI shell & main window](subsystems/ui-shell.md)
- [Tray menu & global hotkeys](subsystems/tray.md)
- [Electron main process](subsystems/electron-main.md)
- [Preload security & IPC bridge](subsystems/preload-security.md)
- [WebSocket wire protocol (engine ↔ UI)](subsystems/wire-protocol.md)
### Privacy & retrieval edge
- [Privacy & LLM egress](subsystems/llm-egress.md)
- [LLM provider service](subsystems/llm-service.md)
- [Retrieval service (backend switch)](subsystems/retrieval-service.md)
- [External RAG client (loopback transport)](subsystems/external-rag-client.md)

## Decisions
- [Founding choices (Electron, macOS-only, Swift+WhisperKit, no cloud ASR, MIT)](decisions/foundations.md)
- [A separate Swift engine sidecar](decisions/swift-engine-sidecar.md)
- [Capture architecture (system audio + mic, process tap, permissions)](decisions/capture-audio.md)
- [Streaming & finalization decisions](decisions/streaming-finalization-decisions.md)
- [Diarization & speaker decisions](decisions/diarization-speakers.md)
- [Privacy & egress decisions](decisions/privacy-egress.md)
- [Vault + RAG decisions](decisions/vault-rag-decisions.md)
- [UI scaffold, first-run onboarding & model-load](decisions/ui-onboarding.md)
- [Live translation — deferred to on-demand post-stop](decisions/translation.md)
- [macOS packaging, signing & notarization](decisions/packaging-distribution.md)

## Meta
- [Sources](sources.md) · [Log](log.md)
