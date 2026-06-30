---
description: Check the kit's external dependencies + configured paths and report/fix what's missing (cairn)
argument-hint: "(optional) 'install' to auto-install missing shell deps after confirmation"
---

# Wiki environment doctor (cairn)

Verify everything the `/cairn-sync-*` and `/lodestar` commands need is present on **this** machine, and that
the **configured paths** ([`.claude/wiki.config.sh`](../wiki.config.sh)) actually resolve. Run this first
thing after cloning the kit onto a new machine, or after changing the config. Report what's missing,
**where to get it**, and offer to install the shell-installable pieces.

Caller hint: **$ARGUMENTS** (if it contains `install`, install missing shell deps after the user confirms).

## Step 1 — Probe everything (tools + configured locations)

```bash
[ -f .claude/wiki.config.sh ] && . .claude/wiki.config.sh
: "${WIKI_DIR:=wiki}" ; : "${DOCS_MIRROR:=raw-docs}" ; : "${CODE_MAIN:=../code}"
: "${CLOUD_SEARCH_ROOT:=$HOME/Library/CloudStorage}"
type resolve_code_repo  >/dev/null 2>&1 || resolve_code_repo(){ echo "${1:-$CODE_MAIN}"; }
type resolve_docs_source >/dev/null 2>&1 || resolve_docs_source(){ [ -n "$DOCS_SOURCE" ] && printf '%s' "${DOCS_SOURCE/#\~/$HOME}"; }
ok(){ printf '  ✅ %-14s %s\n' "$1" "$2"; }
no(){ printf '  ❌ %-14s MISSING — %s\n' "$1" "$2"; }
warn(){ printf '  ⚠️  %-14s %s\n' "$1" "$2"; }

echo "Configured locations (.claude/wiki.config.sh):"
[ -d "$WIKI_DIR" ] && ok "wiki" "$WIKI_DIR" || no "wiki" "WIKI_DIR='$WIKI_DIR' not found — run from the workspace root or fix the config"
p="$(resolve_code_repo main)"; [ -d "$p" ] && ok "code:main" "$p" || warn "code:main" "'$p' not found — set CODE_MAIN in .claude/wiki.config.sh"
SRC=$(resolve_docs_source)
if [ -n "$SRC" ] && [ -d "$SRC" ]; then ok "docs-source" "$SRC${DOCS_SOURCE:+  (DOCS_SOURCE)}"
else warn "docs-source" "no raw-docs source configured (fine if your sources live in the code repo; else set DOCS_SOURCE or CLOUD_DOCS_NAME)"; fi

echo "Core CLI:"
command -v git   >/dev/null && ok git   "$(git --version)"                       || no git   "https://git-scm.com  (or: xcode-select --install)"
command -v rsync >/dev/null && ok rsync "$(rsync --version 2>/dev/null|head -1)"   || warn rsync "only needed by /cairn-sync-docs; ships with macOS, else apt/brew install rsync"

echo "Code sync (/cairn-sync-code, /lodestar):"
command -v node >/dev/null && { v=$(node -v|tr -d v); ok node "v$v"; [ "${v%%.*}" -ge 22 ] || warn node "need ≥22 (have v$v)"; } || no node "brew install node   (≥22)"
command -v pnpm >/dev/null && { p=$(pnpm -v); ok pnpm "$p"; [ "${p%%.*}" -ge 10 ] || warn pnpm "need ≥10 (have $p)"; } || warn pnpm "only for the understand-anything plugin's FIRST build — skip if the plugin already built. corepack enable pnpm (or npm i -g pnpm)"
ls -d "$HOME/.claude/plugins/cache/understand-anything/understand-anything/"* >/dev/null 2>&1 \
  && ok ua-plugin "$(ls -d "$HOME/.claude/plugins/cache/understand-anything/understand-anything/"* | tail -1 | xargs basename)" \
  || no ua-plugin "not at the Claude Code plugin cache (other CLIs install elsewhere — see the UA repo). In Claude Code: /plugin marketplace add Lum1104/Understand-Anything → /plugin install understand-anything"

echo "Docs conversion (optional — only for binary docx/xlsx/pdf/pptx sources):"
command -v uv >/dev/null && ok uv "$(uv --version 2>/dev/null)" || warn uv "brew install uv   (only if you have binary source docs)"
MD="$HOME/.local/bin/markitdown"; { [ -x "$MD" ] || MD=$(command -v markitdown); } && ok markitdown "$MD" || warn markitdown "uv tool install --python 3.12 'markitdown[all]'   (only for binary docs)"
```

## Step 2 — Report & fix

Summarise: which commands are **ready** vs **blocked**, and by what.

- **Configured-path misses** — if `wiki`/`docs-source`/`code:main` didn't resolve, the path points at the
  wrong place (or you're not at the workspace root). Easiest fix: **`/cairn-setup`** (writes the gitignored
  local override); or set the variable by hand (`CODE_MAIN`, `DOCS_SOURCE`/`CLOUD_DOCS_NAME`).
- **Shell-installable** (`node`, `pnpm`, and optionally `uv`, `markitdown`) — if missing and the user said
  `install` (or agrees), run the matching command for **each missing one**, then re-run Step 1. ⚠️
  Installing software is side-effecting — **ask before installing** unless `install` was passed.
- **Not auto-installable** — explain these must be done by the user:
  - **understand-anything plugin** — `/plugin marketplace add Lum1104/Understand-Anything` then
    `/plugin install understand-anything` (https://github.com/Lum1104/Understand-Anything).
  - **The wiki itself** — `/cairn-sync-*` *maintain* the wiki; they don't bootstrap it. Carry `$WIKI_DIR/`
    over (recommended), or use **`/cairn-rebuild`** to regenerate it from sources + code graph.

## Step 3 — Verify
After any installs/config fixes, re-run Step 1 and confirm every row the commands need is ✅.

## Notes
- Read-only by default — it only *probes* (plus reads the config). It changes the machine only when the user
  opts into installing. It does not touch `$WIKI_DIR/` or code-repo content.
