#!/usr/bin/env node
// query-graph.mjs — deterministic, zero-LLM helpers for the /feature-map skill.
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

import { readFileSync, existsSync } from 'node:fs';
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
  query-graph.mjs node-tags   <graph.json>`);
  process.exit(code);
}
if (!cmd || !graphPath) usage();

// --- stale: fail-closed staleness check (exit 1 when graph != code HEAD) ---
if (cmd === 'stale') {
  const repo = rest[0];
  if (!repo) usage();
  const metaPath = join(dirname(graphPath), 'meta.json');
  const graphCommit = existsSync(metaPath)
    ? (JSON.parse(readFileSync(metaPath, 'utf8')).gitCommitHash || '')
    : '';
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
  const fresh = Boolean(graphCommit && head) && sourceChanged.length === 0;
  console.log(JSON.stringify({
    graphCommit: graphCommit.slice(0, 12), head: head.slice(0, 12),
    fresh, commitMatch: graphCommit === head,
    sourceChangedCount: sourceChanged.length, sourceChanged
  }, null, 2));
  process.exit(fresh ? 0 : 1); // nonzero ⇒ real source drift; caller must refresh or warn (fail-closed)
}

const g = JSON.parse(readFileSync(graphPath, 'utf8'));
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
  const l = (g.layers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
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

usage();
