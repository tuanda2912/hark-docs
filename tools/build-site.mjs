// build-site.mjs — render hark-docs/docs/*.md into a polished static HTML site.
//
// Output: docs/site/ (mirrors the docs tree; 00-index.md → index.html). Pure
// static HTML/CSS/JS, fully offline — no CDN, no runtime markdown, no network.
// Markdown via `marked` (GFM); code highlighting baked in at build time via
// `highlight.js`. The wiki/ folder is intentionally NOT touched.
//
// Run:  node tools/build-site.mjs   (or: npm run build  in tools/)

import { marked } from 'marked';
import hljs from 'highlight.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const OUT = path.join(DOCS, 'site');
const ASSETS_SRC = path.join(__dirname, 'assets');
const SITE_TITLE = 'Hark Docs';

// ── collect markdown (skip the generated site dir) ────────────────────────
function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (path.resolve(full) === path.resolve(OUT)) continue;
    const st = fs.statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (name.toLowerCase().endsWith('.md')) acc.push(full);
  }
  return acc;
}

// ── YAML-ish frontmatter (title / status / last_updated) ──────────────────
function splitFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: src };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (mm) meta[mm[1]] = mm[2].replace(/^["']|["']$/g, '').trim();
  }
  return { meta, body: src.slice(m[0].length) };
}

// ── marked: rewrite intra-doc .md links → .html, highlight code ───────────
const renderer = new marked.Renderer();
const baseLink = renderer.link.bind(renderer);
renderer.link = (href, title, text) => {
  let h = href || '';
  if (!/^(https?:|mailto:|#|~|\/)/i.test(h)) h = h.replace(/\.md(#.*)?$/i, '.html$1');
  const out = baseLink(h, title, text);
  return /^https?:/i.test(h) ? out.replace('<a ', '<a target="_blank" rel="noopener" ') : out;
};

marked.setOptions({
  gfm: true,
  headerIds: true,
  headerPrefix: '',
  mangle: false,
  renderer,
  highlight(code, lang) {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code;
    }
  },
});

const stripTags = (s) => s.replace(/<[^>]+>/g, '');
const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const outRelFor = (srcRel) =>
  srcRel === '00-index.md' ? 'index.html' : srcRel.replace(/\.md$/i, '.html');

const GROUP_LABELS = { '': 'Overview', product: 'Product', analysis: 'Analysis', design: 'Design', qa: 'QA' };
const GROUP_ORDER = ['', 'product', 'analysis', 'design', 'qa'];
const groupFor = (srcRel) => (srcRel.includes('/') ? srcRel.split('/')[0] : '');

// ── pass 1: parse every doc ───────────────────────────────────────────────
const files = walk(DOCS).map((abs) => {
  const srcRel = path.relative(DOCS, abs).split(path.sep).join('/');
  const { meta, body } = splitFrontmatter(fs.readFileSync(abs, 'utf8'));
  const h1 = body.match(/^#\s+(.+)$/m);
  const title = (meta.title || (h1 && h1[1]) || path.basename(srcRel, '.md')).trim();
  return { srcRel, meta, body, title, outRel: outRelFor(srcRel), group: groupFor(srcRel) };
});

const groups = GROUP_ORDER.map((g) => ({
  label: GROUP_LABELS[g] || g.charAt(0).toUpperCase() + g.slice(1),
  items: files.filter((f) => f.group === g).sort((a, b) => a.srcRel.localeCompare(b.srcRel)),
})).filter((grp) => grp.items.length);

const relPrefix = (outRel) => {
  const depth = outRel.split('/').length - 1;
  return depth === 0 ? './' : '../'.repeat(depth);
};

const navHtml = (current, prefix) =>
  groups
    .map((grp) => {
      const links = grp.items
        .map(
          (it) =>
            `<a${it.outRel === current ? ' class="active"' : ''} href="${prefix}${it.outRel}">${esc(it.title)}</a>`,
        )
        .join('\n');
      return `<div class="nav-group"><div class="nav-group-label">${esc(grp.label)}</div>${links}</div>`;
    })
    .join('\n');

const tocHtml = (html) => {
  const heads = [...html.matchAll(/<h([23]) id="([^"]+)">([\s\S]*?)<\/h\1>/g)];
  if (heads.length < 2) return '<nav class="toc"></nav>';
  const items = heads
    .map(([, lvl, id, inner]) => `<a class="toc-l${lvl}" href="#${id}">${esc(stripTags(inner))}</a>`)
    .join('\n');
  return `<nav class="toc"><div class="toc-label">On this page</div>${items}</nav>`;
};

const renderPage = ({ title, contentHtml, current, meta }) => {
  const prefix = relPrefix(current);
  const pills = [
    meta.status ? `<span class="meta-pill">${esc(meta.status)}</span>` : '',
    meta.last_updated ? `<span class="meta-pill">updated ${esc(meta.last_updated)}</span>` : '',
  ].join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · ${SITE_TITLE}</title>
<script>try{var t=localStorage.getItem('hark-docs-theme')||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
<link rel="stylesheet" href="${prefix}assets/style.css">
</head>
<body>
<button class="menu-btn" aria-label="Toggle navigation" aria-expanded="false">&#9776;</button>
<div class="scrim" hidden></div>
<aside class="sidebar">
  <a class="brand" href="${prefix}index.html"><span class="brand-mark" aria-hidden="true"></span>${SITE_TITLE}</a>
  <input class="search" type="search" placeholder="Filter docs…" aria-label="Filter docs">
  <nav class="nav">${navHtml(current, prefix)}</nav>
</aside>
<main class="content">
  <header class="topbar">
    <div class="crumbs">${esc(title)}</div>
    <button class="theme-btn" type="button" aria-label="Toggle light/dark theme"></button>
  </header>
  <article class="doc">
    ${pills ? `<div class="doc-meta">${pills}</div>` : ''}
    ${contentHtml}
  </article>
  <footer class="foot">Rendered from <code>hark-docs/docs</code> — Hark is local-first, on-device. The wiki is kept as-is.</footer>
</main>
${tocHtml(contentHtml)}
<script src="${prefix}assets/app.js"></script>
</body>
</html>`;
};

// ── build ─────────────────────────────────────────────────────────────────
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const f of files) {
  const contentHtml = marked.parse(f.body);
  const outAbs = path.join(OUT, f.outRel);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });
  fs.writeFileSync(outAbs, renderPage({ title: f.title, contentHtml, current: f.outRel, meta: f.meta }));
}

fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
for (const a of fs.readdirSync(ASSETS_SRC)) {
  fs.copyFileSync(path.join(ASSETS_SRC, a), path.join(OUT, 'assets', a));
}

console.log(`✓ built ${files.length} pages → ${path.relative(ROOT, OUT)}/`);
for (const f of files) console.log(`   ${f.outRel}  ←  docs/${f.srcRel}`);
