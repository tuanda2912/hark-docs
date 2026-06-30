#!/usr/bin/env node
// query-graph.mjs — deterministic, zero-LLM helpers for the /lodestar skill.
// Reads an understand-anything knowledge graph (JSON) + git; slices by layer/tag,
// checks staleness. This is the "router" half of the framework: structured lookups
// that need no model inference (see SKILL.md §Principles — "deterministic routing").
//
// Usage:
//   node query-graph.mjs stale       <graph.json> <repoDir>     # graph commit vs HEAD + changed files (exit 1 if stale)
//   node query-graph.mjs layers      <graph.json>               # "<fileCount>\t<layer name>" per layer
//   node query-graph.mjs layer-files <graph.json> "<layer name>"# files in a layer (the service partition)
//   node query-graph.mjs tag-files   <graph.json> <tag>         # files carrying a capability tag
//   node query-graph.mjs node-tags   <graph.json>               # "<filePath>\t<tag,tag,...>" per file (seed the vocab)
//   node query-graph.mjs topology    <graph.json> [repoDir]     # PROPOSE monolith|microservices from languages + deploy manifests

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';

const [, , cmd, graphPath, ...rest] = process.argv;
const FILE_LEVEL = new Set(['file', 'config', 'document', 'service']);

function usage(code = 2) {
  console.error(`Usage:
  query-graph.mjs stale       <graph.json> <repoDir>
  query-graph.mjs layers      <graph.json>
  query-graph.mjs layer-files <graph.json> "<layer name>"
  query-graph.mjs tag-files   <graph.json> <tag>
  query-graph.mjs node-tags   <graph.json>
  query-graph.mjs topology    <graph.json> [repoDir]`);
  process.exit(code);
}
if (!cmd || !graphPath) usage();

// --- stale: fail-closed staleness check (0=fresh · 1=stale/missing · 2=broken input) ---
if (cmd === 'stale') {
  const repo = rest[0];
  if (!repo) usage();
  // Graph absent entirely → a distinct signal ("build it", not "refresh a stale one").
  if (!existsSync(graphPath)) {
    console.log(JSON.stringify({ graphMissing: true, fresh: false, hint: 'no graph — run /understand on this repo first' }, null, 2));
    process.exit(1);
  }
  const metaPath = join(dirname(graphPath), 'meta.json');
  let graphCommit = '';
  try {
    if (existsSync(metaPath)) graphCommit = JSON.parse(readFileSync(metaPath, 'utf8')).gitCommitHash || '';
  } catch (e) {
    console.error(`broken meta.json at ${metaPath}: ${e.message}`);
    console.log(JSON.stringify({ brokenInput: true, fresh: false }, null, 2));
    process.exit(2); // distinct from 1 (stale) so the caller can tell "corrupt" from "stale"
  }
  let head = '', changed = [];
  try { head = execSync(`git -C "${repo}" rev-parse HEAD`, { encoding: 'utf8' }).trim(); } catch { /* not a git repo */ }
  if (graphCommit && head && graphCommit !== head) {
    try {
      changed = execSync(`git -C "${repo}" diff ${graphCommit}..HEAD --name-only`, { encoding: 'utf8' })
        .trim().split('\n').filter(Boolean);
    } catch { /* commit gone */ }
  }
  // The graph's own artifacts are not source drift — exclude them so a commit that only
  // re-committed .understand-anything/ doesn't read as stale.
  const sourceChanged = changed.filter((p) => !p.startsWith('.understand-anything/'));
  const notGitRepo = !head;
  const fresh = Boolean(graphCommit && head) && sourceChanged.length === 0;
  console.log(JSON.stringify({
    graphCommit: graphCommit.slice(0, 12), head: head.slice(0, 12),
    fresh, commitMatch: graphCommit === head, notGitRepo,
    sourceChangedCount: sourceChanged.length, sourceChanged
  }, null, 2));
  process.exit(fresh ? 0 : 1); // nonzero ⇒ source drift / not-a-git-repo; caller must refresh or warn (fail-closed)
}

// graph load for the layer/tag/topology/node-tags commands — fail-closed on broken input (exit 2)
let g;
try {
  g = JSON.parse(readFileSync(graphPath, 'utf8'));
  if (!g || !Array.isArray(g.nodes)) throw new Error('graph has no nodes[] array');
} catch (e) {
  console.error(`broken/unreadable graph at ${graphPath}: ${e.message}`);
  process.exit(2); // distinct from 1 — broken input, not a clean "stale" signal
}
const byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));

if (cmd === 'layers') {
  for (const l of g.layers || []) {
    const files = (l.nodeIds || []).map((id) => byId[id]).filter((n) => n && FILE_LEVEL.has(n.type));
    console.log(`${files.length}\t${l.name}`);
  }
  process.exit(0);
}

if (cmd === 'layer-files') {
  const name = rest.join(' ');
  const l = (g.layers || []).find((x) => (x.name || '').toLowerCase() === name.toLowerCase());
  if (!l) { console.error(`layer not found: ${name}`); process.exit(1); }
  for (const n of (l.nodeIds || []).map((id) => byId[id]).filter((x) => x && FILE_LEVEL.has(x.type))) {
    console.log(n.filePath || n.name);
  }
  process.exit(0);
}

if (cmd === 'tag-files') {
  const tag = (rest[0] || '').toLowerCase();
  if (!tag) usage();
  for (const n of g.nodes.filter((n) =>
    FILE_LEVEL.has(n.type) && (n.tags || []).map((t) => String(t).toLowerCase()).includes(tag))) {
    console.log(n.filePath || n.name);
  }
  process.exit(0);
}

if (cmd === 'node-tags') {
  for (const n of g.nodes.filter((n) => FILE_LEVEL.has(n.type))) {
    console.log(`${n.filePath || n.name}\t${(n.tags || []).join(',')}`);
  }
  process.exit(0);
}

// --- topology: PROPOSE monolith vs microservices (detect-and-confirm, never decide) ---
if (cmd === 'topology') {
  const repo = rest[0]; // optional repo dir for filesystem signals
  const CODE_LANGS = new Set(['typescript', 'javascript', 'python', 'swift', 'go', 'rust', 'java',
    'kotlin', 'ruby', 'c', 'c++', 'cpp', 'csharp', 'c#', 'php', 'scala', 'solidity', 'objective-c',
    'dart', 'elixir']);
  const langs = [...new Set((g.project?.languages || []).map((l) => String(l).toLowerCase()))]
    .filter((l) => CODE_LANGS.has(l));
  const signals = [];
  let structural = 0; // STRONG, filesystem-based service-boundary signals (the real evidence)

  // Polyglot is only a WEAK hint — in-repo polyglot is NORMAL for monoliths (a build script, docs,
  // or a deploy toolkit in another language). On its own it is NOT evidence of service boundaries.
  if (langs.length >= 2) signals.push(`polyglot (${langs.join(', ')}) — weak hint only; in-repo polyglot is common in monoliths`);
  else signals.push(`single code language: ${langs[0] || 'unknown'}`);
  signals.push(`${(g.layers || []).length} graph layers`);

  const has = (p) => { try { statSync(join(repo, p)); return true; } catch { return false; } };
  const MANIFESTS = ['package.json', 'go.mod', 'Cargo.toml', 'pom.xml', 'pyproject.toml'];
  if (repo) {
    // docker-compose is a MEDIUM hint, not decisive — monoliths routinely use it to orchestrate backing
    // services (db/redis) for local dev. It corroborates; it no longer crosses the threshold alone
    // (mirrors the prior pass's "polyglot is a weak hint" fix — same false-positive class).
    if (['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'].some(has)) { structural += 2; signals.push('docker-compose present → service orchestration (MEDIUM hint — also common in monoliths for backing services)'); }
    // Count distinct build roots: flat siblings (repo/<unit>/<manifest>) AND nested monorepo units
    // (repo/{services,apps,packages}/<unit>/<manifest>). The 1-level scan alone missed nested monorepos —
    // the layout that most signals a boundary — so its strong evidence was invisible.
    let pkgUnits = 0;
    try {
      for (const e of readdirSync(repo, { withFileTypes: true })) {
        if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue;
        if (MANIFESTS.some((mf) => has(join(e.name, mf)))) pkgUnits++;
      }
    } catch { /* unreadable */ }
    for (const container of ['services', 'apps', 'packages']) {
      try {
        for (const e of readdirSync(join(repo, container), { withFileTypes: true })) {
          if (!e.isDirectory() || e.name.startsWith('.')) continue;
          if (MANIFESTS.some((mf) => has(join(container, e.name, mf)))) pkgUnits++;
        }
      } catch { /* container absent/unreadable */ }
    }
    if (pkgUnits >= 2) { structural += 3; signals.push(`${pkgUnits} build roots (sub-dir manifests, incl. nested) → multiple build units (monorepo/polyrepo — confirm whether they deploy as separate services)`); }
    if (has('Procfile')) { structural += 1; signals.push('Procfile present (multiple processes)'); }
    for (const d of ['services', 'apps', 'packages']) if (has(d)) { structural += 1; signals.push(`monorepo dir "${d}/" present`); }
  } else {
    signals.push('(no repoDir passed — filesystem signals skipped; pass <repoDir> to detect docker-compose / multiple build roots)');
  }

  // Microservices requires a STRUCTURAL boundary signal; polyglot alone does NOT qualify.
  const proposal = structural >= 3 ? 'microservices' : 'monolith';
  if (proposal === 'monolith' && langs.length >= 2) {
    signals.push('verdict: polyglot but the structural signal is below threshold (no multiple build roots; compose alone is only a medium hint) → treated as MONOLITH — confirm');
  }
  console.log(JSON.stringify({ proposal, structuralScore: structural, languages: langs, signals }, null, 2));
  console.error('\n# PROPOSAL ONLY — topology is a deployment fact code alone cannot prove. A MULTI-REPO workspace (several CODE_* repos) is microservices regardless of this single-repo guess. Confirm with the user.');
  process.exit(0);
}

usage();
