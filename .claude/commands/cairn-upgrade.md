---
description: Update this project's deployed Cairn kit (.claude commands/lib/skills/agents + CLAUDE.md) from a source Cairn checkout — dry-run by default, never touches your config or wiki (cairn)
argument-hint: "path to your Cairn source checkout (e.g. ~/code/cairn); add --apply to actually copy"
---

# Upgrade the deployed Cairn kit (cairn)

Cairn is **copied** into each workspace, so framework fixes don't reach deployed projects on their own.
`/cairn-upgrade` diffs the framework files of a **source** Cairn checkout against **this** workspace and
copies the adds + changes — **never** touching project-local config (`wiki.config*.sh`, `*.config.json`),
the `wiki/`, `wiki.context.md`, the eval corpus, or any `.cairn-*` marker.

Source of the update: **$ARGUMENTS** (path to your Cairn checkout; if empty, ask for it). Add `--apply` to
write; otherwise it's a dry run.

## Preflight
```bash
[ -d .claude ] || { echo "❌ Run from the workspace root (the dir holding .claude/)."; exit 1; }
SRC="$(echo "$ARGUMENTS" | tr ' ' '\n' | grep -v '^--' | head -1)"   # first non-flag arg = source path
[ -n "$SRC" ] || { echo "❌ Pass the path to your Cairn source checkout (e.g. /cairn-upgrade ~/code/cairn)."; exit 1; }
[ -d "$SRC/.claude" ] || { echo "❌ $SRC has no .claude/ — not a Cairn checkout."; exit 1; }
```

## Procedure

1. **Dry-run first — always.** Show what would change before writing anything:
   ```bash
   node .claude/lib/upgrade-kit.mjs --source "$SRC" --dest .
   ```
   Read the report: `srcVersion → dstVersion`, then `+ add` / `~ change` / `- gone-from-source (kept)`.
   - **In sync** (exit 0, no drift) → done, nothing to do.
   - **Drift** (exit 1) → continue.

2. **Review the diff** for the changed files that matter (libs and commands you rely on). The `- gone`
   list is **reported, never deleted** — a project may have added its own commands; remove those by hand
   only if you mean to.

3. **Apply** once the diff looks right:
   ```bash
   node .claude/lib/upgrade-kit.mjs --source "$SRC" --dest . --apply
   ```
   This copies added + changed framework files and stamps `.claude/cairn.version` to the source version.

4. **Verify + commit.** Re-run `/cairn-doctor` and (if the project has tests) `npm test`. Then show the
   diff and commit on the user's say-so — *every change is a git commit* (Cairn hard rule). The upgrade
   only ever touches framework files, so the diff should be limited to `.claude/{commands,lib,skills,agents}`
   and `CLAUDE.md`.

## Guardrails
- **Dry-run is the default.** Never `--apply` without showing the dry-run report first.
- **Your config + wiki are sacred.** The tool excludes `wiki.config*.sh`, `*.config.json`, `*.local.*`,
  `wiki/`, `wiki.context.md`, `eval/corpus.json`, and `.cairn-*` — confirm none of those appear in the diff.
- **Source must be trusted.** You are copying executable `.mjs` into your workspace; point `--source` only
  at a Cairn checkout you control.
