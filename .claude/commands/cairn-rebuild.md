---
description: Bootstrap/regenerate the whole wiki from the raw sources + code knowledge graph — for a fresh machine or a lost wiki (cairn)
argument-hint: "(optional) 'force' to regenerate even if wiki pages already exist"
---

# Rebuild the wiki from scratch (cairn)

Regenerate the **entire** wiki (the Karpathy *bootstrap*) from the raw sources + the code knowledge graph.
Unlike `/cairn-sync-docs` (incremental doc ingest) and `/cairn-sync-code` (incremental code re-derive), this
builds **every page from nothing** — use it on a fresh machine where the wiki didn't travel, or to recover a
lost/corrupted wiki. Locations come from [`.claude/wiki.config.sh`](../wiki.config.sh); page conventions come
from [`CLAUDE.md`](../../CLAUDE.md).

Caller hint: **$ARGUMENTS** (`force` = proceed even if the wiki already has pages).

> ⚠️ **Prefer carrying the wiki over rebuilding.** The wiki holds *accumulated synthesis* (contradictions
> found, lint judgments, traceability) that a rebuild regenerates and may not reproduce identically. If the
> existing wiki is available, **copy it over** instead. Rebuild is the fallback, not the default.

## Preflight

```bash
[ -f .claude/wiki.config.sh ] && . .claude/wiki.config.sh
: "${WIKI_DIR:=wiki}" ; : "${DOCS_MIRROR:=raw-docs}"
type resolve_code_repo  >/dev/null 2>&1 || resolve_code_repo(){ echo "${1:-../code}"; }
type resolve_docs_source >/dev/null 2>&1 || resolve_docs_source(){ [ -n "$DOCS_SOURCE" ] && printf '%s' "${DOCS_SOURCE/#\~/$HOME}"; }
[ -d .claude ] || { echo "❌ Run from the workspace root."; exit 1; }
CODE="$(resolve_code_repo main)" ; SRC=$(resolve_docs_source)
[ -d "$DOCS_MIRROR" ] || [ -n "$SRC" ] || echo "ℹ️ no external docs — the wiki will be built from in-repo sources (README/docs/ADRs) + the code graph."
[ -f "$CODE/.understand-anything/knowledge-graph.json" ] || echo "⚠️ no code graph at $CODE — run /cairn-sync-code (or /understand $CODE) first, else the code-map pages can't be built."
[ -d "$WIKI_DIR" ] && [ -n "$(ls -A "$WIKI_DIR" 2>/dev/null)" ] && echo "NOTE: $WIKI_DIR/ already has content — only overwrite if the user passed 'force' or confirms."
echo "wiki=$WIKI_DIR  docs=$DOCS_MIRROR (source=$SRC)  code:main=$CODE"
```
- If the code graph is missing, tell the user to run **`/cairn-sync-code`** (or `/understand <code>`) first
  (and **`/cairn-doctor`** if tools/paths are off), then stop.
- If the wiki already has pages and `force` was **not** given, **ask** before overwriting.

## Procedure

1. **Ensure docs are mirrored** (if an external `DOCS_SOURCE` is configured): run the `/cairn-sync-docs`
   mirror step first. Otherwise gather in-repo sources (README, `docs/`, ADRs, design notes).

2. **Read every raw source.** Convert binaries with markitdown (`"$HOME/.local/bin/markitdown" <file> -o
   $TMP/…`) into a throwaway dir; view images with the Read tool. Read the code graph(s) at
   `<repo>/.understand-anything/knowledge-graph.json`.

3. **Generate the page set** (cross-linked markdown under `$WIKI_DIR/`, following `CLAUDE.md`'s page
   conventions — one topic per page, frontmatter, cite sources, mark status). A generic skeleton (adapt to
   the project's shape — code-shaped projects organise by subsystem/module; requirements-shaped projects by
   epic/feature):

   | Page | Topic |
   |------|-------|
   | `index.md` | catalog of all pages, by category — read first on any query |
   | `overview.md` | what the project is + the architecture/layers at a glance |
   | `<topic/subsystem/feature>.md` | one per major area — from the raw sources + the graph |
   | `<code-map>.md` | architecture, file/module map, key components — from the graph |
   | `glossary.md` | the project's load-bearing terms |
   | `sources.md` | every raw source: path, format, freshness, which pages it feeds |
   | `log.md` | ingest/query/lint history (start it with this rebuild entry) |

   Graph summaries are LLM-generated — **verify against the actual source** before asserting them.

4. **Build the feature→file map.** Once the pages + graph are in place, run **`/lodestar`** to generate
   `wiki/feature-map.md` (the traceability layer).

5. **Seed `log.md`** with a dated rebuild entry (code commit, graph counts, sources read; note it was a
   from-scratch rebuild — synthesis regenerated).

6. **Summarise with a receipt** — proof of work, not a claim. End with the standard receipt so a real
   rebuild can never be mistaken for a no-op (the *Show your work* principle in [`CLAUDE.md`](../../CLAUDE.md)):
   ```bash
   node .claude/lib/receipt.mjs rebuild --scope "$WIKI_DIR" \
     --kv pages=<n> --kv sources=<n> --kv graphCommit=<sha> --note "<gaps surfaced / lint verdict>"
   ```
   Then remind the user that `/cairn-sync-all` (docs + code + `/lodestar`) keeps it fresh incrementally.

## Guardrails
- Wiki lives **outside** the code repos — write only under `$WIKI_DIR/`.
- Raw sources are **immutable** — read, never edit. Don't modify source.
- Heavy operation — only run when the wiki genuinely needs rebuilding.
