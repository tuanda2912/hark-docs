#!/usr/bin/env node
// upgrade-kit.mjs — propagate Cairn framework updates into a deployed project's .claude/ kit.
// Cairn is *copied* (forked) into each workspace, so a framework fix never reaches already-deployed
// projects on its own — that gap stranded a guard-remote fix this session. This diffs the framework
// files of a SOURCE Cairn checkout against a DEPLOYED workspace and reports (or, with --apply, copies)
// the adds + changes. It NEVER touches project-local config or the wiki. Zero deps (node:fs + node:crypto).
//
// Framework files that travel:  .claude/commands · .claude/lib · .claude/skills · .claude/agents ·
//                               CLAUDE.md · .claude/cairn.version
// Never synced (yours):         *.config.json / *.config.sh (wiki.config.sh, lodestar.config.json),
//                               *.local.* , wiki/ , wiki.context.md , eval/corpus.json , .cairn-*
//
// Usage:
//   node upgrade-kit.mjs --source <cairnRepo> [--dest <workspace>] [--apply] [--quiet]
// Default is a DRY RUN (report only). --apply copies added+changed files and stamps .claude/cairn.version.
// Removed files (present in the deploy, gone from source) are REPORTED, never auto-deleted — a project may
// have added its own commands.
// Exit: 0 = in sync (or dry-run with no drift) · 1 = drift found (dry-run) · 2 = bad input.

import { readdirSync, readFileSync, existsSync, statSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { join, relative, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';

const INCLUDE_ROOTS = ['.claude/commands', '.claude/lib', '.claude/skills', '.claude/agents'];
const INCLUDE_FILES = ['CLAUDE.md', '.claude/cairn.version'];
const EXCLUDE = [/\.config\.(json|sh)$/, /\.local\./];

// Is this workspace-relative path a framework file Cairn should keep in sync across deploys?
export function isFramework(rel) {
  const r = rel.split(sep).join('/');
  if (EXCLUDE.some((re) => re.test(r))) return false;
  if (INCLUDE_FILES.includes(r)) return true;
  return INCLUDE_ROOTS.some((root) => r === root || r.startsWith(root + '/'));
}

// Pure diff of two path→hash maps. Sorted, deterministic.
export function planUpgrade(src, dst) {
  const added = [], changed = [], unchanged = [], removed = [];
  for (const [rel, h] of src) {
    if (!dst.has(rel)) added.push(rel);
    else if (dst.get(rel) !== h) changed.push(rel);
    else unchanged.push(rel);
  }
  for (const rel of dst.keys()) if (!src.has(rel)) removed.push(rel);
  return { added: added.sort(), changed: changed.sort(), removed: removed.sort(), unchanged: unchanged.sort() };
}

function* walkFiles(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walkFiles(p);
    else if (e.isFile()) yield p;
  }
}

// Collect framework files under a root → Map(relPath → sha256). Skips non-framework paths.
export function collectFramework(root) {
  const map = new Map();
  for (const abs of walkFiles(root)) {
    const rel = relative(root, abs).split(sep).join('/');
    if (!isFramework(rel)) continue;
    map.set(rel, createHash('sha256').update(readFileSync(abs)).digest('hex'));
  }
  return map;
}

const readVersion = (root) => {
  const f = join(root, '.claude', 'cairn.version');
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  const pkg = join(root, 'package.json');
  if (existsSync(pkg)) { try { return JSON.parse(readFileSync(pkg, 'utf8')).version || 'unknown'; } catch { /* fall through */ } }
  return 'unknown';
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const apply = args.includes('--apply');
  const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  const source = flag('--source');
  const dest = flag('--dest') || '.';
  const die = (m) => { console.error('✗ ' + m); process.exit(2); };

  if (!source) die('usage: upgrade-kit.mjs --source <cairnRepo> [--dest <workspace>] [--apply]');
  if (!existsSync(source) || !statSync(source).isDirectory()) die(`--source is not a directory: ${source}`);
  if (!existsSync(join(source, '.claude'))) die(`--source has no .claude/ — is it a Cairn checkout? (${source})`);
  if (!existsSync(join(dest, '.claude'))) die(`--dest has no .claude/ — is it a Cairn workspace? (${dest})`);

  const src = collectFramework(source);
  const dst = collectFramework(dest);
  const plan = planUpgrade(src, dst);
  const srcVer = readVersion(source), dstVer = readVersion(dest);
  const drift = plan.added.length + plan.changed.length;

  const report = { ok: drift === 0, source, dest, srcVersion: srcVer, dstVersion: dstVer, applied: false, ...plan };

  if (apply && drift > 0) {
    for (const rel of [...plan.added, ...plan.changed]) {
      const to = join(dest, rel);
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(join(source, rel), to);
    }
    writeFileSync(join(dest, '.claude', 'cairn.version'), srcVer + '\n');
    report.applied = true;
    report.ok = true;
  }

  console.log(JSON.stringify(report, null, 2));
  if (!quiet) {
    console.error(`\n  Cairn upgrade  ·  source ${srcVer}  →  dest ${dstVer}`);
    const list = (label, arr) => arr.length && console.error(`  ${label} (${arr.length}): ${arr.join(', ')}`);
    list('+ add', plan.added); list('~ change', plan.changed); list('- gone-from-source (kept)', plan.removed);
    if (drift === 0) console.error('  ✓ in sync — no framework drift.');
    else if (apply) console.error(`  ✓ applied ${drift} file(s); stamped dest to ${srcVer}.`);
    else console.error(`  ⚠ ${drift} file(s) behind — re-run with --apply to update (your config + wiki are never touched).`);
  }
  process.exit(report.ok ? 0 : 1);
}
