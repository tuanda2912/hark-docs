---
description: Run an incremental understand-anything update on the code, then re-derive the wiki code-map pages (cairn)
argument-hint: "(optional) target repo: a CODE_* alias (e.g. main) or a literal path"
---

# Sync code understanding → wiki (cairn)

Refresh the **code knowledge graph** with understand-anything's **incremental update** — it re-analyzes only
the files changed since the graph's last commit (NOT a full re-scan) — then **re-derive the wiki's code-map
pages** from the updated graph.

Target repo: **$ARGUMENTS** (default `main` when empty). The alias (or a literal path) is resolved via
[`.claude/wiki.config.sh`](../wiki.config.sh), so **the code can live anywhere** — set `CODE_*` there.

## Procedure (run from the workspace root)

1. **Resolve paths + preflight.**
   ```bash
   [ -f .claude/wiki.config.sh ] && . .claude/wiki.config.sh
   : "${WIKI_DIR:=wiki}"
   type resolve_code_repo >/dev/null 2>&1 || resolve_code_repo(){ echo "${1:-../code}"; }
   [ -d "$WIKI_DIR" ] || { echo "❌ No $WIKI_DIR/ here — run from the workspace root, or bootstrap the wiki with /cairn-rebuild (the kit ships a starter $WIKI_DIR/)."; exit 1; }
   TARGET_NAME="$ARGUMENTS"
   TARGET_NAME="${TARGET_NAME#"${TARGET_NAME%%[![:space:]]*}"}"   # ltrim
   TARGET_NAME="${TARGET_NAME%"${TARGET_NAME##*[![:space:]]}"}"   # rtrim (preserve internal spaces — paths may contain them)
   [ -z "$TARGET_NAME" ] && TARGET_NAME="main"
   TARGET="$(resolve_code_repo "$TARGET_NAME")"
   [ -d "$TARGET" ] || { echo "❌ Code repo '$TARGET_NAME' → '$TARGET' not found. Set CODE_* in .claude/wiki.config.sh (or pass a valid path)."; exit 1; }
   command -v node >/dev/null || { echo "❌ node missing (≥22) — run /cairn-doctor."; exit 1; }
   ls -d "$HOME/.claude/plugins/cache/understand-anything/understand-anything/"* >/dev/null 2>&1 || echo "⚠️ understand-anything plugin not detected — run /cairn-doctor."
   echo "Target: $TARGET_NAME → $TARGET"
   git -C "$TARGET" rev-parse HEAD 2>/dev/null && git -C "$TARGET" status --porcelain | head -5
   ```
   - If node or the plugin are missing, relay the `/cairn-doctor` pointer and stop. Note whether
     `$TARGET` has **uncommitted** changes (see the 1b caveat).

1b. **Run the incremental update.** Invoke the `/understand` skill on the resolved path (do **not** pass
   `--full`): `/understand $TARGET`. The skill auto-detects the existing
   `<repo>/.understand-anything/knowledge-graph.json` + its stored commit and does an **incremental** pass
   (`git diff <lastHash>..HEAD --name-only` → only changed files). Answer its gates to proceed.

   ⚠️ Incremental works off **git commits**. If the relevant code changes are **uncommitted**, the skill
   reports "graph up to date at this commit" and there is nothing to re-derive — say so and tell the user to
   **commit first** (don't force `--full`). If `HEAD` is unchanged, **stop**.

2. **Note the delta.** Commit `old → new` hash, added/removed/changed files, node/edge counts.

3. **Re-derive the affected wiki code-map pages** (under `$WIKI_DIR/`) from the updated graph — whichever
   pages this wiki uses for the code map (e.g. an architecture/overview page, a file/contract catalog, and
   the traceability page). Update `sources.md` (new commit + counts) and `index.md` if page scope changed.
   ⚠️ Graph summaries are **LLM-generated** — verify specifics against source before asserting them.

4. **Flag coverage shifts.** New/removed files or methods can open/close gaps. If a feature gained or lost
   code, that's a `/lodestar` re-run (the feature→file map) — surface it.

5. **Log it.** Add a dated entry to `$WIKI_DIR/log.md`: commit delta, counts, what changed, pages
   re-derived, new/closed gaps.

6. **Summarise**: what code changed, which wiki pages refreshed, coverage shifts — or "graph already up to date".

## Guardrails
- The graph lives at `<repo>/.understand-anything/` (the tool's native, in-repo location) — correct; only the
  **wiki** must stay outside the code repo.
- **Incremental only** — never `--full` here (that's `/cairn-rebuild`'s job).
- Updates the **wiki** from code understanding; does **not** modify any source.
- After this, run **`/lodestar`** to refresh the feature→file map against the new graph.
