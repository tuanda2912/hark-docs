---
description: Health-check the wiki + feature-map — verify what the kit GENERATED is still honest. Deterministic structural lint (frontmatter · index ↔ files · link/wikilink integrity · @generated marker balance · log format) + fail-closed graph-staleness gate + LLM semantic checks (contradictions · citing-a-superseded-decision-as-current · uncited claims · gap-rot). Report + optionally --fix the safe ones (cairn)
argument-hint: "(optional) '--fix' to apply safe mechanical fixes · or a scope: structure | links | staleness | feature-map"
---

# Lint the second brain (cairn)

The wiki and the feature-map are **generated artifacts** — they rot. This is the periodic health check that
**verifies what was generated is still true and well-formed**, the Layer-2 *Lint* operation from
[`CLAUDE.md`](../../CLAUDE.md) shipped as a command. It is read-only by default; `--fix` applies only safe,
mechanical fixes (never the human-owned `status`/`gap` column, never a raw source, never a `@generated` block).

It splits work the Cairn way: a **deterministic, zero-LLM script** does the mechanical structural checks
(repeatable, cheap, fail-closed exit codes); the **LLM** does only the semantic judgments a script can't.
`/lodestar`'s Phase 6 lints the map *at build time* — this lints the **whole wiki, any time**.

Caller hint: **$ARGUMENTS** (`--fix` = apply safe fixes · or a scope word to run a subset · default: all).

## Preflight — run the deterministic checks

```bash
[ -f .claude/wiki.config.sh ] && . .claude/wiki.config.sh
: "${WIKI_DIR:=wiki}" ; : "${CODE_REPOS:=main}"
type resolve_code_repo >/dev/null 2>&1 || resolve_code_repo(){ echo "${1:-../code}"; }
[ -d .claude ] || { echo "❌ Run from the workspace root (the dir holding .claude/ + $WIKI_DIR/)."; exit 1; }
LINT=.claude/lib/lint-wiki.mjs ; QG=.claude/skills/lodestar/query-graph.mjs

echo "=== 1. structural lint ($WIKI_DIR) ==="
node "$LINT" "$WIKI_DIR"; echo "(structural exit: $?  — 0 clean/warnings · 1 errors · 2 no wiki dir)"

echo ; echo "=== 2. fail-closed staleness gate (feature-map graph vs HEAD) ==="
for a in $CODE_REPOS; do
  CODE="$(resolve_code_repo "$a")" ; G="$CODE/.understand-anything/knowledge-graph.json"
  if [ -f "$G" ]; then
    echo "--- repo:$a ($CODE) ---" ; node "$QG" stale "$G" "$CODE"; echo "(stale exit: $?  — 0 fresh · 1 stale/missing · 2 broken)"
  else
    echo "--- repo:$a ($CODE) — no code graph; run /cairn-sync-code (or /understand $CODE) first ---"
  fi
done

echo ; echo "=== 3. surgical per-page staleness (which wiki pages a changed source owns) ==="
MF="${MANIFEST:-.cairn-manifest.json}"
BASES="--base ."
for a in $CODE_REPOS; do BASES="$BASES --base $(resolve_code_repo "$a")"; done
node .claude/lib/stale-pages.mjs "$MF" $BASES; echo "(per-page stale exit: $?  — 0 fresh/no-manifest · 1 stale pages · 2 broken manifest)"
```

The script (`lint-wiki.mjs`) prints a JSON report on stdout and a `✗ / ⚠ / ℹ` summary on stderr. Read both.
**Fail-closed:** a structural exit of `1`, or any repo's graph-staleness exit of `1`/`2`, is a **BLOCKER** —
the map is resolving through a stale graph and is lying until refreshed. Step 3's exit `1` is the **surgical**
signal: the listed pages (and only those) are downstream of a changed/deleted source — refresh exactly them
via `/cairn-sync-docs`; the rest of the wiki is trustworthy. (No `.cairn-manifest.json` yet ⇒ exit 0 with a
note; run a sync once to enable it.)

## Procedure

### Phase 1 — Ingest the deterministic findings
Take the structural findings, the graph-staleness result, and the **per-page stale list** (step 3) from the
preflight as-is. Do **not** re-derive them by hand — the scripts are the source of truth for the mechanical
layer (frontmatter completeness, index ↔ files, broken links/wikilinks, orphans, log format, `@generated`
marker balance, TODO inventory, sources cross-ref) and for which exact pages a changed source has staled.

### Phase 2 — Semantic checks (LLM — the part a script can't do)
Only now read page *contents* (route via `index.md`; open only what you need — token-lean). Check:
- **Contradictions** — two pages asserting incompatible facts about the same thing. Cite both `file:claim`.
- **Citing a superseded decision as current** — a `status: current` page that relies on a page/ADR whose own
  status is `superseded` (or contradicts a recorded decision). This is the highest-value rot — surface it.
- **Uncited non-obvious claims** — assertions that should trace to a source but don't (beyond the script's
  frontmatter `sources:` presence check). Per the no-invention rule, flag for a citation or a `> TODO:`.
- **Status drift** — a page marked `current` whose cited source actually describes it as planned/superseded.
- **Gap-rot (reverse gap-check)** — *(only if `feature-map.md` + a code graph exist)* any feature still
  marked `gap` whose capability **now has files in the graph** → "gap may be closed, re-verify status."
  Seed the capability→files check with `node .claude/skills/lodestar/query-graph.mjs tag-files <graph.json> <tag>`.
- **Orphan judgement** — for each script-flagged orphan, decide: genuinely unreferenced (cross-link it) vs a
  legitimate root/hub (fine).

### Phase 3 — Report
Emit one consolidated report, grouped by severity, deterministic + semantic findings merged:

```markdown
## Cairn lint — <wiki path>  ·  <YYYY-MM-DD>

**Verdict:** HEALTHY | WARNINGS | BLOCKERS
**Staleness:** fresh @ <graphCommit> | STALE (<n> changed files vs HEAD — run /cairn-sync-code)
**Stale pages:** none | <pages downstream of a changed/deleted source — refresh exactly these via /cairn-sync-docs>

### Blockers (must fix — structural breakage or stale graph)
- <file:line> [<check>] — <issue> → <the exact fix / command to run>

### Warnings (should fix — uncited claims, supersession gaps, orphans, index drift)
- <file> [<check>] — <issue>

### Semantic findings (LLM)
- <fileA ↔ fileB> — contradiction: <…>
- <file> — current page cites superseded <decision> as authoritative
- <feature> — gap may be closed (capability <tag> now has files)

### Info
- open TODOs (<n>): <file:line> …
- <other ℹ from the script>

### Passed
- <what's clean — frontmatter complete, links resolve, markers balanced, graph fresh, …>
```

Be specific and actionable: every blocker/warning names the file and the fix (often a `/cairn-*` command).

### Phase 4 — Fix  *(only if `--fix` was passed)*
Apply **only** safe, mechanical, reversible fixes, then re-run the preflight to confirm they cleared:
- add a missing page to `index.md` (under the right category); add `feature-map.md` to the index;
- append a missing/placeholder `log.md` entry; normalise an `updated:` value to `YYYY-MM-DD`;
- repair an unambiguous broken relative link (target obviously moved/renamed — exactly one candidate).

**Never auto-fix:** the `status`/`gap` column (human-owned — propose a diff instead), `@generated:lodestar`
blocks (re-run `/lodestar`), contradictions/uncited claims (need a source — leave a `> TODO:` or ask), or
anything ambiguous. List what you fixed and what you deliberately left for a human.

### Phase 5 — Log the pass
Append one entry to `<wiki>/log.md` (newest first), per the wiki's log schema:
`## [YYYY-MM-DD] lint | <verdict> — <e> errors, <w> warnings` + a one-line note of what was fixed (if any).

## Guardrails
- **Read-only by default.** Without `--fix`, change nothing — only report.
- **Raw sources are immutable** — never edit a source to satisfy a lint; that's a normal dev change, not a fix.
- **Fail-closed on staleness.** A stale graph ⇒ BLOCKER, not a warning — say so plainly; don't bless a map
  resolved through a graph that lags HEAD.
- **Don't relitigate human judgment.** The `status`/`gap` column and the synthesis in hand-owned sections are
  the curator's — flag, propose, but never overwrite.
