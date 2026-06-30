#!/usr/bin/env node
// eval-lodestar.mjs — the grep-baseline ship-gate for Cairn's feature→file claim.
// Cairn's whole pitch is "a precomputed change-set beats a fresh grep, and fails closed on staleness."
// This turns that claim into a MEASURED number: for each query in a hand-authored corpus ("if I change
// feature X, which files should move?") it scores Cairn's answer (CANDIDATE) against ground truth, next to
// an honest grep (BASELINE), and PASS/FAILs against a stated gate. Zero deps (grep + query-graph via shell).
//
// Per-query resolvers (a query may hard-code sets for self-contained fixtures, else they're computed):
//   baseline  = query.baseline  ?? grep <repo> for query.grepTerms (the honest dumb comparison)
//   candidate = query.candidate ?? query-graph.mjs tag-files <graph> <query.capability> (Cairn's substrate)
// (extend the candidate resolver to parse wiki/feature-map.md once your map is populated.)
//
// Usage:
//   node eval-lodestar.mjs <corpus.json> [--repo <path>] [--graph <graph.json>] [--quiet]
// Output: JSON report on stdout + a human table on stderr.
// Exit:   0 = gate PASS · 1 = gate FAIL · 2 = broken input (no/!corpus)

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const QG = new URL('../skills/lodestar/query-graph.mjs', import.meta.url).pathname;

// --- pure scoring (unit-tested; no IO) ------------------------------------------------------------
export function score(expected, predicted) {
  const E = new Set(expected), P = new Set(predicted);
  let tp = 0;
  for (const p of P) if (E.has(p)) tp++;
  const fp = P.size - tp, fn = E.size - tp;
  const precision = P.size ? tp / P.size : (E.size ? 0 : 1);
  const recall = E.size ? tp / E.size : 1;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { tp, fp, fn, precision, recall, f1 };
}

export function gateDecision(candidateRecall, baselineRecall, gate = {}) {
  const minAbs = gate.minAbsolute ?? 0;
  const minDelta = (gate.minDeltaPP ?? 0) / 100;
  const absOk = candidateRecall >= minAbs;
  const deltaOk = candidateRecall - baselineRecall >= minDelta;
  return {
    pass: absOk && deltaOk,
    reason:
      `candidate recall ${(candidateRecall * 100).toFixed(0)}% (gate ≥ ${(minAbs * 100).toFixed(0)}%) · ` +
      `Δ vs grep ${((candidateRecall - baselineRecall) * 100).toFixed(0)}pp (gate ≥ ${gate.minDeltaPP ?? 0}pp)`,
  };
}

export const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 1);
const norm = (arr) => [...new Set((arr || []).map((p) => String(p).replace(/^\.\//, '').replace(/\\/g, '/')))];
const terms = (feature) => String(feature || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

// --- IO resolvers ---------------------------------------------------------------------------------
function grepFiles(repo, grepTerms) {
  if (!repo || !existsSync(repo) || !grepTerms?.length) return [];
  const args = ['-rIl', '--exclude-dir=.git', '--exclude-dir=node_modules'];
  for (const t of grepTerms) args.push('-e', t);
  args.push('.');
  try { return execFileSync('grep', args, { cwd: repo, encoding: 'utf8' }).split('\n').filter(Boolean); }
  catch { return []; } // grep exits 1 on no matches
}
function graphTagFiles(graph, capability) {
  if (!graph || !existsSync(graph) || !capability) return [];
  try { return execFileSync('node', [QG, 'tag-files', graph, capability], { encoding: 'utf8' }).split('\n').filter(Boolean); }
  catch { return []; }
}

// --- CLI ------------------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const corpusPath = args.find((a) => !a.startsWith('--') && a !== flag('--repo') && a !== flag('--graph'));

  if (!corpusPath || !existsSync(corpusPath)) {
    console.error(`✗ no corpus at: ${corpusPath || '(none given)'} — author one (eval/README.md) or try eval/corpus.example.json`);
    process.exit(2);
  }
  let corpus;
  try { corpus = JSON.parse(readFileSync(corpusPath, 'utf8')); }
  catch (e) { console.error(`✗ broken corpus JSON: ${e.message}`); process.exit(2); }
  const repo = flag('--repo') || corpus.repo;
  const graph = flag('--graph') || corpus.graph;
  const gate = corpus.gate || {};

  const rows = (corpus.queries || []).map((q) => {
    const expected = norm(q.expected);
    const basePred = norm(q.baseline ?? grepFiles(repo, q.grepTerms || terms(q.feature)));
    const candPred = norm(q.candidate ?? graphTagFiles(graph, q.capability));
    const forbiddenHits = norm(q.forbidden).filter((f) => candPred.includes(f));
    return { id: q.id, category: q.category || 'uncategorized', baseline: score(expected, basePred), candidate: score(expected, candPred), forbiddenHits };
  });

  const cats = [...new Set(rows.map((r) => r.category))];
  const byCategory = cats.map((c) => {
    const rs = rows.filter((r) => r.category === c);
    return { category: c, n: rs.length, baselineRecall: avg(rs.map((r) => r.baseline.recall)), candidateRecall: avg(rs.map((r) => r.candidate.recall)) };
  });
  const overallBase = avg(rows.map((r) => r.baseline.recall));
  const overallCand = avg(rows.map((r) => r.candidate.recall));
  const decision = gateDecision(overallCand, overallBase, gate);
  const forbiddenTotal = rows.reduce((a, r) => a + r.forbiddenHits.length, 0);

  const report = {
    ok: decision.pass, corpus: corpusPath, queries: rows.length,
    overall: { baselineRecall: overallBase, candidateRecall: overallCand, deltaPP: (overallCand - overallBase) * 100 },
    byCategory, gate, decision, forbiddenHits: forbiddenTotal,
    rows: rows.map((r) => ({ id: r.id, category: r.category, baselineRecall: r.baseline.recall, candidateRecall: r.candidate.recall, candidatePrecision: r.candidate.precision, forbiddenHits: r.forbiddenHits })),
  };
  console.log(JSON.stringify(report, null, 2));

  if (!quiet) {
    const pct = (x) => `${(x * 100).toFixed(0)}%`.padStart(4);
    console.error('\n  query                          cat          grep   cairn   Δ');
    for (const r of rows) {
      const d = ((r.candidate.recall - r.baseline.recall) * 100).toFixed(0).padStart(4);
      console.error(`  ${r.id.padEnd(30).slice(0, 30)} ${r.category.padEnd(11).slice(0, 11)} ${pct(r.baseline.recall)}  ${pct(r.candidate.recall)}  ${d}pp${r.forbiddenHits.length ? '  ⚠ forbidden:' + r.forbiddenHits.length : ''}`);
    }
    console.error(`\n  OVERALL recall — grep ${pct(overallBase)} · cairn ${pct(overallCand)} · Δ ${((overallCand - overallBase) * 100).toFixed(0)}pp`);
    if (forbiddenTotal) console.error(`  ⚠ ${forbiddenTotal} forbidden file(s) predicted by candidate`);
    console.error(`\n  ${decision.pass ? '✓ PASS' : '✗ FAIL'} — ${decision.reason}`);
  }
  process.exit(decision.pass ? 0 : 1);
}
