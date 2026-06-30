---
description: Build or refresh the feature→file traceability layer of a Cairn second brain — maps each user-facing feature to the capabilities/services/files that implement it (+ status & gaps), reusing the understand-anything code graph. Use when the user wants a feature→file map, a change-impact/blast-radius map, or to answer "if I change feature X, what moves?".
argument-hint: "(optional) a feature to drill into (e.g. 'Vault RAG'), or 'refresh' / 'lint'"
---

# /lodestar — feature → file traceability for a Cairn second brain

Karpathy's LLM-wiki pattern maintains a knowledge base but **never maps a feature to the code that
implements it**. This skill is the lodestar that orients you from intent to implementation: a thin, durable
map from each **user-facing feature** → the **capabilities/services** → the **files**, with **status &
gaps**, so you can answer *"if I change feature X, which files move?"* — including the cross-service edges
grep and the compiler can't see.

It is the third layer of the second brain, sitting between the **requirements/feature wiki** and the
**understand-anything code graph**. It does **not** replace code search — the live source stays the index;
this persists only what you *can't* grep (intent, gaps, cross-service contracts).

## Inputs

Read [`lodestar.config.json`](lodestar.config.json) (next to this file). It declares: the wiki dir, the code
repo(s) + their graph, the topology, the feature sources, and (for micro) the service partition +
cross-service contracts. **Paths are relative to the workspace root** so the skill travels across machines.
To reuse on another project: copy `.claude/`, edit the config.

Helper (deterministic, zero-LLM): [`query-graph.mjs`](query-graph.mjs) — staleness check + graph slices.
Proposer subagent: **`feature-mapper`** (in `.claude/agents/`) — reads feature sources + graph, proposes rows.

## Procedure

Report progress at each phase.

### Phase 0 — Resolve & fail-closed staleness check
1. Load the config. The framework lives at the **workspace root**; resolve the wiki dir + the workspace's
   code repo(s) (`codeRepos[]` in `lodestar.config.json`) and each graph.
2. **Run the fail-closed staleness gate** over the whole workspace:
   - **Single-repo workspace:**
     ```bash
     node .claude/skills/lodestar/query-graph.mjs stale <graph.json> <repoDir>
     ```
   - **Multi-repo (microservices) workspace — check every repo at once:**
     ```bash
     node .claude/lib/aggregate-graphs.mjs <lodestar.config.json> <workspaceRoot>
     ```
   - Exit 0 (all fresh) → proceed.
   - **Exit 1 (any repo stale)** → the graph's `capability→files` layer is lying. Report the drift + changed files and
     **offer to refresh** before continuing: `/understand <repoDir>` (incremental). Do **not** silently build
     on a stale graph — a stale map gives false confidence (worse than honest grep). If the user declines the
     refresh, proceed but **stamp the output as stale** and warn in the result.
3. If no graph exists at all → tell the user to run `/understand <repoDir>` first; this skill consumes its output.

### Phase 1 — Topology
- Read `topology` from config. If unset, **detect & confirm**: signals for *microservices* = multiple code
  repos, multiple languages, process boundaries, a wire/API/event contract, `docker-compose`/k8s/deploy
  manifests. Otherwise *monolith*. Ask the user to confirm, then persist to config.
- **monolith** ⇒ Phase 3 (services) + the contracts table are skipped; the compiler + test suite are the
  cross-module propagation net, so the map only needs feature→capability→files.
- **microservices** ⇒ do everything (the cross-service contracts are the payload).

### Phase 2 — Capability layer (reuse the graph; never hand-tag files)
- The understand-anything graph already tags every file and assigns it a layer — **that is the
  `capability→files` layer, refreshed for free on `/understand`.** Do not build a parallel tagger.
- If `capabilitySource = subsystem-pages` (wiki already code-shaped): the **subsystem slug is the capability
  tag** — reuse it; `capability→files` is the subsystem page's `## Code map`.
- If `capabilitySource = graph-tags`: derive a **small controlled vocabulary** from the graph's tags
  (`node query-graph.mjs node-tags <graph.json>` to seed), curating synonyms (`price`/`rate`/`quote` → one).
  Pin a deterministic **tag→capability** mapping so a re-run's LLM re-tagging can't silently break the join.
- **Tag by stable capability/domain, NEVER by volatile feature-ID** — feature-IDs get re-scoped; a file's
  purpose is stable. The feature-ID and the filename meet only *through* the capability tag.

### Phase 3 — Service partition + contracts  *(microservices only)*
- Build the partition from the workspace's shape:
  - **Single-repo (polyglot) workspace** (a polyglot app in one repo) — group the one graph's **layers** into
    services: `node .claude/skills/lodestar/query-graph.mjs layers <graph.json>`.
  - **Multi-repo workspace** — each **repo is a service** (or its layers are sub-services); get the cross-repo
    partition (per-repo languages, layers, file counts) from
    `node .claude/lib/aggregate-graphs.mjs <lodestar.config.json> <workspaceRoot>`.
- Record the partition in config under `services` (name, language, layers/repo).
- Identify the **cross-service contracts** — the un-greppable/un-compilable edges: wire protocols, API/event
  schemas (OpenAPI/proto/GraphQL), IPC bridges, deploy/compose manifests. **Source these from the contract
  files, not the code graph** (services don't import each other). Flag any seam where the two sides are in
  **different languages** (no shared compiler) — that's where a contract change breaks silently at runtime.
  Record in config under `contracts`.

### Phase 4 — Feature register (agent-proposed, human-approved)
- Dispatch the **`feature-mapper`** subagent with: the `featureSources`, the topology, the capability list
  (subsystems or vocab), the service partition, and the contracts. It returns proposed rows:
  `feature → {capabilities} → {services} → status` grounded in the sources, with **gaps** marked.
- **Present the proposal for approval.** Do not auto-accept — the `status`/`gap` column is the human-judgment
  part. Correct anything the agent over/under-claimed.

### Phase 5 — Write the artifact (canonical template below)
- Write `<output>` (default `wiki/feature-map.md`) in the wiki's own conventions (match the existing pages'
  frontmatter + link style — e.g. `[[wikilinks]]` if the wiki uses them). Use the **canonical template**
  below so every generated map is structurally identical (the consistency guarantee).
- **Stamp the graph commit** in the frontmatter `sources` and the intro, so staleness stays computable.
- **Sentinel markers — regenerate, don't clobber.** Wrap each *graph-derived* block (§1 partition /
  capability→files, §4 worked-query skeleton) in its own fence:
  `<!-- @generated:lodestar start — <what this block is> -->` … `<!-- @generated:lodestar end -->`
  (a descriptive suffix after `start` is allowed — match on the marker prefix, not the whole literal). On a
  **re-run, treat each `start … end` pair as an INDEPENDENT region** and replace only its inner content:
  match **non-greedily** (`@generated:lodestar start[\s\S]*?-->` up to the **nearest following**
  `@generated:lodestar end[\s\S]*?-->`) and **never span across two pairs** — the hand-owned §2/§3 sit
  *between* the §1 and §4 fences and must survive. Never touch the **§3 status column** or **§5 notes** —
  those are hand-owned. For status changes, the `feature-mapper` agent proposes a *diff* for approval; it
  does not overwrite.
- Update the wiki's `index.md` (catalogue the page) and append a `log.md` entry, per the wiki's schema.

### Phase 6 — Lint
- **Coverage:** every feature resolves to ≥1 capability **or** is explicitly a `gap`/`out-of-scope`.
- **Orphans:** no capability that no feature points at (likely infra, fine; flag if it looks feature-bearing).
- **Reverse gap-check:** any feature still marked `gap` whose capability *now has files in the graph* →
  flag "gap may be closed" (the cheap rot-check — catches a built feature whose status never got flipped).
- **(micro)** every declared cross-service contract appears in the contracts table, and every contract's
  seam files still exist.
- **Link integrity + index consistency:** every `[[wikilink]]` / page link in the map resolves; the map is
  catalogued in `index.md`.
- **Staleness:** the stamped graph commit has no *source* drift vs HEAD (`query-graph.mjs stale`), else re-flag.
- Report findings; do not auto-fix the human-owned status column.

## Canonical output template (keep every generated map structurally identical)

Frontmatter (adapt keys to the wiki's house style), then:

- **Intro** — one line + a "why this topology needs it" note + the grounding stamp (`graph @ <commit>`, status source, date).
- **§1 — partition**
  - *microservices:* a **service table** (service · process/language · graph layers · owned capabilities).
  - *monolith:* a **file → capabilities table** (every file + its stable capability tags), and a note that the shared compiler + tests are the propagation net.
- **§2 — cross-service contracts** *(micro only)* — table (contract · between · seam files · checked-by), flagging polyglot/no-shared-compiler seams.
- **§3 — feature register** — table: **feature → capabilities → services → status** (status from the feature sources; `gap` is the highest-value state).
- **§4 — worked query** — one concrete "I'm changing feature/contract X" → resolved file set + the propagation net (compiler/tests for monolith; the hand-mirrored contract for micro).
- **§5 — test/maintenance notes** — what held, what strained, the open gaps, and "status is the only hand-owned column; re-verify on each `/understand` refresh."

## Principles (the rules that keep it from rotting — encode them, don't relitigate)

- **Persist what you can't grep; let agentic search do the rest.** Intent, gaps, and cross-service contracts —
  not a code-search index. The live source is the index for "which files implement this *now*."
- **Fail-closed on staleness.** A map resolved through a stale graph is worse than grep. Stamp the commit;
  refuse-or-warn when it lags HEAD.
- **Capability = stable; feature-ID = volatile.** Never write feature-IDs onto files.
- **Reuse the graph; don't re-tag.** `capability→files` is free and auto-refreshing; only the small
  `feature→capability+status` register is hand-owned.
- **Agent-proposed, human-approved.** The agent drafts; the human owns `status`/`gap`.
- **Token-lean.** Deterministic router (`query-graph.mjs`) for lookups — zero LLM. Read node *summaries* to
  route; open source only to edit. Slice the graph; never load the whole JSON. Heavy build amortized,
  queries ultra-light.
- **Topology decides shape.** Monolith ⇒ file tags + (compiler/tests as the net). Microservices ⇒ also the
  service partition + cross-service **contracts** (sourced from contract files, not the graph).

## Files in this skill
- `SKILL.md` — this procedure + template.
- `lodestar.config.json` — the portable per-project manifest (edit to reuse elsewhere).
- `query-graph.mjs` — deterministic graph helpers (staleness, layer/tag slices).
- `../../agents/feature-mapper.md` — the proposer subagent.
