# Adding an Ordo Agent Ops plugin

English | [中文](adding-ordo-agent-ops-plugin.zh.md)

This guide defines the DeepSeek Harness side of an Ordo Agent Operations integration. It covers a tenant-safe host plugin, a Web client module, a profile/bundle composition, and ToolView presentation. The [local OpenSpec](../../openspec/changes/ordo-dsh-plugin-visualization-v1/README.md) owns the cross-project contract and staged actions.

## Prerequisites

- Read [architecture.md](../architecture.md), [client-modules.md](../subsystems/client-modules.md), and [the package guide](adding-a-package.md).
- Understand that Ordo owns run, task, session, runtime, lease, worktree, approval, verification, evidence, and closeout facts.
- Have a tenant-bound control-plane adapter or a keyless fake for local tests. Do not put a provider token in the browser or in a profile patch.

## 1. Freeze the owner boundary

Write the owner table before creating a package. The DSH adapter owns transport, typed safe projection, event subscription, UI composition, and lifecycle cleanup. Ordo owns canonical state and owner receipts. Workbench owns the full multi-tenant operational view. A DSH plugin must not create a second scheduler, task ledger, lease ledger, capacity reservation, or terminal state.

Use opaque refs and bounded summaries for every cross-process value. Reject raw prompt text, provider payloads, credentials, generic bearer tokens, private tool arguments, absolute host paths, PIDs, and full reasoning at the host boundary.

## 2. Create the host face

Add a Cordis host package with a service definition, provider, and consumer. The service should expose typed methods for loading an authoritative snapshot, subscribing to an event stream, and dispatching only server-authored action descriptors. It should bind every request to tenant, workspace, principal, context revision, membership revision, installation, plugin digest, policy revision, and runtime generation where required.

The host face owns:

- access-ticket or BFF transport and audience checks;
- snapshot and cursor lifecycle;
- duplicate suppression and gap-triggered snapshot reload;
- bounded cache lifetime and connection backoff;
- idempotent disposal on unload, HMR, tenant switch, and runtime switch;
- redaction before data reaches a browser client module.

An event disconnect changes freshness to `stale` or `offline`; it does not change a run to succeeded, failed, or stopped.

The unified bundle now provides a Host-side event contract validator and bounded cursor
consumer. It requires an authoritative stream anchor, accepts only the next sequence,
ignores exact duplicate refs, and clears the cursor for gaps, entity-version regressions,
context/membership/digest/runtime drift, or reset. This is a safe consumer utility, not
an Ordo event source; real subscription, transport backoff, and profile evidence remain
owner-gated.

## 3. Create the client face

Declare `dsh.client` and export the built `./client` bundle. Use existing UI primitives and a reviewed client slot for a persistent Agent Ops panel. Keep the DSH view compact:

- current run and task progress;
- attention and approval counts;
- runtime qualification and capacity source;
- writer lease/worktree summary;
- recent verification/evidence refs;
- a re-authenticated link to the full Workbench Studio.

Use a ToolView for one inspect, approval, reconcile, or evidence operation. ToolView receives the authoritative result and renders `unknown`, `partial`, `cancel_unknown`, and `reconcile_required` explicitly. It never invents a terminal result from an HTTP status or a local optimistic flag.

## 4. Compose the profile and bundle

Declare the plugin in its package metadata and compose it through a profile/bundle patch. Inspect the assembled tree with:

```bash
dsh --profile web --dump-config
```

The bundle must be pinned to a compatible DSH release and must be removable without changing DSH core. A runtime profile and work directory belong to one tenant/workspace/runtime subject; do not multiplex tenant authorization inside one DSH process.

## 5. Implement state and action gates

The client state must distinguish `ready`, `running`, `attention_required`, `approval_required`, `stale`, `offline`, `permission_denied`, `contract_mismatch`, `unknown`, and `reconcile_required`. Mutation controls come only from server-authored `allowed_actions`.

For every action, show target, requested effect, owner, approval, expiry, expected version, policy, cost/rights blockers, and receipt/reconcile semantics before dispatch. `unknown`, `partial`, and `cancel_unknown` disable automatic retry and replacement writer actions.

## 6. Test the assembled path

Add tests at three levels:

1. Host service tests cover context binding, redaction, snapshot and event cursor gap reload, duplicate events, entity-version regression, action idempotency, and idempotent disposal. The local event contract/cursor evidence is in [event-cursor.spec.ts](../../packages/bundle/ordo-agent-ops/tests/event-cursor.spec.ts); it does not replace the owner event source.
2. Client tests cover state reduction, stale/unknown rendering, keyboard focus, reduced motion, and ToolView output.
3. Profile/Web tests load the real bundle through the Loader and verify install, removal, HMR/unload, browser token absence, and tenant-switch cache clearing.

The consumer conformance entries for the Ordo owner fixtures live with the packages that consume them: duplicate, version/ref drift, reconcile re-read, late answer, disconnect without terminal synthesis, and non-readable passthrough in [controller.client.spec.ts](../../packages/client/ui-ordo-agent-ops/tests/controller.client.spec.ts); stale context, unsafe refs, unknown fields, and owner exceptions in [gateway.spec.ts](../../packages/host/ordo-agent-ops/tests/gateway.spec.ts). Fixtures stay safe projections: a case that needs raw prompts, provider payloads, credentials, or host paths is rejected back to the owner contract instead of being reproduced locally.

Run the smallest relevant commands first:

```bash
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run doc-sync
openspec validate ordo-dsh-plugin-visualization-v1 --strict
git diff --check
```

Integration evidence belongs under `temp/integration-test-runs/<run-id>/` and must redact secrets, raw prompts, provider payloads, private tool arguments, absolute paths, and full reasoning.

## 7. Document the contract

Update the package README for configuration and lifecycle semantics, this cookbook for the developer path, and the local OpenSpec when fields, actions, ownership, or failure behavior changes. Add or update a DSH Agent Note when the architecture or security boundary changes. Do not add a root-repository OpenSpec task for DSH-only implementation work.

## 8. Handoff ledger for external owners

The following ledger is the DSH consumer contract. It records the fields and
version summaries that an Ordo, Workbench, Harness Plugins, or Control Plane
owner must publish; it does not implement those owners or turn a missing field
into a local default.

### Ordo read and action services

| Surface | Required safe fields | Version / failure rule |
| --- | --- | --- |
| Snapshot read | `schema_version`, `snapshot_ref`, `snapshot_version`, `generated_at`, `fresh_until`, `context.tenant_ref`, `context.workspace_ref`, `context.principal_ref`, `context.context_revision`, `context.installation_ref`, `membership_revision`, `delegation_ref`, `policy_revision`, `plugin_release_digest`, `ordo_contract_digest`, `stream_ref`, `cursor`, safe run/task/runtime/lease/approval/verification/evidence summaries, `allowed_actions` | `ordo.agent_ops.snapshot.v1alpha1`; `ready` and `stale` facts require an exact frozen context match. Missing, unsafe, unknown, or drifted fields fail closed as `needs_contract` or `contract_mismatch`. |
| Event stream | `schema_version`, `event_ref`, `stream_ref`, monotonic `sequence`, `cursor`, `occurred_at`, `observed_at`, `entity_ref`, `entity_version`, `event_type`, bounded `safe_delta_or_summary`, redacted `evidence_refs` | `ordo.agent_ops.event.v1alpha1`; duplicates are ignored, while gaps, expired cursors, digest changes, tenant/config changes, or runtime-generation changes stop delta application and require a snapshot reload. |
| Action descriptor | `action_type`, `decision_ref`, `target_ref`, `target_version`, exact principal/tenant/workspace/context/installation binding, `runtime_generation` when applicable, `plugin_release_digest`, `ordo_contract_digest`, policy/approval/expiry, idempotency key, `preview_digest` | `harness.action.v1alpha1`; only server-authored descriptors are dispatchable. DSH never sends arbitrary command, argv, env, URL, host path, bearer, or unregistered action type. |
| Receipt | `receipt_ref`, owner state, bounded `safe_summary`, `evidence_refs`, freshness, and reconcile/unknown semantics | `harness.receipt.v1alpha1`; terminal UI state requires an owner receipt or authoritative snapshot. `unknown`, `partial`, and `cancel_unknown` disable retry, replacement writer, and lease release. |

The canonical capability requirements are in [the Ordo Agent Operations
spec](../../openspec/changes/ordo-dsh-plugin-visualization-v1/specs/ordo-agent-operations-plugin/spec.md).
If the owner cannot provide a field or version digest, the adapter reports the
contract failure and waits for owner reconciliation; it does not derive
qualification, capacity, terminal state, or permission locally.

### Workbench handoff and semantic parity

The DSH panel may pass only opaque resource refs, owner versions, freshness,
reason codes, evidence refs, and a safe summary to Workbench. `Open in Studio`
is a navigation hint, not an authorization grant. Workbench must re-authenticate
the principal, tenant, workspace, installation, and target resource before
rendering or dispatching anything. Both clients consume the same
`status`, `reason`, `freshness`, `permission`, `approval`, `allowed_actions`,
owner refs, and receipt state; layout and density may differ, action eligibility
may not.

The Workbench owner owns the Studio route, Canvas presentation state, and
multi-tenant navigation. The DSH adapter does not embed a private React store,
construct a privileged URL, or use a deep link as a substitute for BFF/owner
authorization. See [the visualization spec](../../openspec/changes/ordo-dsh-plugin-visualization-v1/specs/ordo-visualization-experience/spec.md).

### Harness Plugins pack handoff

The pack owner must publish a fixed manifest and profile composition containing
the package name/version, `dsh.bundle.patch` path, host/client contribution
keys, DSH host compatibility range, Ordo contract digest, plugin release
digest, and the profile conformance command. The current local bundle exposes
these seams through [`@yeisme/dsh-ordo-agent-ops`](../../packages/bundle/ordo-agent-ops/package.json)
and [`cordis.patch.yml`](../../packages/bundle/ordo-agent-ops/cordis.patch.yml);
its package tests and `pnpm run build` are local evidence, not catalog or
release authority.

Installation consumes the fixed release and profile composition, then verifies
the assembled tree and removable patch. The pack must not become a tenant
database, Ordo state store, scheduler, lease authority, or release catalog;
those responsibilities stay with the Harness Plugins and Control Plane owners.

### Control Plane inputs

The Host adapter accepts only a tenant-bound access capability or BFF transport
whose audience is the Ordo Agent Ops service, plus an exact runtime binding
(`tenant`, `workspace`, runtime subject and generation), installation config
revision, membership revision, policy/delegation context, and plugin/contract
digests. A membership revoke, audience mismatch, runtime or installation drift,
or stale context invalidates old cursors and action descriptors and disables
mutation until a fresh safe projection is authorized.

The Control Plane owner remains responsible for the tenant database, OAuth
issuer, secret store, BFF/access-ticket issuance, and durable revocation. DSH
never receives credential values, stores generic bearer tokens, or infers
authorization from a browser parameter. See [the host adapter spec](../../openspec/changes/ordo-dsh-plugin-visualization-v1/specs/dsh-ordo-host-adapter/spec.md).
