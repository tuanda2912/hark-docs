---
description: Roll up old log.md entries into a fold page so the append-only log stays skimmable — extractive, dry-run by default, commits on your say-so (cairn)
argument-hint: "(optional) '--apply' to write · '--keep N' recent entries to leave inline (default 20)"
---

# Fold the log (cairn)

`log.md` is append-only and grows forever. `/cairn-fold` rolls the **oldest** entries into a dated fold page
under `wiki/folds/` (extractive — verbatim, no invention) and leaves a single pointer in the log, keeping
the most recent entries inline. Dry-run by default.

Caller hint: **$ARGUMENTS** (`--apply` to write · `--keep N` recent to keep · default keep 20).

## Run
```bash
[ -f .claude/wiki.config.sh ] && . .claude/wiki.config.sh
: "${WIKI_DIR:=wiki}"
node .claude/lib/fold-log.mjs "$WIKI_DIR" --keep 20            # dry-run: show the plan
# then, once the plan looks right:
node .claude/lib/fold-log.mjs "$WIKI_DIR" --keep 20 --apply    # write the fold page + rewrite log.md
```

## Procedure
1. **Dry-run first.** Read the plan: how many entries fold, the date range, the fold filename. If it says
   "nothing to fold", the log is still short — stop.
2. **Apply** only when the plan is right. It writes `wiki/folds/log-<from>_to_<to>.md` (the verbatim old
   entries) and rewrites `log.md` to: preamble + the kept recent entries + one pointer entry to the fold.
3. **Sanity-check** with `/cairn-lint` — the fold page is a normal wiki page and the log stays newest-first.
4. **Stop — commit on say-so.** Show the diff; the human commits.

## Guardrails
- **Extractive only.** A fold copies entries verbatim — never summarise away or drop information.
- **Folds live under `wiki/`** (gitignored instance state) — never committed to a code repo.
- **Commit on say-so.** Propose the diff; the human commits.
