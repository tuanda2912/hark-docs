---
type: concept
title: Visual design system — the "Heard ripples" identity
status: current
sources: [ui/src/styles/tokens.css, ui/src/app/components/ripples.component.ts, ADR-0010, "hark-docs/docs/design/11-ui-visual-brief.md"]
updated: 2026-06-17
tags: [ui, design, identity, motion, tokens, accessibility]
---

**Hark's look is one token file plus one motif, held to a native-macOS bar.** The
renderer carries no design framework: every colour, font, radius, spacing and
motion value is a CSS custom property in `ui/src/styles/tokens.css`, surfaced to
Tailwind as `var(--…)` refs ([[ui-shell]]), so the whole theme repaints on a
single `data-theme` flip with zero JS ([[ui-shell]] · ADR-0010 §2). This page is
the index from the *design language* to the code that enforces it.

> The visual brief lives in the sibling docs repo —
> [`docs/design/11-ui-visual-brief.md`](https://github.com/tuanda2912/hark-docs/blob/main/docs/design/11-ui-visual-brief.md).
> The tokens file is the runtime source of truth; the brief is the rationale.

## The "Heard ripples" identity

The brand mark is a set of **concentric accent rings + a centre dot** — the same
motif as the app icon — rendered as a reusable `RipplesComponent`
(`ui/src/app/components/ripples.component.ts`): pure inline SVG over CSS
keyframes, **accent-tinted via the design token** (`stroke="currentColor"`, a
`color` input, defaulting to `--accent`). It is the resting/listening state
across the shell's empty surfaces — the transcript centre column, the Attendees
panel, the Ask panel's "connect a model" state, the onboarding Trust step, and
the menu-bar [[tray]] status (tinted recording-red while capturing).

- **At rest** the rings ripple outward *slowly* (~4.4 s) and the core breathes —
  a quiet "I'm here, ready" pulse the moment you look, not gated on capture.
- **While capturing** the same motion runs ~2× faster — clearly livelier, not a
  different effect.
- Honours `prefers-reduced-motion`: all movement stops, leaving the two static
  base rings + core.

## Motion vocabulary

A small shared set, so micro-interactions feel coherent rather than ad-hoc:

- `--ease-spring` (`cubic-bezier(0.32,0.72,0,1)`) — weighted press + settle.
- `--ease-out` (`cubic-bezier(0.16,1,0.3,1)`) — gentle entrance decelerate.
- `--dur-press` / `--dur-enter` — short by design; this is a calm tool, not a
  landing page.

Every interactive control gets **tactile press** (a small `scale`/`translateY`
"give") and a **`:focus-visible` ring**; toasts + the saved-meeting card **rise
in**; live numeric readouts (REC timer, RTF, timestamps) use **tabular figures**.
All of it is gated by `prefers-reduced-motion` at the call site, matching the
discipline already in onboarding + model-loading.

## Section-header system

Column headers use a shared pair of token classes instead of flat all-caps
eyebrows: **`.col-title`** (a present, sentence-case title) + **`.status-pill`**
(a small rounded state chip — `listening` / `ready` / a count, with an
`is-live` / `is-accent` variant). Eyebrows are retained for in-panel *sub*-labels
(Ask's "Answer" / "Sources"), so the hierarchy reads **column title → eyebrow
sub-label**.

## What stays native (the deliberate non-defaults)

The identity is "bolder" but held inside a native-mac bar — the brief explicitly
rejects the generic agency-template reach:

- **System SF font stack**, not Geist/Satoshi — the correct premium choice for a
  Mac app, and the only thing the [[threat-model|CSP]] permits (`font-src 'self'
  data:` blocks remote fonts; nothing is fetched).
- **Tight radii** (4/6/10/12, "no pillow"), not big agency squircles.
- **One muted slate-blue accent**, not an AI-purple gradient.
- **No external image assets** — the ripple is inline SVG; the brand never
  fetches anything ([[local-first-guarantee]] · [[threat-model]]).

## How it connects

- **Surface** → all of this lives in the renderer ([[ui-shell]]); the menu-bar
  variant is [[tray]]. Theme writing is `ThemeService`'s job ([[ui-shell]]).
- **Privacy** → the "no remote fonts/assets" rule is the [[threat-model|strict
  CSP]] in practice — the design system can't open a network path.
- **Reuse** → `RipplesComponent` + `.col-title`/`.status-pill` are the shared
  vocabulary new surfaces build on, rather than restyling per-screen.

See also [[ui-shell]] for the shell + services, [[overview]] for the subsystem
map, and [[glossary]] (`data-theme`, squircle, signals).
