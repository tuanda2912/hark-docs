#!/usr/bin/env node
// lint-wiki.mjs — deterministic, zero-LLM structural lint for a Cairn WikiLLM wiki.
// The mechanical half of /cairn-lint: the checks that need no model inference — frontmatter
// completeness, index ↔ files consistency, link/wikilink integrity, @generated marker balance,
// log.md format, sources cross-reference. The command layer adds the SEMANTIC checks (contradictions,
// citing-a-superseded-decision-as-current, weak citations, gap-rot) that do need the LLM.
//
// Same "router" philosophy as query-graph.mjs: structured, repeatable, fail-closed exit codes.
//
// Usage:
//   node lint-wiki.mjs <wikiDir>            # default wikiDir = "wiki"
//   node lint-wiki.mjs <wikiDir> --quiet    # JSON to stdout only (no stderr summary)
//
// Output: a JSON report on stdout + a human summary on stderr.
// Exit:   0 = clean or warnings/info only · 1 = ≥1 ERROR-severity finding · 2 = broken input (no wiki dir)

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, resolve, basename, extname } from 'node:path';
import { wordCount, tagSet, findThin, findOverlaps } from './density.mjs';
import { scan as scanSecrets } from './scan-secrets.mjs';

const args = process.argv.slice(2);
const quiet = args.includes('--quiet');
const wikiDir = args.find((a) => !a.startsWith('-')) || 'wiki';

// Pages the wiki treats specially — they have their own shape, not the per-topic page frontmatter contract.
const SPECIAL = new Set(['index.md', 'log.md', 'sources.md', 'feature-map.md', 'hot.md']);
const REQUIRED_FM = ['type', 'title', 'status', 'sources', 'updated', 'tags'];
const STATUS_VALUES = new Set(['current', 'planned', 'superseded']);

const findings = [];
const add = (severity, check, file, message, line = null, fixable = false) =>
  findings.push({ severity, check, file, line, message, fixable });

// --- locate the wiki ------------------------------------------------------------------------------
if (!existsSync(wikiDir) || !statSync(wikiDir).isDirectory()) {
  const out = { ok: false, brokenInput: true, wikiDir, error: `wiki dir not found: ${wikiDir}` };
  console.log(JSON.stringify(out, null, 2));
  if (!quiet) console.error(`✗ ${out.error} — run from the workspace root, or pass the wiki path.`);
  process.exit(2);
}

// --- collect markdown files (recursive, shallow real wikis stay flat) ------------------------------
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
const allMd = walk(wikiDir);
const rel = (p) => relative(wikiDir, p);
const realFiles = new Set(allMd.map((p) => resolve(p)));

const indexPath = join(wikiDir, 'index.md');
const logPath = join(wikiDir, 'log.md');
const sourcesPath = join(wikiDir, 'sources.md');
const featureMapPath = join(wikiDir, 'feature-map.md');

// content pages = everything that must obey the per-topic page contract (the special hub files don't)
const contentPages = allMd.filter((p) => !SPECIAL.has(basename(p).toLowerCase()));

// --- helpers --------------------------------------------------------------------------------------
function frontmatter(text) {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  const block = text.slice(3, end).split('\n');
  const keys = {};
  let curKey = null;
  for (const raw of block) {
    const line = raw.replace(/\s+$/, '');
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m && !line.startsWith(' ') && !line.startsWith('\t')) {
      curKey = m[1];
      keys[curKey] = m[2]; // inline value (may be '', '[a,b]', or '' before a block list)
    } else if (curKey && /^\s*-\s+/.test(line)) {
      keys[curKey] = (keys[curKey] ? keys[curKey] + ' ' : '') + line.trim();
    }
  }
  return keys;
}
const isEmptyVal = (v) =>
  v == null || v.trim() === '' || v.trim() === '[]' || v.trim() === '""' || v.trim() === "''";

// extract local .md link targets (markdown + wikilink) with line numbers
function links(text) {
  const out = [];
  const lines = text.split('\n');
  lines.forEach((ln, i) => {
    let m;
    const mdRe = /\[[^\]]*\]\(([^)\s]+)\)/g;
    while ((m = mdRe.exec(ln))) out.push({ kind: 'md', target: m[1], line: i + 1 });
    const wlRe = /\[\[([^\]]+)\]\]/g;
    while ((m = wlRe.exec(ln))) out.push({ kind: 'wikilink', target: m[1], line: i + 1 });
  });
  return out;
}

// --- per-page frontmatter contract ----------------------------------------------------------------
let pagesScanned = 0;
const pageText = new Map();
for (const p of allMd) pageText.set(resolve(p), readFileSync(p, 'utf8'));

for (const p of contentPages) {
  pagesScanned++;
  const text = pageText.get(resolve(p));
  const fm = frontmatter(text);
  if (!fm) {
    add('error', 'frontmatter', rel(p), 'no frontmatter block (need: ' + REQUIRED_FM.join(', ') + ')');
    continue;
  }
  for (const k of REQUIRED_FM) {
    if (!(k in fm)) add('error', 'frontmatter', rel(p), `missing frontmatter key: ${k}`);
    else if (isEmptyVal(fm[k])) {
      // sources empty is the no-invention smell → warning; other empties are errors
      if (k === 'sources') add('warning', 'citation', rel(p), 'sources: is empty — page cites no source (no-invention rule)');
      else add('error', 'frontmatter', rel(p), `frontmatter key is empty: ${k}`);
    }
  }
  if (fm.status && !isEmptyVal(fm.status)) {
    const s = fm.status.trim().toLowerCase();
    if (!STATUS_VALUES.has(s)) add('error', 'status', rel(p), `invalid status "${fm.status.trim()}" (use: current | planned | superseded)`);
    if (s === 'superseded') {
      const hasSuccessor = /superseded[_-]?by/i.test(text) || /\bsupersed(ed|es)\b[^\n]*\]\(|\bsee\b[^\n]*\]\(/i.test(text);
      if (!hasSuccessor) add('warning', 'supersession', rel(p), 'status: superseded but no pointer to the successor page/decision');
    }
  }
  if (fm.updated && !isEmptyVal(fm.updated) && !/^\d{4}-\d{2}-\d{2}$/.test(fm.updated.trim()))
    add('error', 'frontmatter', rel(p), `updated not YYYY-MM-DD: "${fm.updated.trim()}"`);
}

// --- index.md ↔ files consistency -----------------------------------------------------------------
const indexedTargets = new Set();
if (existsSync(indexPath)) {
  const text = pageText.get(resolve(indexPath));
  for (const l of links(text)) {
    if (l.kind !== 'md') continue;
    const tgt = l.target.split('#')[0];
    if (!tgt.endsWith('.md') || /^https?:|^mailto:/.test(tgt)) continue;
    const abs = resolve(dirname(indexPath), tgt);
    indexedTargets.add(abs);
    if (!realFiles.has(abs)) add('error', 'index', 'index.md', `links to a missing page: ${tgt}`, l.line);
  }
} else {
  add('error', 'index', 'index.md', 'index.md is missing — it is the catalog read first on every query');
}
// pages on disk not catalogued in index.md
for (const p of contentPages) {
  if (!indexedTargets.has(resolve(p)))
    add('warning', 'index', rel(p), 'page not catalogued in index.md (orphan from the index)');
}
if (existsSync(featureMapPath) && !indexedTargets.has(resolve(featureMapPath)))
  add('warning', 'index', 'feature-map.md', 'feature-map.md not catalogued in index.md');

// --- link / wikilink integrity (all pages) --------------------------------------------------------
const slugMap = new Map(); // slug (filename w/o .md) -> abs
const titleMap = new Map(); // lowercased title -> abs
for (const p of allMd) {
  slugMap.set(basename(p, '.md').toLowerCase(), resolve(p));
  const fm = frontmatter(pageText.get(resolve(p)) || '');
  if (fm && fm.title && !isEmptyVal(fm.title)) titleMap.set(fm.title.trim().toLowerCase(), resolve(p));
}
const inbound = new Map(allMd.map((p) => [resolve(p), 0]));
for (const p of allMd) {
  const text = pageText.get(resolve(p));
  for (const l of links(text)) {
    if (l.kind === 'md') {
      const tgt = l.target.split('#')[0];
      if (!tgt) continue; // pure anchor
      if (/^https?:|^mailto:|^#/.test(tgt)) continue;
      if (extname(tgt) && tgt.endsWith('.md')) {
        const abs = resolve(dirname(p), tgt);
        if (!realFiles.has(abs)) add('error', 'link', rel(p), `broken link: ${l.target}`, l.line);
        else if (inbound.has(abs)) inbound.set(abs, inbound.get(abs) + 1);
      }
    } else {
      // wikilink [[slug]] or [[slug|text]]
      const slug = l.target.split('|')[0].trim().toLowerCase().replace(/\.md$/, '');
      const abs = slugMap.get(slug) || titleMap.get(slug) || slugMap.get(slug.replace(/\s+/g, '-'));
      if (!abs) add('error', 'link', rel(p), `broken wikilink: [[${l.target}]]`, l.line);
      else if (inbound.has(abs)) inbound.set(abs, inbound.get(abs) + 1);
    }
  }
}
// orphan = no inbound link from anywhere (index counts) and not a special hub file
for (const p of contentPages) {
  if ((inbound.get(resolve(p)) || 0) === 0)
    add('info', 'orphan', rel(p), 'no inbound links from any page (cross-link it, or confirm it is a root)');
}

// --- log.md format (## [YYYY-MM-DD] <op> | <title>) -----------------------------------------------
if (existsSync(logPath)) {
  const lines = (pageText.get(resolve(logPath)) || '').split('\n');
  const heads = [];
  lines.forEach((ln, i) => {
    if (/^##\s+/.test(ln) && !/^##\s+Pages/.test(ln)) {
      const m = ln.match(/^##\s+\[(\d{4}-\d{2}-\d{2})\]\s+\S.*\|\s+.+$/);
      if (!m) add('warning', 'log', 'log.md', `entry heading not "## [YYYY-MM-DD] <op> | <title>": ${ln.trim()}`, i + 1);
      else heads.push({ date: m[1], line: i + 1 });
    }
  });
  for (let i = 1; i < heads.length; i++)
    if (heads[i].date > heads[i - 1].date) {
      add('info', 'log', 'log.md', 'entries are not newest-first (a later entry has an earlier date above it)', heads[i].line);
      break;
    }
} else {
  add('warning', 'log', 'log.md', 'log.md is missing — the append-only ingest/query/lint history');
}

// --- hot.md staleness (the warm cache must not lag the newest log entry) ---------------------------
const hotPath = join(wikiDir, 'hot.md');
if (existsSync(hotPath)) {
  const hotText = pageText.get(resolve(hotPath)) || readFileSync(hotPath, 'utf8');
  const hotFm = frontmatter(hotText) || {};
  const hotDate = (hotFm.updated || '').trim();
  const logText = existsSync(logPath) ? (pageText.get(resolve(logPath)) || '') : '';
  const logDates = [...logText.matchAll(/^##\s+\[(\d{4}-\d{2}-\d{2})\]/gm)].map((m) => m[1]).sort();
  const newestLog = logDates[logDates.length - 1];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hotDate))
    add('warning', 'hot', 'hot.md', 'no valid updated: date — cannot verify the warm cache is fresh (treat as cold)');
  else if (newestLog && hotDate < newestLog)
    add('warning', 'hot', 'hot.md', `stale: updated ${hotDate} but log.md has a ${newestLog} entry — refresh via /cairn-save or a sync (treat as cold until then)`);
}

// --- sources.md cross-reference (best-effort string match) ----------------------------------------
if (existsSync(sourcesPath)) {
  const srcText = pageText.get(resolve(sourcesPath)) || '';
  for (const p of contentPages) {
    const fm = frontmatter(pageText.get(resolve(p)) || '');
    if (!fm || !fm.sources || isEmptyVal(fm.sources)) continue;
    const cited = fm.sources.replace(/[[\]'"]/g, ' ').split(/[,\s]+/).filter((s) => s.length > 3);
    for (const c of cited)
      if (!srcText.includes(c)) add('info', 'sources', rel(p), `frontmatter source "${c}" not found in sources.md`);
  }
}

// --- feature-map.md @generated marker balance -----------------------------------------------------
if (existsSync(featureMapPath)) {
  const t = pageText.get(resolve(featureMapPath)) || '';
  const starts = (t.match(/@generated:lodestar\s+start/g) || []).length;
  const ends = (t.match(/@generated:lodestar\s+end/g) || []).length;
  if (starts !== ends) add('error', 'markers', 'feature-map.md', `unbalanced @generated:lodestar markers (${starts} start, ${ends} end) — re-run /lodestar`);
}

// --- TODO scan (the CLAUDE.md "> TODO:" convention = unresolved/uncertain claims) -----------------
for (const p of allMd) {
  (pageText.get(resolve(p)) || '').split('\n').forEach((ln, i) => {
    if (/(^|\s)(>?\s*)TODO:/.test(ln)) add('info', 'todo', rel(p), `open TODO: ${ln.trim().slice(0, 100)}`, i + 1);
  });
}

// --- wiki.context.md presence (the Read-order contract's enforced-context page) -------------------
if (!existsSync(resolve(wikiDir, '..', 'wiki.context.md')))
  add('warning', 'context', 'wiki.context.md', 'missing — the per-project conventions/profile the Read-order contract loads first (run /cairn-setup)');

// --- content confidentiality (leaked secrets/keys) ------------------------------------------------
// Warning here (false positives shouldn't block a lint); /cairn-guard is the hard fail-closed gate.
for (const p of allMd) {
  for (const hit of scanSecrets(pageText.get(resolve(p)) || ''))
    add('warning', 'secret', rel(p), `possible ${hit.desc} (${hit.rule}) — redact, or mark the line <!-- cairn:allow-secret reason -->`, hit.line);
}

// --- density (anti-sprawl, advisory) --------------------------------------------------------------
// Cairn's generated wiki tends to sprawl into more, thinner pages than a human would write. These are
// info-only hints — never blockers — toward fewer, denser pages.
{
  const dpages = contentPages.map((p) => {
    const text = pageText.get(resolve(p)) || '';
    return { file: rel(p), words: wordCount(text), tags: tagSet(frontmatter(text)?.tags) };
  });
  for (const t of findThin(dpages, 80))
    add('info', 'density', t.file, `thin page (${t.words} words) — consider merging into a related page`);
  for (const o of findOverlaps(dpages, 0.6, 3))
    add('info', 'density', o.a, `tags overlap ${Math.round(o.score * 100)}% with ${o.b} — possibly one topic split in two; merge or cross-link`);
}

// --- summarise ------------------------------------------------------------------------------------
const starter = pagesScanned === 0;
if (starter) add('info', 'starter', wikiDir, 'no content pages yet (starter wiki?) — run /cairn-rebuild to populate it');
const counts = { error: 0, warning: 0, info: 0 };
for (const f of findings) counts[f.severity]++;

const report = {
  ok: counts.error === 0,
  wikiDir,
  pagesScanned,
  starter,
  counts,
  verdict: counts.error ? 'BLOCKERS' : counts.warning ? 'WARNINGS' : 'HEALTHY',
  findings,
};
console.log(JSON.stringify(report, null, 2));

if (!quiet) {
  const icon = { error: '✗', warning: '⚠', info: 'ℹ' };
  for (const f of findings)
    console.error(`${icon[f.severity]} [${f.check}] ${f.file}${f.line ? ':' + f.line : ''} — ${f.message}`);
  console.error(`\n${report.verdict}  ·  ${counts.error} error(s), ${counts.warning} warning(s), ${counts.info} info  ·  ${pagesScanned} page(s)`);
}

process.exit(counts.error ? 1 : 0);
