## Context

Project-data already has local, PostgreSQL, fault, race, and real Owner-canary
entrypoints. Those runs are intentionally shorter than a staging soak and use
an evidence wrapper that writes redacted artifacts under
`temp/integration-test-runs/<run-id>/`. A local CLI test explicitly uses a
compressed observation window and is not staging evidence.

The implementation first provides a reproducible local definition of the
staging environment and a one-shot verifier. A separately authorized execution
phase then applies that definition to the `master1` staging host through the
existing kiki-infra Ansible inventory. Local validation remains local evidence;
only the completed master1 wall-clock run can produce the staging receipt.

## Goals / Non-Goals

**Goals:**

- Define a fixed `nerdctl compose` topology with internal-only service
  networking for Workbench API, worker, migration, PostgreSQL, Identity, the
  existing Eikona canary dependency, an Identity rotation hook, and the soak
  runner.
- Make the soak runner read only Workbench public HTTP contracts and produce
  redacted SLO and staging receipts for the existing evidence collector.
- Bootstrap an empty managed-profile database without private ad-hoc SQL:
  approve exactly one safe Project scope, install its initial ProjectWorkspace
  and server-owned role policy through a disposable one-shot control, then
  create Dataset, WorkItem, Task, and Automation fixture records through public
  Workbench contracts.
- Refresh a short-lived Workbench-audience principal through an Identity-owned,
  listener-free disposable staging control that atomically replaces only the
  restricted token file.
- Fail closed for a duration under 24 hours, unavailable or incomplete
  observation, duplicate/unknown data, unreconciled `unknown_accept`, open
  P0/P1, bad SLO values, or invalid rollback/action receipts.

**Non-Goals:**

- Modifying any pre-existing master1 workload, publishing host ports, writing
  outside the isolated staging root/compose project, or using master1 as a
  production or Provider-promotion target.
- Exposing public owner/admin routes, storing owner payloads or secrets, or
  weakening managed authentication or Project authorization.
- Granting promotion or production authority from a local receipt.

## Decisions

### Fixed internal compose topology

`deploy/staging/compose.yaml` references three exact external network names and
no service publishes `ports`. The authorized kiki-infra start control creates
those names with `nerdctl network create --internal`, verifies their isolated
identity, and owns phased service ordering. The manifest contains no
`depends_on`: the approved nerdctl Compose version does not enforce Docker
Compose health conditions and may recreate completed one-shot dependencies on
a later phase. `identity-db` contains only PostgreSQL, Identity, the read-only
Identity authority sidecar, rotation, and the listener-free principal
init/refresh controls; `workbench-db` isolates Workbench database consumers;
`staging-internal` carries the API, TLS proxy, worker, Eikona, fixture, and soak
paths.
The fixed worker service selects the scheduler role explicitly because the
managed worker assembles exactly one engine role per process; scale and drain
evidence therefore applies to scheduler instances and cannot be confused with
a partial four-role process. The worker contract range is fixed to the source
constant `workbench.workflow.v1alpha1` at both bounds.
The staging worker explicitly enables claim readiness only after the managed
dependency checker, durable registration store, and real scheduler engine
supervisor are attached. The default worker mode remains claim-disabled.
Process health never substitutes for this gate: `/readyz` succeeds only when
dependencies are ready, registration is active, lifecycle has no error, and
the worker is not draining.
PostgreSQL initializes the isolated `identity_disposable_staging` database,
then the source-verified `identity-platformd` daemon runs its migration before
listening. There is no source-proven init-only owner CLI; rotation follows
daemon start and its own source-verified preflight fails closed until schema
exists. The rotation DSN uses `postgres:5432`, `sslmode=verify-full`, and the
mounted `/run/identity-db-tls/ca.crt`; the PostgreSQL certificate has the
`postgres` DNS SAN. Identity is available to Workbench only via a pinned
internal HTTPS proxy. The Identity-owned staging authority sidecar exposes only
read-only typed service-identity and delegation readiness under
`/internal/workbench-authority/*`; it rejects non-disposable database targets,
is candidate-digest-bound, and adds no mutation or management route. The API
uses the mounted CA PEM with normal certificate and hostname verification for
JWKS, and the worker uses the same trust root through its own read-only mount
for authority readiness. A healthy process remains unready while either typed
authority dependency is absent, invalid, or stale. PostgreSQL and the external
Identity/Eikona owner images are supplied through an ignored environment file.
Each superseding candidate uses a new durable worker ID when its source or
artifact digest changes. The previous registration remains diagnostic history;
the runtime override and worker ID are SHA-bound into the new start receipt.
Eikona's private service authenticates even health reads. The start control
therefore mounts the Owner key read-only into a disposable internal probe of
`/api/v1/health` and parses the typed `eikona.health.v1` document. The fixture
and soak runner never receive the Owner key and continue to use only Workbench
contracts.
The one-shot migration, rotation, and soak services have `restart: "no"`. A
Taskfile render gate requires an untracked env file and runs only `nerdctl
compose config`, never pull or launch; a separate render target selects the
rotation profile.

Alternatives considered: host ports would permit external admin/owner traffic;
they are rejected. A second Eikona or Identity implementation would duplicate
the owner boundary; it is rejected in favor of existing dependency image
inputs. Lowering worker readiness to accept health-only staging evidence is
rejected because it would bypass the production managed-authority contract.

### Authorized master1 execution boundary

The live run uses inventory host `master1`, an isolated root below
`/data/ssd0/workbench-project-data-staging-soak-v1`, and a unique compose
project name, with all live runtime operations fixed to the dedicated
containerd namespace `workbench.staging`. Preflight records hostname, capacity,
containerd/nerdctl/BuildKit
versions, existing workloads, listeners, and target-path absence before any
write. No host port is allocated. Build inputs are source snapshots with
recorded Git/tree digests; runtime images are addressed by immutable local
content digests and are not pushed to a shared or remote registry. Ansible may
create only the isolated root, transfer the approved bundle, import/build its
images, launch its compose project, and collect redacted evidence. Failure
leaves the isolated project and evidence intact while disabling new automation
mutation.
The staging release task invokes the same deterministic production builder for
the API, worker, migration, bootstrap, fixture, and soak artifacts. A partial
job-only rebuild is rejected because it can bind one candidate image set to
different source revisions.

The managed API request middleware retains loopback-only defaults and accepts
one additional exact authority only when configured by the server. The
disposable staging authorization pair requires `api:8787`; it does not accept
wildcards or alternate service names. Machine clients may omit browser Origin,
while an Origin-bearing request must match the same scheme and authority.

master1 is a shared control-plane host, so capacity is necessary but not
sufficient authority. Every operation is scoped by the compose project name
and target root, and recovery commands must refuse a path or project-name
mismatch. Existing containers, networks, volumes, listeners, Harbor content,
and system services are out of scope.

The shared `default` containerd namespace is not a live staging surface. A
failed-start repair may remove only this project's exact legacy container,
network, and volume names there, with a hard timeout and absence verification,
then must use only `workbench.staging`. It must not list, repair, restart, or
remove unrelated default-namespace workloads, and it must not restart
containerd.

### Disposable bootstrap and rotating principal

An empty managed Workbench database cannot authorize the first Project
mutation until both the safe ProjectRef and its server-owned role policy exist.
The API therefore accepts an operator-mounted, strict JSON allowlist containing
exactly the staging scope and exposes it only to the existing in-process
`ProjectRefResolver`; the file is not an owner payload and cannot select a
different ref at request time. A listener-free `workbench-project-bootstrap`
one-shot command accepts only the exact compose-private verify-full PostgreSQL
target plus `WORKBENCH_STAGING_BOOTSTRAP_TARGET=disposable-staging`. It installs
the initial ProjectWorkspace and policy for the configured Identity subject
with idempotency digests, writes a redacted receipt, and exits. This bounded
bootstrap is necessary because the role-policy repository intentionally
requires an existing ProjectWorkspace, while the first public ProjectWorkspace
mutation intentionally requires that role policy. Dataset, WorkItem, Task, and
Automation records are then created through authenticated public Workbench
contracts.

The ordinary managed authorization path remains the Identity provider's
`AllowedActions` contract. Only when both the exact restricted Project
allowlist and `WORKBENCH_STAGING_AUTHORIZATION_TARGET=disposable-staging` are
present do Task, WorkItem, and Automation use the already verified
PrincipalContext's fixed action scopes; Project access still requires the
server-owned role policy. The pair is rejected in local profile, when
incomplete, or for any other attestation.

Identity provides a separate listener-free `identity-staging-principal`
control. It reuses the same strict disposable PostgreSQL target validation as
rotation, mints a bounded Workbench-audience PrincipalContext, atomically
replaces a mode-`0600` token file in an operator-mounted directory, writes only
a safe refresh receipt, and exits. A compose-private refresh loop invokes it
before expiry; the soak runner rereads the file on every request. Rotation must
be followed by a refresh and successful JWKS/principal validation using the new
active key. No token, DSN, private key, or raw claims enter command arguments,
logs, receipts, or evidence.

### Read-only public-contract observer

`service/cmd/workbench-project-soak` calls only same-origin public Workbench
read projections for supplied opaque Task, Project scope, and Automation
binding refs: task summary/events/receipts, Project events, Project capability
snapshot, Task SSE watch, and Automation's typed list-events read operation. Automation's
actual HTTP read transport is POST; it has no idempotency or mutation path.
It accepts only the exact compose-private diagnostic `http://api:8787` origin
inside the internal network. It reloads its bearer from a restricted read-only
file before each request, never flags, output, receipt, log, or evidence. The
external Identity issuance contract atomically replaces the mode-`0600` file;
missing or unsafe source material fails closed. It never calls an owner, an
admin listener, a database, or a mutation endpoint.

The observer validates the JSON data it receives: malformed/unknown records,
empty first/repeated Automation pages, truncated, duplicate, or incomplete event/receipt responses,
any `unknown` or `unknown_accept` state, and non-contiguous numeric event
sequences are integrity failures. SSE reconnects from the last validated
sequence. Automation requires a nonempty initial page and drains nonempty
cursor pages; the exact facade terminal page is empty and accepted only after
cursor progression. Cursor loops, duplicates, and gaps fail closed. Every
required surface must have one sample at every
one-minute cadence point for the full window; missing or delayed samples are an
observation gap, not a pass.

The one-shot public fixture creates its draft Automation binding with one
closed, value-free system-field mapping (`field:status` to an opaque workflow
input ref). The Automation domain continues to reject empty mappings; staging
does not receive a relaxed validation path.

The Automation kill switch is enforced in the shared facade so HTTP,
JSON-RPC, and gRPC cannot diverge. Every transport reaches that facade; the
closed handler method set distinguishes typed read operations from mutation
operations without a method-only HTTP shortcut. Exact original-key replay is
evaluated before the new-mutation fence so rollback does not destroy
reconciliation.

Alternatives considered: direct PostgreSQL checks and owner probes could give
stronger low-level diagnostics, but breach the Workbench public-contract and
ownership boundary, so they are rejected.

### Fixed policy and receipts

The policy is code-owned and has no environment or CLI overrides: 24-hour
minimum wall-clock observation, p95 at most 500 ms, p99 at most 1 s, errors at
most 1%, availability at least 99%, error-budget consumption at most 10%, zero
observation gaps, and zero open P0/P1 incidents. The runner emits only
`project-data-staging-slo.v1` JSON to an explicit local output directory. A
local finalization command emits a passing `project-data-staging-receipt.v1`
only after exactly eight redacted operator records bind to the SLO SHA-256:
scale, drain, Identity rotation, rollback, and disabled-then-restored checks
for all four public Project capabilities. Finalization re-evaluates every
serialized arithmetic, threshold, integrity, and exact cadence invariant, and
binds each action receipt hash to its paired strict-redacted output file. The
rollback output must satisfy its detailed reconciliation schema. Both artifacts
contain only opaque refs, timing, counts, policy values, verdict/reasons, and
binding digests.

Independent incident evidence uses a bounded terminal handshake. After the
fixed 24-hour public-read observation ends, the runner waits at most 30 minutes
for an atomic mode-`0600` record at the fixed restricted path. It accepts only
the exact Task/scope, a start no later than the actual observation start, an
end no earlier than the actual observation finish, and an end that has already
occurred when read. This makes real endpoint coverage possible without
future-dating evidence; timeout or any unsafe/mismatched record fails the SLO.

The existing `scripts/test-evidence/run.ts` collects these as structured
artifacts. A staging result is never passed to a promotion target by the
Taskfile; the Taskfile has only validate/plan/execute-local commands.

### Safe rollback action receipt

Rollback is a no-new-mutations plan: disable the canary at its external
allowlist/kill-switch boundary, retain reconciliation until original attempts
are terminal, and record an action receipt. The runner validates the receipt
shape and terminal/reconciliation state before marking it usable. It neither
performs the rollback nor changes any remote state. Scale, drain, Identity
rotation, and rollback each use the fixed redacted action-status receipt schema
with an opaque action ref, exact Task/scope, and output/SLO SHA-256 bindings;
unknown fields are rejected. Incident evidence is independent from observation
counters and must record zero P0/P1 during the observation window. The external
`identity-staging-rotate` command is its own explicit profile and is
operator-recorded during, not before, observation. Its separate Identity-owned
immutable image has that real binary as ENTRYPOINT and receives only
`IDENTITY_PLATFORM_DATABASE_URL`, fixed disposable-staging target, attempt id,
expected-current-key id, and receipt path. Its output must be the raw owner
rotation receipt, never a generic Workbench wrapper. The ordinary Identity
daemon is a required external-owner dependency rather than a profile-gated
reconstructed service configuration.

## Risks / Trade-offs

- [A 24-hour run costs time and needs stable staging dependencies] → The
  runner rejects compressed execution; focused tests inject timestamps into
  policy evaluation instead of simulating a passing soak.
- [Public contract drift breaks observations] → Versioned receipt schema,
  strict JSON validation, and malformed/unknown input failure make drift
  visible rather than silently passing.
- [Runtime configuration could leak secrets] → Image refs and opaque IDs are
  validated; a mode-`0600` rotating bearer file is re-read without persistence
  and all emitted strings are redacted.
- [A compose manifest or runtime network might accidentally expose a service]
  → Static tests reject host ports, unexpected network names, `depends_on`,
  admin/owner path env, unpinned image refs, and missing one-shot hooks; the
  Ansible start control creates every fixed network with `--internal`.

## Migration Plan

1. Build the bounded soak and bootstrap controls and run focused tests plus
   compose/static validation locally.
2. Record a read-only master1 preflight, freeze source/image/config digests, and
   provision the isolated root through kiki-infra Ansible.
3. Run migration, disposable bootstrap, public-contract fixture creation,
   principal refresh, and the 24-hour soak under the evidence wrapper.
4. Collect and independently validate the redacted receipts. This is staging
   evidence only and requires a separate owner decision for any promotion.
5. To roll back, prevent new canary mutations first, keep original attempt
   reconciliation available, then validate the recorded rollback action
   receipt. No replay with a new idempotency key is permitted.

## Open Questions

- The exact image content digests and public fixture refs are generated and
  frozen during the authorized master1 execution; they are not tracked before
  the build/bootstrap receipts exist.
