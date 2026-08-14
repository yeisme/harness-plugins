# @yeisme/dsh-host-ordo-agent-ops

English | [中文](README.zh.md)

Read-only Host Remote for the Ordo Agent Ops projection. The service exposes one `ordoAgentOps/snapshot` method and never creates a scheduler, run ledger, lease ledger, or synthetic terminal state.

The server injects `ordoAgentOpsExpectedContext` before gateway construction with the tenant, workspace, principal, context revision, and installation refs. The gateway validates, detaches, and freezes that value once for its process lifecycle. It exposes ready or stale facts only when the owner snapshot includes the same complete context; missing or invalid expected context returns `needs_contract`, while a missing, drifting, or invalid owner context returns `contract_mismatch`. Every degraded projection omits run and capacity facts.

An Ordo owner adapter may provide the `ordoAgentOpsOwner` source to the same Host context. Until that source is mounted, the Remote returns `needs_contract` with `owner_read_contract_unavailable`; this is focused/local, owner-gated evidence rather than an Ordo provider, deployment, or production connection. AccessTicketBinding-to-expected-context composition remains an owner-gated Control Plane responsibility; this package neither derives context from tickets or browser input nor implements OAuth, cloud agents, sandboxes, or durable revocation.

## Model Experience

None, as this package registers no prompts, tools, model requests, or model-visible output.

#### KV Cache effect

None; the package does not assemble model input.

## Known Limitations and Deferred Work

- The package does not connect to Ordo, observe OS processes, reserve capacity, or launch runtimes.
- Event cursors, reconcile actions, AccessTicketBinding composition, tenant authorization, and durable reservations remain owned by the Ordo and Harness Control Plane handoffs.
- The fallback projection intentionally contains no run, lease, worktree, capacity, or evidence facts.
