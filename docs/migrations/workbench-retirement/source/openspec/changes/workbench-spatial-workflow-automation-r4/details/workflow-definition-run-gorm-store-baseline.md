# Workflow definition/run GORM store baseline

## Scope

This slice binds the existing `workflows/service.Store` contract to the
Workbench GORM repository without changing the canonical workflow state
machine. Definition versions, typed steps/edges/bindings/requirements,
compensation metadata, run starts, step-run metadata, and idempotency request
digests are persisted as normalized safe metadata. No owner payload, provider
credential, private path, artifact blob, or opaque definition body is stored.

## Consistency and retry boundary

- `CommitDefinition` and `CommitStartRun` use one GORM transaction each.
- Definition writes lock the definition header before rechecking the mutation
  ledger, so a concurrent same-digest request returns the canonical record
  instead of becoming a version conflict.
- Start-run writes use the `(tenant, definition, idempotency digest)` unique
  scope and return the pinned run/step rows on replay.
- SQLite busy/locked and PostgreSQL transaction-level contention use a bounded
  retry loop with context cancellation; business version/idempotency conflicts
  are not retried.

## Schema and compatibility

Migration `0021_workflow_definition_run_store` is additive. The historical
0001–0020 migration snapshots remain unchanged; the new normalized tables are
introduced only by 0021. External-migration policy remains fail-closed until
the migration is applied, and lifecycle classification covers every new table.

## Local evidence

- `CGO_ENABLED=0 go test ./service/internal/repository -run '^Test(GORMWorkflowStore|WorkflowStoreMigration)' -count=1`
- `CGO_ENABLED=0 go test ./service/internal/repository -count=1`
- `CGO_ENABLED=0 go test ./service/internal/runtime -run '^TestLoopbackRuntimeWorkflowRegistryAndDefinitionReadParity$' -count=1`
- `CGO_ENABLED=0 go test ./service/internal/runtime -run '^TestLoopbackRuntimeWorkflowDefinitionMutationParity$' -count=1`
- `bun test tests/conformance/workflow-sdk-runtime.test.ts`
- evidence runner: `temp/integration-test-runs/20260801175211-1baf30ee-c085-4724-9c81-33d36a7cd49c/`

The loopback check proves that the durable service is now bound to the
canonical definition read path across HTTP, JSON-RPC, and gRPC while the step
registry remains digest-identical. The mutation check additionally proves
create (server-generated stable ref), update, publish, deprecate, start-run,
get-run, and same-idempotency replay through the shared local runtime/GORM
store across HTTP, JSON-RPC, and gRPC. The SDK check additionally starts the
current `workbenchd` binary on dynamic loopback listeners, reads the same local
session token, and completes create/update/publish/start/get-run through the
typed HTTP SDK. Validate/watch, reconcile/events, managed PostgreSQL
promotion, live Identity/R1 delegation, real Eikona provider mutation, browser
E2E, and production readiness remain open. R4 task `1.5b` remains open.

The list parity check additionally proves tenant/workspace-scoped keyset
`ListDefinitions` and `ListRuns` over the SQLite GORM store and the local
HTTP, JSON-RPC, and gRPC runtime. The typed SDK assertions consume the same
published definition and running run; an empty page token is omitted rather
than serialized as an invalid empty token. Evidence is preserved at
`temp/integration-test-runs/20260801194148-a2bf22c1-d624-4a34-91da-62ba6d005582/`
with zero redactions. This remains local/component evidence only; PostgreSQL,
provider, browser, and production gates remain open.

The local run-control slice additionally binds the same GORM run rows to the
existing `control.Service`: HTTP pause, JSON-RPC resume, and gRPC cancel all
commit through the shared transition/outbox path. Evidence is preserved at
`temp/integration-test-runs/20260801200424-991a961c-94bf-48fa-92d3-42ae5d506ea5/`
with zero redactions. This is local-profile component evidence only; managed
Identity/delegation, reconcile/events, PostgreSQL restart parity, provider,
browser, and production gates remain open.
