---
type: subsystem
title: Vault writer (markdown + git)
status: current
sources: ["docs/decisions/0015-transcript-vault-persistence.md", "docs/decisions/0028-meeting-audio-persistence.md", "docs/design/07-data-flows.md", "docs/design/06-architecture-overview.md"]
updated: 2026-06-30
tags: [vault, persistence, git, markdown, audio, privacy]
---

# Vault writer (markdown + git)

What turns a finished meeting into a durable file in the [[markdown-second-brain]] vault. Auto-saved on `capture.stop`, written verbatim to the design-doc format, and committed to a **local-only** git repo (`0015`).

## The meeting file
Path `~/Documents/vault/hark/meetings/YYYY-MM-DD-{slug}.md` — lowercase `meetings/`, YAML front-matter (`title`, `date` ISO-8601 with offset, `duration_sec`, `attendees`, `bookmarks`, `hark_version`) plus a `## Transcript` body of blockquoted, wall-clock-timestamped utterances with 📌 on bookmarks (`docs/design/07-data-flows.md` §2; `0015` §1). The `{slug}` is kebab-cased from an editable title; collisions get a `-2`/`-3` suffix and **never** overwrite (`0015` §5). Post-meeting the LLM summary is appended to the same file and committed (`docs/design/07-data-flows.md` §3).

## Write owner
For v1 (pre-diarization) the **Electron main process** owns the write — a deliberate, documented deviation, since pre-diarization the renderer already holds the ordered final-segment list + bookmarks and the engine adds nothing (`0015` §2). The write reuses the atomic temp-file-write-then-rename pattern from `prefs.ts`. When Phase 5 diarization lands, the write moves into the engine behind the `meeting.saved` frame; the format is byte-compatible — speaker names + `attendees` slot in additively (`0015` §2, migration path).

## Git discipline
On first save, `git init` the vault if absent and set a **local** identity (`Hark <hark@localhost>`) so commits never fail on a machine with no global config — never clobbering an existing repo (`0015` §4). Each meeting is a Conventional Commit (`feat(meeting): add {slug}`). **No remote, nothing pushed** — purely local versioning. Discard **deletes-and-commits** so content stays recoverable from git history rather than auto-deleting.

## Optional audio
When `keep_audio` is on (default **off**), the engine writes the buffered whole-meeting PCM as a 16 kHz mono WAV to `<vaultRoot>/.audio/<meeting-id>.wav`, the meeting markdown's stem (`0028`). `.audio/` is a hidden, **gitignored** folder parallel to `.speakers/`, so audio never travels a git remote — the same guarantee as voiceprints. `meeting.saved` gains `audio_path` (path or explicit `null`). Gate off ⇒ zero `.audio/` I/O.

## Why git, why the vault
Transcripts are user content and belong only in the vault, never app-data; git makes Discard reversible (`0015` alternatives). See [[vault-rag-decisions]], [[local-first-egress]], and the vault as RAG source in [[rag]].
