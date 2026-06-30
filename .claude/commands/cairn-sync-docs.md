---
description: Sync raw source docs from the configured source into the mirror and re-ingest changes into the wiki (cairn)
argument-hint: "(optional) a file/topic to focus the ingest on"
---

# Sync source docs → wiki (cairn)

Pull the latest **source docs** (requirements / ADRs / design docs / papers — whatever the wiki is built
from) from the configured **raw source** into the local mirror, detect what genuinely changed, and
**re-ingest the changes into the wiki** following the *Ingest* operation in [`CLAUDE.md`](../../CLAUDE.md).

Optional focus from the caller: **$ARGUMENTS** (if given, prioritise that file/topic; else ingest all changed).

> **Locations are configurable** via [`.claude/wiki.config.sh`](../wiki.config.sh) — `WIKI_DIR`,
> `DOCS_MIRROR`, and the raw source: set **`DOCS_SOURCE`** to a direct path (any folder / cloud-drive /
> network mount — it wins when set), or set `CLOUD_DOCS_NAME` to auto-discover a cloud library. No source
> configured ⇒ this command has nothing to sync (skip it; build the wiki from in-repo sources instead).
> Run from the **workspace root**.

## Procedure

1. **Resolve paths + detect real changes.** A cloud-synced source rewrites mtimes, so you MUST use `-c`
   (checksum) and filter to actual content changes:
   ```bash
   [ -f .claude/wiki.config.sh ] && . .claude/wiki.config.sh
   : "${WIKI_DIR:=wiki}" ; : "${DOCS_MIRROR:=raw-docs}" ; : "${MANIFEST:=.cairn-manifest.json}"
   type resolve_docs_source >/dev/null 2>&1 || resolve_docs_source(){ [ -n "$DOCS_SOURCE" ] && printf '%s' "${DOCS_SOURCE/#\~/$HOME}"; }
   [ -d "$WIKI_DIR" ] || { echo "❌ No $WIKI_DIR/ here — run from the workspace root, or bootstrap the wiki with /cairn-rebuild (the kit ships a starter $WIKI_DIR/)."; exit 1; }
   SRC=$(resolve_docs_source)
   [ -n "$SRC" ] && [ -d "$SRC" ] || { echo "ℹ️ No raw-docs source configured/found — set DOCS_SOURCE (or CLOUD_DOCS_NAME) in .claude/wiki.config.sh, or skip this command if your sources live in the code repo. (/cairn-doctor)"; exit 1; }
   command -v rsync >/dev/null || { echo "❌ rsync missing — run /cairn-doctor."; exit 1; }
   MD="$HOME/.local/bin/markitdown"; [ -x "$MD" ] || MD=$(command -v markitdown) || echo "⚠️ markitdown missing (only needed for binary docx/xlsx/pdf/pptx) — run /cairn-doctor."
   mkdir -p "$DOCS_MIRROR"
   echo "source: $SRC   |   mirror: $DOCS_MIRROR   |   wiki: $WIKI_DIR"
   rsync -rcn --delete --exclude='.DS_Store' -i "$SRC/" "$DOCS_MIRROR/" | grep -E '^(>|<|\*deleting)' || true
   ```
   - Lines starting with `>` / `<` / `*deleting` are **real changes**; `.f..T....` (time-only) is noise.
   - **No matching lines ⇒ docs already current.** Report "Sources already in sync (checksum-verified, N
     files)", make **no wiki edits**, and **stop**.

2. **Mirror the changes** (only if step 1 found real changes):
   ```bash
   rsync -rc --delete --exclude='.DS_Store' "$SRC/" "$DOCS_MIRROR/"
   ```
   ⚠️ Before trusting a `*deleting`, confirm it's a genuine upstream removal of a file the wiki cites —
   surface it, don't silently drop. **The raw source wins** on any conflict.

3. **Convert + read each new/changed doc** into a throwaway dir (NEVER under `$WIKI_DIR/` or a code repo).
   For binary formats (docx/xlsx/pdf/pptx) use markitdown; read text/markdown directly; view images with
   the Read tool:
   ```bash
   TMP=$(mktemp -d); "$MD" "<changed-file>" -o "$TMP/<name>.md"
   ```
   Note doc **versions** (a `…_v2` supersedes earlier ones for that topic). Confirm a real content change
   before re-ingesting: `node .claude/lib/manifest.mjs check "$MANIFEST" "<source>" "$(node .claude/lib/manifest.mjs hash <changed-file>)"` → `new|changed|unchanged` (skip `unchanged`).

4. **Ingest into the wiki** (under `$WIKI_DIR/`). Update the page(s) the change touches, plus
   `index.md` and `sources.md`. Cross-link; cite the source file + section. Refresh any supersession links.
   Then **record provenance** so the next sync is correct — the pages this source produced:
   ```bash
   node .claude/lib/manifest.mjs record "$MANIFEST" "<source path>" "<source hash>" "wiki/<page1>.md" "wiki/<page2>.md"
   ```
   This mechanizes the `source → pages` map `sources.md` describes (grep can't answer "which pages came from this source").

5. **Flag contradictions.** Where the new source diverges from what the wiki (or the code) says, verify
   against the **actual source**, record it, and surface it. If a feature/requirement gained or lost code,
   note it for `/lodestar`.

6. **Log it + reconcile deletions.** Add a dated entry to `$WIKI_DIR/log.md` (files changed old→new,
   pages updated, contradictions flagged). For any **upstream-deleted** source (a confirmed `*deleting`
   from step 1), retire the pages it solely owned — list them with
   `node .claude/lib/manifest.mjs pages "$MANIFEST" "<source>"`, act on them, then
   `node .claude/lib/manifest.mjs prune "$MANIFEST" "<source>"`. Remove `$TMP`.

7. **Summarise**: files changed, pages updated, contradictions — or "already current".

## Guardrails
- The wiki lives **outside** any code repo — never write wiki/scratch files into the project repo.
- Raw sources are **immutable** — read, never edit them. **Docs → wiki only**; don't modify code here.
