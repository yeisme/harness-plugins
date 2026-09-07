# Platform decision intake contract

`workbench.platform_decision_intake.v1alpha1` is a private, CLI-owned intake
record for the D1 deployment-platform and environment-inventory decision. It is
an operator draft, not a platform adapter, approval record, deployment request,
or production readiness signal.

## Boundary

The only lifecycle commands are:

```text
workbench-release platform-intake init --source <0400-or-0600-json> --output <new-json>
workbench-release platform-intake inspect --intake <0400-or-0600-json>
workbench-release platform-intake validate --intake <0400-or-0600-json> --source <0400-or-0600-json>
```

`init` accepts strict JSON with no unknown fields, hashes the original source,
normalizes environment and capability ordering, and creates a new `0600` file.
Inputs must be regular, non-symlink `0400` or `0600` files no larger than 1 MiB;
the opened file must match the pre-open inode. Existing outputs are never
overwritten. References are field-scheme-bound, content-addressed registry
handles only: `expected-scheme:rid-` followed by exactly 64 lowercase hex
characters (the digest of an external authoritative registry record). They are
not secrets, endpoints, tokens, or authority assertions; this CLI neither
fetches nor validates the external registry.

The generated record always has these fixed fields:

```text
state=operator_draft
approval_state=external_signed_approval_required
production_authorized=false
```

No v1alpha1 command accepts an approval, signer, trust bundle, platform
selection, provider adapter, endpoint, or deployment action. `inspect` emits
only state, approval state, booleans, digests, and counts; it never prints input
paths or opaque references. A complete and current draft makes `validate` return
exit `5` with `platform_decision_approval_required`. Source drift and expiry
also return exit `5`; malformed, unsafe, or custody-invalid inputs return exit
`2`. When loading fails before state is available, summary and explain output
uses `state=unavailable`, never an invented draft state.

## Required source shape

The source has `spec_version`, `revision=1`, `decision_id`, `scope`,
`expires_at`, `source_ref`, and `source_revision_ref`, followed by opaque
platform references for runtime/controller/owner/provider/staging sandbox; the
Web/API/worker/migration topology; operations; trust; and rollout/ownership.
It contains exactly `integration`, `staging`, `canary`, and `production`
environment records. Each supplies opaque environment, inventory, registry,
network, configuration-provider, PostgreSQL, telemetry, and paging references,
plus tenant and inventory SHA-256 digests.

`capability_evidence` entries are sorted by `capability_id` in the resulting
record and each contains `capability_id`, opaque `evidence_ref`, and a SHA-256
digest. Minimum coverage identifiers are:

```text
runtime-web, runtime-api, runtime-worker, runtime-migration
transport-sse, transport-grpc
operation-validate, operation-plan, operation-lookup
rollout-progressive, workflow-pause-abort-rollback
```

This records the operator's complete D1 intake without selecting a platform or
asserting that any provider owns the listed capabilities.

## Gate effect

The Task targets `release:platform-intake:init`, `:inspect`, and `:validate`
are local-only. The production target registry lists validation as the
`decision_intake_consumer` authority and provider-blocked with expected exit
`5`. This contract does **not** close R5 task `2.0b2`, does not establish a production gate, and does not replace the future provider-owned signed approval
consumer, managed runtime receipt, database authority, or observability
authority.
