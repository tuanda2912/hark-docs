# WIKI.md — the Hark source-code wiki schema

This is the **schema / operating manual** for `wiki/` — an LLM-maintained knowledge
base of the **Hark source code** (the `tuanda2912/hark` engineering project), kept
HERE in **hark-docs** (deliberately separate from the code repo). It applies
[Karpathy's "LLM Wiki" pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
to the codebase: a persistent, interlinked set of markdown pages between a reader
and the raw sources (38 ADRs + two codebases), so a new session reads
`wiki/index.md` instead of re-deriving the project from scratch every time.

> **Why this exists:** the bookkeeping — keeping cross-references, summaries, and
> "what supersedes what" current across 38 ADRs and two codebases — is the tedious
> part. The LLM does that; the human curates sources and asks questions.
>
> **Companion (planned):** `understand-anything` will generate an auto-derived code
> *knowledge graph*; these curated markdown pages get rebuilt / deepened from its output.

## Three layers

1. **Raw sources** — two sets, both immutable to the wiki: **(a)** the sibling
   **`tuanda2912/hark` code repo** (`../hark/` on disk) — `CLAUDE.md`, `STATUS.md`,
   `meetingmind-handoff.md`, `docs/BACKLOG.md`, `docs/decisions/*.md` (the 38 ADRs),
   `docs/sessions/*`, and the codebase (`engine/`, `ui/`); **(b)** hark-docs's own
   **`../docs/`** (product / design / analysis / qa). The wiki **reads** these; it
   **never rewrites them.** ADRs are the source of truth for decisions (cited as
   GitHub links — they live in the other repo).
2. **The wiki** — this directory (`wiki/`). LLM-owned: subsystem, concept, and
   decision-digest pages + `index.md` + `log.md`. A reader browses it; the LLM
   writes it.
3. **The schema** — this file.

## Hard rules (wiki-specific)

- **Sources are read-only to the wiki.** Editing an ADR, `CLAUDE.md`, or code is a
  normal dev change (and may trigger a *new* ADR) — never a side effect of a wiki
  ingest.
- **Never contradict an ADR's decision.** ADRs are canonical; wiki pages *digest
  and link* them. If a wiki page disagrees with an ADR, the page is wrong — fix the
  page (or, if the decision actually changed, that's a new ADR first, then re-ingest).
- **Supersession is sacred.** When ADR-B supersedes ADR-A, every page citing A must
  say so and link B (e.g. 0035→0037, 0019→0036, 0021→0038). Lint enforces this.
- **No invention.** Every claim traces to a source (an ADR number or a code path).
  Uncertain? Mark it `> TODO(wiki):` rather than guessing.
- **Every change is a git commit** in the hark-docs repo (recoverable history), on
  the user's say-so.

## Directory layout

```
hark-docs/
  docs/                ← raw sources: product / design / analysis / qa (read-only)
  wiki/                ← THIS wiki (the source-code knowledge base)
    WIKI.md            ← this schema
    index.md           ← catalog of every page, by category (read FIRST on a query)
    log.md             ← append-only chronological record of ingests/queries/lints
    overview.md        ← the front door: what Hark is + the subsystem map at a glance
    subsystems/<slug>.md   ← one page per subsystem (engine, wire protocol, RAG, …)
    concepts/<slug>.md     ← cross-cutting ideas (threat model, egress, finalization, …)
    decisions/<slug>.md    ← ADR digests (grouped by area), each linking the ADRs on GitHub
    glossary.md            ← terms (RTF, utterance_id, template image, squircle, …)
```

## Page conventions

Every page starts with YAML frontmatter (enables Obsidian Dataview-style queries):

```yaml
---
type: subsystem | concept | decision-digest | glossary | overview
title: Human Title
status: current            # or: superseded, planned, partial
sources: [ADR-0029, ADR-0031, ui/src/main/llm/index.ts]
updated: 2026-06-05
tags: [privacy, llm]
---
```

- **Links between wiki pages use `[[slug]]`** (Obsidian wikilinks; Hark's own
  `TranscriptLine` renders these too). Prefer `[[subsystems/llm-egress|LLM + egress]]`
  with a display alias when the slug is terse.
- **Cite sources inline** by ADR number (`ADR-0031`) or repo-relative code path
  (`engine/Sources/Harkd/EngineSession.swift`, as inline code). The ADRs + code live
  in the SIBLING `tuanda2912/hark` repo, so link an ADR as a **GitHub URL** —
  `https://github.com/tuanda2912/hark/blob/main/docs/decisions/0031-...md`. Links
  between wiki pages stay `[[slug]]` wikilinks (folder-independent).
- Keep pages **tight and skimmable**: a one-line summary up top, then sections.
- A **Subsystem page** should answer: *what it does · key files · how it connects to
  other subsystems · which ADRs govern it · invariants that must stay true.*
- A **Concept page** explains a cross-cutting idea and lists the subsystems/ADRs that
  embody it.
- A **Decision digest** summarises a cluster of ADRs (e.g. "Privacy & egress" =
  0027/0029/0030/0031) with status + supersession, linking each ADR.

### index.md format (content catalog — read first on a query)

```markdown
# Hark Project Wiki — Index

## Overview
- [[overview]] — what Hark is + the subsystem map.

## Subsystems
- [[subsystems/engine-harkd|engine / harkd]] — the Swift streaming daemon …
- [[subsystems/wire-protocol|WS wire protocol]] — the harkd↔UI JSON contract …

## Concepts
- [[concepts/threat-model|Threat model & privacy rules]] — audio never leaves …

## Decisions
- [[decisions/privacy-egress|Privacy & egress (ADR-0027/0029/0030/0031)]] — …

## Glossary
- [[glossary]] — RTF, utterance_id, squircle, template image, …
```

### log.md format (chronological, append-only)

Each entry starts with a parseable prefix so `grep "^## \[" log.md | tail` works:

```markdown
## [2026-06-05] bootstrap | initial wiki from 38 ADRs + core docs + code subsystem map
Created N subsystem pages, M concept pages, the decisions digests, glossary, index.
```

## Operations (how to maintain this wiki)

**Ingest** — when a new ADR/doc/session lands (or a subsystem changes materially):
read the source, update the affected subsystem/concept/decision pages, refresh any
supersession links, update `index.md`, and append a `log.md` entry. One source may
touch several pages.

**Query** — read `index.md` first to find relevant pages, drill in, answer with
citations to the source ADRs/files. **File a valuable synthesis back as a new page**
(e.g. a "how a meeting flows end-to-end" walkthrough) so explorations compound.

**Lint** — periodically health-check: pages citing a *superseded* ADR as current,
stale code paths (a file moved/renamed), orphan pages (no inbound `[[links]]`),
concepts mentioned but lacking a page, missing cross-references. Report + fix.

## Viewing this wiki as a graph (Obsidian)

Open **`wiki/` as an Obsidian vault** ("Open folder as vault") and use **Graph view**
(⌘G). The `[[wikilinks]]` become the edges; bare names resolve by basename (verified:
no collisions). Wikilinks inside code spans are ignored by Obsidian, so the syntax
examples in this file produce no phantom nodes. The graph settings live in
`.obsidian/graph.json`, which is **committed** so the colored view travels with the repo
(only the volatile `.obsidian/workspace*.json` is gitignored). This recipe is the
recoverable source of truth if that config is ever lost.

**Color groups** — color nodes by role (Graph view → Groups → Add):

| Color | Role | Query |
|---|---|---|
| 🔵 Blue | Engine (Swift) | `path:"subsystems/engine-harkd" OR path:"subsystems/whisperkit-asr" OR path:"subsystems/vad.md" OR path:"subsystems/audio-capture" OR path:"subsystems/wire-protocol" OR path:"subsystems/diarization.md" OR path:"subsystems/speaker-enrollment" OR path:"subsystems/vault-writer" OR path:"subsystems/audio-store" OR path:"subsystems/rag.md"` |
| 🟢 Green | UI renderer (Angular) | `path:"subsystems/ui-shell" OR path:"subsystems/engine-service" OR path:"subsystems/llm-service" OR path:"subsystems/retrieval-service" OR path:"subsystems/tray"` |
| 🔴 Red | Main process + privacy/egress | `path:"subsystems/electron-main" OR path:"subsystems/preload-security" OR path:"subsystems/llm-egress" OR path:"subsystems/external-rag-client"` |
| 🟣 Purple | Concepts | `path:"concepts/"` |
| 🟠 Amber | Decisions (ADRs) | `path:"decisions/"` |

Uncolored gray = navigation hubs (`overview`, `index`, `glossary`, `onboarding`, `log`).

**Forces** (to tame the hairball): Center ≈ 0.2 · Repel ≈ 19 · Link force ≈ 0.4 · Link
distance ≈ 200; keep line thickness low (~0.5) and text-fade 0 (labels always on).

**Filter recipes** — type in the graph's search box:
- *Peel the hubs* to see pure subsystem-to-subsystem wiring:
  `-file:overview -file:index -file:glossary -file:WIKI -file:log -path:decisions`
- *Only the code subsystems:* `path:subsystems`
- *Just the egress surface:* `file:llm-egress OR file:external-rag-client OR file:egress OR file:preload`

**Local graph is the comprehension tool.** Open a page → Command Palette → *"Graph view:
Open local graph"* → set **depth 2**. It shows one subsystem's neighborhood without the
global hairball — the best way to actually learn the architecture node by node.

## Scope note

The first build ingested the docs + a subsystem map; the **2026-06-05 rebuild** then
grounded every subsystem page in the `understand-anything` knowledge graph
(`hark/.understand-anything/knowledge-graph.json` — 280 nodes / 445 edges over 127
source files, 7 layers, a 12-step tour; commit `8efdfde`, **code-only** scope). Each
subsystem page now carries a verified `## Code map` (files + summaries, key
types/functions with line ranges, pinning XCTest suites, deduped cross-subsystem
edges). Caveat: the graph does not resolve Swift *module imports*, so engine cross-file
wiring rides on `depends_on`/`calls`/`implements` edges; deepen on demand or rebuild
after the next graph pass. This **source-code** wiki is distinct from the eventual
*in-app* "markdown second-brain" feature (the same pattern run over the user's meeting
vault) — see the code repo's `STATUS.md`.
