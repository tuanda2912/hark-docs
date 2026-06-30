#!/usr/bin/env node
// stale-pages.mjs — surgical, per-page staleness from the sync manifest.
// The graph-staleness gate is all-or-nothing (the whole wiki BLOCKS when the graph lags HEAD). This is the
// fine-grained complement: it re-hashes each source the manifest tracks and reports EXACTLY which wiki
// pages are downstream of a changed or deleted source — so you refresh 3 pages, not 43. Zero deps.
//
// Reuses the .cairn-manifest.json that /cairn-sync-docs records (source → {hash, pages[]}).
//
// Usage:
//   node stale-pages.mjs <manifest> [--base DIR]... [--quiet]
// --base adds a root to resolve source paths against (default: cwd). First base where the source exists wins;
// pass one per source root (e.g. --base . --base ../code for docs in the workspace + code in a sibling repo).
// Exit: 0 = all tracked sources fresh (or no manifest yet) · 1 = ≥1 stale page · 2 = broken manifest.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

// Pure: classify each manifest source via an injected hashOf(src) → hash | null (null = source gone).
// Returns the per-source verdict and the de-duplicated, sorted set of stale pages.
export function classifySources(sources, hashOf) {
  const bySource = [];
  const stale = new Set();
  for (const [src, e] of Object.entries(sources || {})) {
    const cur = hashOf(src);
    const status = cur == null ? 'missing' : cur === e.hash ? 'fresh' : 'changed';
    const pages = e.pages || [];
    bySource.push({ source: src, status, pages });
    if (status !== 'fresh') pages.forEach((p) => stale.add(p));
  }
  return {
    bySource: bySource.sort((a, b) => a.source.localeCompare(b.source)),
    stalePages: [...stale].sort(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const bases = [];
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base') { if (args[i + 1]) bases.push(args[++i]); }
    else if (!args[i].startsWith('-')) positional.push(args[i]);
  }
  if (!bases.length) bases.push('.');
  const mfPath = positional[0];
  const die = (code, m) => { console.error('✗ ' + m); process.exit(code); };

  if (!mfPath) die(2, 'usage: stale-pages.mjs <manifest> [--base DIR]...');
  if (!existsSync(mfPath)) {
    console.log(JSON.stringify({ ok: true, noManifest: true, manifest: mfPath, stalePages: [] }, null, 2));
    if (!quiet) console.error(`ℹ no manifest at ${mfPath} — run /cairn-sync-docs to enable per-page staleness.`);
    process.exit(0);
  }
  let manifest;
  try { manifest = JSON.parse(readFileSync(mfPath, 'utf8')); } catch (e) { die(2, `broken manifest JSON: ${e.message}`); }

  const hashOf = (src) => {
    for (const b of bases) {
      const p = join(b, src);
      if (existsSync(p)) return createHash('sha256').update(readFileSync(p)).digest('hex');
    }
    return null;
  };

  const { bySource, stalePages } = classifySources(manifest.sources, hashOf);
  const changed = bySource.filter((s) => s.status === 'changed');
  const missing = bySource.filter((s) => s.status === 'missing');
  const report = {
    ok: stalePages.length === 0,
    manifest: mfPath,
    bases,
    sources: bySource.length,
    changed: changed.map((s) => s.source),
    missing: missing.map((s) => s.source),
    stalePages,
    verdict: stalePages.length === 0 ? 'FRESH' : 'STALE',
  };
  console.log(JSON.stringify(report, null, 2));
  if (!quiet) {
    for (const s of changed) console.error(`⚠ changed: ${s.source}  →  ${s.pages.join(', ') || '(no pages)'}`);
    for (const s of missing) console.error(`✗ source gone: ${s.source}  →  ${s.pages.join(', ') || '(no pages)'}`);
    console.error(`\n${report.verdict}  ·  ${bySource.length} source(s) tracked  ·  ${stalePages.length} stale page(s)` +
      (stalePages.length ? `: ${stalePages.join(', ')}` : ''));
  }
  process.exit(report.ok ? 0 : 1);
}
