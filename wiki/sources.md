# Sources

Raw sources this wiki is built FROM. Sources are **read-only** to the wiki.

## Product docs (`docs/`, in-repo)
| Source | Feeds |
|---|---|
| `docs/00-index.md` | [overview](overview.md), [onboarding](onboarding.md) |
| `docs/product/01-vision-and-personas.md` | [markdown-second-brain](concepts/markdown-second-brain.md), [onboarding](onboarding.md) |
| `docs/product/02-success-metrics.md`, `docs/product/03-roadmap.md` | roadmap/scope context (decisions) |
| `docs/analysis/04-user-journeys.md`, `docs/analysis/05-user-stories.md` | [onboarding](onboarding.md), [ui-shell](subsystems/ui-shell.md), [tray](subsystems/tray.md) |
| `docs/design/06-architecture-overview.md` | [overview](overview.md), all subsystems, privacy concepts, [swift-engine-sidecar](decisions/swift-engine-sidecar.md) |
| `docs/design/07-data-flows.md` | engine + RAG subsystems, [streaming-finalization](concepts/streaming-finalization.md) |
| `docs/design/08-websocket-api-contract.md` | [wire-protocol](subsystems/wire-protocol.md), [streaming-daemon](subsystems/streaming-daemon.md) |
| `docs/design/11-ui-visual-brief.md` | [design-system](concepts/design-system.md), [ui-shell](subsystems/ui-shell.md) |
| `docs/qa/09-test-strategy.md`, `docs/qa/10-performance-benchmarks.md` | [threat-model](concepts/threat-model.md) (privacy checklist); perf context |

## Decision records (`../hark/docs/decisions/`, code repo)
ADRs **0001–0038** — feed the `decisions/` pages (each decision page cites its ADR ids) and corroborate
subsystem/concept claims. e.g. 0001–0004/0013 → [foundations](decisions/foundations.md); 0016–0036 →
[streaming-finalization](concepts/streaming-finalization.md) + [diarization-speakers](decisions/diarization-speakers.md);
0027–0031 → [privacy-egress](decisions/privacy-egress.md); 0032–0034 → [vault-rag-decisions](decisions/vault-rag-decisions.md).

## Code graph
`../hark/.understand-anything/knowledge-graph.json` (7 layers) — feeds every subsystem page + [feature-map](feature-map.md).

> Built 2026-06-30 by `/cairn-rebuild` (Cairn dogfood). Agents also read the actual Swift/TS source files
> (e.g. `Diarizer.swift`, `keystore.ts`, `RagIndex.swift`) to verify the graph + ADR claims.
