---
title: Hark — Product Documentation Index
status: living
last_updated: 2026-05-24
---

# Hark — Product Documentation

A local-first, macOS-only meeting transcription tool with a built-in markdown second-brain. Live captions, translation, speaker diarization, and Claude-powered Q&A — all running on the user's Mac. No cloud ASR.

## How this folder is organized

These docs simulate the artifact set a four-person product team (PO / BA / Dev / Test) would produce. They're written for two audiences:

1. **Future me** — to avoid re-litigating decisions and to onboard new sub-agents into the project.
2. **Future company audience** — to show the full reasoning chain behind a product, not just the code.

Every non-trivial decision also lives as an ADR in the source repo: `/Users/quynhanhquach/Documents/project/hark/docs/decisions/`.

## Document map

### Product (PO)

| Doc | Purpose |
|---|---|
| [01-vision-and-personas](product/01-vision-and-personas.md) | Why this exists, who it's for, what success looks like at the elevator-pitch level |
| [02-success-metrics](product/02-success-metrics.md) | How we know v1 worked. Specific, measurable, time-bound. |
| [03-roadmap](product/03-roadmap.md) | v1 scope, v1.5, v2. What's in, what's deferred, what's rejected. |

### Analysis (BA)

| Doc | Purpose |
|---|---|
| [04-user-journeys](analysis/04-user-journeys.md) | End-to-end flows: first launch, joining a meeting, post-meeting, asking Q&A |
| [05-user-stories](analysis/05-user-stories.md) | Epics → stories with acceptance criteria, sized for backlog grooming |

### Design (Dev)

| Doc | Purpose |
|---|---|
| [06-architecture-overview](design/06-architecture-overview.md) | C4-style high-level view of components and their responsibilities |
| [07-data-flows](design/07-data-flows.md) | Audio pipeline, transcript pipeline, RAG pipeline, vault sync — with sequence diagrams |
| [08-websocket-api-contract](design/08-websocket-api-contract.md) | JSON message schemas between Swift engine and Electron UI |
| [11-ui-visual-brief](design/11-ui-visual-brief.md) | Paste-ready brief for AI design tools (Claude.ai, Figma Make, v0) |

### QA (Test)

| Doc | Purpose |
|---|---|
| [09-test-strategy](qa/09-test-strategy.md) | What we test, how, when. Privacy-test checklist included — non-negotiable. |
| [10-performance-benchmarks](qa/10-performance-benchmarks.md) | RTF, latency, RAM targets and the harness that measures them |

## Working agreements

- **Single source of truth:** stack decisions live in the [handoff doc](file:///Users/quynhanhquach/Documents/project/hark/meetingmind-handoff.md). These docs explain *what* and *why for users*; the handoff explains *how it's built*.
- **Living docs.** When something changes, update the doc in the same commit. Stale docs are worse than no docs.
- **No code in docs unless it's contract.** API schemas yes; example UI snippets no.
- **Vault is sacred.** This folder lives in the vault so it's git-versioned alongside meeting notes — but never auto-edited by the app.
