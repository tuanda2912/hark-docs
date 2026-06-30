---
name: hark
domain: local-first-audio-ai
topology: monolith
status: active
updated: 2026-06-30
---

# hark — wiki context

> Per-project profile Cairn reads to tailor the wiki. Scaffolded during the Cairn dogfood on 2026-06-30.

## What this project is
hark is a **local-first desktop app** for capturing audio, diarizing/transcribing it, optionally
translating, and building a private RAG "second brain" — under strict **egress governance** (privacy-first,
local by default). Electron UI + a local engine (`harkd`) + pluggable LLM/RAG, packaged as a desktop app.

## Sources — what the wiki is built FROM
Raw source docs live in-repo at **`docs/`** (product vision/roadmap/metrics · analysis user-stories/journeys
· design architecture/data-flows/websocket-contract/ui-brief · qa test-strategy/perf). Code repo: **`../hark`**
(graph at `../hark/.understand-anything/knowledge-graph.json`). Paths set in `.claude/wiki.config.local.sh`.

## How to organize the wiki
- **Shape:** hybrid — `concepts/` (cross-cutting), `subsystems/` (one page per module), `decisions/` (ADRs).
- **Link style:** `[[wikilinks]]` (the vault opens in Obsidian).
- **Page set:** overview · glossary · onboarding · concepts/* · subsystems/* · decisions/* · feature-map.

## What counts as a "feature" (for /lodestar)
User-facing app capabilities: capture · diarize · transcribe · translate · RAG query · egress control.

## Domain glossary (seeds)
diarization · egress governance · local-first · streaming finalization · harkd · RAG · vault.

## Conventions & special rules
- **Privacy/egress is load-bearing** — mark anything that crosses the network boundary.
- **Confidentiality:** `hark-docs` is currently a **public** GitHub repo — keep anything sensitive OUT
  (Cairn's `guard-remote` will block `/cairn-save` here until the brain moves out of a pushable public repo).
