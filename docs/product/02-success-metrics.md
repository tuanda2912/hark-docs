---
title: Success Metrics
owner: PO
status: draft
last_updated: 2026-05-24
---

# Success Metrics

How we know v1 worked. Solo project, so these are honest internal targets — not investor decks.

## North Star

**Personal:** *I use Hark in every work meeting for 4 consecutive weeks without falling back to manual note-taking.*

If I'm still typing notes by hand because Hark is too slow / inaccurate / annoying, the product failed regardless of what the benchmarks say.

## Tier 1 — Must hit by end of v1 (otherwise: don't ship)

| Metric | Target | How measured |
|---|---|---|
| Real-time factor (RTF) | < 0.5 on M-series Mac | Phase 0 harness — 60s audio sample, large-v3-turbo, repeat 5x |
| Spoken-word → visible-text latency | < 1.5s p95 | Manual stopwatch on 10 real meetings |
| Word Error Rate (WER), EN | < 12% on technical meetings | Sample 5 meetings, compare to manual transcript |
| Word Error Rate (WER), TH↔EN code-switch | < 25% | Same method, separate sample |
| Speaker diarization accuracy | > 80% segments correctly clustered | Sample 5 meetings, count mislabeled segments |
| App crash rate | 0 crashes in 4-week dogfood period | Local logs |
| Privacy audit | 0 BLOCKER findings | `privacy-auditor` agent run on full codebase before each release |

## Tier 2 — Strong-to-have

| Metric | Target | How measured |
|---|---|---|
| Cold-start to ready-to-record | < 5s on launch | Manual timing |
| RAM at idle | < 2.5 GB | Activity Monitor |
| RAM during 1-hour meeting | < 4 GB | Activity Monitor |
| In-meeting Q&A response time | < 3s p95 | Manual timing on 20 queries |
| Meeting summary quality | "Useful without edit" on 8/10 meetings | Self-rated after each meeting |
| Speaker auto-recognition (after 5+ meetings with a person) | > 90% | Count manual re-tags needed |
| Daily Claude API spend | < $0.50/day at 4hr meetings | Anthropic console |

## Tier 3 — Nice signals

- Number of meetings stored in vault after 4 weeks (proxy for actual usage)
- Number of Q&A queries that referenced prior meetings (proxy for vault being useful, not just an archive)
- Number of action items extracted that I actually did (proxy for summary quality)

## What I am NOT measuring (and why)

- **DAU/WAU, retention curves** — solo product, N=1, the metric is "did I use it today."
- **NPS, satisfaction scores** — self-rating my own product is delusional.
- **Conversion funnel** — no funnel, no purchase, no signup. This is a personal tool first.
- **Industry-benchmark WER vs Whisper paper claims** — paper conditions don't match meeting audio. Only my own real-meeting WER matters.

## When we revisit

After the 4-week dogfood period (Phase 7 + month buffer):

- **If Tier 1 all green:** start planning v1.5 polish + decide whether to publish.
- **If any Tier 1 red:** stop feature work. Fix the broken metric, re-measure, re-decide.
- **If Tier 1 green but I'm not actually using it:** that's the most important signal. Something about the UX is wrong even if benchmarks pass. Diagnose before shipping more.

## Related

- [Test strategy](../qa/09-test-strategy.md) — how the QA-side measurement works
- [Performance benchmarks](../qa/10-performance-benchmarks.md) — RTF/latency harness specifics
