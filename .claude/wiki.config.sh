# wiki.config.sh — where the /cairn-* commands look for things.
# Sourced from the WORKSPACE ROOT. Edit the values to point at where your code / docs / wiki actually
# live. Paths may be RELATIVE to the workspace root or ABSOLUTE; $HOME and a leading ~ are expanded.
# Leave a value blank to fall back to its default.
#
# Safe to commit (defaults are generic). For machine-specific ABSOLUTE paths, DON'T edit this file —
# run `/cairn-setup` (or hand-write `.claude/wiki.config.local.sh`), which is gitignored and sourced
# last to override these defaults. That keeps your local paths out of the shared repo.

# 1) The wiki knowledge base (relative to this repo root, or absolute).
WIKI_DIR="wiki"

# 1b) Where your projects live — scanned by /cairn-projects to list every project that has a
#     wiki.context.md (its frontmatter = name/domain/topology). Point at the parent of your repos.
#         PROJECTS_ROOT="$HOME/Documents/project"
PROJECTS_ROOT="$HOME"

# 2) Code repositories in THIS WORKSPACE — analyzed by /cairn-sync-code, /cairn-rebuild, and /lodestar.
#    The framework lives at the WORKSPACE root (beside/above the code) — NEVER inside a code repo.
#    A MONOLITH workspace has one repo; a MICROSERVICES workspace has several. One CODE_<ALIAS> var per
#    repo (path relative to this workspace root, or absolute), and list every alias in CODE_REPOS so the
#    commands can iterate the whole workspace. resolve_code_repo maps `api` → $CODE_API automatically.
#        CODE_API="services/api"   CODE_WEB="services/web"   CODE_REPOS="api web"
CODE_MAIN="../code"
CODE_REPOS="main"

# 3) Raw source docs the wiki is built FROM (requirements, ADRs, design docs, papers — anything).
#    a) DOCS_SOURCE — a direct path to the source folder (local dir, network mount, Google
#       Drive/Dropbox/iCloud/OneDrive path, anything). >>> If set, this WINS.
#           DOCS_SOURCE="$HOME/Documents/my-project-docs"
DOCS_SOURCE=""
#    b) If DOCS_SOURCE is blank, OPTIONALLY auto-discover a cloud-drive shared library by NAME under
#       SEARCH_ROOT (handles spaces). Leave CLOUD_DOCS_NAME blank to disable auto-discovery entirely
#       (common when your sources are local or live in the code repo).
CLOUD_SEARCH_ROOT="$HOME/Library/CloudStorage"
CLOUD_DOCS_NAME=""
#    c) Local mirror the docs are synced INTO (relative to the workspace root, or absolute).
#       The default "raw-docs/" is gitignored — it's a derived cache of upstream sources (possibly
#       confidential). If you rename it, add the new path to .gitignore too.
DOCS_MIRROR="raw-docs"

# --- helpers (the commands call these; you don't normally edit below) ---
expand_path() { case "$1" in "~") printf '%s' "$HOME" ;; "~/"*) printf '%s/%s' "$HOME" "${1#\~/}" ;; *) printf '%s' "$1" ;; esac ; }

# Map a CODE_* alias (like `main`, `api`) to its path via variable indirection — `api` → $CODE_API.
# No per-repo edit needed: define CODE_<ALIAS> + add the alias to CODE_REPOS. An unknown alias is
# treated as a literal path, so `resolve_code_repo /abs/path` or `../some/repo` also works.
resolve_code_repo() {
  alias_in="${1:-main}"
  case "$alias_in" in
    */*|/*|.*|~*) expand_path "$alias_in"; return ;;  # looks like a path → use literally
  esac
  var="CODE_$(printf '%s' "$alias_in" | tr '[:lower:]-' '[:upper:]_')"
  eval "val=\${$var:-}"   # portable indirection, set -u-safe (the :- yields '' for an unset CODE_<ALIAS>)
  if [ -n "${val:-}" ]; then expand_path "$val"; else expand_path "$alias_in"; fi
}

# Resolve the RAW docs source folder (the thing the mirror is synced FROM). DOCS_SOURCE wins;
# else auto-discover the named cloud library (only if CLOUD_DOCS_NAME is set). Prints empty otherwise.
resolve_docs_source() {
  if [ -n "$DOCS_SOURCE" ]; then
    expand_path "$DOCS_SOURCE"
  elif [ -n "$CLOUD_DOCS_NAME" ]; then
    find "${CLOUD_SEARCH_ROOT:-$HOME/Library/CloudStorage}" -maxdepth 4 -type d \
      -name "$CLOUD_DOCS_NAME" 2>/dev/null | head -1
  fi
}

# --- machine-specific overrides (gitignored; written by /cairn-setup) ---
# Sourced LAST so it overrides the defaults above. (Use `if/fi`, not `&&`, so sourcing always returns
# success even when no override exists.)
if [ -f .claude/wiki.config.local.sh ] ; then . .claude/wiki.config.local.sh ; fi
