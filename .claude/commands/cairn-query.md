---
description: Answer a question from the wiki — BM25-routed, token-budgeted in 3 depth tiers, cite sources, and file the answer back if it's valuable and missing (cairn)
argument-hint: "the question to answer from the wiki"
---

# Query the second brain (cairn)

Answer **$ARGUMENTS** from the wiki — the Layer-2 *Query* operation in [`CLAUDE.md`](../../CLAUDE.md) as a
command. Token-lean by design: a deterministic **BM25 router** (`query-wiki.mjs` — zero-dep, no
embeddings/ollama) points you at the few pages that answer the question, so you open only those, not the
whole wiki.

## Preflight
```bash
[ -f .claude/wiki.config.sh ] && . .claude/wiki.config.sh
: "${WIKI_DIR:=wiki}"
[ -d "$WIKI_DIR" ] || { echo "❌ No $WIKI_DIR/ here — bootstrap with /cairn-rebuild."; exit 1; }
node .claude/lib/query-wiki.mjs "$WIKI_DIR" "<the question>"   # BM25-ranked candidate pages
```

## Procedure — escalate by tier, stop as soon as you can answer

### Tier 1 — warm + catalog (cheapest)
Read `wiki/hot.md` (if present) and `wiki/index.md`. Many questions are answered, or routed, from here.

### Tier 2 — the ranked pages
Run the BM25 router (preflight). Open the **top 2–4** pages it returns and answer from them.

### Tier 3 — neighbours (only if still thin)
Follow cross-links / `[[wikilinks]]` out of the Tier-2 pages, or widen `--top`. Open only what you need.

## Answer
- **Cite every non-obvious claim** (`file:section` or a decision id). No invention — if the wiki doesn't say,
  say so (and treat it as a gap).
- **Mark status** — flag if a cited page is `planned`/`superseded`, not `current`.

## File-back (compounding)
If the answer was **valuable and not already a page**, file it back so the next query is cheaper: write a
page (Ingest contract in `CLAUDE.md`) or capture the decision with **`/cairn-save`** — then it's in the index
next time. Commit on the user's say-so.

## Guardrails
- **Token-lean** — route first, open few; never read the whole wiki.
- **Cite or abstain.** Don't synthesise an answer the wiki doesn't support.
- **Read-only unless filing back**, and a file-back commits only on say-so.
