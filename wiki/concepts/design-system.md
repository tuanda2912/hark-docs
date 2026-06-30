---
type: concept
title: Design system & visual brief
status: current
sources: [docs/design/11-ui-visual-brief.md, docs/decisions/0010-phase-4-ui-scaffold.md]
updated: 2026-06-30
tags: [design, ui, theme, tokens, mac-native]
---

# Design system & visual brief

Hark's visual language. The product's value is **trust**, so the UI should "feel like a Swiss bank
lobby, not a startup demo" — calm, focused, technically credible, quietly Mac-native
(`docs/design/11-ui-visual-brief.md` §3). The audience is senior, compliance-bound knowledge workers who
use Obsidian/Linear and distrust SaaS gloss (§2).

## Foundations
- **Dark mode default**, light supported — meetings run all day, dark reduces strain (§3 Color
  palette). Dark backgrounds are deep cool gray (`#0e1116`–`#161a21`), surfaces `#1a1f27`, subtle
  borders `#262c36`, primary text warm off-white `#e8eaed`.
- **One accent** (muted teal-blue `#5eb3c8` / `#7aa9d6`) for links, focus, active state, recording
  indicator — never chrome decoration. Recording red is a warm `#e35d6a`, not panic-red. A muted
  6-color palette tags speakers in the transcript (§3).
- **Typography:** SF Pro for UI; Inter / SF Pro at 14–15px, line-height 1.55 for transcript body;
  monospace for timestamps, vault paths, code (§3 Typography).
- **Density:** medium-dense (closer to Obsidian/Linear than Notion). Radius 6–8px panels, 4px inputs;
  spacing scale 4/8/12/16/24/32/48; **borders before shadows** (§3 Density, Shape & spacing).
- **Motion:** sparing — fade-in 150ms transcript lines, 200ms panels, no bouncy springs; a slow
  2-second recording pulse (§3 Motion).

## Hard "don'ts"
No "AI shimmer" gradients, no big bright pill buttons, no marketing emoji (SF Symbols only), no card
explosion, no tutorial coach-marks in the main UI, no `✨ NEW` badges, no dark patterns, no mobile
patterns (bottom tabs / hamburgers) (§4).

## How it reaches the code
The design pass ships as a React/HTML **visual contract** (not source); its tokens
(`styles/tokens.css`) are lifted **verbatim** into the renderer (`0010` §Context). In the
[[ui-renderer]] they become `:root` + `[data-theme="dark|light"]` blocks; Tailwind v3
`theme.extend.colors` references the CSS vars (`bg: 'var(--bg)'`), so theme switching is a single
`<html data-theme>` attribute toggle with no JS recompute (`0010` §Decision 2). Surfaces built to
this system: [[ui-shell]], [[tray]], onboarding ([[ui-onboarding]]).

The component inventory (transcript line, speaker tag pill, citation chip, status banner, empty
states) is enumerated in `docs/design/11-ui-visual-brief.md` §5.
