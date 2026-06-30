#!/usr/bin/env node
// receipt.mjs — a standard, compact "proof of work" receipt for Cairn commands. Zero deps.
// Why: a real /cairn-rebuild and a no-op helper script look identical from the outside — that ambiguity
// cost trust this session ("Cairn ran that quick? I don't buy it"). Every /cairn-* command should END by
// emitting one of these: concrete, countable evidence of what actually ran.
//
// Usage:
//   node receipt.mjs <op> [--scope S] [--kv key=val]... [--elapsed MS] [--note TEXT]...
// Library: import { formatReceipt } and pass { op, scope, counts, elapsedMs, notes }.

export function formatReceipt({ op, scope, counts = {}, elapsedMs, notes = [] }) {
  const lines = [`📋 cairn receipt — ${op}`];
  if (scope) lines.push(`   scope:    ${scope}`);
  for (const [k, v] of Object.entries(counts)) lines.push(`   ${(k + ':').padEnd(9)} ${v}`);
  if (elapsedMs != null && !Number.isNaN(elapsedMs)) lines.push(`   elapsed:  ${(elapsedMs / 1000).toFixed(1)}s`);
  for (const n of notes) lines.push(`   note:     ${n}`);
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const op = args.find((a) => !a.startsWith('-')) || 'op';
  const counts = {}; const notes = []; let scope, elapsedMs;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--kv' && args[i + 1]) { const [k, ...v] = args[++i].split('='); counts[k] = v.join('='); }
    else if (args[i] === '--scope') scope = args[++i];
    else if (args[i] === '--elapsed') elapsedMs = Number(args[++i]);
    else if (args[i] === '--note') notes.push(args[++i]);
  }
  console.log(formatReceipt({ op, scope, counts, elapsedMs, notes }));
}
