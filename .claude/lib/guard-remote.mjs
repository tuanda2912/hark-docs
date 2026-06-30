#!/usr/bin/env node
// guard-remote.mjs — fail-closed check that the workspace is NOT inside a git repo with a PUBLIC remote.
// Cairn's second brain (wiki/) must never live in a pushable repo on a third-party host (it holds
// distilled, possibly confidential/NDA'd project knowledge). Run before any command that WRITES wiki
// content (/cairn-save, future emit). Zero deps; shells out to git only, reads nothing else.
//
// Usage:  node guard-remote.mjs        (checks the current working directory)
// Exit:   0 = safe   — not a repo, OR no remote, OR only self-hosted remotes (reported as a note)
//         1 = BLOCKED — a remote points at a known public host
// Self-hosted remotes are allowed-but-flagged: you opted into your own infra; confirm it's confidential-cleared.

import { execFileSync } from 'node:child_process';

const PUBLIC_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org', 'dev.azure.com', 'sourceforge.net', 'codeberg.org', 'gitea.com'];

function git(args) {
  try { return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return null; }
}

if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') process.exit(0);

const remotes = (git(['remote']) || '').split('\n').filter(Boolean);
if (remotes.length === 0) process.exit(0);

const urls = remotes.map((r) => git(['remote', 'get-url', r])).filter(Boolean);
const hostOf = (u) => {
  const m = u.match(/^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)/i) || u.match(/^[^@\s]+@([^:]+):/);
  return m ? m[1].toLowerCase() : null;
};
const offending = urls.filter((u) => { const h = hostOf(u); return h && PUBLIC_HOSTS.some((p) => h === p || h.endsWith('.' + p)); });

if (offending.length) {
  console.error('✗ BLOCKED: this workspace is inside a git repo with a PUBLIC remote:');
  offending.forEach((u) => console.error('   - ' + u));
  console.error('  The Cairn second brain (wiki/) must never live in a pushable repo on a third-party host.');
  console.error('  Move the workspace out of this repo, or point it at a local / self-hosted remote. (CAIRN-FEATURE-PLAN §F1)');
  process.exit(1);
}
const selfHosted = urls.filter((u) => hostOf(u));
if (selfHosted.length) console.error('⚠ note: workspace has a non-public remote (' + selfHosted.join(', ') + ') — allowed; confirm it is your own infra and confidential-cleared.');
process.exit(0);
