---
description: Create or refresh a polished, well-structured README.md for the current project. Use when the user wants a README written, improved, restructured, or "made to look good / put in good shape". Reviews the whole project, leads with features, uses a badge row + GitHub admonitions, keeps it concise and scannable, and omits LICENSE/CONTRIBUTING/CHANGELOG (those get their own files).
argument-hint: "(optional) a focus, e.g. 'rewrite from scratch', 'just add badges + admonitions', or a target audience"
---

# /create-readme — write a README that's worth reading

You're a senior open-source engineer who writes READMEs that are **appealing, informative, and easy to
scan**. Review the whole project first, then produce (or reshape) a `README.md` the maintainer would be
proud to pin to the repo's front page.

> Adapted from the [github/awesome-copilot `create-readme` skill](https://github.com/github/awesome-copilot/blob/main/skills/create-readme/SKILL.md),
> with cross-referenced best practices from [make a README](https://www.makeareadme.com/),
> [standard-readme](https://github.com/RichardLitt/standard-readme), and the sibling `create-llms` /
> `create-tldr-page` skills folded in.

## Process

1. **Read the project before writing a word.** Inspect the manifest (`package.json`, `pyproject.toml`,
   `Cargo.toml`, `go.mod`, …), entry points, config, existing docs (`README`, `docs/`, `CLAUDE.md`,
   `wiki/`), and the file tree. Skim the most important source to learn what it actually does. **Every claim
   in the README must trace to something real in the repo — never invent features, commands, or badges.**
2. **Look for an existing README and a logo/icon.** Improve in place rather than discarding good content. If
   the repo has a logo/icon (an image in `assets/`, `docs/`, `.github/`, or a distinctive emoji already in
   use), put it in the header.
3. **Decide the audience and the one-sentence pitch** before drafting. The tagline is the hardest line to
   get right — make it concrete, not buzzwordy.
4. **Draft following the structure below**, then tighten.
5. **Self-check against the checklist** at the end. Read it once as a newcomer would.

## Structure to produce

Order matters — lead with what hooks a reader, defer the deep config.

1. **Header** — `# Project` + logo/icon if one exists.
2. **Badge row** — only badges that are true and useful (license, build/CI, package version, language/runtime
   version, code style). Prefer [shields.io](https://shields.io). Don't fabricate a CI/coverage badge that
   doesn't exist.
3. **One-line description** — a blockquote tagline saying what it is and why it matters.
4. **Nav / table of contents** — a one-line `·`-separated set of anchor links **if the README is long**
   (roughly > 4 H2 sections). Skip it for short READMEs.
5. **Short intro paragraph** — 2–4 sentences expanding the tagline (the problem it solves, who it's for).
6. **Features** — a bullet list of concrete capabilities, **lead-bolded** (`**Thing.** explanation`). This is
   the section readers scan first; make each bullet earn its place.
7. **Requirements / Prerequisites** — runtimes, accounts, external tools (only if non-trivial).
8. **Installation** — the copy-paste commands to get it on a machine.
9. **Usage / Quick start** — the **most common path, as a runnable example first** (the `create-tldr-page`
   lesson: show before you explain). Then options/flags as a table.
10. **Examples** — a few realistic scenarios if the tool warrants them.
11. **How it works / Architecture** — only if it genuinely aids understanding; keep it tight or link out.
12. **Configuration** — options table, if any.
13. **Project layout** — a categorized file/dir map for anything non-obvious. Writing it so an *LLM* could
    navigate the repo from it (the `create-llms` lesson) makes it better for humans too.
14. **Links out** — point to `CONTRIBUTING.md`, `SECURITY.md`, `LICENSE`, full docs — as a short note or
    admonition, **not** as dedicated sections (see rules).

Not every project needs every section — drop the ones that don't apply rather than padding them.

## Rules (hard)

- **No LICENSE / CONTRIBUTING / CODE_OF_CONDUCT / CHANGELOG *sections*.** Those have dedicated files. A
  license **badge** and a one-line "see [`CONTRIBUTING.md`](CONTRIBUTING.md)" pointer are fine; a full
  heading is not.
- **Don't overuse emojis.** A single icon in the header is plenty. No emoji-per-bullet.
- **Use GFM + [GitHub admonitions](https://github.com/orgs/community/discussions/16925)** where they earn
  their place: `> [!NOTE]`, `> [!TIP]`, `> [!IMPORTANT]`, `> [!WARNING]`, `> [!CAUTION]`. Use `[!WARNING]` /
  `[!CAUTION]` for real footguns, not decoration.
- **Concise and scannable.** Aim for ~200–1500 words of prose; if it sprawls past that, move depth into a
  `docs/` page and keep the README focused on install + usage + links. Favor tables and short bullets over
  walls of text.
- **No invention.** If a fact isn't verifiable in the repo, leave it out or mark it `> TODO:`.
- **Match the project's voice.** Mirror the naming and tone already present in the codebase/docs.

## Inspiration

Borrow structure, tone, and density from these (don't copy verbatim):
- https://raw.githubusercontent.com/Azure-Samples/serverless-chat-langchainjs/refs/heads/main/README.md
- https://raw.githubusercontent.com/Azure-Samples/serverless-recipes-javascript/refs/heads/main/README.md
- https://raw.githubusercontent.com/sinedied/run-on-output/refs/heads/main/README.md
- https://raw.githubusercontent.com/sinedied/smoke/refs/heads/main/README.md

## Final checklist

- [ ] Header has the title and (if available) a logo/icon.
- [ ] Badge row is present and every badge is **true**.
- [ ] Tagline states what it is and why it matters, in one line.
- [ ] Nav line present iff the README is long; every anchor resolves to a real heading.
- [ ] **Features** lead the body; each bullet is concrete and lead-bolded.
- [ ] Install + a runnable quick-start example appear early.
- [ ] Admonitions used for the genuinely important/dangerous notes only.
- [ ] No LICENSE/CONTRIBUTING/CHANGELOG sections — links/badges instead.
- [ ] Emojis minimal; tone matches the project.
- [ ] Every claim traces to the repo; nothing invented.
- [ ] Reads cleanly top-to-bottom as a newcomer; under ~1500 words of prose.
