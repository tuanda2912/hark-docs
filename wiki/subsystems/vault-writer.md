---
type: subsystem
title: Vault writer & per-meeting git
status: current
sources: [ADR-0015, ADR-0016, ADR-0020, ADR-0029, ADR-0031, ADR-0036, engine/Sources/Harkd/VaultWriter.swift]
updated: 2026-06-05
tags: [engine, vault, persistence, git, privacy]
---

The **sole** meeting-file writer in the engine. At `capture.stop` it renders YAML
front-matter + a `## Transcript` blockquote body to
`~/Documents/vault/hark/meetings/<date-slug>.md` (atomic, never-overwrite),
best-effort local git-commits it, re-renders the same file in place on speaker
rename, and **idempotently** merges in a `## Summary` and per-language
`## Transcript — <lang>` sections.

## Code map

_Grounded in the understand-anything graph (commit 8efdfde, 2026-06-05, code-only)._

**Layer:** Streaming Daemon & Transcription.

**Files:**

- `engine/Sources/Harkd/VaultWriter.swift` — writes a finished meeting to the vault as
  markdown (ADR-0015 front-matter + blockquoted transcript) and git-commits it, plus
  appends summary/translation sections; runs only at `capture.stop`, never on the hot
  path, and never deletes or rewrites existing files.

**Key types & functions:**

- `VaultWriter` (class, L31–668) — stateless `Sendable` writer: renders meeting
  markdown, writes + git-commits the vault file, and appends summary/translation
  sections with pure `static` merge helpers.
- `write` (function, L77–117) — writes a new meeting markdown file to the vault
  (collision-suffixed) and git-commits it, returning the resulting path and stats.
- `renderMarkdown` (function, L388–423) — renders the full meeting markdown document:
  ADR-0015 YAML front-matter plus the `## Transcript` body of blockquoted,
  speaker-labeled utterances.

**Pinned by tests:**

- `engine/Tests/HarkdTests/MeetingTranscriptTests.swift` — coverage for the
  `meeting.transcript` mapping (`EngineSession.transcriptUtterances`), driving the
  production mapping over `VaultWriter.Utterance` inputs so the emit path and the test
  share one definition.
- `engine/Tests/HarkdTests/SummaryWriteTests.swift` — the `summary.write` persistence
  path (`VaultWriter.mergeSummarySection` + `appendSummary`) and the
  `SummaryWriteCommand` wire decode (ADR-0031): a pure read-modify-write that
  appends/replaces a `## Summary` section, with no model call in the engine.
- `engine/Tests/HarkdTests/TranslationWriteTests.swift` — the `translation.write`
  persistence path (`VaultWriter.mergeTranslationSection` + `appendTranslation`) and the
  `TranslationWriteCommand` decode, pinning that per-language `## Transcript — <lang>`
  sections coexist and re-translating one language replaces only that section.

**Connections:**

- ⇐ depends_on [[subsystems/engine-harkd|Engine / harkd]] — `EngineSession` is the only
  caller; it owns the session and serializes the single write call site.

## What it does

`VaultWriter` (`engine/Sources/Harkd/VaultWriter.swift`) is a stateless `Sendable`
`struct` — a Java-ish stateless `@Component` with a handful of public methods, holding
no mutable state, touching only the filesystem and a local `git` subprocess. It is the
**one place in the whole app that writes a meeting file to the vault** (hard rule #4:
all vault changes go through one owner so git history stays recoverable). It runs
**only at `capture.stop`** (after the offline diarization pass) and on the post-stop
edit commands — **never on the live caption hot path** (ADR-0016 §4).

Five write entry points, all sharing one render → atomic-write → best-effort-commit
core:

1. **`write(...)`** — first save of a meeting. Renders front-matter + `## Transcript`,
   picks a never-colliding filename, writes atomically, commits `feat(meeting): add
   <slug>`.
2. **`rewrite(fileURL:...)`** — speaker rename (ADR-0020). Re-renders the **same file**
   from retained structured data with the new labels and re-commits. Not find/replace.
3. **`appendSummary(to:summary:...)`** — merges a `## Summary` section (ADR-0031 §6).
4. **`appendTranslation(to:lang:translation:...)`** — merges a flat
   `## Transcript — <lang>` blob verbatim (legacy path).
5. **`appendTranslationStructured(to:lang:translatedLines:utterances:...)`** — merges a
   `## Transcript — <lang>` that is a **structural mirror** of the original transcript
   (same labels, same wall-clock timestamps, same blockquote format), built by zipping
   the renderer-supplied translated lines with the engine's retained utterances
   (ADR-0036 retained-utterance model; see [[translation]]).

## Key files

- `engine/Sources/Harkd/VaultWriter.swift` — the entire subsystem: rendering, slug /
  unique-filename logic, atomic write, the merge helpers, and the local-git glue.
- It is invoked by `EngineSession` (the actor that owns the session and serializes the
  single call site) — see [[engine-harkd]]. The summary / translation / rename commands
  arrive over the wire (`summary.write`, `translation.write`, `speaker.rename`) — see
  [[wire-protocol]].

## The file shape (ADR-0015 §1)

Path: `~/Documents/vault/hark/meetings/YYYY-MM-DD-HHMM.md` (lowercase `meetings/`).
The slug is `yyyy-MM-dd-HHmm` in **local** time (`Self.slug(forStart:)`), already
kebab-safe. `uniqueFileURL` appends `-2`, `-3`… on collision and **never overwrites**
an existing file (hard rule #4).

```markdown
---
title: Meeting 2026-06-01 14:32
date: 2026-06-01T14:32:07+07:00
duration_sec: 2715
attendees: [Speaker 1, Speaker 2]
bookmarks: 0
hark_version: 0.1.0
---

## Transcript

> **Speaker 1** · 14:32:02
> Welcome everyone. Let's start with the Camunda migration status...

> **Speaker 2** · 14:33:42
> We decided to push the cutover to next Monday.
```

- `date` is ISO-8601 with the machine's local UTC offset (`iso8601Local`).
- Per-utterance headers are `> **<label>** · HH:MM:SS`, where the clock is
  `sessionStart + tStart` rendered local (`clockOffset`). Pre-diarization v1 used
  timestamp-only headers with `attendees: []`; Phase 5 diarization ([[diarization]],
  ADR-0016) now populates the `Speaker N` labels and the `attendees` array — the format
  slots were reserved from the start, so the change was additive.
- `renderTranscriptBody` is the **single source of truth** for the blockquote body. The
  original `## Transcript` (via `renderMarkdown`) and the translated
  `## Transcript — <lang>` mirror (via `appendTranslationStructured`) call the exact
  same `static` formatter — no timestamp-base / format / line-count drift possible.
- `yamlScalar` quotes any scalar that would break a YAML flow scalar (`:`, `#`,
  brackets, leading/trailing space, empty) and doubles embedded single quotes.

> TODO(wiki): `bookmarks` is hard-coded `0` and no 📌 pins are emitted — the engine
> retains no bookmark store in this slice (`bookmark.create` is event-only, mirrored by
> the UI). A session bookmark store + pinned headers is a deferred follow-up, noted
> in-code at `renderMarkdown`. ADR-0015's example shows 📌 pins; the live code does not
> yet produce them.

## Idempotent section merges (the load-bearing trick)

`## Summary` and `## Transcript — <lang>` are merged by two **pure**, unit-tested
helpers — `mergeSummarySection` and `mergeTranslationSection` — so the live write path
and the regression suite share one definition of "merge." The instance methods only do
read → merge → atomic-write → commit; the merge itself has no I/O or state.

The rule (identical for both):

- **Section ABSENT** → append it after the existing content (trim trailing blanks, one
  blank line, the heading, a blank line, the body; file ends with exactly one trailing
  newline).
- **Section PRESENT** → **replace its body in place**, from the heading up to the next
  top-level `## ` heading (or EOF), leaving everything before and any following sections
  untouched. This is what makes re-summarize / re-translate idempotent — no duplicate
  heading, no stacked bodies.

Heading matching is **exact on the trimmed line**, so a `### Summary` subheading or a
quoted `## Summary` inside the transcript body never matches. For translation the
heading includes the language (`## Transcript — Thai` vs `## Transcript — French`), so
**different languages get their own coexisting sections** while a re-translate to the
*same* lang replaces only that lang's section.

## Speaker rename = re-render, not find/replace (ADR-0020)

Live captions carry no speaker labels (`segment.final` ships `speaker: nil`); labels
exist only *after* the post-stop diarization pass, by which point the file is already
written. So rename is necessarily **post-save**. The engine retains the just-saved
meeting's structured data (`SavedMeetingSnapshot` in [[engine-harkd]]); `speaker.rename`
hands in a `{label: name}` map, and `rewrite` re-renders the **same file** from that
retained data with the new labels and re-commits. Re-rendering (not string replacement)
is what keeps it clean and idempotent — a transcript line literally containing "Speaker
1" can't be corrupted. The wire payload carries **no path** (`session_id` is an equality
guard; the engine uses the snapshot's stored `vaultPath`), so a rename can never
redirect the write to another file.

## Local git (ADR-0015 §4)

Git is **best-effort, layered on top of the durable `.md`** — every method's `Result`
carries `committed: Bool`, and any git failure logs a status-only line and returns
`committed = false`. The `.md` is already on disk, so a meeting is **never lost** because
git misbehaved. `gitCommit`:

1. If `<vault>/.git` is absent → `git init` and set a **local** identity (`user.name
   "Hark"`, `user.email "hark@localhost"`) so commits never fail on a machine with no
   global git config. On an existing repo it **skips init entirely** — never clobbering
   the user's repo or config.
2. Ensures `<vault>/.gitignore` excludes `.speakers/` (rule #5 forward-safety) and
   `.audio/` (ADR-0027 / rule #2) — create-or-append, never rewriting unrelated lines,
   idempotent. The `static` `ensureSpeakersGitignored` / `ensureAudioGitignored` helpers
   are `vaultRoot:`-parameterized so [[speaker-enrollment]] and [[audio-store]] can
   assert their own ignore rule the moment they create those dirs, regardless of whether
   a meeting was ever saved.
3. `git add meetings/<file> .gitignore` then `git commit -m <message>`.

**No remote is ever added and nothing is pushed** — purely local versioning, so no
network socket opens (rule #6 needs no separate ADR). Hardening (flagged by a privacy
audit): every invocation is prefixed with `-c core.hooksPath=/dev/null` (`hooksOff`) so
no user-global git hook can fire inside a Hark commit, and `git`'s stdout/stderr are
routed to `/dev/null` so a path or transcript snippet can never leak into Hark's own
logs.

## How it connects to other subsystems

- **[[engine-harkd]]** — `EngineSession` owns the diarization pass and the retained
  utterances / `SavedMeetingSnapshot`, then calls `VaultWriter` at stop and on the
  post-stop edit commands. It is the only caller.
- **[[diarization]]** — produces the `Speaker N` labels and the `attendees` list that
  `renderMarkdown` writes (ADR-0016). Pre-diarization there were none.
- **[[wire-protocol]]** — `speaker.rename` → `rewrite`, `summary.write` →
  `appendSummary`, `translation.write` → `appendTranslation` /
  `appendTranslationStructured`. The engine **persists only**; it never calls a model.
- **[[llm-egress]]** / **[[egress-governance]]** — summaries and translations are
  generated in the Electron-main egress chokepoint (ADR-0029/0031), then handed to the
  engine as plain markdown to persist. Main **never** writes the vault behind the
  engine's back (ADR-0031 §6) — that would be a second writer to the sacred vault.
- **[[translation]]** — the structured per-utterance translation path
  (`appendTranslationStructured`) and on-demand post-stop translation (ADR-0037).
- **[[speaker-enrollment]]** / **[[audio-store]]** — share the gitignore-assertion
  helpers so `.speakers/` and `.audio/` stay out of any repo the user might later push.
- **[[markdown-second-brain]]** — the durable Obsidian-readable `.md` files this writer
  produces *are* the second brain; this subsystem fulfils that core product promise.
- **[[threat-model]]** — embodies hard rules #2 (vault-only writes), #4 (single owner,
  recoverable git history, never auto-delete/overwrite), #5 (`.speakers/` gitignored,
  no embeddings written/transmitted), #6 (git is local-only, no socket).

## Governing ADRs

- **[ADR-0015](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0015-transcript-vault-persistence.md)** (Accepted) — the
  file format, the `capture.stop` save trigger, never-overwrite + collision suffix, and
  the local-git discipline. v1 parked the write in Electron main "until Phase 5"; that
  interim writer was **never built**.
- **[ADR-0016](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0016-phase-5-diarization.md)** (Accepted; pipeline choice
  superseded by [ADR-0017](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0017-diarization-offline-pipeline.md)) — Phase 5
  fired ADR-0015's migration trigger: the **engine became the sole writer** and the
  reserved speaker fields are now populated with `Speaker N`. See [[diarization]].
- **[ADR-0020](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0020-post-save-speaker-relabeling.md)** (Accepted) —
  post-save speaker rename via re-render-from-snapshot + re-commit (`rewrite`), not
  find/replace.
- **[ADR-0029](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0029-llm-provider-layer-egress.md)** (Accepted) — LLM calls
  originate in Electron main, never the engine; the engine stays network-free. The
  writer only persists text main generated. See [[egress-governance]].
- **[ADR-0031](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0031-content-egress-redaction-log.md)** (Accepted) — §6:
  the summary is persisted through the engine (`appendSummary` via `summary.write`), not
  by main writing the vault directly — keeping the vault single-owner.
- **[ADR-0036](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0036-grow-in-place-finalization.md)** (Accepted) — export-
  only grow-in-place finalization: the **saved transcript** (built from the engine's
  retained `finalizedUtterances`, the same data this writer renders) recovers grown
  tails, while the live view stays discrete. So the saved file can be more complete than
  the live captions were. See [[streaming-finalization]].

Digest pages: [[diarization-speakers]] (0016/0017/0020), [[privacy-egress]]
(0027/0029/0031), [[translation]] (0035/0037), [[streaming-finalization-decisions]]
(includes 0036), [[vault-rag-decisions]].

## Invariants (must stay true)

1. **One owner.** `VaultWriter` is the only thing that writes a meeting `.md`. Main
   never writes the vault directly (ADR-0031 §6); summaries/translations come *through*
   the engine.
2. **Vault-only.** Writes land strictly under `~/Documents/vault/hark/meetings/`. The
   write path is engine-derived from `NSHomeDirectory()` (and, for edits, the snapshot's
   stored `vaultPath`); no wire payload supplies a path.
3. **Never overwrite, never auto-delete** (rule #4). First-save uses
   `uniqueFileURL` (-2/-3 collision suffix); edits target the meeting's **own existing**
   `fileURL` only. Discard is user-initiated delete-and-commit (recoverable from git).
4. **Atomic writes.** `Data.write(.atomic)` (temp-then-rename on the same volume) — same
   pattern as the UI's prefs.ts (ADR-0014). No partial file is ever observable.
5. **Git is best-effort and never fails the save.** A commit failure returns
   `committed = false`; the `.md` is already durable.
6. **Local-only git.** No remote, no push, ever (rule #6). Adding a remote is a new ADR
   + privacy review of repo contents.
7. **`.speakers/` and `.audio/` stay gitignored** (rules #5 / #2 / ADR-0027) — asserted
   idempotently, even before the first meeting is saved.
8. **No content in logs.** Log lines are paths, counts, and git status only — never
   transcript text; git subprocess output is discarded.
9. **Section merges are idempotent.** Re-summarize / re-translate replaces the section
   body in place; never a duplicate heading or stacked body. Distinct languages coexist.
10. **One blockquote formatter.** Original and translated transcripts both render through
    `renderTranscriptBody` — labels, wall-clock timestamps, and blockquote format can't
    drift between them.

## See also

[[engine-harkd]] · [[diarization]] · [[wire-protocol]] · [[markdown-second-brain]] ·
[[threat-model]] · [[egress-governance]] · [[translation]] · [[audio-store]] ·
[[speaker-enrollment]] · [[glossary]]
