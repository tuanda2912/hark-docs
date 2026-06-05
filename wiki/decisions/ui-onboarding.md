---
type: decision-digest
title: UI & onboarding (ADR-0010/0014/0022/0023)
status: current
sources: [ADR-0010, ADR-0014, ADR-0022, ADR-0023]
updated: 2026-06-05
tags: [ui, electron, angular, onboarding, prefs, first-run, privacy]
---

# UI & onboarding (ADR-0010/0014/0022/0023)

How the Electron + Angular shell got built and how a fresh user first meets it: the **Phase 4 signals scaffold** (0010 — hand-rolled Angular 21, Tailwind-through-CSS-vars, signals, renderer-owned WebSocket), **local prefs persistence** in the main process (0014 — a hand-rolled versioned `prefs.json` under the sanctioned app-data dir), a **first-run model-load progress** screen behind an ~800 ms anti-flash readiness gate (0022 — the additive `meta.model_progress` frame), and a **Trust → Permissions → Setup onboarding overlay** gated on a persisted `hasCompletedOnboarding` flag (0023), with the engine warming up behind it. The renderer that consumes all this is [[ui-shell]]; the WebSocket client is [[engine-service]]; the security boundary the prefs/onboarding APIs cross is [[preload-security]]; the process that owns the prefs file + spawns the engine is [[electron-main]]; the "explain before macOS asks" posture is [[privacy-data-control]].

## At a glance

| ADR | Title | Status | Supersession |
|---|---|---|---|
| 0010 | Phase 4 UI scaffold — Electron + Angular 21 + Tailwind + signals | Accepted | — |
| 0014 | Local preferences persistence for the Electron UI | Accepted | — (schema extended in code, see note) |
| 0022 | First-run model-load progress | Accepted | — (Slice 1; Slice 2 became 0023) |
| 0023 | First-run onboarding flow | Accepted | — (the deferred "Slice 2" of 0022) |

## ADR-0010 — Phase 4 UI scaffold

[../decisions/0010-phase-4-ui-scaffold.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0010-phase-4-ui-scaffold.md) · 2026-05-28 · **Accepted**

The per-stack-layer choices below ADR-0001 (which locked Electron + Angular 21 — see [[foundations]]). Phase 3's stable WebSocket contract was in place; Phase 4 stood up an actual UI. Decisions:

- **Build / project structure** — a **hand-rolled** Angular 21 project (no `ng new`), standalone components only, no NgModule. Two TypeScript build paths via separate tsconfigs: `tsconfig.app.json` → Angular CLI builds the renderer into `dist/renderer/`; `tsconfig.main.json` → plain `tsc` builds the Electron main process into `dist/main/`. The split keeps Electron's `electron` API out of the renderer compile graph and Angular services out of main's.
- **Styling — Tailwind CSS v3 through CSS custom properties.** `src/styles/tokens.css` carries `:root` + `[data-theme="dark|light"]` blocks lifted verbatim from the design pass; `tailwind.config.js` `theme.extend.colors` references the CSS vars (`bg: 'var(--bg)'`) so utilities like `bg-bg` / `text-text-2` resolve through the theme. Theme switching is one DOM attribute on `<html>`, no JS recompute. Tradeoff: Tailwind opacity modifiers (`bg-bg/50`) don't work natively on `var(--bg)` refs.
- **State — Angular signals** (`signal`/`computed`/`effect`) for component state; a single `EngineService` holds the WebSocket and exposes RxJS `Subject`s for frame events. **No NgRx/Redux** — a single-window app with one WS source of truth doesn't earn it.
- **Engine bridge — Electron main is the lifecycle owner.** It spawns `harkd`, polls for `engine.port`, parses the JSON, and exposes the port to the renderer via `contextBridge` + a typed `window.hark`. The **renderer connects to the WebSocket directly** (browser-native `WebSocket`) — keeps WS protocol logic in one place and satisfies Hard Rule #1 because the loopback bind already gates external access. Rejected: WS-in-main forwarded over IPC (doubles the message-shape code; revisit only for multi-window).
- **First-commit thin slice** — scaffold + harkd spawn + WS connect + a minimal live-transcript view, proving the dev loop end-to-end before piling on surfaces (tray, Q&A, settings, speaker tagging all deferred to follow-ups).

Rejected: `ng new` + Angular Material (fights the opinionated design language; ships Karma/Jasmine/Protractor we don't want at v1); plain CSS (loses iteration speed — user picked Tailwind); Vite-only (fighting Angular's `ng build`/`ng serve` toolchain). Open at the time: production bundling of `harkd`, signing/notarization, auto-updater, renderer-side persistence — the last became **ADR-0014**, signing/packaging became [[packaging-distribution|ADR-0021/0038]].

Must remain true: standard Angular 21 idioms; the two-tsconfig split; single-window assumption (else lift the WS into main).

## ADR-0014 — Local preferences persistence

[../decisions/0014-ui-preferences-persistence.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0014-ui-preferences-persistence.md) · 2026-06-01 · **Accepted**

The first persistence layer in the UI. Capture-source toggles (mic/system) and ASR language were transient renderer state, reset to defaults every launch — daily-driver friction. Decision: a small **user-preferences layer in the Electron main process**, a versioned JSON file at `~/Library/Application Support/Hark/prefs.json`.

- **Path discipline:** built as `app.getPath('appData')` joined with a literal `'Hark'` — **not** `getPath('userData')`, which (no `productName` set) resolves to `.../Electron` in dev and `.../hark-ui` packaged. This pins the file in the sanctioned app-data location, **never the vault** (CLAUDE.md rules #2/#4).
- **Minimal versioned schema:** `{ "version": 1, "audio": { "mic": true, "system": true, "language": null } }`.
- **Hand-rolled (~30-line) reader/writer:** read on demand via IPC, **validated before write**, exposed to the renderer over a **whitelisted `contextBridge` API**. Opens **no network socket** and writes nothing outside the app-data dir, so it needs no network-dependency ADR under rule #6.

Rejected: `electron-store` (a whole dependency + transitive tree for what 30 lines cover — revisit only if prefs need real migrations / atomic guarantees); renderer `localStorage` (lives in the opaque Chromium profile dir, splits state across two stores — violates the spirit of "one well-known app-data location"); storing prefs in the vault (the vault is for *user content*, not app config). Accepted tradeoff: no atomic-write/migration machinery, and we own the schema-versioning discipline (any field change bumps `version` and handles older shapes on read). Invariant: prefs stay **small and config-only** — never transcripts, audio, or PII.

> TODO(wiki): the **schema has since grown beyond ADR-0014's literal `version: 1` shape** without a superseding ADR — `ui/src/main/prefs.ts` now also persists `hasCompletedOnboarding` (added by ADR-0023) and a theme field, and the writer comments describe an **atomic write** ("a crash mid-write can't leave a half-written `prefs.json`"), which ADR-0014 explicitly listed as *not* done. This is the in-code evolution ADR-0014's "version bump handled on read, not a new store" clause anticipated; confirm whether a follow-up ADR should record it.

## ADR-0022 — First-run model-load progress

[../decisions/0022-first-run-model-load-progress.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0022-first-run-model-load-progress.md) · 2026-06-02 · **Accepted**

A fresh packaged install (after [[packaging-distribution|ADR-0021]]) hit a rough first launch: the WhisperKit speech model (~626 MB) and FluidAudio diarizer CoreML models download + compile during warm-up, and the engine previously emitted **nothing** on the wire between `meta.hello {model_loaded: "(loading)"}` and the terminal `meta.ready` — a frozen idle UI that looks hung for a couple of minutes.

Decision: a **purely additive** engine→UI event **`meta.model_progress`** with payload `{ phase, fraction, detail }`:

- `phase` ∈ `downloading_speech` | `optimizing_speech` | `downloading_diarizer` | `optimizing_diarizer`.
- `fraction` is `0..1` where the loader exposes one; **explicit JSON `null` for the WhisperKit ANE compile**, which has *no* progress API — the UI shows a labeled **spinner**, not a fabricated percentage.
- **Throttled** before crossing the actor boundary (emit on phase change, on `fraction` delta ≥ 0.01, or ≥ 200 ms elapsed) so the high-frequency download callbacks don't flood the actor.
- The last payload is **snapshot-replayed** to a client that connects mid-download, and **cleared on `meta.ready`** — which stays the single **terminal** readiness signal.
- The UI shows a full-screen **"Preparing Hark…"** screen (determinate bar when `fraction != null`, labeled spinner when `null`) behind an **~800 ms anti-flash gate** (reveal immediately if a progress frame arrives) so warm-cache launches don't flicker a loader.

This was explicitly **Slice 1** (the functional fix). The welcome/permission **onboarding screens + a first-run prefs flag** were **Slice 2**, deferred to BACKLOG — and became **ADR-0023**.

Rejected: fabricating a percentage for the ANE compile (dishonest; compile time varies M1 ~90 s vs M4 seconds); spinner-only with no fractions (throws away the real download signal); polling a `meta.status` endpoint (the contract is push/event-based); always-on full-screen loader (would flash every warm launch). Must remain true: the model loaders keep exposing their progress callbacks (WhisperKit `download`, FluidAudio `load(progressHandler:)`); `meta.ready` stays the single terminal signal. The frame itself is part of the [[wire-protocol]] contract.

## ADR-0023 — First-run onboarding flow

[../decisions/0023-first-run-onboarding-flow.md](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0023-first-run-onboarding-flow.md) · 2026-06-02 · **Accepted**

The "Slice 2" deferred by ADR-0022. With the app packaged and the model-load screen shipped, the remaining first-run gap was the onboarding the design specifies (`hark-docs/docs/design/ui/` screens 13/14/15: Trust → Permissions → Setup). A fresh user should understand the privacy posture and the permissions macOS is about to ask for **before** the prompts appear — "no surprises" is core to a privacy-first product.

Decision: an onboarding **overlay** shown on first run, gated on a new persisted **`hasCompletedOnboarding`** flag (default `false`; a *missing* field reads as `false`, so existing installs see it once). "Start using Hark" sets the flag. The overlay sits **above everything (incl. the loading screen)**; the engine warms up behind it, masking the model download. Content adapted from the design for **honesty over literal fidelity**:

- **Trust:** engine label corrected to **WhisperKit large-v3-turbo** (not the design's "whisper.cpp"). Three points: local capture/transcription, opt-in itemized cloud, plain-markdown vault you control.
- **Permissions: two, not three.** **Microphone** (live status via Electron `systemPreferences.getMediaAccessStatus`, optional `askForMediaAccess` when undecided) and **System Audio Recording** — Core Audio Process Taps (`kTCCServiceAudioCapture`), **deliberately not Screen Recording** ([[capture-audio|ADR-0011]]), requested **lazily at first capture** ([[capture-audio|ADR-0012]]) so it's informational ("macOS will ask the first time you record"). The design's **Accessibility / global-hotkeys** card was **dropped** — global hotkeys aren't built.
- **Setup:** the real fixed vault path with `writable` / `git-tracked` chips and a working "Reveal in Finder". The **folder picker** and **Anthropic API-key** field are rendered in the design's layout but **disabled/deferred** (configurable vault + Keychain key are future work). The "Obsidian detected" chip was dropped (can't be truthfully detected for a fixed path).

Rejected: matching the design verbatim (would mislabel Screen Recording and present unbuilt features as working); no onboarding / lazy-prompts-only (drops the trust moment); requesting all permissions upfront (our model is lazy — `kTCCServiceAudioCapture` can't be pre-granted without starting a tap, so a "Grant" button there would be fake). Must remain true: the permission model stays Process Taps + lazy ([[capture-audio|ADR-0011/0012]]); if configurable vault and/or a Keychain key land, screen 3's deferred controls get enabled. Tradeoff documented so a future session doesn't "fix" the permissions screen back to Screen Recording.

> TODO(wiki): ADR-0023's *decision* describes a **three-screen** flow (Trust → Permissions → Setup), but the shipped component (`ui/src/app/components/onboarding.component.ts`) is **four screens — Trust → Permissions → Privacy → Setup** (a `Privacy` screen was inserted). The one-liner's "three/four-screen" wording reflects this divergence; the ADR has not been updated to record the added screen.

## Where these decisions live in the code

The scaffold, prefs layer, and first-run UI live entirely under `ui/`:

- **Scaffold (0010):** `ui/src/styles/tokens.css` (design tokens), `ui/tailwind.config.js` (vars-through-theme), `ui/tsconfig.app.json` + `ui/tsconfig.main.json` (the two build paths), `ui/src/main.ts` (renderer entry), `ui/src/main/main.ts` (Electron main entry). The renderer architecture is [[ui-shell]]; the WS client `EngineService` is [[engine-service]].
- **Prefs (0014):** `ui/src/main/prefs.ts` (the versioned JSON reader/writer in main), surfaced to the renderer over [[preload-security]] (`ui/src/main/preload.ts`) and consumed via `ui/src/app/services/preferences.service.ts`. The process that owns the file is [[electron-main]].
- **Model-load progress (0022):** UI side `ui/src/app/services/engine.types.ts` (+ `engine.service.ts`) and `ui/src/app/components/model-loading.component.ts`; engine side `WireProtocol.swift`, `EngineSession.swift`, `HarkCore/ModelLoader.swift`, `DiarizerLoader.swift` ([[engine-harkd]] / [[whisperkit-asr]]). The `meta.model_progress` frame is in [[wire-protocol]].
- **Onboarding (0023):** `ui/src/app/components/onboarding.component.{ts,html,css}` and `app.component.*`; main side `ui/src/main/prefs.ts` + `ui/src/main/preload.ts` + `ui/src/main/main.ts`; renderer `ui/src/app/services/preferences.service.ts`.

The "explain before macOS asks" / opt-in-gate framing is [[privacy-data-control]] and [[threat-model]] (Hard Rules #1/#2/#3/#6). Terms like signals, `contextBridge`, anti-flash gate, `meta.ready`, `kTCCServiceAudioCapture`, and squircle/design-tokens are in [[glossary]].

## See also

[[ui-shell]] · [[engine-service]] · [[preload-security]] · [[electron-main]] · [[privacy-data-control]] · [[capture-audio]] · [[wire-protocol]] · [[packaging-distribution]] · [[foundations]] · [[glossary]]
