## ADDED Requirements

### Requirement: Project-data staging topology MUST stay internal and pinned

The system SHALL provide a `nerdctl compose` staging definition containing
Workbench API, worker, migration, PostgreSQL, Identity, an Identity-owned
read-only authority readiness sidecar, the existing Eikona canary dependency,
a one-shot Identity rotation hook, and a one-shot soak runner. API, worker,
migration, and soak MUST each use their own immutable release image input that
matches its checked-in Docker target. Services MUST use only the three fixed
networks created as internal networks by the authorized staging control,
MUST publish no host ports, MUST use pinned image inputs, and MUST NOT
configure a public admin or owner route. Secrets MUST NOT be tracked in compose
files, examples, receipts, or evidence. PostgreSQL MUST create the
`identity_disposable_staging` database before the source-verified Identity
daemon migration path starts. The rotation hook MUST use its source-verified
schema preflight and fail closed rather than treating that daemon as a completed
one-shot initialization job.
The worker service MUST select the scheduler role explicitly; an unset or
multi-role engine configuration MUST fail validation instead of being treated
as a ready worker. Its contract minimum and maximum MUST both equal
`workbench.workflow.v1alpha1`. The staging service MUST enable claim readiness
explicitly, and the runtime MUST reject that mode unless a managed dependency
checker, durable registration store, and real engine supervisor are attached.
Default worker mode MUST remain claim-disabled. Enabled `/readyz` MUST return
success only when all required dependencies are ready, registration is active,
no lifecycle error is present, and the worker is not draining.

The Identity database network MUST contain only PostgreSQL, Identity, the
read-only authority sidecar, the rotation hook, and the listener-free principal
init/refresh controls.
PostgreSQL and all database consumers MUST use operator-mounted TLS material.
The start control MUST parse Identity JWKS and require at least one complete
`OKP`/`EdDSA` signing key before starting the authority sidecar; HTTP success
with an empty key set MUST remain unready.
The rotation DSN MUST be exactly the owner-approved
`postgres:5432/identity_disposable_staging` target with `sslmode=verify-full`
and `sslrootcert=/run/identity-db-tls/ca.crt`. Identity JWKS and the authority
sidecar MUST be exposed only through a pinned internal HTTPS proxy. The sidecar
MUST reject non-disposable targets, MUST bind its typed service-identity and
delegation documents to the candidate digest, and MUST NOT add a mutation or
management route. Workbench MUST use read-only injected CA PEM mounts and normal
TLS and hostname verification for both JWKS and authority readiness, never
plaintext, redirects, inherited proxy routing, or skip-verify. Worker `/readyz`
MUST remain unready unless both typed authority dependencies validate their
fixed staging issuer, audience, contract, grant, environment, service identity,
and candidate digest.
When a superseding candidate changes its source or worker artifact digest, the
control plane MUST assign a new opaque durable worker ID rather than reusing or
deleting the prior candidate registration. The new start receipt MUST bind that
worker ID and its runtime config digest.
The authorized start control MUST validate Eikona through an authenticated
compose-private `GET /api/v1/health` and MUST structurally require an
`eikona.health.v1` document whose service is `eikona` and whose data status is
`ready`. It MUST mount the Eikona-owned key read-only only into the disposable
probe. The fixture and soak runner MUST NOT receive that key or call Eikona
directly.

#### Scenario: Compose definition is inspected
- **WHEN** the staging compose definition is statically validated
- **THEN** validation MUST reject host ports, a non-internal network, an
  unexpected runtime network name, any Compose `depends_on`, an unpinned image,
  a missing required service/hook, a worker without explicit claim enablement,
  or an admin/owner route
- **AND** it MUST confirm that every service is attached only to an approved
  network that the authorized start control creates with `--internal`, with
  Identity database access limited to PostgreSQL, Identity, the read-only
  authority sidecar, rotation, and the listener-free principal controls
- **AND** Eikona health MUST use its authenticated canonical route without
  placing the Owner key in host arguments, logs, fixtures, or evidence

#### Scenario: A corrected candidate replaces a superseded candidate
- **WHEN** the worker artifact or source digest changes while the disposable
  database and public fixture are preserved
- **THEN** the replacement worker MUST register under a new durable worker ID
- **AND** the control MUST NOT delete the old registration or replay the public
  fixture to make readiness pass

### Requirement: Authorized staging execution MUST be isolated and recoverable

The system SHALL execute the live soak only on the explicitly approved
`master1` inventory host through kiki-infra Ansible. It MUST use a unique
compose project and an isolated root below
`/data/ssd0/workbench-project-data-staging-soak-v1`, MUST publish no host port,
MUST use the dedicated containerd namespace `workbench.staging`, MUST address
runtime images by immutable content digest, and MUST NOT modify an existing
container, network, volume, listener, Harbor object, or system service.
Preflight and recovery MUST fail closed when the host, root, compose-project,
or containerd-namespace identity differs from the approved values. A failed run
MUST disable new automation mutation and retain the isolated environment and
redacted evidence for diagnosis. Repair MAY remove only this project's exact
legacy resource names from the shared default namespace with a hard timeout and
absence verification; it MUST NOT list, repair, restart, or remove unrelated
default-namespace workloads or restart containerd.

#### Scenario: master1 is prepared for the live run
- **WHEN** the operator applies the staging Ansible entrypoint
- **THEN** it MUST first record read-only host/capacity/runtime/current-workload
  evidence and verify the isolated root is absent or already bound to the same
  run identity
- **AND** every subsequent write MUST remain within that root and compose
  project and the `workbench.staging` containerd namespace without altering
  pre-existing master1 workloads

### Requirement: Empty managed staging MUST bootstrap without bypassing public contracts

The Workbench API SHALL load an operator-mounted strict allowlist containing
exactly the approved safe Project scope for the staging run. A listener-free
Workbench bootstrap command SHALL accept only the exact compose-private
verify-full PostgreSQL target and an explicit `disposable-staging` attestation,
install the initial ProjectWorkspace and server-owned role policy idempotently,
emit a redacted receipt, and exit. It MUST reject any non-PostgreSQL, non-compose,
non-verify-full, non-disposable, inherited-override, or ambiguous target. After
that bounded bootstrap, Dataset, WorkItem, Task, and Automation fixture records
MUST be created only through authenticated public Workbench contracts.
The managed API MUST bind authenticated HTTP requests to the exact configured
authority. Disposable staging MUST require `api:8787`; every other non-loopback
Host MUST fail closed. A service client without a browser `Origin` MAY use that
authority, but any supplied Origin MUST match the request scheme and exact
authority.

The staging-only Task, WorkItem, and Automation authorizer MUST activate only
when the restricted Project allowlist and exact `disposable-staging`
attestation are both present. It MUST use scopes from a successfully verified
PrincipalContext and MUST keep Project role-policy authorization as a separate
mandatory gate. The ordinary managed Identity `AllowedActions` path MUST remain
unchanged when the staging pair is absent.

Identity SHALL provide a listener-free disposable staging principal refresh
control that mints only a bounded Workbench-audience PrincipalContext from the
persisted active key and atomically replaces a restricted mode-`0600` token
file. It MUST use the same strict target validation as the rotation control,
MUST emit only a redacted refresh receipt, and MUST never place the token, DSN,
private key, or raw claims in arguments, logs, receipts, or evidence. Rotation
MUST be followed by refresh and successful validation against the new JWKS.

#### Scenario: Empty staging data is initialized
- **WHEN** migration has completed on the isolated compose PostgreSQL service
- **THEN** the one-shot Workbench bootstrap MUST install only the approved
  ProjectWorkspace and subject/scope policy, and the Identity refresh control
  MUST create the restricted rotating bearer file
- **AND** all business fixture mutations MUST subsequently traverse public
  Workbench APIs with fixed idempotency keys
- **AND** the fixture and soak runner MUST use the exact `api:8787` authority
  without weakening browser Origin validation or accepting an arbitrary Host

### Requirement: Staging soak MUST observe only public Workbench contracts

The soak runner SHALL use only public Workbench HTTP task, event, and receipt
contracts plus public Project events/capabilities, public Task SSE watch, and
the typed read-only Automation event-list contract for opaque approved Task, Project scope, and
Automation binding refs. Until a signed observer-target authority exists, it
MUST use only compose-private `http://api:8787` on the internal network. It MUST NOT call
owner, admin, database, migration, or mutation routes. Its bearer token MUST
be read from a restricted, read-only rotating file below
`/run/workbench-secrets`, re-read before each request, and MUST NOT appear in
arguments, output, structured receipts, or evidence. A missing, unsafe, or
expired token file MUST fail closed rather than reusing a prior credential.

#### Scenario: Runner is configured with a token and task ref
- **WHEN** a staging operator runs the soak command with the exact
compose-private `http://api:8787` diagnostic origin, an opaque task reference,
  and an operator-provided rotating bearer file
- **THEN** the runner MUST make only read requests to public Workbench task,
  event, and receipt paths
- **AND** its emitted receipt MUST contain no token, authorization value,
  private path, owner payload, or raw response body

### Requirement: Staging soak policy MUST fail closed

The soak policy SHALL require an actual wall-clock observation of at least 24
hours, p95 latency of at most 500 ms, p99 latency of at most 1 s, error rate
of at most 1%, availability of at least 99%, error-budget consumption of at
most 10%, zero observation gaps, and zero open P0/P1 incidents. Each required
public surface MUST have at least one sample per fixed one-minute cadence point
across the full window; empty, truncated, paginated, delayed, or missing
samples MUST fail. Policy inputs MUST be fixed in code and MUST NOT accept
short-soak or threshold overrides.

Task SSE reconnects MUST use the last validated event sequence and reject a
replayed sequence. The Automation list probe MUST drain bounded nonempty
`nextCursor` pages using the returned cursor; cursor loops, event duplicates,
gaps, malformed pages, or an exceeded bound MUST fail closed.

An SLO pass MUST require a separately validated redacted incident-evidence
record with explicit zero open P0/P1. It MUST NOT infer incident status from a
zero-value observer counter. The report MUST include the opaque task, complete
scope, and incident-evidence digest; final action receipts and generic outputs
MUST bind exactly to those values and the SLO digest. The Identity rotation
output MUST be the owner receipt schema with `status`, `attempt_id`,
`rotated_at`, `new_key_id`, `previous_key_id`, and `rotation_digest` only.

#### Scenario: Observation is too short
- **WHEN** a receipt contains an observation window shorter than 24 hours
- **THEN** the runner MUST return a non-success verdict with a
  `minimum_duration_not_met` reason
- **AND** it MUST NOT label the result as staging-ready or promotion-ready

#### Scenario: Integrity is uncertain
- **WHEN** received task/event/receipt data is duplicate, unknown, malformed,
  contains an unreconciled `unknown_accept`, or has an observation gap
- **THEN** the runner MUST fail the SLO verdict closed
- **AND** the staging receipt MUST include only a safe reason code and opaque
  correlation ref

### Requirement: Staging SLO and rollback evidence MUST be structured and redacted

The soak runner SHALL emit a versioned SLO report and staging receipt suitable
for collection by the existing evidence runner. The receipt MUST bind its
summary using a digest and report redaction status. A rollback action receipt
MUST prove new mutations are disabled and original attempts are terminal or
remain under original-key reconciliation; invalid, duplicate, unknown, or
unreconciled `unknown_accept` action receipts MUST fail validation.

When `PROJECT_AUTOMATION` is disabled, the mutation fence MUST be enforced at
the shared Automation facade for HTTP, JSON-RPC, and gRPC. It MUST continue to
serve closed read operations, including the typed HTTP POST read methods, and
MUST preserve exact original-idempotency replay/reconciliation while rejecting
every new mutation.

#### Scenario: Automation kill switch preserves read and reconcile paths
- **WHEN** the operator disables `PROJECT_AUTOMATION` during the soak
- **THEN** new create, update, lifecycle, and manual-start mutations MUST fail
  closed on every transport
- **AND** typed binding/run/event reads plus exact original-key replay MUST
  remain available until the capability is restored

Scale, drain, Identity rotation, and rollback SHALL each be represented only
by a redacted local `workbench.project_data_staging_action_status.v1` receipt
with a closed action enum, completed state, opaque action ref, and SHA-256
bindings to its output receipt and SLO receipt. Unknown fields or unsafe
extensions MUST fail validation. Validation MUST NOT execute an action.

A passing staging receipt SHALL require exactly those four action records and
four additional public Project capability records that each prove one of
`PROJECT_WORKSPACE`, `PROJECT_CUSTOM_FIELDS`, `PROJECT_CANVAS`, or
`PROJECT_AUTOMATION` was observed disabled and then restored. Every action and
capability record MUST bind to the final SLO SHA-256. The observer alone MUST
NOT emit a passing staging receipt.

Finalization MUST strictly re-evaluate the serialized SLO invariants, including
window-derived expected sample counts, exact per-contract count, derived error
and availability arithmetic, budget arithmetic, thresholds, and zero-integrity
counters. Every action record's output digest MUST be verified against its
paired strict-redacted local output file. The rollback output MUST be parsed as
the detailed rollback receipt schema; a minimal report or arbitrary digest MUST
NOT create a passing receipt.

#### Scenario: Rollback action is recorded
- **WHEN** an operator supplies a rollback action receipt to the local validator
- **THEN** validation MUST accept only a redacted receipt with a valid action,
  original-attempt reconciliation state, and no open P0/P1
- **AND** validation MUST not execute the rollback, send a request, or grant
  promotion authority
