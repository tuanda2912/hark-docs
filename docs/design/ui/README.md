# Handoff: Hark — Local-First Meeting Transcription (macOS)

## Overview

Hark is a local-first macOS meeting transcription app with live captions, speaker diarization + voiceprint memory, translation, post-meeting summaries, and a Markdown vault. This bundle contains the **UI/UX design pass** covering nine surfaces of the product, from the menubar tray through the main window, post-meeting review, settings, onboarding, docs site, and an interactive speaker-tagging flow.

The defining product position is **trust**: audio never leaves the Mac, voiceprints stay in the user's vault, every cloud LLM call shows a redaction receipt, and identity is something the user teaches Hark — never something Hark guesses without consent.

## About the Design Files

The files in this bundle are **design references created as a single self-contained HTML/React prototype** — a pan/zoom design canvas hosting 9 sections of artboards. They show intended look, layout, copy, and interaction behavior. **They are not production code to copy directly.**

The task is to **recreate these designs in the target codebase's environment** — per the existing Hark docs in `hark/docs/`, that is an Electron renderer (React) over a Swift sidecar engine, with state pushed via the WebSocket contract in `08-websocket-api-contract.md`. Use whatever component library, styling system, and IPC plumbing the real codebase already has — these mocks are only the *visual contract*.

Speaker tagging especially has live, interactive logic in the HTML (audio playhead animation, name field, confirm/correct state machine). That logic is illustrative of the user-facing state model; the real implementation must hook the audio buttons to the engine and call `speaker.tag` over WebSocket as documented in the existing API contract.

## Fidelity

**High-fidelity.** Pixel-perfect mockups: exact hex colors via CSS custom properties, exact font sizes, exact spacing, real component states (hover / active / disabled), real interactions (the speaker-tagging modal genuinely plays animated waveforms and accepts text input).

The developer should recreate this pixel-perfectly. Tokens are in `styles/tokens.css`; lift those values straight into the codebase's theme file.

## Files in This Bundle

```
Hark - Design Canvas.html       Top-level canvas + Tweaks wiring + cover card
design-canvas.jsx               Canvas runtime (pan/zoom, fullscreen focus)
tweaks-panel.jsx                In-prototype tweaks UI runtime
styles/tokens.css               ALL design tokens — colors, spacing, type, components
components/shared.jsx           Icon set, MacWindow chrome, TranscriptLine,
                                TermCard, BookmarkHover, AudioMeter, SpeakerTag,
                                CitationChip, StatusBanner, Toggle, Eyebrow,
                                SPEAKER_COLORS palette, SAMPLE_TRANSCRIPT data
artboards/MainWindow.jsx        Section 1: live transcript main window
artboards/TrayMenu.jsx          Section 2: menubar popover (3 states)
artboards/PostMeetingReview.jsx Section 3: tabbed post-meeting review
artboards/QAPanel.jsx           Section 4: streaming Q&A side panel
artboards/SettingsPrivacy.jsx   Section 5: privacy settings + redaction log
artboards/Onboarding.jsx        Section 6: 3 onboarding screens
artboards/DocsSite.jsx          Section 7: static docs site landing + page
artboards/ComponentSheet.jsx    Section 8: every atom + molecule used
artboards/SpeakerTagging.jsx    Section 9: INTERACTIVE tagging modal +
                                auto-recognition state machine (latest work)
screenshots/*.png               Reference renders of each artboard variant
```

To preview the design as the user sees it: open `Hark - Design Canvas.html` in any modern browser. Use the in-page Tweaks panel to flip accent, font, density, **speaker label style** (smallcaps / pill / name), and translation visibility.

### Screenshot Index

Reference renders are in `screenshots/`, scaled to fit a fixed viewport so each entire artboard is visible. For full-fidelity inspection, open the HTML canvas in a browser and click any artboard to focus it.

| File | Source | Notes |
|---|---|---|
| `01-mw-dark.png` | MainWindow · dark default | live transcript, term card hover, Q&A preview |
| `02-mw-light.png` | MainWindow · light default | same in light theme |
| `03-mw-compact.png` | MainWindow · compact transcript variant | denser transcript spacing |
| `04-tray-rec.png` | TrayMenu · dark · recording | active capture state |
| `05-tray-idle.png` | TrayMenu · dark · idle | between meetings |
| `06-tray-paused.png` | TrayMenu · light · paused | mid-meeting pause |
| `07-rev-dark.png` | PostMeetingReview · dark | full tab UI, unlabeled-speaker resolve |
| `08-rev-light.png` | PostMeetingReview · light | same in light |
| `09-qa-dark.png` | QAPanel · dark | streaming answer + citations |
| `10-qa-light.png` | QAPanel · light | same in light |
| `11-set-dark.png` | SettingsPrivacy · dark | redaction log + cloud spend |
| `12-set-light.png` | SettingsPrivacy · light | same in light |
| `13-ob-1-trust.png` | Onboarding · trust promise | screen 1 of 3 |
| `14-ob-2-permissions.png` | Onboarding · permissions | screen 2 of 3 |
| `15-ob-3-setup.png` | Onboarding · vault & API key | screen 3 of 3 |
| `16-ob-1-trust-light.png` | Onboarding · trust · light | light theme variant |
| `17-docs-landing.png` | DocsSite · landing | docs hub |
| `18-docs-page.png` | DocsSite · doc page | interior doc template |
| `19-docs-landing-light.png` | DocsSite · landing · light | light variant |
| `20-comp-dark.png` | ComponentSheet · dark | full atom catalog |
| `21-comp-light.png` | ComponentSheet · light | same in light |
| **`22-st-tagging-modal.png`** | **SpeakerTagging · tagging modal** | the audio-snippet + name flow |
| **`23-st-auto-recognition.png`** | **SpeakerTagging · auto-recognition** | confirm/correct Alice? chip |
| `24-st-tagging-modal-light.png` | SpeakerTagging · light | tagging modal light variant |

---

## Design System

### Color Tokens — Dark Theme (default)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0e1116` | Page background |
| `--bg-2` | `#161a21` | Sidebar / sub-surface background |
| `--surface` | `#1a1f27` | Cards, modals, inputs |
| `--surface-2` | `#20262f` | Elevated surface (popover) |
| `--border` | `#262c36` | Subtle dividers |
| `--border-2` | `#323a47` | Card / input borders |
| `--text` | `#e8eaed` | Primary text |
| `--text-2` | `#9aa3b2` | Secondary text |
| `--text-3` | `#6a7280` | Tertiary / metadata |
| `--accent` | `#7aa9d6` | Brand accent (muted blue) |
| `--accent-2` | `#5eb3c8` | Secondary accent (teal) |
| `--accent-soft` | `rgba(122,169,214,0.14)` | Accent surface tint |
| `--selection` | `rgba(122,169,214,0.22)` | Text selection |
| `--highlight` | `rgba(255,255,255,0.03)` | Hover overlay |

### Color Tokens — Light Theme

| Token | Value |
|---|---|
| `--bg` | `#fafaf7` |
| `--bg-2` | `#f2f2ed` |
| `--surface` | `#ffffff` |
| `--surface-2` | `#f6f6f1` |
| `--border` | `#e3e2db` |
| `--border-2` | `#d2d1c9` |
| `--text` | `#1d2128` |
| `--text-2` | `#5b6472` |
| `--text-3` | `#8a8f97` |
| `--accent` | `#4a85b9` |
| `--accent-2` | `#3f95ad` |
| `--accent-soft` | `rgba(74,133,185,0.10)` |

### Status Colors (shared across themes)

| Token | Value | Meaning |
|---|---|---|
| `--status-recording` | `#e35d6a` | Red dot, REC indicator |
| `--status-warning` | `#d4a657` | Unlabeled, ambiguous, rate-limit |
| `--status-success` | `#7ec089` | Confirmed, saved, healthy |
| `--status-cloud` | `#7aa9d6` | "Used cloud API" affordance |

### Speaker Palette — 6 muted colors

These are the per-speaker chip/name colors. **Never use saturated colors here.** Shared across themes.

```js
SPEAKER_COLORS = [
  "#d8a3ad", // warm pink
  "#a8bf9a", // sage
  "#d4a07a", // dusty terracotta
  "#b4a3cf", // lavender
  "#d8c98a", // sandy yellow
  "#9aacbf", // soft slate
];
```

### Typography

| Variable | Stack |
|---|---|
| `--font-ui` | `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif` |
| `--font-display` | `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", system-ui, sans-serif` |
| `--font-mono` | `ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace` |

Type scale (the actual sizes used across the canvas):

| Use | Size | Weight | Letter-spacing |
|---|---|---|---|
| Window title / display | 18–28 px | 600 | -0.015em to -0.025em |
| Body / transcript text | 14–15 px | 400 | normal |
| UI label | 13 px | 500 | normal |
| Speaker label (smallcaps) | 11 px | 600 | 0.09em + UPPERCASE |
| Speaker label (pill, name) | 11–12 px | 600 | 0 |
| Metadata / mono | 11 px | 400 | normal, monospace |
| Eyebrow / section header | 10 px | 600 | 0.08em + UPPERCASE, mono |

### Spacing & Radii

Spacing scale: 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 32, 36, 40, 48 px. No formal token, but spacing inside artboards is always one of those values (read off the source).

Radii:
- `--r-input` 6px
- `--r-card` 8–10px
- `--r-panel` 10–12px
- `--r-window` 12px
- Pills / chips: 999px

Shadow: `--shadow-modal: 0 24px 60px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.3)` (dark) / `0 16px 48px rgba(20,24,30,0.18), 0 2px 6px rgba(20,24,30,0.08)` (light).

### Components (atoms)

See `components/shared.jsx` for all of these, and `artboards/ComponentSheet.jsx` for a visual catalog.

- **Icon** — 24×24 viewBox stroke-only SVG, `currentColor`, 1.6px stroke. Filled glyphs: `bookmark`, `play`, `pause`, `stop`, `pin`. Available names: see the `paths` object at top of `shared.jsx`.
- **MacWindow** — traffic-light titlebar, rounded 12px, title centered, accessory slot on right.
- **TranscriptLine** — speaker chip + name + timestamp + body text; supports `[[wikilink]]` inline syntax, optional translation line, optional pinned indicator, optional citation superscript, `variant="compact"` flag.
- **SpeakerTag** — pill with chip + name + chevron-down (rename affordance).
- **TermCard** — floating preview for `[[wikilinks]]`, 320px wide, vault path mono.
- **BookmarkHover** — floating popover when hovering a bookmarked transcript moment.
- **AudioMeter** — animated CSS-keyframe bars for live capture.
- **StatusBanner** — tone-tinted strip (warning / success / cloud / neutral) with optional icon and action button.
- **Toggle** — pill switch.
- **CitationChip** — accent-soft pill with number + label.
- **Eyebrow** — small uppercase section header, mono.

---

## Screens / Views

### 1 · Main Window — Live Transcript

**File:** `artboards/MainWindow.jsx` — three variants: dark default, light default, dark compact transcript.

**Purpose:** Centerpiece of the app while a meeting is being captured.

**Layout:** macOS window, 1100×700.
- **Top bar** (`8px 16px` padding, `--bg`): REC indicator (red pulsing dot + `--status-recording` mm:ss counter, mono) · `<AudioMeter>` · vertical separator · `[⏸ Pause]` button · `[🔖 Bookmark ⌘⇧B]` button · spacer · `cloudOff · audio · local-only` lozenge · settings cog.
- **Status banner** under top bar: tone="warning" alerting that translation fell back to the local model. Includes a `[Review]` button.
- **3-column body** (`grid-template-columns: 240px 1fr 320px`):
  - **Left (Attendees)** — `--bg-2` background, scrollable list of speakers. Each row: chip dot + name (italic-grey if unlabeled) + meta line. Unlabeled rows get a `--status-warning` 8%-tint background + dashed warning border + `[Who is this?]` secondary button. Footer line: `diarization · FluidAudio · ● 0.94` (mono).
  - **Center (Transcript)** — header strip with `Eyebrow: Live transcript · auto-scroll`, language pill `VI → EN`. Scrollable feed of `<TranscriptLine>` items. Live partial at bottom = current speaker chip + italic gray text + blinking caret. A floating `<TermCard>` is shown anchored to a `[[Tessera deal]]` wikilink to demonstrate hover behavior.
  - **Right (Q&A preview)** — `--bg-2`. Search field showing the recent question. `Eyebrow: Answer · streaming`. Body text with inline `[1]` `[2]` superscript citations. Sources list (numbered chips → title → snippet). Footer dashed `--status-cloud`-tinted note: "Q&A used Claude API · PII redacted (3 names, 1 dollar amount)".

**Footer:** `1,284 words · 14m 27s · 3 bookmarks · 2 vault links` · spacer · `● WhisperKit · large-v3-turbo · RTF 0.18`.

**States:** `theme="dark"|"light"`, `variant="default"|"compact"`. Compact tightens the transcript line padding and shrinks body to 14px.

---

### 2 · Tray Menu — Menubar Popover

**File:** `artboards/TrayMenu.jsx`.

280px wide. Three states displayed side-by-side:
- **Recording (dark)** — REC indicator, current meeting title, live duration, audio meter, [Pause] [Stop] [Bookmark] [Open] actions, current speaker badge.
- **Idle (dark)** — recent meetings list, [New recording] primary action.
- **Paused (light)** — paused indicator, [Resume] [Stop] [Bookmark] actions, gentle ambient gradient.

---

### 3 · Post-Meeting Review

**File:** `artboards/PostMeetingReview.jsx`. 1100×780.

macOS window. Header: 40×40 waveform tile + meeting title + meta line (`Fri 24 May · 14:00–14:38 · 4 speakers · 3 bookmarks · vault://meetings/2026-05-24-tessera.md`). Right side: `[📁 Open in Obsidian]` secondary + `[✓ Confirm & file]` primary.

**Tabs:** Summary · Action items (5) · Decisions (3) · Open questions (2) · Full transcript · Speakers (4). Selected tab has `--accent` bottom border + count chip in `--accent-soft`.

**Body grid:** `1fr 320px`.
- **Main pane:** TL;DR paragraph · Chapters list (4 numbered rows, currently-highlighted one in `--accent-soft`) · Action items table (checkboxes + assignees + due dates) · Decisions list (ul).
- **Side pane (`--bg-2`):** "Summary generated with" panel — `--status-cloud` dashed tint, shows `Claude API · sonnet`, redaction count, "View redaction log →" link, footer with token counts + cost in mono. Below: Speakers list with 3 tagged + 1 inline `[Unlabeled — Speaker 4]` resolve block (mini waveform play button + "Who is this?" input + privacy footer line). Vault path card at bottom showing git status + backlinks.

---

### 4 · Q&A Panel

**File:** `artboards/QAPanel.jsx`. 380×700 detail view of the right-rail Q&A from MainWindow. Streaming answer with cursor caret, numbered sources with snippets, dashed `--status-cloud` privacy footer.

---

### 5 · Settings → Privacy

**File:** `artboards/SettingsPrivacy.jsx`. 1100×720.

The trust receipt: full settings frame with left nav (Recording, Vault, Privacy active, AI, Permissions, About). Privacy pane shows:
- **Redact before cloud** master toggle + per-category sub-toggles (names, dollar figures, phone numbers, sub-IDs).
- **Voiceprint storage** — vault path, "Open folder" action, count of stored speakers.
- **Cloud calls log** — table: date · purpose · model · tokens · redactions applied · cost.
- **Monthly spend** — running total + soft cap setting.
- **Permissions audit** — microphone, screen recording, accessibility, with grant date.

---

### 6 · Onboarding

**File:** `artboards/Onboarding.jsx`. 720×520 each.

Four screens:
1. **Trust promise** — large display heading; "Audio never leaves this Mac. Voiceprints stay in your vault. Every cloud call shows a redaction receipt." Below: 3 promises with icons.
2. **Permissions** — Microphone, Screen Recording, Accessibility. Each row explains what it does, why, and when Hark uses it.
3. **Vault & API key** — vault folder picker (defaults to `~/Hark`), optional Claude API key (with note: "skip → local model only, summaries quality lower").
4. (Light theme variant of screen 1.)

---

### 7 · Docs Site

**File:** `artboards/DocsSite.jsx`. 1280×900.

Static site for the `vault/hark/docs` folder. Landing page (hero + nav grid into the 4 doc categories) and an interior doc page template (left ToC, content column, right "On this page" anchor list). Dark + light landing variants.

---

### 8 · Component Sheet

**File:** `artboards/ComponentSheet.jsx`. 1100×2050.

Visual catalog of every atom + molecule. Use this as the reference when implementing components in the real codebase.

---

### 9 · Speaker Tagging — Interactive ⭐ (latest work)

**File:** `artboards/SpeakerTagging.jsx`. Three artboards. This is the most logic-heavy and corresponds to the `speaker.tag` and ambiguous-match flows in the WebSocket spec.

#### 9a · Tagging Modal (`SpeakerTaggingModal`) — 860×620

**Trigger:** user clicks `[Who is this?]` on an unlabeled row.

**Layout:** centered modal card (640px wide) over dimmed/blurred meeting window context.

**Card header:** `--surface` background, chip dot in `SPEAKER_COLORS[3]` + heading "Who is **Speaker 4**?" (the "Speaker 4" colored) + meta "5m 08s spoken · 3 segments · clustered by voice only" + close [×].

**Body — Listen section:** `Eyebrow: Listen · 3 representative snippets`. Three `<PlayableSnippet>` components, each:
- 26px round play button in speaker color
- Animated waveform of vertical bars (heights deterministic, defined as `WF_A`, `WF_B`, `WF_C` arrays in the file)
- Bars left-of-playhead colored in speaker accent; bars right-of-playhead in `--text-3` 55%
- 2px playhead line driven by `requestAnimationFrame`, mm:ss counter on right
- Click to play/pause; auto-stops at duration end
- Footer line (mono, --text-3, 10.5px): "audio stays on this Mac · samples taken from §4.2 chapter"

**Suggestions section:** `Eyebrow: Hark thinks it might be one of these · sub-threshold matches`. Three pill buttons, each: user icon + name + similarity %. Pills are sub-threshold matches from the user's `vault/.speakers/`. Clicking a pill auto-fills the name field.

Currently shown: "Linh Nguyễn 62%", "Bao Trần 51%", "Mai Phạm 44%" — **replace these with real engine outputs**. Pills below threshold (`< 0.65` per the docs) get suggested here. Selected state: `--accent` border, `--accent-soft` fill, accent text.

**Name input:** standard `<input class="input">` with placeholder. Clear-button [×] appears when text present. Autofocus.

**Privacy receipt card** (`--bg-2`, `--border`, 8px radius):
- Row 1: shield icon (`--status-success`) + "Voiceprint will save to `vault/.speakers/<slug>.json`" — slug updates live as user types.
- Row 2: cloudOff icon + "Embedding (~3KB) never leaves this Mac. Used only to recognize this voice in future meetings."
- Row 3: read-only mirror of the global PII-redaction setting, with a "Settings →" link. **Per the resolved open question, this is NOT a per-speaker override** — the privacy story is "one global toggle, no exceptions" so users never have to remember per-speaker state.

**Footer bar** (`--bg-2`, dividers):
- Left: keyboard hints `⏎ to save · esc to cancel` (mono, --text-3, 11.5px).
- Right: `[Cancel]` secondary + `[Save & remember voice]` primary. Primary disabled until name ≥ 2 chars.
- On save: transitions to "Saved" state showing a check, button locks. Toast slides up from bottom: "Speaker 4 → **Linh Nguyễn**" + meta "3 segments renamed · voiceprint saved · git committed" + `[undo]` button.

**WebSocket integration:** on save, fire `{type: "speaker.tag", payload: {meeting_id, speaker_label: "Speaker 4", name: "Linh Nguyễn"}}` per `08-websocket-api-contract.md`. Engine response writes the JSON file, retroactively renames segments, git commits.

#### 9b · Auto-Recognition States (`SpeakerAutoRecognition`) — 720×620

Header: "Attendees · 4 · New meeting · Hark cross-checked your vault voiceprints" + `[← reset demo]` ghost button.

**Three speaker rows, each in a distinct state:**

**Row 1 — High-confidence auto-resolved:**
- "Ahmed K." with `auto · 94%` success-tinted badge
- Background: `--status-success` 7% tint, success-tinted border
- Meta: "Auto-matched · 94% · Counsel"
- Right action: `[Not Ahmed?]` ghost button → clicking demotes to unknown ("Match undone — please re-tag manually") + `[Re-apply]` button.

**Row 2 — Ambiguous "Alice?" chip** (the spec's `Speaker N (Alice?)`):
- Name: "Speaker 1" (grey) + "(Alice?)" (in Alice's speaker color)
- Background: `--status-warning` 8% tint, dashed warning border
- Badge: `needs your confirm` warning chip
- Meta: "Possible match — 78% confidence · last seen Mar 14"
- Embedded playable snippet of Alice's voice (so user can listen before confirming)
- Right actions: `[✓ Yes]` primary + `[✗ No]` secondary
- On Yes → row becomes "Alice Chen", success badge, meta "Voiceprint reinforced · 4 meetings together"
- On No → row reverts to "Speaker 1", neutral border, meta "Match rejected — Hark won't suggest Alice for this voice again", `[undo]` ghost button to restore.

**Row 3 — Fully unknown:**
- "Speaker 4" with playable snippet, meta "Unknown voice · not in your vault"
- Right action: `[Who is this?]` secondary button
- On click → row expands to show an inline name input + `[✓ Save]` primary. Save button disabled until name ≥ 2 chars.
- On save → row becomes labeled, success badge, meta "New voiceprint saved · will auto-match next time".

**Footer info card** (dashed `--border`, `--bg-2`): documents the threshold model:
> Voiceprints from past meetings live in `vault/.speakers/`. Cosine similarity ≥ 0.85 auto-matches; 0.65–0.85 surfaces as an *(Alice?)* chip; below 0.65 stays unlabeled. Adjust thresholds in Settings → Speakers.

#### 9c · Tagging Modal — Light theme

Same as 9a but with `theme="light"`.

---

## Interactions & Behavior

### Speaker Tagging Modal (9a)

| Trigger | Behavior |
|---|---|
| Click play button on snippet | Animation starts via `requestAnimationFrame`. Bars left-of-playhead fill with speaker color. Playhead advances. mm:ss counter increments. Auto-pauses at duration end. |
| Click pause | Animation halts at current position. |
| Click again after end | Resets to 0 and plays from start. |
| Click a suggestion pill | Name field fills. Pill shows selected state (`--accent` border + `--accent-soft` background). |
| Type in name field | Vault path preview updates live (`vault/.speakers/<slug>.json`). Save button enables at length ≥ 2. |
| Slugify rules | Lowercase · NFD-strip diacritics · non-alphanumeric → `-` · trim leading/trailing hyphens. |
| Toggle "Redact this name before cloud" | Updates state; persists per-speaker as override on the global setting. |
| Click Save | Send WebSocket `speaker.tag`. Wait for ack. Show toast with undo (toast persists until dismissed). Lock modal in "Saved" state. |
| Click Undo on toast | Send compensating action; revert tag; reopen modal in editable state. |

### Auto-Recognition (9b)

| Trigger | State transition |
|---|---|
| App starts new meeting | Engine sends `meeting.saved` with `speakers[]` array including `matched_name` + `confidence`. UI renders rows. |
| `confidence ≥ 0.85` | Render with success badge + auto-matched meta. Provide [Not X?] escape hatch. |
| `0.65 ≤ confidence < 0.85` | Render as `Speaker N (Name?)` ambiguous chip with warning border + [Yes][No] actions. |
| `confidence < 0.65` | Render unlabeled, no suggestion, [Who is this?] button. |
| User clicks Yes on ambiguous | Confirm match, reinforce embedding (engine appends to existing voiceprint file). |
| User clicks No | Reject match. Add this segment's embedding to a "negative" list so Hark doesn't re-suggest this person for this voice. |
| User clicks "Not X?" on auto-matched | Demote to unknown. Embedding is **not** removed from the original speaker file (it was matched correctly in prior meetings); only this meeting's segments unlink. |

### Threshold Model (per `hark/docs/design/06-architecture-overview.md` and the docs the user already has)

The 0.85 / 0.65 thresholds are placeholders that need engine tuning. Surface both as user-adjustable in **Settings → Speakers** (a settings pane not yet drawn — see "Open Design Decisions" below).

---

## State Management (Renderer Side)

For the speaker-tagging surfaces specifically:

```ts
type SpeakerState =
  | { kind: "unknown" }
  | { kind: "ambiguous"; suggested: string; confidence: number }
  | { kind: "auto-matched"; name: string; confidence: number }
  | { kind: "user-confirmed"; name: string }
  | { kind: "user-rejected" }
  | { kind: "tagging" }; // local UI state during modal

type Speaker = {
  label: string;          // "Speaker 1"
  color: string;          // SPEAKER_COLORS[i]
  durationSeconds: number;
  segmentCount: number;
  sampleSnippets: AudioSnippet[];  // engine-provided representative segments
  state: SpeakerState;
};
```

Modal-local state (inside `SpeakerTaggingModal`):
- `name: string`
- `saved: boolean`
- `redactInCloud: boolean` (default = global setting)

The HTML uses React `useState`. The real implementation should keep this in whatever store Hark already uses (the docs imply a per-meeting reducer; align with what's already there).

---

## Open Design Decisions — resolved 2026-05-24

1. ✅ **Sub-threshold suggestion pills.** Cap at 3 pills, floor at 0.40. Below that is noise and erodes trust.
2. ✅ **Per-speaker redact toggle in modal — DROPPED.** Replaced with a read-only mirror of the global Privacy setting + `Settings →` link. Reason: one global toggle is simpler to reason about; per-speaker overrides complicate the privacy story ("did I disable redaction for that person? can't remember").
3. ⏳ **Settings → Speakers pane.** Still to mock. Lives between "AI" and "Permissions" in the left nav. Surface: auto-match threshold slider, ambiguous-band floor slider, enrolled-speaker list with delete/merge.
4. ✅ **Rejection effect on prior transcripts.** Prior meetings stay labeled. Rejection only affects this meeting's segments and prevents future suggestion of this person for this *new* voice. Original speaker file untouched.
5. ⏳ **Single-speaker collapse.** When only 1 speaker is detected, collapse the 240px attendees sidebar to a slim 1-row indicator. Still to mock.

---

## Assets

No external image assets — everything is SVG (drawn inline in `components/shared.jsx` `Icon` component) or CSS. Fonts load from Google Fonts (`Inter`, `JetBrains Mono`) with `-apple-system` first in the stack.

In the real codebase, prefer the OS-native fonts; the Google Font imports were used only to make the design canvas render outside macOS reliably.

---

## How to Implement (suggested order)

1. **Tokens first.** Copy `styles/tokens.css` values into the codebase's theme module. Map dark/light to existing dark/light scheme.
2. **Atoms.** Build the components in `shared.jsx` (Icon, MacWindow chrome, TranscriptLine, etc.) — use the `ComponentSheet` artboard as a visual test.
3. **Main window shell.** Implement the 3-column layout + top bar + status banner.
4. **Speaker tagging (the spec's HARK-B-2 + auto-recognition).** Build the modal + the auto-recognition state machine — wire to existing `speaker.tag` WebSocket action.
5. **Post-meeting review.** Implement after streaming pipeline is in place.
6. **Settings → Privacy + the unfinished Speakers sub-pane.**
7. **Onboarding, Tray menu, Docs site, Q&A panel** can land in parallel.

Reference `hark/docs/analysis/04-user-journeys.md` and `hark/docs/analysis/05-user-stories.md` for the user flows these screens implement; the user stories `HARK-B-1` and `HARK-B-2` map directly to section 9 of this design.
