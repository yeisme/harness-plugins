# Ordo × DeepSeek Harness Agent Ops plugin and visualization design

English | [中文](README.zh.md)

This change freezes the plugin contract that projects Ordo canonical control facts into the DeepSeek Harness (DSH) Web and the Workbench Harness Studio, together with the two-client information architecture, interaction states, and cross-project handoffs.

## Design conclusions

- Owner-fit: `split-owner`.
- Ordo is the only scheduling truth owner for run, task, attempt, session, lease, approval, verification, evidence, and closeout.
- DSH Web provides a compact duty panel inside a single-tenant runtime; Workbench provides the full multi-tenant Agent Ops Studio.
- The candidate `agent/harness-plugins` repository owns host adapters, manifests, packaging, and conformance, but never a second scheduler.
- V1 delivers safe observation, events, an approval inbox, and reconcile first; real launch/re-dispatch/cancel open only after durable reservation and fencing authority are connected.

## Artifacts

- [proposal.md](proposal.md): problem, capability ledger, boundaries, and delivery slices.
- [design.md](design.md): contracts, state machines, DSH/Workbench visualization, and security design.
- [tasks.md](tasks.md): DSH implementation tasks and the Ordo/Workbench/Harness Plugins handoffs.
- [specs/ordo-agent-operations-plugin/spec.md](specs/ordo-agent-operations-plugin/spec.md): Ordo Agent Ops projection, event, and action contract.
- [specs/dsh-ordo-host-adapter/spec.md](specs/dsh-ordo-host-adapter/spec.md): DSH Cordis host/client/profile integration contract.
- [specs/ordo-visualization-experience/spec.md](specs/ordo-visualization-experience/spec.md): DSH compact view and Workbench full Studio experience contract.

## Relationship

This change is the Ordo Agent Ops implementation specification inside the DSH subproject; it relies on the root `enterprise-harness-platform-v1` for identity, the multi-tenant control plane, the plugin supply chain, and the generic action/receipt rules, without copying any of those owners' canonical state.

## Current local slice

- The Host Remote captures the server-injected `ordoAgentOpsExpectedContext` at construction; a missing or invalid value returns `needs_contract` without facts, and a later Context key replacement never rebinds the current instance.
- An owner snapshot passes strict schema, opaque ref, safe text, count/context, unknown-field, and non-ready/stale facts validation before crossing the Host; ready/stale snapshots pass through only on an exact match with the frozen expected context, while missing, sensitive, or drifting data degrades to `contract_mismatch` without facts and an owner read exception degrades to `offline`.
- The compact client keeps single-flight reads, generation reset/dispose, and late-result drops, and maintains a snapshot-axis cursor over `snapshotRef`/`snapshotVersion`: duplicate versions are ignored idempotently, a ref rotation or version regression fails closed with `owner_cursor_drift` and no facts, and the next read reconciles by re-establishing the cursor from an authoritative snapshot; event stream cursors, event-sequence gap detection, ToolView, mutation, and the Workbench re-authenticated deep link remain unimplemented.
- Verification commands: `CI=true pnpm exec tsc -p packages/host/ordo-agent-ops/tsconfig.json --noEmit`, `CI=true pnpm exec vitest run packages/host/ordo-agent-ops/tests/gateway.spec.ts` (10/10), `CI=true pnpm exec vitest run packages/client/ui-ordo-agent-ops/tests/controller.client.spec.ts packages/client/ui-ordo-agent-ops/tests/browser-plugin.client.spec.tsx packages/host/ordo-agent-ops/tests/gateway.spec.ts` (21/21), and `pnpm exec openspec validate ordo-dsh-plugin-visualization-v1 --strict --no-interactive`; these are focused/local or browser/consumer evidence, not Ordo owner, provider/deployment, or production evidence. Full AccessTicketBinding-to-expected-context composition, OAuth, cloud agents, sandboxes, and durable revocation remain owner-gated.
