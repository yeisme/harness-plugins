## Why

Project-data has focused local, PostgreSQL, fault, concurrency, and Owner-canary
evidence, but no reproducible staging topology or wall-clock staging soak gate.
Promotion therefore needs a fail-closed, redacted receipt that distinguishes a
real 24-hour staging observation from compressed local tests.

## What Changes

- Add a fixed, internal-only `nerdctl compose` staging topology for Workbench
  API, worker, migration, PostgreSQL, Identity, an Identity-owned read-only
  authority readiness sidecar, the existing Eikona canary dependency, an
  Identity rotation hook, and a one-shot soak runner.
- Add a Go staging-soak runner that observes only public Workbench contracts,
  enforces the fixed SLO policy, and emits redacted structured SLO and staging
  receipts for the existing evidence runner to collect.
- Add safe Taskfile entrypoints, operational documentation, and tests for
  configuration validation, redaction, receipt validation, rollback actions,
  compose structure, and fail-closed non-24-hour results.
- Add an explicitly authorized master1 execution phase through the existing
  kiki-infra Ansible inventory. The phase provisions only an isolated compose
  project in the dedicated `workbench.staging` containerd namespace, disposable
  staging databases, immutable build inputs, restricted rotating credentials,
  and redacted evidence; it does not promote or publish a Provider result.
- Add disposable-staging bootstrap controls for the approved ProjectRef/role
  policy and short-lived Identity principal refresh required by an empty
  managed-profile database. Neither control adds an HTTP route or accepts a
  non-disposable target.
- Bind managed worker readiness to Identity-owned typed service-identity and
  delegation documents over the existing internal TLS proxy with an injected
  read-only CA. Health without those dependencies remains unready.

## Capabilities

### New Capabilities

- `workbench-project-data-staging-soak`: Fixed, evidence-producing staging soak
  controls for Project-data that remain internal, redacted, and fail closed.

### Modified Capabilities

- `workbench-daily-operations`: Add the Project-data staging-soak evidence and
  rollback entrypoints without granting promotion or production authority.

## Impact

- Deployment manifests under `deploy/staging/`, standalone Go staging controls,
  Taskfile targets, Ansible-driven master1 execution, and operations documents.
- The authorized external mutation is limited to a uniquely named directory,
  compose project, internal networks, and persistent volumes on master1. No
  existing master1 workload, host port, browser-to-owner route, tracked secret,
  production state, paid call, Provider promotion, or registry publication is
  authorized by this change.
