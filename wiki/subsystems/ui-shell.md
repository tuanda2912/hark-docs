---
type: subsystem
title: UI shell — Angular renderer, services & panels
status: current
sources: [ADR-0001, ADR-0010, ADR-0014, ADR-0022, ADR-0023, ADR-0024, ui/src/app/app.component.ts, ui/src/main.ts, ui/src/app/app.config.ts, ui/src/app/services/preferences.service.ts, ui/src/app/services/theme.service.ts, ui/src/app/services/llm.service.ts, ui/src/app/services/retrieval.service.ts, ui/src/app/services/translation-job.service.ts, ui/src/app/components/settings-panel.component.ts, ui/src/app/components/onboarding.component.ts, ui/src/app/components/post-meeting-review.component.ts, ui/tailwind.config.js, ui/src/styles/tokens.css, ui/src/styles.css, ui/src/index.html]
updated: 2026-06-05
tags: [ui, angular, electron, signals, renderer, privacy]
---

# UI shell — Angular renderer, services & panels

The Electron + **Angular 21** renderer: a single-window, standalone-component,
signals-first app whose root `AppComponent` is a **3-column shell — Attendees ·
live transcript · Ask** — surrounded by a thin titlebar strip and a controls
bar. It owns no network of its own: the WebSocket to `harkd` lives in
[[engine-service|EngineService]], every cloud call funnels through the
[[electron-main|Electron main]] egress chokepoint via [[llm-service|LlmService]],
and the renderer runs under a **strict CSP** with no telemetry. Theme is a
single `data-theme` attribute flip over CSS-variable tokens; defaults persist
through [[electron-main]]'s prefs file.

> Why Electron + Angular, not Tauri / SwiftUI: [[ui-onboarding]] — ADR-0001
> picked Electron (predictable Chromium, mature sign/notarize tooling) once the
> engine became a separate Swift binary; ADR-0010 fixed the per-layer stack
> (standalone components, signals, Tailwind-via-CSS-vars).

## Code map

**Layer:** UI Renderer (Angular). This is the hub slice — 30 files spanning the
shell, every panel/modal/atom under `components/`, the renderer-owned services,
and the styling/config layer.

**Files**

*Shell & bootstrap*
- `ui/src/main.ts` — renderer bootstrap; forks on the URL hash to mount `TrayPopoverComponent` (`#tray`) or the full `AppComponent` shell, keeping the popover dependency-free in one shared bundle.
- `ui/src/app/app.config.ts` — root `ApplicationConfig` (providers) consumed by the `AppComponent` bootstrap.
- `ui/src/app/app.component.ts` — root standalone component orchestrating the whole UI: live transcript, capture controls, panels, speaker tagging, bookmarks, tray integration.
- `ui/src/app/app.component.html` — main-window template: macOS title strip, controls bar, collapsible 3-column layout (Attendees · transcript · Ask) on token-bound Tailwind utilities.
- `ui/src/app/app.component.css` — component-scoped shell styles: hiddenInset titlebar/traffic-light chrome, clamped 3-column grid, two-row header responsive degradation.

*Panels & modals*
- `ui/src/app/components/ask-panel.component.ts` — vault/in-meeting Q&A panel: answer with citation chips, source list, scope toggle, RAG index status.
- `ui/src/app/components/attendees-panel.component.ts` — side panel listing attendees/speakers with confidence badges + color chips; triggers speaker tagging.
- `ui/src/app/components/settings-panel.component.ts` — settings modal: theme, audio defaults, language, privacy toggles, LLM provider/model/key config with connection testing, RAG backend.
- `ui/src/app/components/settings-panel.component.html` — settings template: read-only engine/connection status + editable appearance/audio/privacy/vault-search sections.
- `ui/src/app/components/settings-panel.component.css` — scoped settings-modal styles (backdrop, card, toggle switches, sections).
- `ui/src/app/components/summary-panel.component.ts` — Claude-powered meeting summary from the transcript, with redaction receipts; saves into the vault note.
- `ui/src/app/components/translate-panel.component.ts` — starts a post-stop, per-utterance translation job toward a chosen target language and reports cloud-path use.
- `ui/src/app/components/onboarding.component.ts` — first-run wizard: privacy toggles, RAG backend choice, mic permission grant, vault reveal.
- `ui/src/app/components/onboarding.component.html` — four-step flow (Trust · Permissions · Privacy · Setup) explaining the local-first model and capturing opt-in toggles + vault location/backend.
- `ui/src/app/components/onboarding.component.css` — scoped onboarding styles (panel layout, step-progress bar, trust/permission cards, opt-in switches, choice cards).
- `ui/src/app/components/post-meeting-review.component.ts` — full-screen review modal: plays back saved audio, syncs the playhead to utterances, renames speakers against the recording.
- `ui/src/app/components/model-loading.component.ts` — full-screen overlay shown while the WhisperKit model loads, rendering a progress fraction + detail text.
- `ui/src/app/components/speaker-tagging.component.ts` — modal to name/re-tag a single speaker, with recognition hints, focus trapping, remember-speaker awareness.
- `ui/src/app/components/meeting-saved-toast.component.ts` — post-save toast confirming vault write; inline speaker rename + reveal/review/summarize/translate actions.

*Atoms & presentational components*
- `ui/src/app/components/transcript-line.component.ts` — single transcript line: timestamp, speaker color, optional translation, partial caret, bookmark indicator.
- `ui/src/app/components/transcript-line.component.css` — scoped styles for the transcript line (speaker label, timestamp, text layout).
- `ui/src/app/components/speaker-tag.component.ts` — OnPush atom: colored dot + name + chevron speaker chip, italic untagged variant, token-only styling.
- `ui/src/app/components/citation-chip.component.ts` — tiny numbered-citation marker chip, optionally interactive (emits select).
- `ui/src/app/components/status-banner.component.ts` — presentational status/warning/error banner with severity-based color.
- `ui/src/app/components/eyebrow.component.ts` — minimal eyebrow/label component projecting content for section headers.

*Renderer services*
- `ui/src/app/services/preferences.service.ts` — signals store for audio/theme/privacy/RAG/onboarding prefs; loads + persists via the hark bridge (ADR-0014).
- `ui/src/app/services/theme.service.ts` — sole writer of `<html data-theme>`; `effect` on the theme signal + `prefers-color-scheme` listener; pure DOM, no IPC/network/disk.

*Styling & config*
- `ui/src/index.html` — renderer entry HTML hosting both custom-element hosts under a strict CSP (denies remote content; permits loopback harkd WS + local blob media).
- `ui/src/styles.css` — global stylesheet: imports tokens, pulls in Tailwind layers, sets html/body typography, keeps the tray popover surface transparent.
- `ui/src/styles/tokens.css` — design-token source of truth: CSS custom properties (fonts, spacing, radii, colors, status semantics, speaker palette) under `:root` + per-theme selectors.

**Key types & functions**
- `AppComponent` — `app.component.ts` (L79–976) — wires engine/LLM/prefs/retrieval services to the view; meeting lifecycle (start/stop/bookmark), panel visibility, ask-scope routing, autoscroll.
- `SettingsPanelComponent` — `settings-panel.component.ts` (L47–396) — binds prefs/LLM/engine to controls; draft LLM config, key save/clear, live LLM & RAG connection tests.
- `OnboardingComponent` — `onboarding.component.ts` (L57–210) — multi-step wizard; persists privacy/RAG prefs, polls + requests mic permission, completes onboarding.
- `PostMeetingReviewComponent` — `post-meeting-review.component.ts` (L625–900) — loads audio into an object URL, manages `HTMLAudioElement` playback, follows playhead, applies renames.
- `AskPanelComponent` — `ask-panel.component.ts` (L770–881) — emits ask/scopeChange/openSettings; derives source, placeholder, index-state labels.
- `MeetingSavedToastComponent` — `meeting-saved-toast.component.ts` (L419–564) — editable roster from saved meeting; applies renames via engine; emits summarize/translate/openSettings (gated on model config).
- `SummaryPanelComponent` — `summary-panel.component.ts` (L435–586) — builds timestamped transcript + speaker names, invokes LLM summarize, writes back to the note via engine.
- `TranslatePanelComponent` — `translate-panel.component.ts` (L384–492) — gathers transcript texts + speaker names, enqueues a translation job via `TranslationJobService`.
- `SpeakerTaggingComponent` — `speaker-tagging.component.ts` (L489–636) — captures a display name, persists via engine `renameSpeakers`, keyboard focus trapping.
- `AttendeesPanelComponent` — `attendees-panel.component.ts` (L309–362) — builds attendee rows from the last saved meeting, derives confidence + colors, emits tag-speaker.
- `SpeakerTagComponent` — `speaker-tag.component.ts` (L73–80) — name/color/tagged signal inputs rendering a speaker-chip pill atom.
- `PreferencesService` — `preferences.service.ts` (L79–316) — injectable signals store; loads/saves via the hark bridge; tracks onboarding completion.
- `ThemeService` — `theme.service.ts` (L22–66) — injectable theme applier; effect + media-query listener sets `data-theme`.

**Pinned by tests:** none in this slice.

**Connections**
- imports / calls → [[subsystems/engine-service|EngineService]]
- imports → [[subsystems/wire-protocol|Wire protocol]]
- imports / calls → [[subsystems/llm-service|LlmService]]
- imports / calls → [[subsystems/retrieval-service|RetrievalService & TranslationJobService]]
- imports → [[subsystems/tray|Tray & popover]]
- ⇐ imports [[subsystems/engine-service|EngineService]]
- ⇐ imports [[subsystems/retrieval-service|RetrievalService & TranslationJobService]]

## What it does

`ui/src/main.ts` bootstraps **exactly one** Angular surface per window, chosen by
the URL **hash** (no `@angular/router`):

- `#tray` → the dependency-free [[tray|tray popover]] (`TrayPopoverComponent`),
  bootstrapped with zone change-detection only — **no `EngineService`, no prefs,
  no WebSocket**; it is a dumb view fed by main's `window.harkTray` bridge.
- anything else → the main app shell (`AppComponent`) with `appConfig`.

Both custom-element hosts (`<hark-root>`, `<hark-tray-popover>`) sit in
`index.html`; the unmatched one stays an inert empty element. The `#tray`
document also sets `data-surface="tray"` so the global opaque background drops
(the popover window is transparent and draws its own rounded card).

`app.config.ts` provides **only** `provideZoneChangeDetection({ eventCoalescing:
true })` — signals are the primary state mechanism (ADR-0010), but Zone stays
because the engine's RxJS streams (`bookmarkCreated$`, `warnings$`, …) still flow
through it. No NgRx/Redux: a single window with one WebSocket source of truth
doesn't earn the ceremony (ADR-0010 §3).

## The 3-column shell (`AppComponent`)

`ui/src/app/app.component.ts` (+ `.html` / `.css`) is the Phase-4 MainWindow:

- **Row 1 — titlebar strip:** a macOS window-drag region (reserving the
  hiddenInset traffic-light zone) with the honest app name and the two
  panel-toggle buttons.
- **Row 2 — controls bar:** REC counter + audio meter + Start/Stop/Bookmark/New
  on the left; language picker, trust lozenge, a dev RTF readout, and the gear on
  the right. Degrades responsively (drops the dev readout, then collapses labels
  to icons).
- **Row 3 — the grid:** `Attendees (left) | Transcript (center) | Ask (right)`.
  Center is the flexible track; the side columns **shrink** (clamped widths)
  rather than vanish, and the **only** way a column disappears is a user toggle
  (`leftPanelOpen` / `rightPanelOpen`) — there are no width media-queries that
  hide a column (that auto-hide was a past bug source). Window `minWidth` is set
  in `main.ts` so three shrunk columns always fit.

It injects five services — `EngineService`, `PreferencesService`, `LlmService`,
`RetrievalService`, `TranslationJobService` — plus `ThemeService` purely for its
construction side-effect (it writes `data-theme` and is never referenced again).

**Live transcript:** `finalizedSegments` render upright in history; `liveSegments`
(in-flight partials) float at the bottom, italic with a blinking caret. An
`afterRenderEffect` pins the scroll to the newest line, but only while the user is
within ~48 px of the bottom (`followTail`), so reading back up isn't yanked down.
At stop the engine's `meeting.transcript` frame replaces the live churn with the
clean, per-line **speaker-labeled** set (ADR-0024); `speakerColorFor` delegates to
the single `EngineService` palette mapping so transcript chips and the Attendees
roster always agree.

**Overlays & modals** (each a standalone component, gated by a signal):
`ModelLoadingComponent` (first-run "Preparing Hark…", below), `OnboardingComponent`
(first-run trust/permissions overlay, ADR-0023), `SettingsPanelComponent` (⌘,),
`AttendeesPanelComponent` + `SpeakerTaggingComponent` (rename → re-color both
surfaces), `PostMeetingReviewComponent` (verify-by-ear tagging; only when audio was
kept), `SummaryPanelComponent`, `TranslatePanelComponent`, `AskPanelComponent`,
`StatusBannerComponent`, `MeetingSavedToastComponent`. ⌘⇧B fires a bookmark, ⌘,
opens Settings (`@HostListener('window:keydown')`).

**Capture lifecycle:** `onStart` reads the live source toggles + language **and**
the persisted privacy gates (`keepAudio`, `rememberSpeakers`, ADR-0027) and calls
`engine.startCapture`. Live translation is **never** requested during capture
(deferred, ADR-0037 → [[translation]]); translation is an on-demand post-stop
action driven by `TranslationJobService`.

> Many panel components (Settings, Onboarding, Attendees, Ask, etc.) are their own
> files under `ui/src/app/components/`; this page covers the **shell + services**.
> Deepen a specific panel on demand.

## First-run gating (anti-flash + onboarding)

- **`showLoadingOverlay`** (ADR-0022): an `effect` gates the full-screen loader.
  A real `meta.model_progress` frame (cold start, models downloading/compiling) →
  reveal immediately; otherwise arm an **800 ms anti-flash timer** so a warm cache
  start (`meta.ready` in ~1–2 s) doesn't flash a loader; tear down on `ready()` /
  disconnect.
- **`showOnboarding`** (ADR-0023): a `computed` true only once `prefs.loaded()`
  **and** `!hasCompletedOnboarding()`, so a returning user never flashes onboarding
  during the async prefs read. "Start using Hark" calls
  `prefs.completeOnboarding()`, flipping the persisted flag for good.

## The renderer services

| Service | File | Role |
|---|---|---|
| `PreferencesService` | `ui/src/app/services/preferences.service.ts` | Signals-based wrapper over main's prefs IPC bridge (ADR-0014). Owns audio defaults, language, theme choice, the `hasCompletedOnboarding` flag, privacy flags (ADR-0027), and the RAG backend selection (ADR-0033/0034). Loads via `window.hark.loadPrefs`, persists via `savePrefs`; degrades to in-memory defaults outside Electron. |
| `ThemeService` | `ui/src/app/services/theme.service.ts` | The single writer of `<html data-theme>`. Resolves the choice (`system`/`light`/`dark`) — `system` follows `matchMedia('(prefers-color-scheme: dark)')` and re-resolves live. Pure DOM, **no IPC/network/disk**; the *choice* is persisted by `PreferencesService`. |
| `LlmService` | `ui/src/app/services/llm.service.ts` | Thin facade over `window.hark.llm` (ADR-0029). Projects provider readiness (`configured`, `asking`) as signals; sends keys down to main (encrypted via `safeStorage`) and reads back only non-secret status. **Never touches the network, never sees a stored key.** See [[llm-service]] / [[llm-egress]]. |
| `RetrievalService` | `ui/src/app/services/retrieval.service.ts` | The `RetrievalBackend` switch (ADR-0033): `builtin` → `EngineService.retrieve` (loopback WS, ADR-0032) vs `external` → main's loopback client (ADR-0034). Both return the same `RagResultChunk` shape so the Ask panel renders either identically. See [[retrieval-service]] / [[external-rag-client]] / [[rag]]. |
| `TranslationJobService` | `ui/src/app/services/translation-job.service.ts` | Post-stop background transcript translation **orchestrator** — **no socket, no network**. Translates utterances one at a time via `LlmService.translateSegment` (→ main, the egress chokepoint), tracks a progress %, and writes the ordered lines back through `EngineService.writeTranslationLines` (the engine is the single vault writer). See [[retrieval-service]] / [[translation]]. |
| `EngineService` | `ui/src/app/services/engine.service.ts` | The renderer's WebSocket client to `harkd` — connection/capture state, segment streams, speaker roster + colors, RAG retrieval. Its own page: [[engine-service]]. |

## Styling — Tailwind through CSS-variable tokens

`tailwind.config.js` `theme.extend` maps utility classes to `var(--…)` refs only
(`bg-bg` → `var(--bg)`, `text-text-2`, `border-border-2`, `sp-1…sp-6`, radii,
fonts). The real values live in `ui/src/styles/tokens.css` under `:root`,
`[data-theme="dark"]`, `[data-theme="light"]` (dark is the default in
`index.html`). Theme switching is therefore **one attribute flip with zero JS
recomputation** — `ThemeService` sets `data-theme` and the CSS cascade repaints
(ADR-0010 §2). The speaker palette (`--sp-1`…`--sp-6`) and status semantics
(recording/warning/success/cloud) are shared across themes.

## Strict CSP & no-telemetry posture

`index.html` ships a `<meta http-equiv="Content-Security-Policy">` (per ADR-0001's
security tradeoffs + [[threat-model]] hard rule #3):

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
font-src 'self' data:; connect-src 'self' ws://127.0.0.1:*;
img-src 'self' data:; media-src 'self' blob:; object-src 'none'; base-uri 'self';
```

- **`connect-src`** admits *only* `'self'` + the `harkd` loopback bind
  (`ws://127.0.0.1:*`) — no remote origin. Cloud LLM/RAG egress is **not** in the
  renderer; it lives in main ([[egress-governance]]).
- **`media-src blob:`** lets the Post-Meeting Review screen play locally-read
  meeting audio via `URL.createObjectURL` — bytes come from main's validated,
  vault-internal read, **not** the network; it widens nothing.
- No `unsafe-eval`, no remote scripts. The only inline allowance is `style-src
  'unsafe-inline'` for Tailwind's base.

The renderer makes **no** analytics/telemetry calls; the only `console.error` is
a bootstrap failure log (local).

## How it connects

- **Engine I/O** → all WS traffic via [[engine-service]] over the
  [[wire-protocol|WebSocket contract]]; the spawn/port handshake is
  [[electron-main]].
- **IPC bridge** → prefs / reveal-in-Finder / tray / LLM / external-RAG all cross
  the `contextBridge` surface in [[preload-security]]; `window.hark` is `undefined`
  under bare `ng serve`, and every call site guards for it.
- **Cloud egress** → only through [[llm-service]] → [[electron-main]]
  ([[llm-egress]], [[egress-governance]]); the renderer never calls out.
- **Vault Ask** → [[retrieval-service]] (built-in [[rag]] or
  [[external-rag-client]]); answers + sources rendered in the Ask panel.
- **Tray** → `AppComponent` pushes a capture/connection snapshot to main
  (`setTrayState`) and routes tray Start/Stop/Settings actions ([[tray]]).
- **First run** → [[ui-onboarding]] (ADR-0022/0023); privacy gates →
  [[privacy-data-control]]; the saved markdown the transcript mirrors →
  [[markdown-second-brain]] / [[vault-writer]].

## Governing ADRs

- [ADR-0001](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0001-electron-over-tauri.md) — Electron + Angular 21 shell; strict CSP, no remote content, contextIsolation on.
- [ADR-0010](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0010-phase-4-ui-scaffold.md) — Phase 4 scaffold: standalone components, signals, Tailwind-via-CSS-vars, renderer-side WebSocket, two-tsconfig split, thin-slice scope.
- [ADR-0014](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0014-ui-preferences-persistence.md) — local prefs persistence in main (`prefs.json` in `~/Library/Application Support/Hark/`); `PreferencesService` is the renderer wrapper.
- [ADR-0022](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0022-first-run-model-load-progress.md) — `meta.model_progress` + the "Preparing Hark…" overlay with the 800 ms anti-flash gate.
- [ADR-0023](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0023-first-run-onboarding-flow.md) — three-screen onboarding overlay gated on `hasCompletedOnboarding`.
- [ADR-0024](https://github.com/tuanda2912/hark/blob/main/docs/decisions/0024-onscreen-transcript-back-annotation.md) — `meeting.transcript` replaces the live feed with per-line speaker-labeled utterances at stop.

## Invariants

- **One surface per window, chosen by hash.** `main.ts` bootstraps `AppComponent`
  *or* `TrayPopoverComponent`, never both; the popover pulls in none of the main
  app's services.
- **The renderer makes no network call.** Its only socket is the `harkd` loopback
  WS (in `EngineService`); all cloud egress goes through main (CSP `connect-src`
  enforces it). No telemetry/analytics (hard rule #3; [[threat-model]]).
- **Theme is one attribute.** `ThemeService` is the sole writer of `data-theme`;
  switching never recomputes JS, only flips the CSS-variable cascade.
- **Prefs never hold content.** `prefs.json` carries UI defaults + flags only —
  never transcripts, audio, or PII (ADR-0014; hard rule #2). Privacy gates default
  **off** ([[privacy-data-control]]).
- **A side column is hidden only by an explicit user toggle** — never by a width
  breakpoint (columns shrink, they don't auto-vanish).
- **Graceful outside Electron.** Every `window.hark?.…` call guards for a missing
  bridge so bare `ng serve` stays functional (in-memory defaults, no persistence).

See also [[overview]] for the subsystem map and [[glossary]] for terms
(`data-theme`, signals, standalone component, squircle, …).
