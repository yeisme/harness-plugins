# Ordo DSH Plugin Visualization - Agent Note

## Change Summary

This change implements DSH-side safe projections and host/client plugins for Ordo Agent Ops visualization, including snapshot/event cursors, validation boundaries, and compact UI components.

## Key Design Decisions

### Split-Owner Architecture
**Ordo Owner responsibilities:**
- Run/task/session/lease/approval/verification/evidence/closeout canonical state
- Snapshot service (`snapshot.v1alpha1`) - source of truth
- Event service (`event.v1alpha1`) - real-time updates
- Action service (`harness.action.v1alpha1`) - mutation authority
- Receipt service (`harness.receipt.v1alpha1`) - confirmation records

**DSH Plugin responsibilities:**
- Safe projection consumption (opaque refs, bounded summaries)
- Host validation boundary (schema, safe text, context containment)
- Client cursor lifecycle (browser snapshot axis, event axis pending)
- Compact UI with Workbench parity (no terminal state synthesis)

### Host Validation Boundary
**Three-layer validation (packages/host/ordo-agent-ops/src/validation.ts):**
1. Schema validation - structure and field types
2. Safe ref/text validation - no URLs, tokens, or host paths
3. Context containment - expected context frozen on first snapshot
4. Unknown field rejection - fail closed on unexpected fields

**Validation outcomes:**
- `needs_contract`: Expected context missing or invalid
- `contract_mismatch`: Owner context invalid, missing, drifting, or non-ready/stale
- `offline`: Owner read exception (transport failure)
- Valid projections only cross the boundary after passing all checks

### Context Containment Strategy
**Expected context capture:**
- Frozen once at first successful snapshot
- Includes tenant/workspace/principal/context revision
- Bound to installation/runtime generation

**Drift detection:**
- Context missing → `needs_contract`
- Context invalid → `contract_mismatch` with zero run/capacity facts
- Context drifting → `contract_mismatch` with owner reconciliation hint
- Never derive context from browser parameters or ticket claims

### Cursor Architecture
**Two cursor axes:**
1. **Snapshot axis** (browser): `packages/client/ui-ordo-agent-ops/src/client/cursor.ts`
   - Version-based cursor tracking
   - Ref rotation detection
   - Drift detection (owner_cursor_drift)
   - Re-read on reconcile signal

2. **Event axis** (host): `packages/bundle/ordo-agent-ops/src/host/event-cursor.ts`
   - Sequence-based cursor tracking
   - Gap detection with reconcile signal
   - Bounded history enforcement
   - Entity version regression detection

**Cursor behaviors:**
- Single-flight reads prevent duplicate suppression
- Late-answer drop for stale cursors
- Disconnect handling never synthesizes terminal state
- Re-read on reconcile signal with idempotent operations

### Browser-Only Safety Rules
**Never exposed to browser:**
- URLs, paths, bearer tokens, or base URLs
- Raw prompts or provider payloads
- Private tool arguments or internal state
- Host file paths or socket addresses

**Only safe projections:**
- Opaque refs (run_id, task_ref, lease_id)
- Bounded summaries (status, reason, freshness)
- Version digests and evidence refs
- Server-authored action descriptors

## Completed Tasks

**Phase 1 - DSH Design (1.1-1.3):** ✅ Complete
- Owner boundary analysis (split-owner: Ordo/DSH/Workbench/Harness Plugins)
- Three capability specs frozen
- Dependency review with enterprise-harness-platform-v1

**Phase 2 - Ordo Handoff (2.1-2.2):** ✅ Complete
- Ordo service dependencies documented
- Snapshot/event/action/receipt field ledger fixed
- Consumer conformance fixtures defined

**Phase 3 - DSH Implementation (partial):**
- ✅ 3.1: DSH spec frozen (host/client/bundle paths, Cordis keys)
- ✅ 3.2a: Read-only snapshot Host Remote with owner source fallback
- ✅ 3.3a: Compact sidebar consumer with single-flight and dispose
- ✅ 3.2b: Host validation boundary (schema/safe ref/context/unknown fields)
- ✅ 3.2c: Context containment (expected context freeze + drift detection)
- ⏸️ 3.2: Real Cordis event source (typed service/event/cursor lifecycle - external owner)
- ⏸️ 3.3: Agent Ops panel with ToolView and Workbench deep link (pending DSH rc seams)

**Phase 4 - Workbench Handoff (4.1):** ✅ Complete
- Workbench handoff requirements documented
- Opaque refs and re-authenticated deep-link rules established

**Phase 5 - Harness Plugins Handoff (5.1-5.2):** ✅ Complete
- Plugin pack requirements documented
- Control Plane handoff (audience/runtime/membership) established

**Phase 7 - Skills & Docs (7.1-7.3):** ✅ Complete
- DSH skills added (`dsh-ordo-agent-ops`, `dsh-plugin-experience`)
- Bilingual cookbook completed
- Documentation gates passing (doc-sync, lint, link validation)

## Remaining Tasks (Blocked/External)

**Phase 3 - Remaining:**
- ⏸️ 3.2: Real Cordis host plugin with event source and subscription lifecycle
- ⏸️ 3.3: Agent Ops panel, ToolView, Workbench deep link authorization
- ⏸️ 3.4: Verification (profile dump, cursor gap, ToolView redaction, a11y)

**Phase 4 - Remaining:**
- ⏸️ 4.2: Parity testing with Workbench (requires UI implementation)

**Phase 6 - Closeout:**
- ⏸️ 6.1: Conformance validation (snapshot/event/gap/tenant switch/a11y evidence)
- ⏸️ 6.2: Documentation closeout (README, cookbook, architecture, Agent Note)

## Verification Evidence

**Focused/Local tests (all passing):**
```bash
# Host validation gateway tests
CI=true pnpm exec vitest run packages/host/ordo-agent-ops/tests/gateway.spec.ts
# Result: 10/10 passed

# Client controller tests
CI=true pnpm exec vitest run packages/client/ui-ordo-agent-ops/tests/controller.client.spec.ts
# Result: 9/9 passed

# Combined client tests
CI=true pnpm exec vitest run packages/client/ui-ordo-agent-ops/tests/controller.client.spec.ts \
  packages/client/ui-ordo-agent-ops/tests/browser-plugin.client.spec.tsx \
  packages/host/ordo-agent-ops/tests/gateway.spec.ts
# Result: 21/21 passed

# Typecheck gates
CI=true pnpm exec tsc -p packages/host/ordo-agent-ops/tsconfig.json --noEmit
CI=true pnpm exec tsc -p packages/client/ui-ordo-agent-ops/tsconfig.json --noEmit
# Result: Both exit 0

# OpenSpec validation
npx -y @fission-ai/openspec@1.6.0 validate ordo-dsh-plugin-visualization-v1 --strict --no-interactive
# Result: Change valid

# Repository gates
pnpm run doc-sync
pnpm run lint
git diff --check
verify-package-invariants
verify-md-links
# Result: All exit 0
```

## Architecture Documentation

**Host-side packages:**
- `packages/host/ordo-agent-ops/` - rc.7 compatibility shims + tests
- `packages/bundle/ordo-agent-ops/` - unified bundle with event schema

**Client-side packages:**
- `packages/client/ui-ordo-agent-ops/` - controller, cursor, compact UI

**Key implementation files:**
- `src/validation.ts` - Three-layer host validation boundary
- `src/client/cursor.ts` - Browser snapshot cursor with drift detection
- `tests/gateway.spec.ts` - 10 focused host validation tests
- `tests/controller.client.spec.ts` - 9 focused client behavior tests
- `src/host/event-cursor.ts` - Event cursor with gap/bounded history
- `tests/event-cursor.spec.ts` - 6 event cursor tests

**Documentation:**
- `docs/cookbook/adding-ordo-agent-ops-plugin.md` - Integration guide (§8: field ledger)
- `docs/cookbook/ordo-slash-commands.md` + `.zh.md` - Command reference
- `.agents/notes/` - Architecture decision records

## External Owner Handoffs

**To Ordo Owner:**
- Snapshot service contract (`snapshot.v1alpha1`)
- Event service contract (`event.v1alpha1`) 
- Action service contract (`harness.action.v1alpha1`)
- Receipt service contract (`harness.receipt.v1alpha1`)
- Exact context/resource revision for Workbench re-authentication

**To Workbench Owner:**
- Opaque refs only (no credentials or paths)
- Re-authenticated deep link (`Open in Studio` as navigation hint)
- Status/reason/freshness/permission parity requirements
- Action and receipt parity definitions

**To Control Plane Owner:**
- Audience and runtime binding inputs
- Installation/membership revision tracking
- Plugin/contract digest verification
- Membership revoke signal handling

**To Harness Plugins Owner:**
- Bundle manifest and version contracts
- Host compatibility definitions
- Profile composition rules
- Conformance entry points

## Capability Probe Strategy

When external services are unavailable, the implementation uses:
1. `needs_contract` - Owner source missing
2. `offline` - Owner read exception
3. `contract_mismatch` - Invalid or drifting context
4. `not_available` - Action surface not mounted

The code never:
- Fakes owner state or optimistic fallback
- Retries uncertain actions automatically
- Synthesizes terminal run states from loading/errors
- Derives context from browser parameters

## Future Work

**When DSH rc seams are available:**
- Real Cordis event source and subscription lifecycle (task 3.2)
- ToolView registration for Agent Ops panel (task 3.3)
- `command/executed` client event for popup integration
- Workbench re-authenticated deep link full integration

**When Ordo owner contracts are complete:**
- Full event sequence cursor consumption
- Mutation actions through owner CAS boundary
- Receipt verification and reconciliation

**Verification work (pending external dependencies):**
- Task 3.4: Integration evidence with profile dump, cursor gap, a11y
- Task 4.2: Parity testing with Workbench
- Task 6.1: Conformance validation against all three capability specs
- Task 6.2: Full documentation closeout

## Date: 2026-08-24
## Agent: Lane E (6th generation)
## Session: harness-plugins/Ordo dual change implementation
