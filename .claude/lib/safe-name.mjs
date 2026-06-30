#!/usr/bin/env node
// safe-name.mjs — sanitize an LLM-derived name into a safe wiki filename slug.
// Defense at the WRITE BOUNDARY: an LLM proposes page titles, so before any model string names a file we
// strip path traversal, separators, control chars, and accents — a name can never escape the wiki dir or
// inject a path. Pure, zero-dep, deterministic.
//
// Usage:
//   node safe-name.mjs "Chose SSE over WebSockets / simpler ops"   ->  chose-sse-over-websockets-simpler-ops
//   echo "name" | node safe-name.mjs
// Exit: 0 + slug on stdout · 1 if the input is empty after sanitizing (caller must pick a real name)

export function safeName(input, { maxLen = 80 } = {}) {
  let s = String(input ?? '');
  s = s.normalize('NFKD').replace(/[̀-ͯ]/g, ''); // drop accents/diacritics
  s = s.replace(/\.md$/i, '').toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, '-'); // anything else (/, \, .., spaces, control chars) -> hyphen
  s = s.replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '');
  if (s.length > maxLen) s = s.slice(0, maxLen).replace(/-+$/g, '');
  return s;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = process.argv.slice(2).join(' ').trim();
  const get = arg
    ? Promise.resolve(arg)
    : new Promise((r) => { let d = ''; process.stdin.on('data', (c) => (d += c)); process.stdin.on('end', () => r(d.trim())); });
  get.then((raw) => {
    const slug = safeName(raw);
    if (!slug) { console.error('✗ name is empty after sanitizing — provide a descriptive name'); process.exit(1); }
    process.stdout.write(slug + '\n');
  });
}
