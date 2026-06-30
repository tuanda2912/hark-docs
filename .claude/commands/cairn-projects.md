---
description: List all second-brain projects (discovered by their wiki.context.md), optionally filtered by domain (cairn)
argument-hint: "(optional) a domain to filter by, e.g. fintech"
---

# List projects (cairn)

Discover every project that has a second brain built with this kit — by scanning for `wiki.context.md`
files under your projects root — and list them with their **domain** and **topology**. Filter by domain.

There is **no central registry**: each project's `wiki.context.md` frontmatter IS the record, so the list is
always current and nothing drifts. (A project shows up once its `/cairn-setup` has scaffolded + filled its
`wiki.context.md`.)

Caller hint: **$ARGUMENTS** — an optional domain to filter by.

## Procedure
1. Resolve the projects root + run the discovery helper:
   ```bash
   [ -f .claude/wiki.config.sh ] && . .claude/wiki.config.sh
   : "${PROJECTS_ROOT:=$HOME}"
   type expand_path >/dev/null 2>&1 || expand_path(){ case "$1" in "~/"*) printf '%s/%s' "$HOME" "${1#\~/}";; "~") printf '%s' "$HOME";; *) printf '%s' "$1";; esac; }
   ROOT="$(expand_path "$PROJECTS_ROOT")"
   DOMAIN="$ARGUMENTS"
   DOMAIN="${DOMAIN#"${DOMAIN%%[![:space:]]*}"}"; DOMAIN="${DOMAIN%"${DOMAIN##*[![:space:]]}"}"   # trim ends only
   node .claude/lib/list-projects.mjs "$ROOT" ${DOMAIN:+--domain "$DOMAIN"}
   ```
2. Present the table (NAME · DOMAIN · TOPOLOGY · STATUS · PATH). If filtering by domain, say so. If none are
   found, point the user at **`/cairn-setup`** (run in a project to scaffold its `wiki.context.md`, which is
   what registers it) and check that `PROJECTS_ROOT` in `.claude/wiki.config.sh` points where your projects live.

## Notes
- Set **`PROJECTS_ROOT`** in `.claude/wiki.config.sh` (or the gitignored local override) to where your
  projects live (e.g. `$HOME/Documents/project`). Defaults to `$HOME` (slower; scans a few levels deep).
- Read-only — only scans for + reads `wiki.context.md` frontmatter; touches nothing else.
