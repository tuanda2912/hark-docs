#!/usr/bin/env node
// guard-remote.mjs — fail-closed check that the workspace is NOT inside a git repo with a PUBLIC remote.
// Cairn's second brain (wiki/) must never live in a pushable repo on a third-party host (it holds
// distilled, possibly confidential/NDA'd project knowledge). Run before any command that WRITES wiki
// content (/cairn-save, future emit). Zero deps; shells out to git only, reads nothing else.
//
// Usage:  node guard-remote.mjs        (checks the current working directory)
// Exit:   0 = safe   — not a repo, OR no remote, OR only self-hosted remotes (reported as a note),
//                      OR a public remote that the project EXPLICITLY opted into (reported loudly)
//         1 = BLOCKED — a remote points at a known public host and there is no opt-out
// Self-hosted remotes are allowed-but-flagged: you opted into your own infra; confirm it's confidential-cleared.
//
// Opt-out (default stays fail-closed — this only fires when deliberately set):
//   • env  CAIRN_ALLOW_PUBLIC_REMOTE=1
//   • file .cairn-allow-public  at the workspace root (or git top-level)
// Use it ONLY for a project with no confidential content (e.g. an open-source wiki). It is always loud.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export const PUBLIC_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org', 'dev.azure.com', 'sourceforge.net', 'codeberg.org', 'gitea.com'];

// Parse the host out of either URL form: scheme://[user@]host[:port]/...  or  user@host:path (scp-like).
export function hostOf(u) {
  const m = u.match(/^[a-z][a-z0-9+.-]*:\/\/(?:[^@/]+@)?([^/:]+)/i) || u.match(/^[^@\s]+@([^:]+):/);
  return m ? m[1].toLowerCase() : null;
}

export function isPublicHost(h) {
  return !!h && PUBLIC_HOSTS.some((p) => h === p || h.endsWith('.' + p));
}

// Pure decision over a repo's remote URLs. `optedOut` downgrades a public remote from block → allow.
// Returns the offending (public) and self-hosted URLs plus whether to BLOCK.
export function classify(urls, optedOut = false) {
  const offending = urls.filter((u) => isPublicHost(hostOf(u)));
  const selfHosted = urls.filter((u) => hostOf(u) && !isPublicHost(hostOf(u)));
  return { offending, selfHosted, optedOut: !!optedOut, blocked: offending.length > 0 && !optedOut };
}

function git(args) {
  try { return execFileSync('git', args, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return null; }
}

// Where the opt-out came from (for a loud, auditable message), or null if not opted out.
function optOutSource() {
  if (process.env.CAIRN_ALLOW_PUBLIC_REMOTE === '1') return 'env CAIRN_ALLOW_PUBLIC_REMOTE=1';
  const top = git(['rev-parse', '--show-toplevel']);
  const candidates = ['.cairn-allow-public', top ? `${top}/.cairn-allow-public` : null].filter(Boolean);
  const hit = candidates.find((p) => existsSync(p));
  return hit ? `marker ${hit}` : null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') process.exit(0);

  const remotes = (git(['remote']) || '').split('\n').filter(Boolean);
  if (remotes.length === 0) process.exit(0);

  const urls = remotes.map((r) => git(['remote', 'get-url', r])).filter(Boolean);
  const optedOut = optOutSource();
  const { offending, selfHosted, blocked } = classify(urls, !!optedOut);

  if (blocked) {
    console.error('✗ BLOCKED: this workspace is inside a git repo with a PUBLIC remote:');
    offending.forEach((u) => console.error('   - ' + u));
    console.error('  The Cairn second brain (wiki/) must never live in a pushable repo on a third-party host.');
    console.error('  Move the workspace out of this repo, or point it at a local / self-hosted remote.');
    console.error('  Open-source project with NO confidential content? Opt out explicitly:');
    console.error('    CAIRN_ALLOW_PUBLIC_REMOTE=1   or   touch .cairn-allow-public  (at the workspace root)');
    process.exit(1);
  }
  if (offending.length) {
    console.error('⚠ PUBLIC REMOTE ALLOWED by explicit opt-out (' + optedOut + '):');
    offending.forEach((u) => console.error('   - ' + u));
    console.error('  Saves WILL be committable to this public repo — never /cairn-save anything confidential here.');
  } else if (selfHosted.length) {
    console.error('⚠ note: workspace has a non-public remote (' + selfHosted.join(', ') + ') — allowed; confirm it is your own infra and confidential-cleared.');
  }
  process.exit(0);
}
