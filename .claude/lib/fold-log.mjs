#!/usr/bin/env node
// fold-log.mjs — roll up old log.md entries into a fold page so the append-only log stays skimmable.
// EXTRACTIVE only (no invention): moves the OLDEST entries into wiki/folds/<range>.md verbatim and leaves
// a single pointer entry in their place; keeps the most recent <keep> entries inline. Dry-run by default.
// log.md is newest-first (the lint enforces it), so in file order the oldest entries are last.
//
// Usage:
//   node fold-log.mjs <wikiDir> [--keep N] [--apply]
// Output: JSON plan on stdout + human summary on stderr. Exit 0 ok · 2 no log.md.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// --- pure parsing/selection (unit-tested; no IO) --------------------------------------------------
export function parseLog(text) {
  const lines = String(text || '').split('\n');
  const heads = [];
  lines.forEach((ln, i) => { const m = ln.match(/^##\s+\[(\d{4}-\d{2}-\d{2})\]/); if (m) heads.push({ i, date: m[1] }); });
  const preamble = heads.length ? lines.slice(0, heads[0].i).join('\n') : text;
  const entries = heads.map((h, k) => {
    const end = k + 1 < heads.length ? heads[k + 1].i : lines.length;
    return { date: h.date, raw: lines.slice(h.i, end).join('\n').replace(/\s+$/, '') };
  });
  return { preamble: preamble.replace(/\s+$/, ''), entries };
}

// Newest-first: keep the first <keep>, fold the rest (the older tail).
export function selectFold(entries, keep) {
  if (entries.length <= keep) return { fold: [], kept: entries };
  return { kept: entries.slice(0, keep), fold: entries.slice(keep) };
}

export function foldRange(fold) {
  const dates = fold.map((e) => e.date).sort();
  return { from: dates[0], to: dates[dates.length - 1] };
}

// --- CLI ------------------------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const keepI = args.indexOf('--keep');
  const keep = keepI >= 0 ? parseInt(args[keepI + 1], 10) || 20 : 20;
  const wikiDir = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--keep') || 'wiki';
  const logPath = join(wikiDir, 'log.md');
  if (!existsSync(logPath)) { console.error(`✗ no log.md at ${logPath}`); process.exit(2); }

  const { preamble, entries } = parseLog(readFileSync(logPath, 'utf8'));
  const { fold, kept } = selectFold(entries, keep);
  const plan = { logPath, total: entries.length, keep, willFold: fold.length, apply };

  if (!fold.length) {
    console.log(JSON.stringify({ ...plan, noop: true }, null, 2));
    if (!apply) console.error(`  nothing to fold — ${entries.length} entries ≤ keep ${keep}`);
    process.exit(0);
  }

  const range = foldRange(fold);
  const foldRel = `folds/log-${range.from}_to_${range.to}.md`;
  const pointer = `## [${range.to}] fold | ${fold.length} older entries rolled up → [${foldRel}](${foldRel})`;
  plan.foldFile = join(wikiDir, foldRel);
  plan.range = range;

  console.log(JSON.stringify(plan, null, 2));
  if (!apply) {
    console.error(`  would fold ${fold.length} oldest entries (${range.from}…${range.to}) → ${foldRel}`);
    console.error(`  keeping ${kept.length} recent inline. Re-run with --apply to write.`);
    process.exit(0);
  }

  const foldBody = `# Folded log entries — ${range.from} … ${range.to}\n\n` +
    `> ${fold.length} entries rolled up from \`log.md\` (extractive; newest-first preserved).\n\n` +
    fold.map((e) => e.raw).join('\n\n') + '\n';
  mkdirSync(join(wikiDir, 'folds'), { recursive: true });
  writeFileSync(plan.foldFile, foldBody);
  const newLog = [preamble, '', kept.map((e) => e.raw).join('\n\n'), '', pointer, ''].join('\n').replace(/\n{3,}/g, '\n\n');
  writeFileSync(logPath, newLog);
  console.error(`  ✓ folded ${fold.length} entries → ${foldRel}; ${kept.length} kept inline + 1 pointer.`);
  process.exit(0);
}
