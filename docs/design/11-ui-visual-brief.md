---
title: UI/UX Visual Design Brief
owner: Dev + PO
status: ready-to-paste
last_updated: 2026-05-24
audience: AI design tools (Claude.ai artifacts, Figma Make, v0, etc.) and human designers
---

# Hark — UI/UX Design Brief

> **HOW TO USE THIS DOC:** Copy everything below the next horizontal rule into the design tool of your choice. It is self-contained — no prior context needed.

---

# Hark — Design Brief

## 1. What I'm building

**Hark is a local-first meeting transcription app for macOS.** Live captions, speaker labels, translation, post-meeting summaries, and a personal knowledge vault — all running on the user's Mac, **no cloud transcription**. Audio never leaves the machine.

**One-line pitch:** *"A meeting tool you can actually trust with your work calls — because every byte of audio stays on your Mac."*

Think: **Obsidian's discipline meets Granola's polish, built for people who can't use Granola because of compliance.**

## 2. Audience

**Primary user:** Senior knowledge workers (engineers, consultants, analysts) at regulated companies — banking, insurance, healthcare, legal. They're in 4–6 hours of meetings daily, bilingual (often English + an Asian or European language), code-switching mid-sentence. They use Obsidian or similar for notes. They distrust SaaS. They're on macOS daily, Apple Silicon, comfortable with hotkeys.

**Tone they expect:** Calm, focused, technically credible. Not playful, not gamified, not "AI-magical." This is a tool for serious work.

**Anti-user:** People who want Granola's "click join → magic happens" experience. They will hate this app's permission prompts and manual speaker tagging. That's fine.

## 3. Visual direction

### Mood

- **Calm, focused, trustworthy.** The product's value is trust — the visual should feel like a Swiss bank lobby, not a startup demo.
- **Quietly Mac-native.** Uses macOS materials, vibrancy, traffic-light buttons, SF system font. Feels like a first-party Apple tool, not a cross-platform port.
- **Information-dense but breathable.** Meeting transcripts have a lot of text. We respect the reader's eye — generous line-height, restrained color, no cards-within-cards.

### Color palette

**Default to dark mode.** Meetings happen all day; dark reduces eye strain. Light mode supported.

**Dark mode (primary):**
- Background: deep cool gray, not pure black — `#0e1116` to `#161a21` range
- Surface (panels): slightly elevated — `#1a1f27`
- Border: subtle — `#262c36`, never harsh white
- Primary text: warm off-white `#e8eaed`
- Secondary text: `#9aa3b2`
- Muted text: `#5c6573`
- Accent (single color — restraint!): a muted teal-blue like `#5eb3c8` or `#7aa9d6`. Used for: links, focus rings, active state, the recording indicator. **Never use accent for chrome decoration.**
- Speaker colors (for transcript): a soft palette of 6 colors — warm pinks, sage greens, dusty oranges, lavenders, sandy yellows, soft slates. Muted, never saturated.
- Status:
  - Recording (red): `#e35d6a` — warm, not panic-button red
  - Warning (amber): `#d4a657`
  - Success (green): `#7ec089`
  - Privacy / cloud-touched (faint blue glow): subtle, only on Claude-API actions

**Light mode:**
- Background: warm off-white `#fafaf7` (not pure white)
- Same hierarchy, inverted contrast
- Same accent, slightly desaturated

### Typography

- **System UI:** SF Pro (macOS default) — feels native
- **Body text in transcripts:** Inter or SF Pro at 14–15px, line-height 1.55
- **Monospace (timestamps, code blocks, vault paths):** Berkeley Mono if budget; JetBrains Mono or SF Mono otherwise
- **Headings:** SF Pro Display, weights restrained — 600 max for h1, 500 for h2

### Density

- **Medium-dense.** Closer to Obsidian or Linear than to Granola/Notion (which feel spacious to the point of empty).
- Tray menu: compact, every item < 32px tall
- Main window: comfortable padding (16–24px), but transcript lines are tight (1.55 line-height, not 2.0)
- No huge hero areas. No oversized buttons.

### Motion

- **Sparingly.** A meeting tool that animates everything is exhausting.
- New transcript line: fade-in 150ms, no slide
- Panel open/close: 200ms ease-out
- Modal: 180ms scale + fade
- **No bouncy springs.** Curves: standard ease-out, not material-design overshoot.
- Recording indicator pulse: slow, 2-second cycle, low opacity range

### Shape & spacing

- **Border radius:** 6–8px on panels, 4px on inputs, 10px on cards. **No 20px+ pillow radii.**
- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48px. No half-pixels, no arbitrary 13s.
- **Borders before shadows.** Dark mode: 1px subtle border. Avoid drop shadows unless elevation truly matters (modal, popover).

## 4. What NOT to do

Treat this as a hard constraint list. Violating any of these breaks the product's positioning.

- ❌ **No "AI shimmer" effects.** No animated gradients on text, no rainbow gradients on the recording button, no purple-to-blue magic-wand iconography. We're not selling AI; we're selling trust.
- ❌ **No huge rounded pill buttons** with bright primary colors. We're not Stripe.
- ❌ **No marketing-flavored emoji icons** scattered through the UI. Mac-native SF Symbols only.
- ❌ **No "card explosion"** — don't wrap every component in a rounded card with shadow. Use borders sparingly.
- ❌ **No tutorial overlays / coach marks** in the main UI. Onboarding is a separate 3-screen flow, then never again.
- ❌ **No notification badges that say things like "✨ NEW".** We don't celebrate features.
- ❌ **No dark patterns** — no "Are you sure you want to disable cloud features?" guilt-tripping. The user is the boss.
- ❌ **No mobile-app patterns** (bottom tabs, hamburger menus). This is a desktop app for adults.

## 5. Component inventory (atomic level)

### Atoms
- Button — primary (accent), secondary (border-only), ghost (text-only), destructive (red)
- Icon button (32x32, SF Symbol)
- Input — text, password (for API key), select dropdown
- Toggle switch (Mac-native style)
- Slider
- Badge — speaker color chip, status pill
- Tooltip (delayed, subtle)
- Avatar — circular, speaker initial fallback

### Molecules
- **Transcript line** — speaker name + timestamp + text + (optional) translated line + (optional) inline citation marker. Speaker name colored per palette above.
- **Bookmark marker** — inline pin icon with timestamp, hover shows context
- **Term card** — small floating card with vault term excerpt + link to source note
- **Citation chip** — small numbered superscript that links to source file
- **Speaker tag pill** — `[Speaker 2 ▾]` dropdown that opens rename input
- **Status banner** — top-of-window strip for warnings (yellow) / errors (red) / info (blue)
- **Empty state** — single SF Symbol icon + 1 line + 1 button. Never illustrated cartoons.

### Organisms
- **Tray menu** (compact, ~280px wide)
- **Live transcript pane** (the centerpiece of the main window)
- **Q&A side panel** (collapsible, right side of main window)
- **Speaker sidebar** (collapsible, left, shows attendees with tagging)
- **Settings page** with sub-nav (Privacy, Audio, Translation, API, Hotkeys, Vault, About)
- **Post-meeting review screen** (summary + action items + speaker confirmation)

## 6. Screens to design

Design each as both a **dark** and **light** mock. Include realistic content (actual transcript text, real-sounding action items) — no `Lorem ipsum`.

### Screen 1: Tray menu

- ~280px wide, opens from menu-bar icon
- Top: recording state (idle / recording with elapsed time / paused)
- Big single button: "Start recording" or "Stop" (color reflects state)
- Below: "Pause", "Bookmark moment" buttons
- Below: "Open main window", "Recent meetings" (last 3)
- Footer: Settings, Quit
- Recording state: pulse on tray icon (red dot)

### Screen 2: Main window — live transcript (PRIMARY SCREEN)

This is the centerpiece. Get this right and everything else follows.

- Window: ~1100px x 700px default, resizable
- **Three columns:**
  - Left (collapsible, 240px): attendees list with speaker color chips + manual tag UI
  - Center (flexible): live transcript, latest line at bottom, auto-scroll with manual override
  - Right (collapsible, 320px): Q&A panel OR term cards OR off
- **Top bar:** recording indicator (red pulse + elapsed time), pause button, bookmark button (with hotkey hint ⌘⇧B), settings cog
- **Transcript line shape:**
  - Speaker name in colored small caps
  - Timestamp in monospace, muted
  - Text in body font, comfortable line-height
  - Below (if translation on): translated text in slightly muted italic, smaller
  - Inline pin icon if bookmarked
  - `[[wikilink]]` style for auto-linked vault terms
- **Status banner area** above transcript (only visible if a warning is active)

### Screen 3: Q&A panel (right column expanded)

- Top: search/ask input with hotkey hint (⌘⇧Q)
- Below input: streaming answer with citation chips `[1] [2]`
- Below answer: cited source previews (collapsible)
- Empty state: "Ask anything about your past meetings or notes."

### Screen 4: Post-meeting review

Appears after stopping a recording.

- Header: meeting title (editable), date, duration
- **Tabs:** Summary | Action Items | Decisions | Open Questions | Full Transcript | Speakers
- Summary tab: TL;DR + LLM-generated chapters (each chapter expandable to show its segment)
- Action Items tab: checklist of `[ ] {action} — {owner} — by {date}`, each editable
- Speakers tab: list of detected speakers, for unlabeled ones an inline "Who is this?" input + audio sample play button

### Screen 5: Settings (multi-page)

Left sub-nav (Privacy, Audio, Translation, API & Cost, Hotkeys, Vault, About). Right pane shows the active section.

- **Privacy page (most important):**
  - Big honest paragraph: "Hark never sends your audio anywhere. The only cloud-touching feature is Claude API calls for summary, translation (high-quality mode), and Q&A — and only when you invoke them."
  - Toggle: "Redact PII before sending to Claude" (ON by default)
  - Toggle: "Show me what was redacted" (opens log)
  - Section: "Recent cloud-touching activity" — last 10 Claude API calls with timestamp, action type, redacted-or-not indicator. NO transcript content shown.
  - 7-day API spend running total
- **Audio page:** mic selection, system audio test, VAD sensitivity slider
- **Translation page:** mode toggle (Fast local / High-quality cloud), target language picker
- **API & Cost page:** API key input (masked), daily/monthly spend graph
- **Hotkeys page:** rebindable shortcuts
- **Vault page:** folder path picker, git status indicator, "Open in Finder", "Open in Obsidian" buttons

### Screen 6: Onboarding (3 screens, dismissible after)

1. **Trust promise:** big text — "Your audio never leaves this Mac." Three bullets. One button: "Got it."
2. **Permissions:** ScreenCapture + Microphone, each with a one-line "why we need this", a button per permission
3. **Setup:** Vault folder picker (default suggested) + API key paste field (skippable, "I'll add this later"). One button: "Start."

### Screen 7: Empty states

- **No meetings yet:** SF Symbol of a waveform, "No meetings yet. Press ⌘⇧R or click the tray icon to start your first one."
- **No API key:** subtle banner in Q&A panel, "Add an Anthropic API key in Settings to enable Q&A."

### Screen 8: Error states

- **ScreenCapture permission denied:** modal, plain text explanation, "Open System Settings" button
- **Disk full:** banner across top, recording paused, "Free up space and resume"
- **Offline (Q&A attempted):** in Q&A panel, "Q&A is offline. Local search still works:" + show top-K local matches

## 7. Docs site / portfolio design (secondary deliverable)

For showing this project to a company audience as a portfolio piece. A static docs site that renders the markdown files in `vault/hark/docs/`.

### Vibe

Same color palette and typography as the app. Reads like Linear's or Stripe's docs — calm, technical, confident. Not like Vercel's marketing splash.

### Pages to design

1. **Landing page** — one screen. Big title "Hark", one-line pitch, three columns: Product / Architecture / QA, each linking into the docs. Footer: GitHub, license.
2. **Doc page template** — left sidebar nav (collapsible nesting), main content (max ~720px reading width), right "On this page" outline. Code blocks syntax-highlighted, mermaid diagrams rendered inline, callouts (info / warning / note) styled subtly.
3. **ADR card** — special template for decision records: header strip with status pill (Accepted/Superseded), context/decision/alternatives sections styled distinctly.

## 8. Reference: what we admire and what we don't

**Steal from:**
- **Linear** — calm, dense, restrained color, brilliant typography
- **Obsidian** — markdown-first, takes power users seriously, dark mode done right
- **Things 3** — Mac-native feel, tasteful
- **Bear** — typography in a writing tool
- **Stripe Docs** — what we want our docs site to feel like

**Don't be:**
- **Notion** — too playful for our audience
- **Granola** — too sparse, too "consumer SaaS"
- **Otter.ai** — too busy, too many badges and CTAs
- **Slack** — too colorful, too much chrome

## 9. Deliverables I want from this design pass

In rough priority order:

1. **Main window — live transcript** (dark + light) — the screen we live in. Get this right first.
2. **Tray menu** (dark + light)
3. **Post-meeting review** screen (dark)
4. **Q&A panel** detail (dark)
5. **Settings → Privacy** page (dark) — this is where trust lives
6. **Onboarding** 3 screens (dark)
7. **Docs site landing + per-doc template**
8. **Component sheet** — buttons, inputs, transcript line variants, speaker tags

For each: ideally a single-frame mock at realistic resolution (Retina). Including realistic content matters more than including every state.

## 10. Constraints worth repeating

- macOS app, **dark mode default**, light mode supported
- Resizable window, but design at 1100×700 as the canonical size
- All text examples should sound like a real bilingual technical meeting (English + Thai code-switching is fine)
- No fake names that sound like a marketing video ("Sarah from Acme Corp"). Use plausible names: Alice Chen, Khun Somchai, Ahmed K.
- No fake company logos or third-party brand chrome

---

*End of brief.*
