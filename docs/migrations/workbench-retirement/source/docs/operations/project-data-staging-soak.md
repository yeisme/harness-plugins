# Project-data staging soak

This runbook defines the Workbench half of `workbench-project-data-staging-soak-v1`.
It is a staging evidence gate, not a production action or promotion decision.
The repository tracks the topology and validation contracts, but never tracks
staging credentials, generated image digests, real fixture refs, or a completed
24-hour receipt.

## Local contract checks

These commands do not start containers, pull images, connect to staging, or
generate a real soak receipt:

```bash
task project:data:staging:compose:validate
task project:data:staging:soak:test
task test:project-data-staging-soak:component
```

The component evidence is local/integration evidence only. It is deliberately
not called staging evidence and cannot satisfy the wall-clock gate below.

## Fixed topology and safe configuration

`deploy/staging/compose.yaml` is rendered with `nerdctl compose` in an approved
staging control environment. All live build, image, network, volume, container,
and compose operations are fixed to the dedicated containerd namespace
`workbench.staging`; the shared `default` namespace is not used for the live
stack. The topology references three exact external network names and publishes
no host ports. The kiki-infra start control creates those names
with `nerdctl network create --internal` before starting any service, verifies
their isolated identity, and owns all dependency ordering because the approved
nerdctl Compose version does not enforce Docker Compose health conditions.
The manifest therefore deliberately contains no `depends_on`; adding one would
allow a later phase to recreate a completed one-shot migration or bootstrap.
`identity-db` contains only PostgreSQL, Identity, the read-only staging
authority sidecar, the rotation job, and the two listener-free principal
controls; `workbench-db` isolates Workbench database consumers;
`staging-internal` carries API/proxy/soak traffic. It includes
PostgreSQL, the existing Identity and Eikona
canary dependencies, separately-built Workbench migration/API/worker roles, a
one-shot Identity rotation hook, and the one-shot soak observer. It does not
expose a Workbench admin listener or an Owner route. PostgreSQL creates
`identity_disposable_staging` on first volume initialization. The
source-verified `identity-platformd` daemon opens that DB and runs its own
migration before it opens its listener; no init-only Identity CLI currently
exists. Rotation is scheduled after the daemon is started and its own exact
owner CLI performs a schema preflight before it can mutate a key. Thus a startup
race fails the rotation job closed rather than treating a long-running daemon
as a successful completion dependency. This is an explicit owner
image/entrypoint contract, not reconstructed Identity configuration or a fake
health check. PostgreSQL TLS is mandatory. Its server certificate has DNS SAN
`postgres`; the Identity rotation URL is exactly
`postgres://<user>:<password>@postgres:5432/identity_disposable_staging?sslmode=verify-full&sslrootcert=/run/identity-db-tls/ca.crt`.
The database TLS materials and CA are read-only operator mounts, never tracked.

Identity publishes only behind the pinned `identity-tls` reverse proxy. The
proxy has no host port or admin endpoint, terminates HTTPS for
`identity-tls:8443`, sends `/internal/workbench-authority/*` only to the
Identity-owned `identity-staging-authority` sidecar, and forwards all other
paths only to `identity:8490` on the internal network. The sidecar is read-only,
accepts only the exact disposable staging PostgreSQL target, exposes only typed
service-identity and delegation readiness documents, and is bound to the
candidate digest. It has no mutation or management route. Its fixed issuer,
audience, contract, grant, environment, and service-identity-ref claims are
checked by Workbench before the worker can become ready.

The proxy certificate has the `identity-tls` DNS SAN. Only its CA PEM is mounted
into the Workbench API at `/run/workbench-secrets/identity-ca.pem` and into the
worker at `/run/workbench-authority/identity-ca.pem`; neither process receives
the proxy certificate or private-key directory. Workbench keeps normal TLS and
hostname verification enabled for both the issuer/JWKS origin and authority
readiness probes; plaintext, proxy inheritance, redirects, and skip-verify are
not permitted. API or worker health alone is not staging readiness: both
managed `/readyz` documents must be ready, including worker service-identity and
delegation dependencies, before fixture creation.

The compose worker is explicitly scheduler-only. The managed worker runtime
assembles exactly one engine role per process, and the soak's scale/drain
action applies to that scheduler service. Leaving the role unset would select
the ordinary four-role default and is rejected rather than starting a partial
worker. Its minimum and maximum workflow contract are both fixed to the source
contract `workbench.workflow.v1alpha1`; a shortened alias is not accepted. The
staging service also passes explicit `--claim-enabled`. That gate is accepted
only when a managed dependency checker, durable registration store, and real
engine supervisor are all attached. Without it, `/healthz` remains useful but
`/readyz` truthfully returns `claim_disabled`; with it, `/readyz` returns 200
only after dependency readiness, worker registration, and non-draining engine
state converge.

Start from `deploy/staging/.env.example`, copy it to an untracked runtime-only
location, and replace every image reference with its approved immutable digest.
The example intentionally omits database credentials and the soak bearer token.
Inject those only through the approved staging secret mechanism. Never put them
in a Taskfile variable, command line, compose file, receipt, evidence artifact,
shell transcript, or this repository.

The allowed static render is:

```bash
task project:data:staging:compose:render STAGING_ENV=/approved/runtime/workbench-staging.env
```

This runbook does not authorize `nerdctl compose up`, image pulls, migrations,
or any remote environment operation. Those require separate staging operator
approval.

Live provision is limited to inventory host `master1`, isolated root
`/data/ssd0/workbench-project-data-staging-soak-v1`, and compose project
`workbench-project-data-staging-soak-v1`, inside containerd namespace
`workbench.staging`. Runtime images must be pinned by content digest. TLS and
secrets are generated outside Git. The staging build entrypoint invokes the
same deterministic release builder for API, worker, migration, bootstrap,
fixture, and soak artifacts; a job-only partial rebuild is not accepted. Local
validation does not launch Ansible:

```bash
task project:data:staging:provision:validate \
  PROVISION_IDENTITY=<redacted-local-file> \
  OBSERVED_HOST=master1 \
  OBSERVED_ROOT=/data/ssd0/workbench-project-data-staging-soak-v1 \
  OBSERVED_PROJECT=workbench-project-data-staging-soak-v1 \
  RUNTIME_MATERIAL=/run/operator-managed/identity-https-tls \
  GIT_ROOT="$PWD"
```

`validate-provision` does not create the root, import images, or modify an
existing container, network, volume, listener, or Harbor object. A host, root,
or compose-project mismatch fails closed.

A 4.5 observation may start only from a redacted start receipt bound to the
existing public fixture. The receipt must name a fresh candidate and worker
ID, record that the previous window was superseded, and prove zero host ports,
zero restart counts, and that the fixture was not replayed. Local validation
does not start the 24-hour runner:

```bash
task project:data:staging:start:validate \
  START_RECEIPT=<redacted-local-file> \
  FIXTURE_RECEIPT=<existing-fixture-receipt>
./dist/workbench-project-soak validate-start \
  --receipt <redacted-local-file> \
  --fixture-receipt <existing-fixture-receipt>
```

The soak `run` command requires both the existing fixture receipt and that
fresh start receipt. Compose observation starts only with
`--fixture-receipt /evidence/workbench-project-fixture.json` and
`--start-receipt /evidence/staging-start.json`. A fixture-only soak start is rejected.
Local validation still does not launch the 24-hour runner.

On the approved host, the shared `default` containerd namespace may contain
unrelated workloads and is not a staging execution surface. Failed-start repair
may perform only exact-name, hard-timeout removal of this compose project's
legacy default-namespace resources, then MUST operate exclusively in
`workbench.staging`. It never lists, repairs, restarts, or removes unrelated
default-namespace workloads or the containerd service.

The render target requires the given env file to be untracked. A temporary
non-secret placeholder env can render the topology for local contract proof;
it must still provide every compose interpolation value, but is never a
credential source and never starts or pulls a container.

The checked-in Workbench Dockerfile has separate `api`, `worker`, `migration`,
`project-soak`, and `project-bootstrap` targets, each supplied by a
corresponding immutable image variable. The soak never assumes the API or
worker image contains its binary. The release helper writes the soak binary at
`dist/release/bin/workbench-project-soak`, matching the `project-soak` target.
Workbench command arguments follow the checked-in entrypoints: migration
receives its database URL through `WORKBENCH_DATABASE_URL`; the worker receives
its managed config through `WORKBENCH_*` environment inputs.

Empty managed staging is initialized without an HTTP bootstrap or owner route.
`workbench-project-bootstrap` is a listener-free one-shot that accepts only the
compose-private verify-full Workbench PostgreSQL target and
`WORKBENCH_STAGING_BOOTSTRAP_TARGET=disposable-staging`. It loads the
operator-mounted ProjectRef allowlist, installs the approved subject/scope
role policy idempotently, writes a redacted receipt, and exits. The managed
API pairs that same allowlist with the disposable-staging attestation and
cannot select a different Project scope at request time. It also fixes the
managed HTTP request authority to `api:8787`; service clients may omit the
browser `Origin` header, while any supplied browser Origin must still match
that exact authority and scheme.

Identity mints the short-lived Workbench-audience principal through the
external `identity-staging-principal` image. Workbench binds only
`--audience workbench`, `--token-file /run/workbench-secrets/bearer-token`,
and `--receipt-path`. The command is listener-free, uses the same
`disposable-staging` target validation as rotation, atomically replaces the
mode-`0600` token file, and emits only a redacted refresh receipt. The token,
DSN, private key, and raw claims never appear in arguments, logs, receipts,
or evidence.

Empty-database initialization after migration is the authorized 4.4 sequence,
not a 24-hour soak. On the isolated compose project, `workbench-project-bootstrap`
installs the approved subject/scope policy, Identity writes the restricted
bearer file, then `workbench-project-fixture` proves internal readiness and
creates Dataset, WorkItem, Automation, and Task records only through
authenticated public Workbench contracts with fixed idempotency keys. The
fixture probes compose-private `http://api:8787/readyz`,
and `http://worker:8789/readyz`. The authorized start control separately mounts
the Eikona-owned key read-only into a disposable internal probe, calls
`http://eikona-canary:8080/api/v1/health`, and structurally requires the
`eikona.health.v1` document to report service `eikona` and status `ready`.
The Owner key is not passed to the fixture or soak runner and never appears in
host arguments, logs, or evidence.
Managed API `/readyz` already includes the Identity JWKS probe. Those probes
use no host-published port, owner route, admin metrics path, or database URL.
A phased start also parses the direct internal Identity JWKS document and
requires at least one complete `OKP`/`EdDSA` signing key before starting the
authority sidecar; HTTP 200 with an empty key set is not readiness.
A redacted fixture receipt is the 4.4 output; it is not a staging soak receipt
and does not grant promotion.

### R5 retention setup remediation (candidate preparation only)

The original fixture remains immutable. Before a fresh R5 observation window,
the profile-gated `identity-principal-setup` and `retention-setup` one-shots
may be explicitly invoked by the later operator gate; they are not part of the
ordinary fixture path. The first mints the fixed
`workbench-project-soak-setup` principal only for Board create/read, Workflow
execute, Automation write, and WorkItem read. It writes the separate restricted
`/run/workbench-secrets/retention-setup-token` and the redacted
`/evidence/identity-principal-retention-setup.json` receipt.

The second uses only `http://api:8787` public Workbench contracts. It loads the
existing `/evidence/workbench-project-fixture.json`, creates the idempotent
Board and bounded no-owner-side-effect Workflow, replaces the fixture draft's
synthetic pin through the Automation API, validates/enables it, starts it once
for the existing WorkItem with CAS/idempotency, and requires a nonempty run
projection. It writes only the strict redacted
`workbench.project_data_staging_retention_setup.v1` receipt at
`/evidence/workbench-project-retention-setup.json`. It does not create a
Dataset, WorkItem, Task, or fixture binding, replay an unknown acceptance, or
establish a staging-success claim.

## Real staging execution boundary

The soak observer uses only these public Workbench read contracts for one
opaque approved task ref and approved Project scope:

- `GET /v1alpha1/tasks/{taskRef}`
- `GET /v1alpha1/tasks/{taskRef}/events?after_sequence=0&page_size=100`
- `GET /v1alpha1/tasks/{taskRef}/events/watch?after_sequence=<last validated sequence>`
  (the public Task SSE watch contract, with at least one validated event per
  cadence probe)
- `GET /v1alpha1/receipts?task_id={taskRef}`
- `GET /v1alpha1/project/events` with the public Project scope and cursor
- `POST /v1alpha1/projectautomation/ListAutomationEvents` with its typed
  read-only list payload (the actual Automation HTTP read contract is POST)
- `GET /v1alpha1/project/capabilities`

Until signed observer-target authority is introduced, it uses only the exact
compose-private diagnostic `http://api:8787` origin; external public HTTPS is
not an accepted observer target;
it has no host-published port. The observer never calls owner, admin, database,
migration, reconcile, or mutation endpoints. The Automation POST is a public
typed list projection and has no idempotency or mutation path. The observer
drains bounded cursor pages until `nextCursor` is empty; repeated cursors,
sequence gaps, malformed pages, or a page bound are failures. On each cadence
reconnect, SSE resumes from the last validated sequence and rejects replayed
events.

The observer reloads the restricted bearer file
`/run/workbench-secrets/bearer-token` before every request. The only accepted
source is the read-only operator-mounted directory supplied by
`WORKBENCH_STAGING_SOAK_TOKEN_DIR`; the external Identity issuance/rotation
process atomically replaces that file with a mode-`0600` token. The observer
does not persist, print, or include the token in artifacts. A missing, unsafe,
expired, or unreadable file fails the current observation closed rather than
reusing a stale credential.

The required `--incident-evidence` file is a strict redacted, operator-recorded
`workbench.project_data_staging_incident_evidence.v2` record. It contains safe
operator/evidence refs plus `task_ref`, normalized full `scope`,
`observation_started_at`, `observation_finished_at`, and an explicit zero
`open_p0_p1` result. The declared evidence window must cover the entire actual
SLO window: evidence start is at or before soak start, and evidence finish is
at or after soak finish. A wider coverage window is valid; another task/scope
or either coverage gap fails closed. The observer does not infer this result
from its own zero-value counters; absent or invalid independent evidence makes
the SLO fail. After the 24-hour read-only observation finishes, the runner
waits for at most 30 fixed minutes for an operator to atomically write the
exact mode-`0600` file at
`/run/workbench-secrets/incident-evidence.json`. The record's finish time must
already have occurred when it is read; future-dated evidence is rejected. This
bounded terminal handshake lets independent evidence cover the real endpoint
without predicting it. A missing, unsafe, mismatched, early-ending, or late
record still produces a failed SLO report.

There is no duration flag and no policy override. A real result must observe at
least 24 wall-clock hours and meet all fixed limits:

| Gate | Required result |
| --- | --- |
| p95 latency | at most 500 ms |
| p99 latency | at most 1 s |
| errors | at most 1% |
| availability | at least 99% |
| error-budget consumption | at most 10% |
| observation gaps | 0 |
| duplicate or unknown data | 0 |
| unreconciled `unknown_accept` | 0 |
| open P0/P1 | 0 |

Any short window, interrupted run, malformed response, duplicated event or
receipt, sequence gap, unknown state, unreconciled `unknown_accept`, or failed
metric is a failed result. It is never retried as a replacement mutation.
The report also requires a sample for every listed contract at every one-minute
cadence point over the full 24 hours. Missing, delayed, duplicate, empty,
truncated, paginated, or resync-required observations fail closed. Latency
percentiles are recorded in microseconds, avoiding millisecond truncation.

## Receipts and evidence collection

On completion, the observer writes only the redacted SLO report to its explicit
local output directory. It does not create a passing staging receipt:

- `project-data-staging-slo.json` (`workbench.project_data_staging_slo.v3`,
  mandatory `scenario: "project-data"`)

The final `project-data-staging-receipt.json`
(`workbench.project_data_staging_receipt.v3`, mandatory
`scenario: "project-data"`) is created only by the local
finalization command after all operator records have been supplied:

The v3 SLO is bound to SHA-256 digests of the exact fixture and superseding
start receipts, plus the start receipt's candidate ID, worker ID, and source
digest. The observer validates those records and its pre-existing absolute
artifact root before any request. On Linux, every authoritative local input is
opened with `O_NOFOLLOW` and checked on the same descriptor as a single-link,
owner-controlled mode-0600 regular file; symlinks, hard links, FIFOs,
oversized records, duplicate or case-drifted JSON fields, cross-root paths,
and pre-existing output destinations fail closed. Artifact writes are atomic
new-file-only writes and scan their redacted payload before publication. These
checks are local custody checks, not authority to start the soak or promote it.
Until a separately approved signed observer-target and CA authority exists,
the observer accepts only the exact compose-private diagnostic origin
`http://api:8787`; arbitrary HTTPS origins, redirects, credentials in URLs,
and external staging endpoints are rejected before the token is read. This is
diagnostic-only local evidence and is not staging or production acceptance.

```bash
task project:data:staging:finalize \
  TASK_REF=<opaque-task-ref> \
  SLO_REPORT=<local-output>/project-data-staging-slo.json \
  ACTION_RECEIPTS=<eight-comma-separated-redacted-local-files> \
  ACTION_OUTPUT_FILES=<eight-comma-separated-strict-redacted-output-files> \
  OUTPUT_DIR=<local-output>
```

It requires exactly these distinct records, each with the SLO report SHA-256:

- `scale_workers`, `drain_workers`, `identity_rotation`, and `rollback`;
- `verify_workspace_kill_switch`, `verify_custom_fields_kill_switch`,
  `verify_canvas_kill_switch`, and `verify_automation_kill_switch`.

Each capability verification record must name its public capability ID and
prove an operator-recorded disabled observation followed by restoration. The
finalizer performs no mutation, admin call, Owner call, or network request;
missing, duplicate, mismatched, unknown, or unbound records fail closed.
It strictly re-evaluates every serialized SLO invariant, including exact
cadence sample counts and metric arithmetic. Each action receipt's output hash
must match its paired strict-redacted local output file. The rollback output is
parsed as the detailed rollback schema, including new-mutation disablement and
original-attempt reconciliation; a minimal pass report or arbitrary hash is not
sufficient.

The incident-evidence record must reproduce the original opaque Task and
normalized full Project/Automation scope with explicit zero open P0/P1. Its
declared coverage window must contain the entire SLO observation window; exact
matching is not required. The SLO report carries that validated record and its
digest. Every action status receipt and each generic action output must
reproduce that exact Task/scope/SLO hash. The raw Identity rotation
output is the source-owned
`{status,attempt_id,rotated_at,new_key_id,previous_key_id,rotation_digest}`
receipt instead: the finalizer strictly parses this exact field set and binds
its byte hash through the scope-bound action status receipt. Its `attempt_id`
must equal the opaque attempt ID authorized at soak start, and `rotated_at` must
fall inside that same SLO observation window.

The receipt binds the SLO report and every action record with SHA-256 and
contains only opaque task references, counts, timings, reason codes, and
redaction status. Every action status record, generic action output, and
rollback record is likewise v2 and must repeat `scenario: "project-data"`.
Versions 1 and 2 artifacts remain historical read-only records: the v3 finalizer and
current release gate reject them, and they cannot close a current gate. The existing
evidence runner collects them from an approved local staging execution:

```bash
bun scripts/test-evidence/run.ts --layer system --environment staging \
  --project client/yeisme-workbench \
  --collect-structured-artifact <local-output>/project-data-staging-slo.json \
  --collect-structured-artifact <local-output>/project-data-staging-receipt.json \
  -- <approved one-shot staging soak command>
```

Do not place tokens, URLs with credentials, raw Workbench responses, owner
payloads, private paths, or the real command in evidence. The evidence runner
rejects structured artifacts containing sensitive fields.

## Rollback receipt validation

Rollback starts by stopping new canary mutations at the approved external
allowlist/kill-switch boundary. Existing attempts remain terminal or under
reconciliation with their original idempotency key. Do not replay an unknown
attempt and do not switch owner/channel.

An operator records a redacted rollback action receipt with schema
`workbench.project_data_staging_rollback_action.v2`, mandatory
`scenario: "project-data"`, action
`disable_new_mutations`, the new-mutation state, original-attempt safe refs,
their terminal/original-key-reconciliation status, and open P0/P1 count. Local
validation only checks that record; it does not execute rollback:

```bash
task project:data:staging:rollback:validate ROLLBACK_RECEIPT=<redacted-local-file>
```

An invalid receipt, duplicated attempt ref, unknown status, unreconciled
`unknown_accept`, active new mutations, nonzero P0/P1, or failed redaction is
rejected. A valid receipt is operational evidence only and does not grant
promotion or production authority.

## Operator-recorded actions during a soak

Scaling, drain, Identity rotation, and rollback are not performed by this
repository. The operator supplies one redacted local action-status receipt per
recorded action and validates it without a network call:

```bash
./dist/workbench-project-soak validate-action --receipt <redacted-local-file>
```

The fixed `workbench.project_data_staging_action_status.v2` schema requires
`scenario: "project-data"` and permits
only `scale_workers`, `drain_workers`, `identity_rotation`, or `rollback`;
requires completed status, an opaque action ref, SHA-256 bindings to both the
action output receipt and SLO receipt, the exact opaque Task ref and complete
scope from that SLO receipt, zero open P0/P1, and fixed redaction.
Unknown fields (including tokens, owner payloads, paths, or arbitrary
extensions) are rejected.

`identity-staging-principal` is the matching Identity-owner image command.
The initial one-shot creates the restricted rotating bearer file. The ordinary
`identity-principal-refresh` service then runs the Identity-owned listener-free
refresh loop with the same config and token paths; it is not profile-gated.
Workbench does not implement Identity minting.

The public fixture's Automation draft uses one value-free system-field mapping
from `field:status` to `input:work-item-status`. Empty mappings are invalid by
the ordinary Automation contract and are not accepted specially for staging.

`PROJECT_AUTOMATION=false` fences new Automation mutations in the shared
facade, covering HTTP, JSON-RPC, and gRPC. Typed read-only POST methods such as
`ListAutomationEvents` and exact original-idempotency replay/reconciliation
still reach that facade and remain available. This is required for rollback
evidence and is not equivalent to making the entire Automation surface
unavailable.

`identity-staging-rotate` is an external Identity-owner image command under
the explicit `identity-rotation` compose profile. The separate pinned
`WORKBENCH_STAGING_IDENTITY_ROTATION_IMAGE` must be the Identity release
artifact whose image `ENTRYPOINT` is that actual binary; Workbench does not add
a wrapper. Its published runtime inputs are
`IDENTITY_PLATFORM_DATABASE_URL`,
`IDENTITY_PLATFORM_ROTATION_TARGET=disposable-staging`, `--attempt-id`,
`--expected-current-key-id`, and `--receipt-path`. The database URL remains an
execution-only secret and is absent from the example. The ordinary `identity`
service is the required external-owner daemon dependency with an
operator-provided immutable command/configuration contract, not a generic
`IDENTITY_MODE` process. Its output is the raw Identity-owner receipt only:
`status`, `attempt_id`, `rotated_at`, `new_key_id`, `previous_key_id`, and
`rotation_digest`; Workbench does not wrap or extend it.

The soak command independently receives the same opaque
`--identity-rotation-attempt-id` at run start. This authorizes only that raw
owner receipt for the run; a historical receipt, a receipt for another attempt,
or one outside the SLO window fails local finalization.

There is no fabricated Identity health endpoint. The identity daemon initializes
its schema before listening; rotation is ordered after that daemon starts and
independently rejects an unavailable schema. It is deliberately not a dependency
of the soak service. During an approved soak, the operator starts it after
observation is already running and records its output receipt; the local
validator can then validate that recorded action only.
