#!/usr/bin/env node
// query-wiki.mjs — zero-dep BM25 retrieval over the wiki (the engine behind /cairn-query).
// Ranks wiki pages for a query by Okapi BM25 (TF·IDF with length normalisation) — pure math: no model,
// no embeddings, no ollama, no service. The deterministic "which pages answer this?" router, so a query
// opens only the few pages it needs (token-lean) instead of re-reading the whole wiki.
//
// Usage:
//   node query-wiki.mjs <wikiDir> "<query>" [--top N] [--quiet]
// Output: JSON ranking on stdout + a human table on stderr. Exit 0 ok · 2 no wiki dir / no query.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

const STOP = new Set(('the a an of to and or for with in on at by is are be it this that these those as from ' +
  'i you we they them our do does should can could will would what which when how why not but if so into ' +
  'out up down over under than then else also more most some any all each per via use used using').split(/\s+/));

// --- pure ranking (unit-tested; no IO) ------------------------------------------------------------
export function tokenize(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !STOP.has(w));
}

// docs: [{ id, text }]. Returns a BM25 index (term freqs per doc, idf, avg length).
export function buildIndex(docs) {
  const N = docs.length || 1;
  const df = new Map();
  const prepared = docs.map((d) => {
    const tf = new Map();
    for (const t of tokenize(d.text)) tf.set(t, (tf.get(t) || 0) + 1);
    let len = 0; for (const c of tf.values()) len += c;
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    return { id: d.id, tf, len };
  });
  const avgdl = prepared.reduce((a, d) => a + d.len, 0) / N || 1;
  const idf = new Map();
  for (const [t, n] of df) idf.set(t, Math.log(1 + (N - n + 0.5) / (n + 0.5)));
  return { docs: prepared, idf, avgdl, N };
}

export function rank(query, index, { k1 = 1.5, b = 0.75 } = {}) {
  const terms = tokenize(query);
  const out = [];
  for (const d of index.docs) {
    let s = 0;
    for (const t of terms) {
      const f = d.tf.get(t);
      if (!f) continue;
      s += (index.idf.get(t) || 0) * (f * (k1 + 1)) / (f + k1 * (1 - b + b * (d.len / index.avgdl)));
    }
    if (s > 0) out.push({ id: d.id, score: s });
  }
  return out.sort((a, b) => b.score - a.score);
}

// --- CLI (IO: read wiki, weight title/tags by repetition, rank) -----------------------------------
function frontmatter(text) {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const keys = {};
  for (const raw of text.slice(3, end).split('\n')) {
    const m = raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) keys[m[1]] = m[2];
  }
  return keys;
}
function walk(dir) {
  const md = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) md.push(...walk(p));
    else if (e.isFile() && e.name.endsWith('.md')) md.push(p);
  }
  return md;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const topI = args.indexOf('--top');
  const top = topI >= 0 ? parseInt(args[topI + 1], 10) || 8 : 8;
  const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--top');
  const wikiDir = positional[0];
  const query = positional.slice(1).join(' ');
  if (!wikiDir || !existsSync(wikiDir) || !statSync(wikiDir).isDirectory()) { console.error(`✗ no wiki dir: ${wikiDir || '(none)'}`); process.exit(2); }
  if (!query) { console.error('✗ usage: query-wiki.mjs <wikiDir> "<query>" [--top N]'); process.exit(2); }

  const docs = walk(wikiDir).map((p) => {
    const text = readFileSync(p, 'utf8');
    const fm = frontmatter(text) || {};
    const title = fm.title || (text.match(/^#\s+(.+)$/m) || [])[1] || basename(p, '.md');
    const tags = fm.tags || '';
    return { id: p, text: `${title} ${title} ${title} ${tags} ${tags} ${text}` }; // title×3, tags×2 boost
  });
  const ranked = rank(query, buildIndex(docs)).slice(0, top);
  console.log(JSON.stringify({ query, wikiDir, indexed: docs.length, results: ranked.map((r) => ({ page: r.id, score: Number(r.score.toFixed(3)) })) }, null, 2));
  if (!quiet) {
    console.error(`\n  query: "${query}"  ·  ${docs.length} pages indexed (BM25)\n`);
    if (!ranked.length) console.error('  (no lexical matches — try other terms, or the wiki may not cover this yet)');
    for (const r of ranked) console.error(`  ${r.score.toFixed(2).padStart(6)}  ${r.id}`);
  }
  process.exit(0);
}
