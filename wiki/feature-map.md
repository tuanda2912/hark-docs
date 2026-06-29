---
type: traceability
title: Feature → service → subsystem map
status: current
sources: [STATUS.md, knowledge-graph.json@69d53bc, ADR-0029, ADR-0032, ADR-0033, ADR-0037]
updated: 2026-06-28
tags: [traceability, features, architecture, wire-protocol, second-brain]
---

The **feature → file traceability** layer for Hark — "if I change feature X, which services and files
move?" Hark's wiki is organised by **subsystem** (code-shaped), so the *subsystem → files* half is already
done (each [[subsystems/rag|subsystem page]] carries a `## Code map`). This page adds the two things the
subsystem view doesn't give: a **feature → subsystem** map (the user-facing intent), and the **cross-process
contracts** that the code graph can't see.

> **Why Hark needs the cross-process layer.** Hark is a **multi-process, polyglot** app: `harkd` (Swift)
> ↔ Electron `main` (Node) ↔ `renderer` (Angular), talking over a WebSocket [[subsystems/wire-protocol|wire
> protocol]] + a [[subsystems/preload-security|preload IPC]] bridge. **There is no shared compiler across the
> Swift↔TS seam** — change a wire frame in Swift and the renderer's TypeScript mirror does **not** fail to
> compile; it breaks at runtime. So the cross-service edges are un-greppable *and* un-compilable — exactly
> what a precomputed map has to carry. Grounded in the graph @ `69d53bc` + [[STATUS|STATUS.md]] (2026-06-04).

---

## 1. The three services (process partition)

<!-- @generated:feature-map start — service partition, derived from the graph layers (query-graph.mjs layers). A /feature-map re-run regenerates everything between these markers; edit the config, not this block. -->

| Service | Process / language | Graph layers | Owns (subsystems) |
|---|---|---|---|
| **`harkd`** | Swift sidecar (one binary) | *Engine Core & Audio Capture* + *Streaming Daemon & Transcription* | [[subsystems/audio-capture]] · [[subsystems/vad]] · [[subsystems/whisperkit-asr]] · [[subsystems/diarization]] · [[subsystems/speaker-enrollment]] · [[subsystems/rag]] · [[subsystems/vault-writer]] · [[subsystems/audio-store]] · [[subsystems/engine-harkd]] · [[subsystems/wire-protocol]] (server) |
| **`main`** | Electron main (Node/TS) | *Electron Main Process* + *Privacy & LLM Egress* | [[subsystems/electron-main]] · [[subsystems/preload-security]] · [[subsystems/llm-egress]] · [[subsystems/external-rag-client]] · [[subsystems/tray]] |
| **`renderer`** | Angular (browser ctx) | *UI Renderer (Angular)* | [[subsystems/ui-shell]] · [[subsystems/engine-service]] · [[subsystems/llm-service]] · [[subsystems/retrieval-service]] |
| *(cross-cutting)* | — | *Engine Tests* · *Build & Configuration* | test suites · packaging |

<!-- @generated:feature-map end -->

**The subsystem is the capability tag** (already curated in Hark's wiki) — no separate vocabulary needed.
Each subsystem belongs to exactly one service, so `feature → service` falls out of `feature → subsystem`.

---

## 2. Cross-service contracts (the micro edges — not in the code graph)

These are the seams a feature crosses. They are **hand-mirrored contracts**, so they are the highest-risk
part of any cross-service change and the reason this map exists.

| Contract | Between | Source files (the seam) | Caught by |
|---|---|---|---|
| **WS wire protocol** (snake_case JSON envelope) | `harkd` ↔ `renderer` | `engine/Sources/Harkd/WireProtocol.swift` + `WebSocketServer.swift` (emit) ↔ `ui/src/app/services/engine.service.ts` (TS mirror) | `engine/Tests/HarkdTests/RagWireTests.swift` (Swift side only) — **renderer side is hand-verified** |
| **contextBridge IPC** (`window.hark`) | `renderer` ↔ `main` | `ui/src/main/preload.ts` (+ `tray-preload.ts`) ↔ renderer service calls | `tsc` within the TS side only; the **trust boundary** ([[subsystems/preload-security]]) |

> **No shared compiler crosses the WS seam.** A change to a `rag.*` / `segment.*` / `meeting.*` frame in
> `WireProtocol.swift` will **not** break `engine.service.ts`'s build. `RagWireTests.swift` pins the *engine*
> shape; the renderer mirror is kept in sync by hand. **This is the edge the feature map has to enumerate** —
> the compiler and the (Swift-only) tests will not.

---

## 3. Feature register (feature → services → subsystems → status)

The hand-owned intent layer. Status from [[STATUS|STATUS.md]] (Phase 6 shipped; Phase 7 packaging current).

| Feature | Services | Subsystems | Status |
|---|---|---|---|
| **Live transcription** | harkd → renderer | [[subsystems/audio-capture]] · [[subsystems/vad]] · [[subsystems/whisperkit-asr]] · [[concepts/streaming-finalization]] · [[subsystems/engine-harkd]] · [[subsystems/wire-protocol]] · [[subsystems/engine-service]] · [[subsystems/ui-shell]] | ✅ shipped (Ph 0–4) · ⚠ VAD energy-based not Silero; VN ASR quality open |
| **Diarization & speakers** | harkd → renderer | [[subsystems/diarization]] · [[subsystems/speaker-enrollment]] · [[subsystems/vault-writer]] · `speaker-tagging.component` | ✅ Ph 5/5.1 · 🔒 offline only, **no live diarization v1** (ADR-0025) |
| **Vault RAG / "Ask Hark"** | **harkd ↔ main ↔ renderer** (all 3) | [[subsystems/rag]] · [[subsystems/external-rag-client]] · [[concepts/pluggable-retrieval]] · [[subsystems/retrieval-service]] · [[subsystems/llm-service]] · [[subsystems/llm-egress]] | ✅ Ph 6 complete + pluggable — **the full cross-service showcase** |
| **Summary & this-meeting Q&A** | renderer ↔ main → harkd | [[subsystems/llm-service]] · [[subsystems/llm-egress]] · [[subsystems/vault-writer]] (`summary.write`) | ✅ Ph 6 (slices 2/3) |
| **Translation (on-demand)** | renderer ↔ main → harkd | [[subsystems/retrieval-service]] (`TranslationJobService`) · [[subsystems/llm-egress]] · [[subsystems/vault-writer]] | ✅ post-stop structured (ADR-0037) · ⚠ **live translation REMOVED**; engine `task:.translate` dormant (gap-by-decision) |
| **Meeting vault & git** | harkd | [[subsystems/vault-writer]] · [[subsystems/audio-store]] | ✅ Ph 5 · audio persistence opt-in (ADR-0028) |
| **Privacy / egress governance** | main (renderer has no key) | [[subsystems/llm-egress]] · [[subsystems/preload-security]] · [[concepts/egress-governance]] · [[concepts/threat-model]] | ✅ Ph 6 (ADR-0029/30/31) · privacy-audited PASS |
| **Onboarding** | renderer ↔ main | [[subsystems/ui-shell]] · (ADR-0023) | ✅ Ph 4 · polish ongoing |
| **Tray / menu-bar** | main → renderer | [[subsystems/tray]] | ✅ Ph 4 |
| **Packaging / notarization** | build/config | (ADR-0021/0038) | 🟡 **Phase 7 CURRENT ~60%** — ⛔ gaps: app icon, TCC-attribution check, notarize (needs paid Apple Dev ID) |

---

## 4. Worked query — "I'm changing the `rag.retrieve` wire frame"

<!-- @generated:feature-map start — worked-query resolution skeleton; a re-run regenerates the file list from the graph + contracts. The prose below the fence is hand-owned. -->

```
1. feature lookup    rag.retrieve belongs to → "Vault RAG / Ask Hark" → services {harkd, main, renderer}
2. contract (§2)     it crosses the WS wire protocol (harkd ↔ renderer)
3. files to touch (cross-service, in lock-step):
     engine/Sources/Harkd/WireProtocol.swift        ← define the frame
     engine/Sources/Harkd/WebSocketServer.swift      ← emit it
     engine/Tests/HarkdTests/RagWireTests.swift       ← update the Swift contract test
     ui/src/app/services/engine.service.ts            ← MIRROR by hand (compiler will NOT flag this)
     ui/src/app/services/retrieval-service.ts         ← consume
     ui/src/app/components/…ask/citation-chip          ← render
4. propagation reality: the Swift build + RagWireTests pin the ENGINE side only.
   The renderer mirror has no compiler safety net across the seam → this checklist IS the safety net.
```

<!-- @generated:feature-map end -->

This is the case a **single-language monolith cannot exhibit**: there, a shared compiler + one test suite
catch cross-module breaks, so the map only needs "which files." Here, the Swift↔TS seam has **no shared
build**, so the map must enumerate the cross-service file set explicitly — the genuine **microservices**
property, on a real (not synthetic) app.

---

## 5. Test notes — framework (micro path) applied to Hark

- ✅ **Subsystem = capability, for free.** Hark's code-shaped wiki already did `capability → files`
  (the subsystem `## Code map` blocks). The framework only adds the thin `feature → subsystem` register
  (§3, ~10 rows) + the process partition (§1) + the contracts (§2).
- ✅ **The cross-service contract is the real payload.** Unlike a single-language monolith (shared compiler), Hark's polyglot WS
  seam is un-greppable *and* un-compilable — so enumerating it (§2/§4) is where the map earns its keep.
- ✅ **Graph is fresh** (`69d53bc`, 4 files behind HEAD `8e7d009`) — no re-run needed. Status grounded in
  STATUS.md, the project's own source of truth.
- ⚠ **The wire mirror is the one thing to keep honest.** `RagWireTests.swift` guards the engine side; there
  is **no committed renderer/main test runner** ([[STATUS|STATUS.md]] open thread 7). Candidate next step:
  a `vitest`/`node --test` contract test that asserts `engine.service.ts` matches the Swift frames — turning
  the hand-mirror into a checked edge.
- ⚠ **`feature → subsystem` status is the only hand-owned column** — re-verify on each phase change / `/understand` refresh.

**Verdict (micro test instance):** the framework's microservices path holds on a real polyglot app. The
service = process, capability = subsystem, and the cross-service edge = the wire/IPC **contract** (sourced
from the seam files, not the code graph). The one gap worth closing is a renderer-side wire contract test.
