# DSH Ordo Command Interaction - Agent Note

## Change Summary

This change implements a safe DSH command surface for Ordo Agent Ops, providing a projection-based interface without creating local state or second sources of authority.

## Key Design Decisions

### Owner Boundary
- Ordo remains the sole owner of runs, tasks, leases, approvals, receipts, reconciliation, and composition facts
- DSH commands only provide safe projections and owner handoff
- No local ledger, no automatic retry of uncertain actions
- All mutation actions require preview and owner confirmation

### Command Syntax Contract
The unified Ordo command surface follows a four-part contract:
1. `Conclusion` - Command outcome
2. `Freshness / status` - Data freshness indicator
3. `Safe refs / summary` - Opaque owner references only
4. `Next action` - Safe next steps without mutation shortcuts

### Safe Projection Rules
- Unsafe refs, paths, URLs, credentials are rejected without echo
- Input validation happens before any owner contact
- Decision refs use CAS (Compare-And-Set) semantics with digest verification
- Stale/offline/contract_mismatch states fail closed (no mutation)

### Action CAS Decision
**Why CAS for approve/reconcile:**
- Prevents replay attacks with expired decision references
- Digest verification ensures context hasn't changed between preview and approval
- Owner boundary preserved: DSH forwards decisions but never synthesizes acceptance
- `still_unknown` and `reconcile_required` are terminal (no retry)

**Implementation:**
- `approve`: Re-reads snapshot, checks decision ref + expiry, forwards digest + context to owner
- `reconcile`: Only available when fresh/ready + `reconcile_required`, displays server-authored descriptor
- `qualify`: Returns preview-only handoff, no local maturity/risk calculation

### External Dependencies
Task 2.1 remains intentionally open because:
- Independent composition owner contract not yet available
- Formal Ordo qualify action contract requires external owner implementation
- DSH implements the safe envelope and handoff, but actual qualification requires owner service
- No local fact promotion without owner confirmation

## Completed Tasks
- ✅ 1.1: Ordo command registration and read subcommand
- ✅ 1.2: Registration invariants and bilingual README
- ✅ 2.2: Slash command cookbook (bilingual, validated with doc-sync)

## Remaining Tasks (Blocked/External)
- ⏸️ 2.1: Action preview and CAS (structure complete, waiting for external owner contract)
- ⏸️ 3.1/3.2: Popup menu and panel linkage (requires DSH client popup events not yet available)
- ⏸️ 4.1: E2E verification (requires owner fixtures and action contracts)
- ⏸️ 4.2: Change validation (this task - documenting architecture decisions)

## Verification Evidence

```bash
# Validation commands that pass:
pnpm --filter @yeisme/dsh-ordo-agent-ops run typecheck
pnpm run doc-sync
openspec validate dsh-ordo-command-interaction-v1 --strict --no-interactive
```

## Architecture Notes

### Unified Command Structure
All Ordo commands flow through a single unified host in `packages/host/ordo-commands/`:
- Safe envelope parsing and validation
- Owner source detection with `needs_contract` fallback
- CAS-based decision forwarding with digest verification
- Negative coverage for stale/unknown/contract_mismatch states

### Safe Envelope Contract
The command surface consumes `dsh.composition.preview.v0` safe envelopes:
- Opaque refs only (no URLs, paths, or tokens)
- Server-authored reconcile descriptors
- Exact context revision with tenant/workspace/principal binding
- Digest-based CAS to prevent drift/replay

### No Local State Policy
This change explicitly avoids:
- Local task ledger or run state
- Optimistic UI state that diverges from owner
- Retry logic for uncertain actions
- Terminal state synthesis from loading/error conditions

## Handoff Boundaries

**To Ordo Owner:**
- Snapshot/event/action/receipt field ledger defined
- Exact context/resource revision for Workbench re-authentication
- Decision-ref CAS contracts for approve/reconcile
- Qualify action requires external owner contract completion

**To DSH Client:**
- Popup/panel integration blocked on `command/executed` event availability
- ToolView registration seam not yet available in DSH rc
- Workbench deep-link requires owner re-authentication

**To Harness Plugins:**
- Bundle digest and host compatibility defined
- Profile composition and conformance entry points established
- No tenant state creation in plugin layer

## Evidence Paths

Local validation evidence:
- `packages/host/ordo-commands/tests/gateway.spec.ts` - 20 tests covering preview-before-mutate, negative states, context forwarding
- `docs/cookbook/ordo-slash-commands.md` + `.zh.md` - Bilingual command reference

External owner requirements:
- Ordo snapshot service (`snapshot.v1alpha1`)
- Composition preview service (`dsh.composition.preview.v0`)
- Qualify action contract (formal contract pending)
- Popup/decorate client events (DSH rc.6+)

## Future Work

When external owner contracts are available:
1. Complete task 2.1 with full qualify integration
2. Implement popup/menu linkage (3.1) when `command/executed` event available
3. Add ToolView registration when DSH seam opens
4. End-to-end verification (4.1) with owner fixtures
5. Full Workbench parity testing (4.2 in visualization change)

## Date: 2026-08-24
## Agent: Lane E (6th generation)
## Session: harness-plugins/Ordo dual change implementation
