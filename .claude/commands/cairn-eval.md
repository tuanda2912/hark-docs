---
description: Prove the feature→file map beats grep — score Cairn's answer vs an honest grep baseline against a hand-authored ground-truth corpus, with a PASS/FAIL ship-gate (cairn)
argument-hint: "(optional) path to the corpus — default eval/corpus.json"
---

# Evaluate the feature→file map vs grep (cairn)

Cairn's central claim is that a **precomputed change-set beats a fresh grep**. `/cairn-eval` is the proof:
it scores Cairn's answer (**candidate**) next to an honest **grep baseline** against a hand-authored
ground-truth corpus, and **PASS/FAILs against a stated gate**. It's the difference between *asserting*
"beats grep" and *measuring* it. Full schema + authoring guide: [`eval/README.md`](../../eval/README.md).

Corpus from the caller: **$ARGUMENTS** (a corpus path; default `eval/corpus.json`).

## Preflight — run the harness
```bash
[ -d .claude ] || { echo "❌ Run from the workspace root."; exit 1; }
CORPUS="eval/corpus.json"   # or the path the caller passed in $ARGUMENTS
[ -f "$CORPUS" ] || { echo "ℹ️ No corpus at $CORPUS — author one (see eval/README.md). Demo: eval/corpus.example.json"; CORPUS="eval/corpus.example.json"; }
node .claude/lib/eval-lodestar.mjs "$CORPUS"
echo "(eval exit: $?  — 0 PASS · 1 FAIL · 2 broken corpus)"
```
The script prints a JSON report on stdout and a per-query table + verdict on stderr. Read both.

## Procedure

### Phase 1 — Run + read the result
Take the table as-is: per-query `grep` vs `cairn` recall, the Δ (percentage points), forbidden-file hits,
and the overall verdict. **Exit 1 (FAIL) is a real signal**, not a nuisance — either the map is missing
files the ground truth says should move, or it's not beating grep by the gate's margin.

### Phase 2 — Diagnose a FAIL (don't paper over it)
- **Low candidate recall** → the graph isn't tagging the right files with that capability (re-run
  `/cairn-sync-code` / `/understand`), or the `capability` in the corpus is wrong, or `/lodestar` hasn't
  mapped that feature yet → a genuine **gap** (consider `/cairn-save` to record it).
- **Candidate ≈ baseline** → Cairn isn't adding value for that query *yet*; expected for in-file features,
  but a **cross-service / seam** query that grep can't see should win — if it doesn't, the contract isn't captured.
- **Forbidden hits** → the capability tag is too broad (over-predicting). Tighten the tag/vocabulary.

### Phase 3 — Report
Summarise: overall grep vs cairn recall + Δ, the verdict, and for any FAIL the specific queries + the fix
(re-sync the graph, fix a tag, map a feature, or record a gap). Do **not** weaken the gate or the baseline
to force a PASS — a fair grep that wins is information, not an embarrassment.

## Guardrails
- **Read-only.** This command measures; it changes no wiki content.
- **A fair baseline.** The grep terms must be ones a developer would really try — never cripple grep to flatter Cairn.
- **Countable gate.** Keep `minAbsolute` / `minDeltaPP` numeric; "good enough" is a number, not a vibe.
- **Author ground truth honestly** — `expected[]` is what *truly* moves, not what makes the score look good.
