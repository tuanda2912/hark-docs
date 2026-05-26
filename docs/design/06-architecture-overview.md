---
title: Architecture Overview
owner: Dev
status: draft
last_updated: 2026-05-24
---

# Architecture Overview

C4-style decomposition, top-down. Skip to the diagram if you just want the shape.

## System context

```mermaid
C4Context
    title Hark — System Context

    Person(user, "User", "Knowledge worker on macOS")
    System(hark, "Hark", "Local-first meeting transcription app")
    System_Ext(claude, "Claude API", "Anthropic — text-only, user-invoked")
    System_Ext(vault, "Vault folder", "User's git-backed markdown notes")
    System_Ext(meeting, "Meeting app", "Zoom / Teams / etc. — Hark listens to its audio output")

    Rel(user, hark, "Controls + reads transcripts")
    Rel(meeting, hark, "System audio output", "ScreenCaptureKit")
    Rel(user, hark, "Microphone", "AVAudioEngine")
    Rel(hark, vault, "Reads + writes .md files")
    Rel(hark, claude, "Text-only, user-invoked", "HTTPS")
```

**Trust boundaries (critical):**
- Everything inside Hark stays on the Mac.
- Vault is on local disk (could be in iCloud Drive, but that's the *user's* choice — Hark doesn't push it anywhere).
- The Claude API edge is the **only** outbound channel. It carries transcript text and vault excerpts. Never audio.

---

## Container view

```mermaid
graph TB
    subgraph Mac["macOS"]
        subgraph Electron["Electron + Angular UI"]
            UI[Angular App<br/>Tray + Main + Q&A panel]
            Main[Electron Main<br/>Window mgmt, hotkeys,<br/>auto-updater]
        end

        subgraph Engine["Swift Engine Binary"]
            Capture[Audio Capture<br/>ScreenCaptureKit +<br/>AVAudioEngine]
            ASR[WhisperKit<br/>large-v3-turbo]
            VAD[Silero VAD<br/>CoreML]
            Diar[FluidAudio<br/>diarization]
            SpkMatch[Speaker Matcher<br/>cosine similarity]
            WS[Swift NIO<br/>WebSocket server]
            Trans[NLLB-200<br/>CoreML translation]
        end

        Vault[(Vault folder<br/>~/Documents/vault/hark<br/>git-backed)]
        AppData[(~/Library/Application<br/>Support/Hark/<br/>models cache)]
        Keychain[(macOS Keychain<br/>Anthropic API key)]
    end

    Claude[Claude API<br/>HTTPS]

    UI <-->|WebSocket :PORT| WS
    Capture --> VAD --> ASR --> WS
    WS --> Diar --> SpkMatch
    SpkMatch <--> Vault
    UI --> Vault
    Main --> Keychain
    Main -.->|user-invoked only| Claude
    ASR --> AppData
    Trans --> AppData
```

### Components

| Component | Language | Process | Responsibility |
|---|---|---|---|
| Angular UI | TypeScript | Electron renderer | All user-facing surfaces: tray menu, main window, Q&A panel, settings |
| Electron Main | TypeScript / Node | Electron main | Window/tray management, global hotkeys, auto-updater, Keychain access, Claude API client |
| Swift Engine | Swift | Separate sidecar binary | Audio capture, ASR, diarization, translation, speaker matching, WebSocket server |
| Vault | Plain markdown files + `.git` | (on disk) | Source of truth for transcripts, notes, speaker embeddings |
| App Data | Files in `~/Library/Application Support/Hark/` | (on disk) | Model caches, preferences, indexed embeddings |

### Why a separate Swift engine instead of in-process Node?

- **Performance:** WhisperKit on ANE wants real-time priority; running it inside Electron's main process would deadline-starve UI rendering.
- **Crash isolation:** if the engine OOMs (large model + 4-hour meeting), the UI survives and can offer restart.
- **Permission model:** ScreenCaptureKit permission is per-binary on macOS — keeping it in a stable signed Swift binary is more user-friendly than re-prompting on every Electron update.
- **Language fit:** WhisperKit, ScreenCaptureKit, AVAudioEngine, FluidAudio are all Swift-native. No FFI tax.

### Why Electron, not Tauri or SwiftUI?

See [ADR-0001](~/Documents/project/hark/docs/decisions/0001-electron-over-tauri.md).

---

## Component view: Swift Engine

```mermaid
graph LR
    subgraph Capture["Capture Layer"]
        SCK[ScreenCaptureKit<br/>system audio]
        AVE[AVAudioEngine<br/>mic]
        Mixer[Mixer +<br/>16kHz resampler]
    end

    subgraph Pipeline["ASR Pipeline"]
        Ring[Ring Buffer]
        VAD[Silero VAD]
        Win[Sliding Window<br/>30s / 5s hop]
        Whisper[WhisperKit]
    end

    subgraph Post["Post-processing"]
        Diar[Diarization]
        SpkMatch[Speaker Matcher]
        Term[Term Detector<br/>vault index]
    end

    subgraph Output["Output"]
        WS[WebSocket Server]
        Writer[Vault Writer<br/>markdown + git]
    end

    SCK --> Mixer
    AVE --> Mixer
    Mixer --> Ring
    Ring --> VAD
    VAD --> Win
    Win --> Whisper
    Whisper --> WS
    Whisper --> Diar
    Diar --> SpkMatch
    Whisper --> Term
    Term --> WS
    SpkMatch --> Writer
    SpkMatch --> WS
```

Each box is roughly a Swift `actor` or a dedicated dispatch queue. Backpressure: if WhisperKit can't keep up (RTF > 1), the ring buffer drops oldest unprocessed audio and emits a warning event over WS. The UI surfaces it as a yellow banner.

---

## Component view: Electron + Angular UI

```mermaid
graph TB
    subgraph Renderer["Renderer (Angular)"]
        Tray[Tray Menu<br/>Component]
        Main[Main Window<br/>- Live Transcript<br/>- Bookmarks<br/>- Q&A Panel<br/>- Term Cards]
        Set[Settings<br/>Component]
    end

    subgraph MainProc["Electron Main (Node)"]
        WSC[WebSocket Client<br/>→ Swift engine]
        Hotkey[Global Hotkeys<br/>⌘⇧R / ⌘⇧B / ⌘⇧Q / ⌘⇧S]
        Updater[electron-updater]
        Anthropic[Anthropic SDK<br/>text-only]
        KeyMgr[Keychain Bridge]
        VaultIO[Vault FS + git wrapper]
    end

    Tray <--> MainProc
    Main <--> MainProc
    Set <--> MainProc
    WSC <-->|ws://localhost:PORT| EngineWS[Swift Engine WS]
    Anthropic -->|HTTPS| ClaudeAPI[Claude API]
```

Renderer talks to Main via Electron IPC. Main holds all sensitive surfaces (Keychain, network, FS). Renderer is locked down: `contextIsolation: true`, `nodeIntegration: false`, strict CSP.

---

## Data stores

| Store | Where | Format | Lifetime |
|---|---|---|---|
| Meetings | `vault/hark/meetings/*.md` | Markdown + YAML frontmatter | Permanent, git-versioned |
| Notes | `vault/hark/notes/*.md` | Markdown | User-managed |
| Speaker embeddings | `vault/.speakers/*.json` | JSON: `{name, embeddings: number[][], meetings_seen}` | Permanent |
| Term index | `~/Library/Application Support/Hark/term-index.sqlite` | SQLite FTS5 | Rebuildable from vault |
| Embedding index (RAG) | `~/Library/Application Support/Hark/embeddings.sqlite` | SQLite + sqlite-vec | Rebuildable from vault |
| Model cache | `~/Library/Application Support/Hark/models/` | CoreML bundles | Permanent |
| Preferences | `~/Library/Application Support/Hark/prefs.json` | JSON | User settings |
| Anthropic API key | macOS Keychain | n/a | User-managed |
| Logs | `~/Library/Logs/Hark/*.log` | Plain text, rotated | 7-day retention |

**Why SQLite for embedding index?** Local-only, zero dependency, fast enough for 100K+ chunks, supports vector similarity via `sqlite-vec` extension. No need for Pinecone/Weaviate.

---

## Threat model summary

| Threat | Mitigation |
|---|---|
| Closed-source binary captures and exfiltrates audio | Hark is open-source (planned); audio path is auditable; `privacy-auditor` agent runs each release |
| Network attacker MITM the Claude API call | TLS pinning unnecessary — Anthropic SDK handles cert validation; we trust Anthropic's transport |
| Local malware reads the vault | Out of scope — vault is plain files; user's responsibility to secure their disk (FileVault recommended) |
| API key leaks to logs or commits | Stored in Keychain, never written to disk in plaintext, never logged; `privacy-auditor` checks for `sk-ant-` patterns in code |
| User accidentally records a confidential conversation | Pause button always visible; ⌘⇧S kills capture instantly; redact-before-send on by default |
| Speaker fingerprint reverse-engineered to identify someone | Embeddings stay local; never networked. Trust boundary: the disk the embeddings live on. |

---

## Related

- [Data flows](07-data-flows.md) — sequence diagrams for each major flow
- [WebSocket API contract](08-websocket-api-contract.md) — message schemas
- Handoff doc — stack rationale
- ADRs — individual decisions
