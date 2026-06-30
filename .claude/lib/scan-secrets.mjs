#!/usr/bin/env node
// scan-secrets.mjs — content-side confidentiality scan for the wiki. Zero deps.
// guard-remote checks the git HOST; this checks the CONTENT — it catches a secret/token/key that would
// leak the moment a page goes public (the natural other half of the confidentiality story). Curated,
// low-false-positive patterns. Suppress a known-safe line with a trailing
//   <!-- cairn:allow-secret reason -->   (any occurrence of the token cairn:allow-secret on the line works).
//
// Usage:
//   node scan-secrets.mjs <path>...        # files and/or dirs (dirs scanned recursively for .md); default: wiki
// Exit: 0 = clean · 1 = ≥1 finding · 2 = bad input.

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const RULES = [
  { id: 'pem-private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, desc: 'PEM private key block' },
  { id: 'aws-access-key', re: /\bAKIA[0-9A-Z]{16}\b/, desc: 'AWS access key id' },
  { id: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/, desc: 'GitHub token' },
  { id: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/, desc: 'Slack token' },
  { id: 'google-api-key', re: /\bAIza[0-9A-Za-z\-_]{35}\b/, desc: 'Google API key' },
  { id: 'openai-key', re: /\bsk-[A-Za-z0-9]{20,}\b/, desc: 'OpenAI-style secret key' },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, desc: 'JSON Web Token' },
  { id: 'generic-secret', re: /(?:api[_-]?key|secret|token|passwd|password|client[_-]?secret|access[_-]?token)["']?\s*[:=]\s*["']?([A-Za-z0-9_\-/+]{16,})/i, desc: 'hardcoded secret assignment', valueGroup: 1 },
];

// Values that look like a secret pattern but are obviously a placeholder / doc example — not a real leak.
const PLACEHOLDER = /^(x{4,}|\.{3,}|<|your[_-]|example|sample|redacted|changeme|placeholder|dummy|test|fake|n\/a|\*+|0+|1234|abcd|foo|bar)/i;

// Pure: scan text → findings [{rule, desc, line, snippet}]. Lines carrying the allow marker are skipped.
export function scan(text, { allowMarker = 'cairn:allow-secret' } = {}) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    if (line.includes(allowMarker)) return; // explicitly allowed
    for (const rule of RULES) {
      const m = rule.re.exec(line);
      if (!m) continue;
      if (rule.valueGroup && PLACEHOLDER.test(m[rule.valueGroup] || '')) continue; // obvious placeholder
      out.push({ rule: rule.id, desc: rule.desc, line: i + 1, snippet: line.trim().slice(0, 80) });
    }
  });
  return out;
}

function* walkMd(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walkMd(p);
    else if (e.isFile() && e.name.endsWith('.md')) yield p;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  let targets = args.filter((a) => !a.startsWith('-'));
  if (!targets.length) targets = ['wiki'];

  const files = [];
  for (const t of targets) {
    if (!existsSync(t)) { console.error(`✗ no such path: ${t}`); process.exit(2); }
    if (statSync(t).isDirectory()) files.push(...walkMd(t));
    else files.push(t);
  }

  const findings = [];
  for (const f of files) for (const hit of scan(readFileSync(f, 'utf8'))) findings.push({ file: f, ...hit });

  const report = { ok: findings.length === 0, scanned: files.length, findings, verdict: findings.length ? 'LEAK RISK' : 'CLEAN' };
  console.log(JSON.stringify(report, null, 2));
  if (!quiet) {
    for (const f of findings) console.error(`✗ [${f.rule}] ${f.file}:${f.line} — ${f.desc}: ${f.snippet}`);
    console.error(`\n${report.verdict}  ·  ${files.length} file(s) scanned  ·  ${findings.length} finding(s)` +
      (findings.length ? '  — redact, or mark a known-safe line with <!-- cairn:allow-secret reason -->' : ''));
  }
  process.exit(report.ok ? 0 : 1);
}
