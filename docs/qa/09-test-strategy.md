---
title: Test Strategy
owner: Test
status: draft
last_updated: 2026-05-24
---

# Test Strategy

What we test, how, when. Solo project, so the test pyramid is honest: lots of automated unit + privacy tests, light integration tests, **manual dogfood as the system test layer**. Dogfooding 4h/day on real meetings catches what no synthetic test will.

## Test pyramid (Hark-flavored)

```
                    ▲
                    │ Manual dogfood (4 weeks daily use)
                    │ — the real system test
                ────┼────
                    │ Integration tests
                    │ — WS contract, vault writes, end-to-end flow
                ────┼────
                    │ Unit tests + Privacy tests
                    │ — heavy: audio math, redactor, speaker matcher, RAG retrieval
                    └──────────────────────────────────────────────►
```

## Test types & where they live

| Type | Tool | Location | Run when |
|---|---|---|---|
| Swift unit | `swift test` (XCTest) | `engine/Tests/` | Pre-commit hook on engine files; CI on push |
| TypeScript unit | Vitest | `ui/src/**/*.spec.ts` | Pre-commit hook on UI files; CI on push |
| Privacy audit | `privacy-auditor` agent | n/a — runs against the diff | Before every merge to `main`, before every release |
| WebSocket contract | Custom harness, both sides | `tests/contract/` | CI on push |
| Performance / RTF | Phase 0 harness + variants | `bench/` | Manually before release; after any model or pipeline change |
| Privacy regression | Network sniffer (Little Snitch / pcap) | `tests/privacy/` | Before every release |
| Manual smoke | Checklist | this doc | Before every release |
| Dogfood (real meetings) | Reality | Daily | Continuous |

## Per-epic test focus

### Epic A — Live capture
- Unit: mixer math (mic + system → 16kHz mono), VAD boundary detection
- Integration: 60s synthetic audio → segments out, latency measured
- **Privacy: assert audio bytes never reach disk outside the engine session temp dir**
- Manual: real meeting, observe partial → final transitions don't flicker

### Epic B — Speakers
- Unit: cosine similarity threshold, embedding serialization round-trip
- Integration: 3-person mock audio → diarization → 3 clusters → manual tag → persist → re-run → auto-resolve
- **Privacy: speaker embeddings never appear in any network payload**

### Epic C — Translation
- Unit: NLLB-200 produces output for TH↔EN pairs (snapshot test, not quality)
- Integration: high-quality mode round-trips through Claude API (mocked)
- **Privacy: when in fast mode, zero network calls fire**

### Epic D — Vault
- Unit: markdown frontmatter serialization, slug generation, term index incremental update
- Integration: write meeting → git commit → verify content + commit log
- Manual: vault stays editable in Obsidian throughout

### Epic E — Intelligence (Claude API)
- Unit: prompt builder, citation extraction, redactor
- Integration: summarize a fixture meeting (Claude mocked) → assert summary sections written to vault
- **Privacy: redactor strips emails/phones/IDs; verified by fuzzing**
- **Privacy: API key never appears in logs (regex check on log files)**
- Manual: real meeting summaries are useful (Tier 2 metric)

### Epic F — Trust & Privacy
- See [Privacy checklist](#privacy-checklist) below — its own layer

## Privacy checklist

**Non-negotiable. A release with ANY failure here does not ship.**

Run before every release. Failures block merge.

### Static analysis
- [ ] `privacy-auditor` agent returns 0 BLOCKER findings on the full codebase diff vs. last release
- [ ] No `fetch`, `axios`, `URLSession`, `http.request` outside the approved network paths:
  - Anthropic SDK (Electron Main only)
  - electron-updater (configured update server only)
  - WhisperKit / FluidAudio model download URLs (Argmax + HuggingFace, first run only)
- [ ] Grep: zero `sk-ant-` literals in source
- [ ] Grep: zero `console.log` / `print` / `os_log` of `transcript`, `audio`, `embedding` variable contents
- [ ] CSP for Electron renderer: `default-src 'self'; script-src 'self'; connect-src 'self' ws://127.0.0.1:*` (no wildcards)

### Runtime observation
- [ ] Run a 30-min mock meeting with Little Snitch (or `tcpdump`) recording all outbound traffic
- [ ] Verify: outbound destinations are ONLY Anthropic API (and only when user invoked an action) + (first-run only) model download
- [ ] Verify: zero outbound traffic during idle, during recording, during playback
- [ ] Verify: zero traffic to analytics domains (Google, Segment, Mixpanel, Amplitude, Sentry, etc.)

### Filesystem
- [ ] No writes outside `vault/hark/`, `~/Library/Application Support/Hark/`, `~/Library/Logs/Hark/`, `~/Library/Caches/Hark/`, `NSTemporaryDirectory()`
- [ ] Logs in `~/Library/Logs/Hark/` contain zero transcript text, zero PII (grep audit)
- [ ] Speaker embeddings exist only in `vault/.speakers/`

### Redactor
- [ ] Fuzz redactor with 1000 synthetic transcripts containing emails, phones, Thai national IDs, EU IBANs — 0 false negatives on these patterns
- [ ] Document false-positive rate (acceptable < 5%)
- [ ] Redaction log written for every API call when redact-before-send is ON

### API key
- [ ] Stored in Keychain via `security add-generic-password`, not in files
- [ ] Never logged, never written to crash dumps
- [ ] Cleared from memory after each API call (best-effort)

## Test data

| Asset | Purpose | Storage |
|---|---|---|
| `fixtures/short-en.wav` | 30s English-only sample | `engine/Tests/Fixtures/` |
| `fixtures/code-switch.wav` | 60s TH↔EN code-switching | same |
| `fixtures/3speakers.wav` | 90s with 3 distinct voices | same |
| `fixtures/silence.wav` | 30s ambient room noise | same |
| `fixtures/meeting-transcript.md` | Realistic transcript for summary tests | `tests/fixtures/` |

**Privacy of fixtures:** all fixtures are public-domain audio (LibriSpeech, Common Voice) or synthetic (Bark / Mimic) — **never real meeting recordings**. Even the developer's own.

## Mocking strategy

- **Anthropic SDK:** replaced with a fake that records prompts and returns canned responses. Real API hit only in a single "smoke" integration test run manually before release.
- **ScreenCaptureKit:** wrapped behind an `AudioSource` protocol; tests inject a file-reader implementation.
- **Vault git:** wrapped behind a `VaultRepo` protocol; tests use `tmp/` and assert commit messages.

## Release checklist (manual)

Before publishing any build:

1. [ ] All automated tests green on CI
2. [ ] Privacy checklist green (above)
3. [ ] Manual smoke: 10-min real meeting, summary generated, Q&A returns sensible answer
4. [ ] Cold-start time measured ≤ 5s
5. [ ] RAM during 30-min meeting ≤ 4 GB
6. [ ] No new ADRs that contradict CLAUDE.md hard rules
7. [ ] CHANGELOG updated
8. [ ] Build signed + notarized; `spctl --assess` passes
9. [ ] Test the signed build on a clean macOS user account (Gatekeeper realism)
10. [ ] Tag release in git; archive the signed `.app` outside the repo

## Out of scope for testing

- **Cross-browser compatibility** — single Chromium via Electron
- **Cross-OS compatibility** — macOS-only
- **Load / stress beyond 4-hour single meeting** — not the target use case
- **Localization correctness for translation quality** — we surface raw model output; quality is the model's problem, not Hark's
- **Penetration testing** — local-only attack surface, deferred until/unless we ship a server component (we won't, in v1)

## Related

- [Performance benchmarks](10-performance-benchmarks.md) — RTF/latency harness
- [Success metrics](../product/02-success-metrics.md) — what targets we're testing against
- [User stories](../analysis/05-user-stories.md) — acceptance criteria source
- `privacy-auditor` agent: `/Users/quynhanhquach/Documents/project/hark/.claude/agents/privacy-auditor.md`
