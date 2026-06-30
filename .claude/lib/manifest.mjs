#!/usr/bin/env node
// manifest.mjs — source → derived-wiki-page provenance for correct incremental sync.
// Persists what you can't grep: which wiki pages each raw source produced, so /cairn-sync-docs can
//   (a) skip unchanged sources by content hash, (b) refresh/retire exactly the pages a changed source owns,
//   (c) answer "which pages does this source feed?" deterministically (the sources.md map).
// Zero deps (node:fs + node:crypto). The manifest is INSTANCE state — gitignored, never committed.
//
// Usage:
//   node manifest.mjs hash <file>                                 -> sha256 hex of the file
//   node manifest.mjs check <manifest> <source> <hash>            -> new | changed | unchanged
//   node manifest.mjs record <manifest> <source> <hash> [page...] -> upsert {hash, updated, pages[]}
//   node manifest.mjs pages <manifest> <source>                  -> pages this source feeds (one per line)
//   node manifest.mjs sources <manifest> <page>                  -> sources that feed a page (reverse)
//   node manifest.mjs prune <manifest> <source>                  -> drop a source's entry (upstream deleted)
// Exit: 0 ok · 1 usage/error.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const [cmd, ...rest] = process.argv.slice(2);
const die = (m) => { console.error('✗ ' + m); process.exit(1); };
const load = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return { version: 1, sources: {} }; } };
const save = (p, d) => writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
const sha = (p) => { if (!existsSync(p)) die(`no such file: ${p}`); return createHash('sha256').update(readFileSync(p)).digest('hex'); };

switch (cmd) {
  case 'hash': {
    const [f] = rest; if (!f) die('usage: hash <file>');
    process.stdout.write(sha(f) + '\n'); break;
  }
  case 'check': {
    const [mf, src, hash] = rest; if (!mf || !src || !hash) die('usage: check <manifest> <source> <hash>');
    const e = load(mf).sources[src];
    process.stdout.write((!e ? 'new' : e.hash === hash ? 'unchanged' : 'changed') + '\n'); break;
  }
  case 'record': {
    const [mf, src, hash, ...pages] = rest; if (!mf || !src || !hash) die('usage: record <manifest> <source> <hash> [page...]');
    const d = load(mf);
    d.sources[src] = { hash, updated: new Date().toISOString().slice(0, 10), pages: [...new Set(pages)] };
    save(mf, d); console.error(`✓ recorded ${src} → ${pages.length} page(s)`); break;
  }
  case 'pages': {
    const [mf, src] = rest; if (!mf || !src) die('usage: pages <manifest> <source>');
    (load(mf).sources[src]?.pages || []).forEach((p) => console.log(p)); break;
  }
  case 'sources': {
    const [mf, page] = rest; if (!mf || !page) die('usage: sources <manifest> <page>');
    for (const [src, e] of Object.entries(load(mf).sources)) if ((e.pages || []).includes(page)) console.log(src);
    break;
  }
  case 'prune': {
    const [mf, src] = rest; if (!mf || !src) die('usage: prune <manifest> <source>');
    const d = load(mf); delete d.sources[src]; save(mf, d); console.error(`✓ pruned ${src}`); break;
  }
  default:
    die('usage: manifest.mjs <hash|check|record|pages|sources|prune> ... (see header)');
}
