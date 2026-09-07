# R4 Observability baseline

## Scope

This baseline records the local observability slice for R4 task 9.1. It is a
consumer/component result only; it does not promote PostgreSQL, worker, Owner,
browser, staging, or production readiness.

## Implemented local slice

- `observability.System` accepts `boards.ViewportObservation` through the
  existing `boards.ViewportObserver` contract.
- `runtime.New` wires the same `observability.System` into `BoardService`, so
  viewport query/render observations use the service-wide redaction and
  correlation boundary.
- `MetricsSnapshot.BoardViewports` aggregates query count, duration, and safe
  result counts using only the bounded `lod` and `status` dimensions. Unknown
  dimensions are mapped to `unknown`; board, tenant, node, cursor, projection,
  payload, and private-path values never become labels.
- The optional OTLP metrics producer exports bounded board viewport query and
  duration families without changing business success semantics or blocking on
  exporter outage.
- `WorkflowControlService` now feeds the same observer for pause/resume/cancel
  outcomes. `MetricsSnapshot.WorkflowControls` and OTLP
  `workbench.workflow.control.count` use only bounded action/outcome/run-state
  dimensions; run, tenant, actor, command, receipt, and error text are never
  labels.
- Worker role snapshot seam now covers scheduler, executor, outbox, and
  reconcile engines through the neutral `workers/engines.Snapshot` contract.
  `Supervisor.Snapshots` is ordered and read-only; engines without a provider
  explicitly project `snapshot_unavailable`. The optional worker-runtime
  observer forwards snapshots into `observability.System`, where role/state/
  reason are canonicalized and backlog/lag/cursor/dead-letter/backoff/counter
  values are projected without raw error text or private refs.
- OTLP role families are bounded (`workbench.workflow.role.*`) and split into
  current gauges plus cumulative counters. Negative backlog/lag/dead-letter
  values clamp to zero, unknown roles/reasons collapse to `unknown`, and
  exporter conversion clamps oversized counters rather than leaking or
  overflowing.

## Verification evidence

- Component: `temp/integration-test-runs/20260802040447-f5372cec-a04e-422e-b7d8-d55691e925a4/`
  (`task test:observability`, passed, redaction passed).
- Collector: `temp/integration-test-runs/20260802035808-ed2f7482-96d8-4d16-b5da-c8160a8283d1/`
  (OTLP delivery/outage bounded tests, passed, redaction passed).
- Focused pure-Go and race checks passed for
  `service/internal/observability` and `service/internal/runtime`.
- Fresh component evidence: `temp/integration-test-runs/20260802043348-0341aa52-3bd4-4265-8279-25800ba85a5b/`
  (`task test:observability`, passed, `redaction_result.total_redactions=0`).
- Fresh focused race evidence: `temp/integration-test-runs/20260802043428-b41026ea-3673-4666-aae2-b26b2d54ef6a/`
  (`CGO_ENABLED=1 go test -race` observability/runtime control and viewport
  cases, passed, `redaction_result.total_redactions=0`).
- Fresh role-observer component evidence: `temp/integration-test-runs/20260802153548-24a803de-e141-4bff-99f6-f40edea14af5/`
  (`task test:observability:component`, passed, `duration_ms=2273`,
  `redaction_result.total_redactions=0`). Focused pure-Go package tests and
  `CGO_ENABLED=1 go test -race` passed for observability, worker supervisor /
  runtime, scheduler, executor, outbox, and reconcile packages.
- Rechecked after fail-closed stopped-state projection: `temp/integration-test-runs/20260802154419-6ac98c2c-8db3-420a-bb52-0bfce4e2765c/`
  (`task test:observability:component`, passed, `duration_ms=2274`,
  `redaction_result.total_redactions=0`).

## Explicit remaining boundary

Task 9.1 remains open. Workflow queue/lease/outbox/reconcile lag,
run/step/attempt/retry/unknown/cancel detail, quota/kill-switch/operator
metrics, and separate API/scheduler/managed-worker readiness truth are not yet
fully wired. The local evidence above proves the Board viewport plus workflow
control observability slices and existing exporter contracts; it is not a
production or provider canary.
