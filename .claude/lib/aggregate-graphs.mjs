#!/usr/bin/env node
// aggregate-graphs.mjs — cross-repo view for a MULTI-REPO microservice workspace.
// Reads lodestar.config.json's codeRepos[], loads each repo's understand-anything graph, and emits the
// per-repo service partition + per-repo staleness. In a multi-repo workspace each REPO is a service (or
// its layers are sub-services). Single-repo workspaces don't need this — use query-graph.mjs directly.
//
// Usage: node aggregate-graphs.mjs <lodestar.config.json> [workspaceRoot]
//   workspaceRoot defaults to cwd; codeRepos[].path / .graph are resolved relative to it.
// Exits nonzero if ANY repo's graph is stale (fail-closed), so /lodestar can refuse-or-warn.

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, join, resolve, isAbsolute } from 'node:path';

const [, , configPath, workspaceRootArg] = process.argv;
if (!configPath) { console.error('Usage: aggregate-graphs.mjs <lodestar.config.json> [workspaceRoot]'); process.exit(2); }

const root = workspaceRootArg ? resolve(workspaceRootArg) : process.cwd();
let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'));
} catch (e) {
  // Broken/missing config is broken INPUT (exit 2), not staleness (exit 1) — match query-graph.mjs.
  console.error(`broken/unreadable config at ${configPath}: ${e.message}`);
  process.exit(2);
}
if (config.codeRepos !== undefined && !Array.isArray(config.codeRepos)) {
  // codeRepos present but not an array is broken INPUT (exit 2) — without this it would slip past the
  // empty-guard below and crash in the for…of with an uncaught exit 1 (the stale-collision we just fixed).
  console.error(`broken config: codeRepos must be an array, got ${typeof config.codeRepos}`);
  process.exit(2);
}
const repos = Array.isArray(config.codeRepos) ? config.codeRepos : [];
if (repos.length === 0) {
  // Zero graphs to verify is NOT "all fresh" — fail-closed so /lodestar can't build on nothing.
  console.error('no codeRepos[] in config — nothing to verify (fail-closed)');
  console.log(JSON.stringify({ workspace: { repoCount: 0, languages: [], allFresh: false, note: 'no codeRepos configured' }, repos: [] }, null, 2));
  process.exit(1);
}
const FILE_LEVEL = new Set(['file', 'config', 'document', 'service']);
const abs = (p) => (isAbsolute(p) ? p : resolve(root, p));

const out = [];
for (const r of repos) {
  const repoPath = abs(r.path || '.');
  const graphPath = abs(r.graph || join(r.path || '.', '.understand-anything/knowledge-graph.json'));
  const entry = { name: r.name || repoPath, path: repoPath, graphExists: existsSync(graphPath) };
  if (!entry.graphExists) { entry.fresh = false; entry.note = 'no graph — run /understand on this repo'; out.push(entry); continue; }

  let g, byId;
  try {
    g = JSON.parse(readFileSync(graphPath, 'utf8'));
    if (!g || !Array.isArray(g.nodes)) throw new Error('graph has no nodes[] array');
    byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
  } catch (e) {
    entry.broken = true; entry.fresh = false; entry.note = `unreadable graph: ${e.message}`;
    out.push(entry); continue;
  }
  entry.languages = [...new Set((g.project?.languages || []).map((l) => String(l).toLowerCase()))];
  entry.layers = (g.layers || []).map((l) => ({
    name: l.name,
    files: (l.nodeIds || []).map((id) => byId[id]).filter((n) => n && FILE_LEVEL.has(n.type)).length,
  }));
  entry.fileCount = g.nodes.filter((n) => FILE_LEVEL.has(n.type)).length;

  // staleness (graph commit vs repo HEAD, ignoring the graph's own artifacts)
  const metaPath = join(dirname(graphPath), 'meta.json');
  let graphCommit = '';
  try { if (existsSync(metaPath)) graphCommit = JSON.parse(readFileSync(metaPath, 'utf8')).gitCommitHash || ''; }
  catch (e) { entry.broken = true; entry.note = `unreadable meta.json: ${e.message}`; }
  let head = '', changed = [];
  try { head = execSync(`git -C "${repoPath}" rev-parse HEAD`, { encoding: 'utf8' }).trim(); } catch { /* not git */ }
  if (graphCommit && head && graphCommit !== head) {
    try {
      changed = execSync(`git -C "${repoPath}" diff ${graphCommit}..HEAD --name-only`, { encoding: 'utf8' })
        .trim().split('\n').filter(Boolean).filter((p) => !p.startsWith('.understand-anything/'));
    } catch { /* commit gone */ }
  }
  entry.graphCommit = graphCommit.slice(0, 12);
  entry.head = head.slice(0, 12);
  entry.fresh = !entry.broken && Boolean(graphCommit && head) && changed.length === 0;
  entry.sourceChanged = changed.length;
  out.push(entry);
}

const allLangs = [...new Set(out.flatMap((e) => e.languages || []))];
const anyBroken = out.some((e) => e.broken);
const anyStaleOrMissing = out.some((e) => !e.graphExists || !e.fresh);
console.log(JSON.stringify({
  workspace: {
    repoCount: repos.length,
    languages: allLangs,
    topologyHint: repos.length > 1 ? 'microservices (multi-repo)' : 'single-repo',
    allFresh: !anyStaleOrMissing && !anyBroken,
  },
  repos: out,
}, null, 2));
// fail-closed exit codes: 2 = broken graph input · 1 = any repo stale or missing-graph · 0 = all fresh
process.exit(anyBroken ? 2 : (anyStaleOrMissing ? 1 : 0));
