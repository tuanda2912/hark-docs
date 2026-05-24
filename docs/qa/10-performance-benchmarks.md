---
title: Performance Benchmarks
owner: Test
status: draft
last_updated: 2026-05-24
---

# Performance Benchmarks

The numbers that decide whether Hark is good enough to use. Phase 0 of the project is essentially "build this harness and measure" — if the numbers don't hit Tier 1 targets, we don't proceed.

## What "performance" means here

Three orthogonal things, each measured independently:

1. **Speed** — how fast can the engine convert audio to text? (RTF)
2. **Latency** — how long from spoken word to visible text? (end-to-end)
3. **Resource use** — how much RAM / CPU / power does it consume?

You can pass one and fail another. We measure all three.

## Hardware baseline

Benchmarks run on the developer's actual hardware. Stack rationale assumes Apple Silicon.

- **Primary:** Apple Silicon M-series Mac (M3 or later assumed for 2026 user base), 16 GB RAM minimum
- **Stretch:** test on M1 base (8 GB) to know the floor
- **Out of scope:** Intel Macs — refuse to install with a clear error

Every benchmark records: model name, OS version, chip, RAM, thermal state at start.

## Benchmark 1: Real-Time Factor (RTF)

**Definition:** wall-clock seconds taken to transcribe / audio seconds processed.
**Pass:** RTF < 0.5 for large-v3-turbo on M-series.
**Stretch:** RTF < 0.3.

### Harness

```
bench/rtf.swift
  ├── loads WhisperKit large-v3-turbo
  ├── reads fixtures/long-en.wav (10 min, mixed speech)
  ├── feeds in 30s windows with 5s hop (production setting)
  ├── records wall-clock per window
  └── outputs: rtf_avg, rtf_p50, rtf_p95, rtf_p99
```

### Cases to measure

| Case | Fixture | Why |
|---|---|---|
| English clean | `long-en.wav` | Baseline, ideal conditions |
| English with noise | `long-en-noisy.wav` | Realistic conference room |
| Thai-English code-switch | `long-th-en.wav` | The actual use case |
| 3 speakers | `3speakers.wav` | Diarization adds load |
| Cold start | first window of any | One-time model warm-up cost |

### Output format

```json
{
  "hardware": "Apple M3 Pro, 18GB, macOS 14.5",
  "model": "whisperkit-large-v3-turbo (Q5)",
  "thermal_state_start": "nominal",
  "cases": [
    { "name": "english_clean", "rtf_avg": 0.28, "rtf_p95": 0.41, "windows": 20 },
    ...
  ],
  "run_date": "2026-05-24T10:00:00Z"
}
```

Output committed to `bench/results/{date}-{git-sha}.json` so we have a regression history.

## Benchmark 2: End-to-end latency

**Definition:** time from "word spoken" to "word visible in UI."
**Pass:** ≤ 1.5s p95.
**Stretch:** ≤ 1.0s p95.

This is harder to automate because it requires actually playing audio and screen-recording the UI. Approach:

### Method

1. Play a click-track WAV through an output device (BlackHole virtual audio device → ScreenCaptureKit)
2. Each click is a known timestamp-encoded marker (e.g., DTMF tone encoding "click N at t=X.XXs")
3. Hark transcribes it as recognizable text ("click one", "click two", ...)
4. Screen-record the UI at 60fps via `screencapture -V`
5. Run a small post-processor: detect the rendered text frame, subtract the click timestamp from the frame timestamp
6. Output p50 / p95 / p99 latency over 100+ clicks

### Cases

| Case | Why |
|---|---|
| Continuous speech | Worst case for sliding-window batching |
| Burst speech with gaps | VAD-driven boundary triggers fast finalization |
| Cold start | First word latency (model warm-up) |

## Benchmark 3: Memory & CPU

**Pass:**
- Idle (no recording): ≤ 2.5 GB total (engine + UI + models loaded)
- Recording: ≤ 4 GB total during 60-min meeting
- CPU: average ≤ 60% of one P-core during recording (ANE doesn't show up in CPU%; that's expected)

### Method

- `instruments` template: Allocations + Activity Monitor + System Trace
- Record for 60 min synthetic audio, sample every 5s
- Output time-series, attach to release notes

### Things to watch for

- **Memory leaks:** RAM growth over a 4-hour session must be < 100 MB. Larger = leak. Bisect with Instruments.
- **Thermal throttling:** if RTF degrades > 30% over the session, we're hitting throttle. Document the threshold.
- **Battery drain:** 1-hour meeting should consume < 15% battery on a typical M3 Pro. Measured via `pmset -g log`.

## Benchmark 4: Word Error Rate (WER) — quality side of "performance"

Speed without accuracy is useless. WER matters as much as RTF.

**Pass:**
- English clean: < 8% WER
- English noisy (real meeting): < 12% WER
- Thai-English code-switch: < 25% WER (this is hard for any model in 2026)

### Method

1. Curate 5 reference meetings: 30 min each, hand-transcribed (the developer's own meetings, with consent and PII redacted before storing as fixtures — these stay LOCAL, never committed to a public repo)
2. Run Hark on each, save the auto-transcript
3. Use standard WER tool (`jiwer` or similar — runs locally, no network)
4. Output per-meeting WER + segment-level WER for the worst-N segments

### What we explicitly don't measure

- WER on LibriSpeech / Whisper paper conditions — already published, not predictive of real meetings
- BLEU/ROUGE on translation — too dependent on reference choice; user satisfaction (Tier 2 metric) is the real signal

## Benchmark 5: Claude API cost & latency

**Pass:**
- Summary of 60-min meeting: ≤ 30s wall-clock to full response, ≤ $0.03/run
- Q&A query: ≤ 3s p95 to first token, ≤ $0.01/run
- Daily spend at 4hr meetings, 1 summary each, 5 Q&A: ≤ $0.50

### Method

- Anthropic SDK already returns timing + usage in responses
- Log each call to `~/Library/Logs/Hark/claude-cost.log`
- Weekly report: total spend, average per-call latency, cache hit rate

**Cache hit rate target:** ≥ 80% on system prompts (SUMMARY_PROMPT, QA_PROMPT, TRANSLATE_PROMPT). Below that, we're paying for prompt re-tokenization.

## Regression policy

| Regression | Severity | Action |
|---|---|---|
| RTF up > 10% from last release | High | Bisect, block release until explained |
| Latency p95 up > 20% | High | Same |
| RAM growth > 100 MB / hour during session | Critical | Block release, file leak ticket |
| WER up > 2 absolute points | Medium | Investigate; ship with note if explained (e.g., new language added) |
| Claude API cost up > 25% per equivalent action | Medium | Check cache hit rate, prompt structure |

## Tooling we'll need

- [ ] `bench/rtf.swift` — Swift CLI, harness for RTF
- [ ] `bench/latency/` — click-track generator + screen-recording post-processor (Swift + Python)
- [ ] `bench/wer/` — local WER calculator (jiwer or custom)
- [ ] `bench/results/` — regression history (committed as JSON)
- [ ] Instruments templates checked into `bench/instruments/`
- [ ] `Makefile` or `scripts/bench-all.sh` — one command to run everything before release

## Phase 0 — the go/no-go

The single benchmark that decides whether the entire stack is viable:

**Goal:** measure RTF for WhisperKit large-v3-turbo on the developer's M3 with a 60s realistic meeting sample. If RTF > 0.7, the stack doesn't work — fallback options must be considered before proceeding.

**Duration:** 1 day to write the harness + run.
**Output:** a single JSON file + a 1-paragraph go/no-go memo.

## Related

- [Success metrics](../product/02-success-metrics.md) — Tier 1 targets that these benchmarks verify
- [Test strategy](09-test-strategy.md) — how benchmarks fit the overall test approach
- Handoff doc — Phase 0 description
