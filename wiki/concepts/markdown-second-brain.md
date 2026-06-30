---
type: concept
title: The vault — a plain-markdown second brain
status: current
sources: [docs/product/01-vision-and-personas.md, docs/design/06-architecture-overview.md, docs/analysis/04-user-journeys.md, docs/analysis/05-user-stories.md]
updated: 2026-06-30
tags: [vault, markdown, second-brain, git, obsidian]
---

# The vault — a plain-markdown second brain

Hark turns every meeting into "a structured, searchable memory that lives entirely on your machine"
(`docs/product/01-vision-and-personas.md` §Vision). That memory **is** the vault: a folder of plain
markdown files the user owns, versioned with git, openable by any tool. The primary persona already
note-takes in Obsidian and wants meeting transcripts to "absorb… seamlessly" into that workflow
(`docs/product/01-vision-and-personas.md` §Real instance). The positioning is "Obsidian's discipline
meets Granola's polish."

## What lives in the vault
From `docs/design/06-architecture-overview.md` §Data stores:
- **Meetings** — `vault/hark/meetings/*.md`, Markdown + YAML frontmatter, **permanent &
  git-versioned**.
- **Notes** — `vault/hark/notes/*.md`, user-managed Markdown.
- **Speaker embeddings** — `vault/.speakers/*.json` (`{name, embeddings, meetings_seen}`), permanent.

Deliberately **not** in the vault: app config, the term/RAG indexes, the model cache, prefs, and the
Anthropic key — those go in `~/Library/Application Support/Hark/` or the Keychain, keeping the vault
"the user's stuff" only (`docs/design/06-architecture-overview.md` §Data stores; see also
[[ui-onboarding]] on why prefs stay out of the vault).

## Why plain markdown
So the user can "open, search, and edit my meetings with any tool (Obsidian, VS Code, grep)"
(`docs/analysis/05-user-stories.md` HARK-D-1). Each saved meeting carries frontmatter (date, duration,
speakers, bookmark count) and a transcript organized by speaker; the indexes (term FTS, RAG vectors)
are explicitly **rebuildable from the vault**, so the markdown is the source of truth
(`docs/design/06-architecture-overview.md` §Data stores).

## Git as the memory's spine
On meeting save, and again after summary/rename, Hark **auto-commits** the file
(`docs/analysis/04-user-journeys.md` Journey 2 step 11, Journey 4 step 5). If the vault folder isn't a
git repo, Hark prompts once to initialize it and the user may decline, losing versioning
(`docs/analysis/05-user-stories.md` HARK-D-1).

## A brain that grows
The vault is also an **input**: a wiki-link auto-links known terms in transcripts
(`docs/analysis/05-user-stories.md` HARK-D-2), vault titles/tags seed the WhisperKit initial-prompt to
sharpen recognition (HARK-D-3), and the same notes feed in-meeting Q&A retrieval
(`docs/analysis/04-user-journeys.md` Journey 5). Meetings are written over the [[wire-protocol]] by the
engine, then read directly by the [[ui-renderer]] via Node `fs`. The local-first contract around it is
[[local-first-egress]].
