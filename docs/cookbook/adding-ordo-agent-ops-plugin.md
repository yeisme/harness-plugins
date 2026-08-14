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

1. Host service tests cover context binding, redaction, cursor gap reload, duplicate events, action idempotency, and idempotent disposal.
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
