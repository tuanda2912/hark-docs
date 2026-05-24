---
title: Roadmap
owner: PO
status: draft
last_updated: 2026-05-24
---

# Roadmap

Phased delivery aligned with the technical plan in the [handoff doc](file:///Users/quynhanhquach/Documents/project/hark/meetingmind-handoff.md). Each phase ends with a working artifact, not an intermediate one.

## v1 — "Trustworthy live transcription with a brain" (5–7 weeks)

| Phase | What ships | Demo-able outcome | Est. |
|---|---|---|---|
| **0** | RTF benchmark harness | Numbers in a markdown file — go/no-go on the entire stack | 1 day |
| **1** | Swift engine batch mode | Drop a `.wav` in, get JSON segments out | 3–5 days |
| **2** | Audio capture | Capture 60s of mixed mic + system audio, write to disk | 3–5 days |
| **3** | Streaming engine | WebSocket emits partial + final segments live | 3–5 days |
| **4** | Electron UI MVP | Menu-bar tray, main window, live transcript view, manual speaker tag | 1–2 weeks |
| **5** | Diarization | FluidAudio runs post-meeting, speakers labeled and persisted | 2–3 days |
| **6** | Claude integration | Summary, action items, in-meeting Q&A, translation modes | 2–3 days |
| **7** | Hardening | Sign + notarize, auto-update, settings, hotkeys, error states | 1–2 weeks |

**v1 includes:**
- Live captions (English + Thai, auto-detect, code-switch supported)
- Translation: local NLLB-200 (fast) OR Claude API (high-quality) — user toggle
- Speaker labels with manual tag + voice fingerprint memory across meetings
- Bookmark hotkey during meetings
- Post-meeting summary, action items, decisions, open questions
- In-meeting LLM Q&A over vault + past transcripts (RAG with local embeddings)
- Term capture panel — detected vault terms get inline definitions
- Vault: Obsidian-compatible markdown folder, git-versioned, auto-export per meeting
- Auto-link entities during transcription
- Whisper vocab auto-grows from vault terms
- Privacy: pause/resume button, redact-before-send toggle for Claude API path

**v1 does NOT include:**
- Calendar integration (blocked — corporate Intune)
- Auto-join Zoom/Teams
- Confluence-style visual version diffs
- Active-speaker OCR from Teams window
- Native SwiftUI UI
- Windows / Linux / mobile

## v1.5 — Polish & longevity (~4 weeks, after v1 dogfood)

Triggered only if v1 hits all Tier 1 success metrics AND I'm actively using it daily.

- Speaker fingerprint improvements: per-mic profiles, "this is the same person on a different call"
- Better vault UX: backlinks panel, graph view (or surrender and tell users to use Obsidian directly)
- Summary templates per meeting type (1:1 standup, design review, customer call) — auto-detected from attendees or chosen at start
- Hotkey-driven moment annotations during meetings ("decision", "question", "todo" — not just plain bookmark)
- Onboarding flow that doesn't suck
- Possibly: native SwiftUI rewrite of the UI for ~30% RAM reduction and Mac-native feel

## v2 — Open questions, not commitments

Things I'd consider only if v1 succeeds AND there's signal from outside myself:

- Optional encrypted multi-device sync (iCloud Drive of the vault folder — *not* a cloud service we operate)
- Public release on a marketplace (Setapp? Direct sale? Open source?)
- Real-time speaker fingerprint sharing across a small team (each user runs their own Hark; speaker IDs are merged via a peer-shared `.speakers/` folder)
- Plugin API so the vault can be extended (Obsidian-style)

## Explicitly rejected (don't re-litigate)

These keep coming back in brainstorming. They're not coming back.

- ❌ Cloud ASR (Soniox, AssemblyAI, etc.) — breaks the entire product thesis. See ADR-0004 (TODO).
- ❌ Native iOS/Android clients — different OSes, different audio APIs, different threat models. Different product.
- ❌ Windows port — was the original reason for Rust engine. Scope cut. ADR-0002.
- ❌ Calendar auto-pull — corporate IT blocks every path. Will reconsider only if Microsoft Graph API becomes installable without admin consent (unlikely).
- ❌ Auto-join meetings — would require browser automation or platform-specific APIs. Doubles the surface area.
- ❌ Team/multi-user features — explicitly out of scope for personal v1.
- ❌ Subscription pricing — hostile to the primary persona.

## Risks to the roadmap

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| WhisperKit RTF on real Thai-EN code-switch is worse than benchmarks | Medium | High | Phase 0 measures this directly. Fallback: large-v3-turbo Q5 quantized, accept ~3% WER loss for speed. |
| Builder runs out of evenings/weekends | High | High | Phase 0–3 alone (~2 wks) = useful CLI. Phases are independently shippable. |
| Claude API costs exceed $0.50/day target | Low | Medium | Aggressive prompt caching on transcript; truncate older history. |
| Apple breaks WhisperKit or ScreenCaptureKit in macOS 16 | Low | High | First-party APIs; Argmax actively maintains WhisperKit. Tolerable risk. |
| Diarization quality is so bad it's unusable | Medium | Medium | FluidAudio is a known port; fallback is pyannote Python sidecar (already considered, ADR-able). |

## Related

- [Vision & personas](01-vision-and-personas.md)
- [Success metrics](02-success-metrics.md)
- [User stories](../analysis/05-user-stories.md) — per-epic backlog
- Source repo phased plan: handoff doc
