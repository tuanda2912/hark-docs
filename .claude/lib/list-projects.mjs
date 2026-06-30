#!/usr/bin/env node
// list-projects.mjs — discover second-brain projects by scanning for wiki.context.md.
// Each project's wiki.context.md frontmatter (name/domain/topology/status) IS the registry —
// no central state, nothing to drift. Optionally filter by domain.
//
// Usage:
//   node list-projects.mjs <root> [--domain <d>] [--depth <n>]

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const positional = [];
let domainFilter = null, depthFlag = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--domain') domainFilter = (argv[++i] || '').toLowerCase() || null;
  else if (argv[i] === '--depth') depthFlag = parseInt(argv[++i] || '', 10);
  else if (argv[i].startsWith('--')) { /* unknown flag — ignore */ }
  else positional.push(argv[i]);
}
const root = positional[0];                                    // first true positional (not a flag value)
const maxDepth = (depthFlag == null || Number.isNaN(depthFlag)) ? 4 : depthFlag;
if (!root) { console.error('Usage: list-projects.mjs <root> [--domain <d>] [--depth <n>]'); process.exit(2); }

const SKIP = new Set(['node_modules', '.git', '.understand-anything', 'dist', 'build', '.next', 'vendor', 'target']);
const found = [];
function walk(dir, depth) {
  if (depth > maxDepth) return;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isFile() && e.name === 'wiki.context.md') found.push(join(dir, e.name));
    else if (e.isDirectory() && !SKIP.has(e.name) && !e.name.startsWith('.')) walk(join(dir, e.name), depth + 1);
  }
}
walk(root, 0);

function frontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  const fm = {};
  if (m) for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) fm[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/\s+#.*$/, '');
  }
  return fm;
}

let rows = found.map((p) => {
  const fm = frontmatter(readFileSync(p, 'utf8'));
  return {
    name: fm.name || '?', domain: fm.domain || '—', topology: fm.topology || '—',
    status: fm.status || '—', path: p.replace(/\/wiki\.context\.md$/, ''),
  };
}).filter((r) => r.name !== '?' && !r.name.startsWith('<'));  // skip un-filled templates + garbled frontmatter

if (domainFilter) rows = rows.filter((r) => r.domain.toLowerCase() === domainFilter);
rows.sort((a, b) => (a.domain + a.name).localeCompare(b.domain + b.name));

if (!rows.length) {
  console.log(domainFilter
    ? `No projects with domain "${domainFilter}" under ${root}`
    : `No filled wiki.context.md projects found under ${root}`);
  process.exit(0);
}
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('NAME', 22)} ${pad('DOMAIN', 16)} ${pad('TOPOLOGY', 14)} ${pad('STATUS', 9)} PATH`);
for (const r of rows) console.log(`${pad(r.name, 22)} ${pad(r.domain, 16)} ${pad(r.topology, 14)} ${pad(r.status, 9)} ${r.path}`);
console.log(`\n${rows.length} project(s)${domainFilter ? ` in domain "${domainFilter}"` : ''}.`);
