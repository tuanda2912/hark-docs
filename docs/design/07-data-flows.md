---
title: Data Flows & Sequence Diagrams
owner: Dev
status: draft
last_updated: 2026-05-24
---

# Data Flows

The pipelines that move bytes through Hark. Each flow names: who produces, who consumes, latency budget, failure behavior.

## 1. Live audio → live caption (the hot path)

**Latency budget:** spoken word → visible text ≤ 1.5s p95
**Throughput target:** sustain RTF < 0.5

```mermaid
sequenceDiagram
    participant SCK as ScreenCaptureKit
    participant AVE as AVAudioEngine (mic)
    participant Mix as Mixer + Resampler
    participant Ring as Ring Buffer (10s)
    participant VAD as Silero VAD
    participant WK as WhisperKit
    participant WS as WebSocket
    participant UI as Angular UI

    par parallel capture
        SCK->>Mix: PCM frames @ 48kHz stereo
    and
        AVE->>Mix: PCM frames @ 44.1kHz mono
    end
    Mix->>Ring: 16kHz mono s16le @ 100ms chunks
    loop every 100ms
        Ring->>VAD: latest chunk
        VAD-->>Ring: speech / silence flag
    end
    Note over VAD: When speech detected,<br/>accumulate into utterance
    VAD->>WK: utterance (3-30s) + 30s context window
    WK->>WS: partial segment {text, t_start, t_end, isFinal: false}
    WS->>UI: partial
    UI->>UI: render in place (replace last partial)
    WK->>WS: final segment {text, t_start, t_end, isFinal: true}
    WS->>UI: final
    UI->>UI: lock segment, scroll
```

**Backpressure rule:** if `Ring.fill > 8s` for >2s straight, drop the oldest unprocessed chunk and emit `{type: "warning", code: "rtf_high"}` over WS. UI shows yellow banner.

**Failure modes:**
| Failure | Detection | Response |
|---|---|---|
| ScreenCapture permission revoked | SCK callback error | Stop SCK, continue mic-only, WS event `{type: "warning", code: "sck_lost"}` |
| WhisperKit OOM | Swift `MemoryWarning` | Save state, restart WhisperKit instance, replay last 5s |
| Engine crashes | UI WS disconnect | Reconnect with backoff; if engine missing, prompt user to restart it |

---

## 2. Capture end → diarization → vault file

**Latency budget:** stop pressed → file in vault ≤ 5s for a 60-min meeting

```mermaid
sequenceDiagram
    actor User
    participant UI
    participant Engine as Swift Engine
    participant Diar as FluidAudio
    participant SpkMatch as Speaker Matcher
    participant Vault as Vault FS
    participant Git as git wrapper

    User->>UI: Stop recording
    UI->>Engine: WS: stop
    Engine->>Engine: Flush ring buffer, finalize segments
    Engine->>Diar: full session audio + segment timestamps
    Diar-->>Engine: per-segment embeddings + cluster IDs
    loop for each cluster
        Engine->>SpkMatch: centroid embedding
        SpkMatch->>Vault: read .speakers/*.json
        alt Match found (sim > 0.72)
            SpkMatch-->>Engine: known name
        else No match
            SpkMatch-->>Engine: "Speaker N"
        end
    end
    Engine->>Vault: write meetings/YYYY-MM-DD-{slug}.md
    Engine->>Git: commit -m "feat(meeting): add {slug}"
    Engine->>UI: WS: meeting saved {path, segments, speakers}
    UI->>User: Toast "Meeting saved"
```

**The vault file shape:**

```markdown
---
title: Q2 Planning Sync
date: 2026-05-24T10:30:00+07:00
duration_sec: 2715
attendees: [Alice Chen, Speaker 2, Speaker 3]
bookmarks: 4
hark_version: 0.1.0
---

## Transcript

> **Alice Chen** · 10:30:02
> Welcome everyone. Let's start with the Camunda migration status...

> **Speaker 2** · 10:30:18
> [[Camunda]] migration is at 80%. Two services left to cut over.

> 📌 **Speaker 2** · 10:31:42
> We decided to push the cutover to next Monday.

...
```

---

## 3. Post-meeting summary (Claude API path — the only outbound channel)

**Latency budget:** stream first token ≤ 3s; full summary ≤ 30s for 60-min meeting

```mermaid
sequenceDiagram
    actor User
    participant UI
    participant Main as Electron Main
    participant Redact as Redactor
    participant Claude as Claude API
    participant Vault

    User->>UI: Click "Summarize"
    UI->>Main: IPC: summarize(meetingPath)
    Main->>Vault: read meeting markdown
    Vault-->>Main: transcript text + bookmarks
    Main->>Redact: scrub PII (if enabled)
    Redact-->>Main: redacted text + redaction log
    Main->>Claude: messages.create({model: claude-sonnet-4.7,<br/>system: SUMMARY_PROMPT [cached],<br/>messages: [transcript], stream: true})
    Claude-->>Main: SSE: {text}
    Main-->>UI: IPC stream: chunks
    UI->>User: Render summary live
    Main->>Vault: append summary sections to meeting file
    Main->>Vault: git commit "docs(meeting): summarize {slug}"
```

**What's sent:**
- ✅ Transcript text (post-redaction if enabled)
- ✅ Bookmark timestamps
- ✅ The SUMMARY_PROMPT system message (cached)
- ❌ Audio bytes — NEVER
- ❌ Speaker voice embeddings — NEVER
- ❌ Speaker real names if redact-before-send is ON (replaced with `Speaker A`, `Speaker B`)

**Prompt caching strategy:** the SUMMARY_PROMPT is ~2000 tokens of formatting instructions and example output. Cached, so cost is ~$0.0003 per summary regardless of transcript length (input transcript dominates cost).

---

## 4. In-meeting Q&A (RAG over vault)

**Latency budget:** retrieval ≤ 200ms local; first token from Claude ≤ 3s

```mermaid
sequenceDiagram
    actor User
    participant UI
    participant Main as Electron Main
    participant Embed as Local Embedder<br/>BGE-small CoreML
    participant Vec as SQLite-vec index
    participant Vault
    participant Redact as Redactor
    participant Claude

    User->>UI: ⌘⇧Q + type question
    UI->>Main: IPC: ask(question)
    Main->>Embed: embed(question)
    Embed-->>Main: 384-dim vector
    Main->>Vec: top-K similarity search (K=8)
    Vec-->>Main: chunk IDs + scores
    Main->>Vault: read source files for chunks
    Vault-->>Main: chunk texts + provenance
    Main->>Redact: scrub PII (if enabled)
    Main->>Claude: messages.create({system: QA_PROMPT [cached],<br/>messages: [{context: chunks, question}], stream: true})
    Claude-->>Main: SSE: {text}
    Main-->>UI: stream chunks + citations
    UI->>User: Render answer with [1] [2] citations linking to vault files
```

**Embedding index lifecycle:**
- Built on first run by walking the vault folder
- Updated incrementally via FSEvents on vault changes (debounced 30s)
- Rebuildable from scratch in < 60s for a 1000-note vault (BGE-small is fast on ANE)

---

## 5. Translation (two modes)

### 5a. Fast mode (local NLLB-200)

**Latency budget:** segment finalized → translated line shown ≤ 500ms

```mermaid
sequenceDiagram
    participant WK as WhisperKit
    participant Trans as NLLB-200 CoreML
    participant WS as WebSocket
    participant UI

    WK->>WS: final segment {text, lang_detected}
    WS->>Trans: translate(text, source_lang, target_lang)
    Trans-->>WS: translated_text
    WS->>UI: {original, translation}
```

### 5b. High-quality mode (Claude API)

**Latency budget:** segment finalized → translated line shown ≤ 3s

```mermaid
sequenceDiagram
    participant WK as WhisperKit
    participant WS as WebSocket
    participant UI
    participant Main as Electron Main
    participant Claude

    WK->>WS: final segment
    WS->>UI: original text
    UI->>Main: IPC: translate(text)
    Main->>Claude: messages.create({system: TRANSLATE_PROMPT [cached], messages: [text]})
    Claude-->>Main: translation
    Main-->>UI: translation
```

User toggles mode in Settings. Subsequent segments use the new mode immediately.

---

## 6. Vault watcher → term index → Whisper vocab

```mermaid
sequenceDiagram
    actor User
    participant FS as Vault folder
    participant Watch as FSEvents Watcher
    participant TermIdx as Term Index (FTS5)
    participant EmbIdx as Embedding Index
    participant Engine as Swift Engine

    User->>FS: edit notes/camunda.md
    FS->>Watch: file change event
    Watch->>Watch: debounce 30s
    Watch->>TermIdx: re-index changed files (titles + frontmatter tags)
    Watch->>EmbIdx: re-chunk + re-embed changed files
    Note over Engine: At next "start recording":
    Engine->>TermIdx: top-N most-relevant terms
    TermIdx-->>Engine: term list
    Engine->>Engine: build WhisperKit initial-prompt
```

---

## Cross-cutting concerns

### Cost accounting (Claude API)

Tracked per session, logged locally. Settings → Privacy shows last-7-day spend so user has no surprises.

| Action | Avg tokens in | Avg tokens out | Cost @ Sonnet 4.7 |
|---|---|---|---|
| Summary (60-min meeting) | ~8,000 (cached after first) | ~800 | ~$0.02 |
| Q&A query | ~3,500 (mostly cached) | ~300 | ~$0.005 |
| Translation chunk (high-quality) | ~100 | ~100 | ~$0.0005 |

At 4 hours of meetings/day with 1 summary each + 5 Q&A + ~20 translation chunks: **~$0.15/day**.

### Local logging

- Path: `~/Library/Logs/Hark/`
- Files: `engine.log`, `ui.log`, `claude-cost.log`, `redaction.log`
- Format: JSON-lines, 7-day rotation
- Never contains: transcript text, audio, vault contents, API keys
- Always contains: timestamps, event types, error stacks, performance counters (RTF, latency, RAM)

## Related

- [Architecture overview](06-architecture-overview.md)
- [WebSocket API contract](08-websocket-api-contract.md) — message schemas referenced above
- [Privacy test checklist](../qa/09-test-strategy.md#privacy-checklist)
