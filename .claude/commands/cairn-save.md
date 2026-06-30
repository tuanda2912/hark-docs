---
description: Capture a source-less decision / ADR / gap into the wiki — intent that grep can't recover and no source doc records yet. Writes one page (frontmatter + index + log), refreshes wiki/hot.md, commits only on your say-so (cairn)
argument-hint: "the decision/gap to capture (e.g. 'chose SSE over websockets for the feed — simpler ops')"
---

# Save a decision / gap to the wiki (cairn)

`/cairn-save` captures **intent that has no source file yet** — a decision, an ADR, a known gap — as a wiki
page. It is the one operation the sync commands can't do: **`/cairn-sync-*` re-derives from *changed source
docs*; `/cairn-save` records a *source-less* fact** (the rationale, the trade-off, the gap) straight from you.

What to capture from the caller: **$ARGUMENTS** (the decision/gap; if empty, ask one short question first).

## Preflight — fail-closed safety
```bash
[ -f .claude/wiki.config.sh ] && . .claude/wiki.config.sh
: "${WIKI_DIR:=wiki}"
[ -d .claude ] || { echo "❌ Run from the workspace root (the dir holding .claude/ + $WIKI_DIR/)."; exit 1; }
[ -d "$WIKI_DIR" ] || { echo "❌ No $WIKI_DIR/ here — bootstrap with /cairn-rebuild first."; exit 1; }
node .claude/lib/guard-remote.mjs || exit 1   # the brain must never live in a pushable public repo
```
A non-zero guard exit is a **BLOCKER**: do not write anything — tell the user to move the workspace out of
the pushable repo (the second brain must never be committable to a code repo on a third-party host).

## Procedure

1. **Classify** what you're saving → sets `type` + `status`:
   - `decision` — a choice + the *why* + alternatives rejected (`status: current`).
   - `adr` — a formal, dated decision record.
   - `gap` — something true/needed with **no code yet** (`status: planned`).

2. **Name it safely** — never let a raw model string name a file:
   ```bash
   SLUG=$(node .claude/lib/safe-name.mjs "<short title for the decision>") || exit 1
   echo "→ will write: $WIKI_DIR/decisions/$SLUG.md"   # use the dir your wiki.context.md assigns to decisions
   ```

3. **Write the page** following the **Ingest page contract** in [`CLAUDE.md`](../../CLAUDE.md) — do *not*
   re-specify the frontmatter rules here; reuse them. Required frontmatter: `type` · `title` ·
   `status` (current | planned | superseded) · `sources` · `updated` (today) · `tags`. For `sources`, the
   source **is this decision/conversation** — say so plainly; never fabricate a document. Body: the
   decision, the **why**, alternatives rejected, and the gap if any. Cross-link related pages.
   **No invention** — uncertain detail ⇒ `> TODO:`, not a guess.

4. **Catalogue + log.** Add the page to `index.md` under the right category; append to `log.md`:
   `## [YYYY-MM-DD] save | <title>`.

5. **Refresh `wiki/hot.md`** (the warm cache) as a side-effect — see its contract in [`CLAUDE.md`](../../CLAUDE.md):
   overwrite it, ≤500 words, **un-greppable working state only** (open questions, in-flight decisions, where
   you left off — **never restate `log.md`**), and set its `updated:` to **today** so `/cairn-lint` can tell
   when the cache has gone cold. `hot.md` is gitignored instance state — it is not committed.

6. **Stop — do not commit.** Show what changed (the new page, index/log edits, hot.md refresh). Commit only
   when the user says so — *every change is a git commit on the user's say-so* (Cairn hard rule).

## Guardrails
- **Source-less only.** If the fact comes from a doc, that's `/cairn-sync-docs` (Ingest), not save.
- **Never commit without say-so.** Propose the diff; the human commits.
- **Never write outside `$WIKI_DIR/`**, and never into a pushable public repo (the preflight guard enforces this).
- **No invention.** Every non-obvious claim cites something; uncertainty is a `> TODO:`.
