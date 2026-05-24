---
title: Vision & Personas
owner: PO
status: draft
last_updated: 2026-05-24
---

# Vision & Personas

## One-line pitch

**Hark is a meeting transcription tool you can actually trust with your work calls — because every byte of audio stays on your Mac.**

## The problem

Knowledge workers run on meetings. The good tools (Otter, Granola, Fireflies, Alt) all share the same architecture: your audio gets streamed to a SaaS, transcribed in their cloud, stored on their servers. For people in regulated industries (banking, insurance, healthcare, legal) or with strict corporate IT, this is either:

- **Forbidden** — Group Recording Policy, Thai PDPA, EU GDPR, Intune-blocked installations
- **Risky** — closed-source binary listening to confidential conversations with vague data-retention promises
- **Both**

So they either skip the meeting tool entirely (taking notes by hand, missing context) or use one of those tools quietly and hope nothing leaks.

## The opportunity

A **local-first** alternative. Apple Silicon Macs in 2026 can run Whisper large-v3-turbo on the Neural Engine at >2x real-time. The hardware is finally good enough to do production-grade live transcription without the cloud. No vendor has shipped a polished, trustworthy version of this yet.

## Vision (3-sentence form)

> *Hark turns every meeting into a structured, searchable memory that lives entirely on your machine. Live captions and translation during the call, summary and action items after, and a personal knowledge graph that grows with every conversation. Built for the kind of work you can't afford to leak.*

## Non-goals

- **Not a Zoom/Teams replacement.** Hark listens to whatever Zoom/Teams plays — we don't replace the meeting client.
- **Not for casual users who want frictionless.** Hark asks for ScreenCapture permission, requires a one-time speaker tag, costs ~$0.50/month in Claude API tokens. Users who want zero friction will keep using Granola.
- **Not a transcription-as-a-service.** No accounts, no cloud sync, no team sharing in v1.

## Personas

### Primary: "The Compliance-Bound Knowledge Worker"

- **Profile:** Senior engineer / consultant / analyst at a regulated company (bank, insurer, law firm, healthcare). 5–15 years experience.
- **Tech:** macOS daily driver, comfortable with hotkeys and config files, won't sign up for SaaS that touches work data.
- **Pain:** 4–6 hours/day in meetings. Loses context across meetings. Hand-typed notes miss 60% of what was said. Existing tools are banned or untrusted.
- **Job to be done:** "Help me remember and act on what was said in my meetings without breaking compliance."
- **What they'll pay:** One-time license $49–99, or self-host free + bring-your-own-Anthropic-key. Subscription is hostile to this persona.

### Real instance: Quynh Anh (me)

- Java/Spring backend, 7+ yrs, working in Thailand on banking/insurance projects
- Bilingual TH ↔ EN meetings daily, code-switching mid-sentence
- Corporate Intune blocks Exchange sync to third-party clients → no calendar integration possible
- Already manually note-taking in Obsidian; wants that workflow to absorb meeting transcripts seamlessly

### Secondary: "The Privacy-Conscious Independent"

- **Profile:** Solo consultant, journalist, therapist, researcher. Owns their own work.
- **Pain:** Same context loss, plus genuine ethical/legal duty to protect client confidentiality (privilege, HIPAA-equivalent, source protection).
- **Why they're secondary, not primary:** smaller segment, often Mac-light. Worth building for, not worth optimizing for.

### Anti-persona: "The Friction-Averse Generalist"

- Wants Granola's "join meeting → magic happens" experience.
- Won't tolerate ScreenCapture permission prompts, won't manually tag speakers, doesn't care about data residency.
- **We will lose them. That's fine.** Building for them would compromise the trust model that's our actual moat.

## Why this is the right product for the builder

This is a personal product first, market product second. The builder uses it every day on real Allianz-style meetings (with manager/DPO sign-off). Dogfooding is structural — if Hark doesn't earn its keep in the builder's own daily standups by Phase 4, the project gets killed. That's the honesty filter.

## Related

- [Success metrics](02-success-metrics.md) — how we know we got this right
- [Roadmap](03-roadmap.md) — what's in v1 vs deferred
- [Handoff doc](file:///Users/quynhanhquach/Documents/project/hark/meetingmind-handoff.md) — full design rationale
