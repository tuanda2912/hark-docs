# Log

Append-only record of ingests / queries / lints (newest first).

## [2026-06-30] rebuild | full-coverage wiki rebuild (Cairn dogfood, pass 2)
Authored the full wiki with `/cairn-rebuild` from all `docs/` + the 38 ADRs (`../hark/docs/decisions/`) + the code graph.
- Code: hark @ `6dbb6b9`; graph @ `69d53bc` (fresh — no source drift).
- **43 content pages**: 9 concepts, 10 decisions, 21 subsystems + overview/glossary/onboarding (+ feature-map).
- Sources: 11 design/product/analysis/qa docs + ADRs 0001–0038 + graph layers; agents verified against actual Swift/TS source.
- Notable gaps/nuances surfaced: Translate deferred & decision `superseded` (0037 removed 0035); offset-only RAG storage (0032); cross-mic enrollment threshold left open (0026 → TODO).

## [2026-06-30] rebuild | from-scratch wiki rebuild (Cairn dogfood, pass 1)
First pass — overview/glossary/sources/feature-map + 1 concept, 1 decision, 5 subsystems. Superseded by pass 2 above.
