# Gateway Console consumer contract

This page documents the Workbench consumer boundary for the typed Gateway
console slice. It is an operator and release reference for the local
Workbench control plane; it is not a Gateway owner deployment, credential
store, or production readiness claim.

## Contract and trust chain

The SDK exposes the additive `WorkbenchClient.gateway` facade under
`workbench.gateway.v1alpha1` and accepts the supported
`gateway.console.contract.v1` projection only. Unknown contract majors are
reported as `contract_mismatch` and disable Gateway actions; Workbench does
not infer fields from raw JSON.

The request path is fixed:

```text
Browser -> Web BFF -> workbenchd -> dedicated Gateway adapter -> Gateway owner
```

The browser supplies neither a downstream URL, method, raw body, credential,
Authorization header, credential reference, private URL, nor owner payload.
The adapter uses the server-side allowlist and returns only the bounded typed
projection. Workbench persists task metadata, revisions, safe refs,
receipt/evidence refs, and transport receipts—not Gateway secrets or raw tool
arguments.

`capabilityState` is the server-declared capability flag for this surface. It
may be `available`, `needs_contract`, `degraded`, or `unknown`; a local build,
fixture, or mock must not promote it to `available`. When the negotiated owner
contract is absent, mismatched, stale, or unavailable, Gateway actions stay
disabled and the typed unavailable state remains visible.

The dedicated adapter is loopback-only: its base URL must start with
`http://127.0.0.1`, `http://localhost`, or `http://[::1]`; URL userinfo is
rejected. The browser has no endpoint or credential override.

## Allowlisted operations

The initial contract registers only:

- `gateway.approval.decide`
- `gateway.tools.refresh`
- `gateway.runtime.reload`

Each mutation requires server-side permission, the current owner revision, a
new idempotency key, a safe request digest, audit data, and an owner receipt or
operation reference. Runtime restart, registry/policy mutation, token
provisioning, arbitrary tool execution, and other undeclared operations remain
unavailable.

If the downstream outcome is ambiguous, the Task becomes `unknown_accept`.
Workbench does not automatically replay it or fabricate `cancelled`; the next
action is an explicit receipt/status reconciliation.

## Local verification

These commands verify the Workbench consumer contract and local evidence only:

```bash
bun test packages/task-sdk/test/gateway-contract.test.ts \
  packages/task-sdk/test/gateway-fixtures.test.ts \
  packages/task-sdk/test/gateway-client.test.ts
CGO_ENABLED=0 go test ./service/internal/gateway/... ./service/internal/registry/... \
  ./service/test/conformance -run 'Gateway' -count=1
bunx vitest run apps/web/test/gateway-overview.test.tsx \
  apps/web/test/gateway-backends.test.tsx \
  apps/web/test/gateway-approvals.test.tsx \
  apps/web/test/gateway-activity.test.tsx
openspec validate --all --strict
for anchor in WorkbenchClient.gateway gateway.approval.decide gateway.tools.refresh gateway.runtime.reload unknown_accept 'owner canary'; do
  grep -n -F "$anchor" docs/interfaces/gateway-console.md
done
```

Evidence runs belong under
`temp/integration-test-runs/<run-id>/` and must retain the original exit code,
redaction result, command, stdout/stderr, environment projection, and
artifacts. The existing local reference is
`temp/integration-test-runs/20260728040016-74c35a93-6108-4cad-b906-feed63ef2bef/summary.json`:
it records a passing, exit-0 integration run with the redaction result in
`redaction.json`. Local loopback, fixtures, mocked owner responses, and
Workbench integration/E2E evidence do not prove a real Gateway owner consumer
canary by themselves.

## Recovery and rollback

The UI must distinguish loading, empty, stale, permission, Gateway unavailable,
backend down, browser offline, and Workbench unavailable. A stale snapshot is
labelled with its observation time and is never presented as live. An action
that is unavailable because the contract or capability is missing exposes the
reason and a valid recovery path rather than a fake retry or success state.

The rollback boundary is source/build and capability scoped: restore the
previous Workbench release artifacts or keep `capabilityState` non-available,
keep undeclared Gateway actions disabled, and preserve task/receipt evidence.
Do not delete owner data, rotate credentials, or send a remote rollback command
from this consumer surface.

## Owner canary gate

The Gateway owner canary is a separate release gate, and it passed on
2026-08-12. The Gateway owner archive records a real checked-in Workbench
adapter consuming a built Gateway binary over loopback with a durable owner
data directory:

- consumer: `yeisme-workbench/service/internal/gateway`
- owner contract: `gateway.console.contract.v1`
- owner digest: `87f96595b2315657fe103dfaf9054363a0606b7cccbf132d88b0a1df1ea411e3`
- exercised operation: `gateway.runtime.reload`
- result: `status=passed`, `result_code=success`, summary `runtime reloaded`
- safe owner receipt: `receipt:8ab77a0bebfa16d2`
- observed at: `2026-08-12T10:23:17Z`

The durable evidence references are the Gateway owner artifacts
`mcp/gateway/openspec/changes/archive/2026-08-12-gateway-workbench-console-contract/evidence.md`
and `tasks.md`; they record the original redacted six-file evidence bundle and
secret-sentinel scan. This closes the local owner-consumer canary dependency.
It does not claim a remote Gateway, public ingress, staging, or production
readiness. Rollback remains capability-scoped: keep `capabilityState`
non-available and stop selecting the typed `/console/*` compatibility routes.
