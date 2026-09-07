# master1 24h staging soak restart operator pack (r6)

Scope: one complete re-run of the `workbench-project-data-staging-soak-v1` 24h
staging soak (tasks 4.5/4.6) on inventory host `master1`, after the r5 window
was voided. This pack is an execution checklist for the credentialed staging
operator on the approved control machine. It does not by itself authorize any
staging operation; every live step still requires the standing staging
operator approval, and nothing here may be executed from a browser or by
editing owner state.

Why r5 is void (do not resurrect it):

- Worker `worker:project-data-staging:r5-attempt17` started observation at
  `2026-08-26T17:19:50.458956257Z`; the fixed 30-minute terminal handshake
  window opened at ≈ `2026-08-27T17:20:50Z` and was missed.
- The source tree changed after the r5 candidate was frozen, so the frozen
  source/config/image digest no longer matches the candidate.
- The user has explicitly authorized re-opening one full, uncompressed 24h
  window. A shortened or compressed window remains invalid.

Authoritative references (do not restate or weaken them here):

- `openspec/changes/workbench-project-data-staging-soak-v1/details/master1-24h-soak-execution-runbook.md`
  — execution checklist; its §5 is the supersede/restart path this pack
  operationalizes.
- `docs/operations/project-data-staging-soak.md` — topology, fixed SLO gates,
  receipt schemas, redaction rules, execution boundary.
- `deploy/staging/compose.yaml` and `deploy/staging/.env.example` — pinned
  topology and safe configuration template.
- Retained r5 pre-terminal artifacts:
  `temp/project-data-staging-soak-r5-preterminal-20260826/`.

Machine legend used on every command below:

- **[local]** — this repository checkout on the development machine.
- **[control]** — the approved kiki-infra control machine (Ansible + nerdctl,
  holds the master1 credentials).
- **[master1]** — executed on the soak host itself (via the control machine).

Fixed identifiers for the r6 run:

- Host: `master1` (10.10.1.201); containerd namespace: `workbench.staging`
  (never the shared `default` namespace except exact-name, hard-timeout
  legacy cleanup of this compose project's own resources).
- Isolated root: `/data/ssd0/workbench-project-data-staging-soak-v1`;
  compose project: `workbench-project-data-staging-soak-v1`.
- New candidate: `candidate:r6:<candidate-images-sha256>`; new durable worker
  ID: `worker:project-data-staging:r6-attempt<N>` (fresh; must not equal any
  previous candidate or worker ref).
- New run-authorized Identity rotation attempt ref, e.g.
  `attempt_workbench_project_soak_r6_<yyyymmdd>`; it is injected only through
  `WORKBENCH_STAGING_IDENTITY_ROTATION_ATTEMPT_ID` in the untracked runtime
  env, never into Git.

## 0. Operational prerequisites

Honest boundary statement: this development machine holds **no** master1
credentials. Every step below marked [control] or [master1] is executed by
the credentialed operator from the approved kiki-infra control machine
(Ansible inventory + nerdctl against `workbench.staging`). [local] steps are
static or receipt-validation only and never touch staging.

Before any staging contact, run every local gate and record exact output;
any failure stops the run before staging contact:

```bash
# [local]
openspec validate --all --strict
buf lint
CGO_ENABLED=0 go test ./service/internal/projectsoak ./service/cmd/workbench-project-soak \
  ./service/internal/stagingcontrol ./service/cmd/workbench-project-bootstrap \
  ./service/cmd/workbench-project-fixture -count=1
task project:data:staging:compose:validate          # static only; no pull/start
task project:data:staging:soak:test                 # local policy/observer/redaction gates
```

Confirm on the control machine before proceeding (fail-closed: any anomaly
aborts; do not repair or restart anything from this pack):

- Host identity resolves to inventory host `master1` (10.10.1.201) and UTC
  clock skew is within tolerance. Note: the r5 binding artifact recorded the
  hostname string `qianxi-master-1`; the contract constant is `master1`
  (`service/internal/stagingcontrol`). Treat them as the same inventory node
  only after the operator confirms the alias in the kiki-infra inventory.
- Ansible and nerdctl are available on the control machine; containerd,
  nerdctl, and BuildKit versions on master1 are the approved ones.
- All live resources exist only in namespace `workbench.staging`:
  `nerdctl --namespace workbench.staging ps -a`. Unrelated `default`
  -namespace workloads are left untouched.

## 1. Retention surface confirmation (no deletion, no fixture replay)

The r5 supersede path keeps the database and the immutable fixture. Verify
retention at the command level; do not create, migrate, or mutate anything in
this section.

1. [control→master1] Confirm the isolated root and database volumes still
   exist and are bound to the approved compose project:

   ```bash
   nerdctl --namespace workbench.staging volume ls
   nerdctl --namespace workbench.staging ps -a --filter name=workbench-project-data-staging-soak-v1
   ```

   Fail-closed: a missing PostgreSQL volume or a root bound to a different
   compose project aborts the run. Never delete the database or reinitialize
   a volume from this pack.

2. [local] Confirm the retained fixture receipt and r5 start artifacts are
   present and untouched:

   ```bash
   ls temp/project-data-staging-soak-r5-preterminal-20260826/
   # expected: workbench-project-fixture.json, staging-start.json,
   # staging-start-binding-r5.json, scale/drain/rotation/kill-switch raw
   # records, rollback-action-r5.json, project-data-staging-slo.json,
   # finalization-r5.next/
   ```

   Note: `finalization-r5.next/project-data-staging-receipt.json` is a
   **pre-terminal simulation** receipt (`incident_evidence_ref`:
   `incident:project-data-staging:r5-preterminal-simulation`, created
   `2026-08-26T18:38Z`). It is not a valid 24h staging receipt and must never
   be cited as one.

3. Fixture mutation replay is forbidden: do not start the `fixture`,
   `bootstrap`, `retention-setup`, or `identity-principal-setup` compose
   services again. The r6 start receipt must carry `fixture_replayed: false`,
   and `validate-start` enforces it against the retained fixture receipt.

## 2. New candidate r6 start sequence

Each step lists its machine and its fail-closed abort condition.

### 2.1 Freeze the candidate [local]

- Ensure the tracked tree is exactly the intended candidate; record the
  SHA-256 source digest (64 hex chars) that the kiki-infra start control
  computes over the frozen tree, plus the config digest and every image
  digest. From this point until the 24h window closes, no tracked source,
  test, fixture, or config may change — a changed tree voids r6 the same way
  it voided r5.
- Build the release artifacts with the deterministic builder (this is also a
  dependency of the soak test target):

  ```bash
  # [local]
  task build:release:project-data-staging-soak   # writes dist/release/bin/...
  test -x dist/release/bin/workbench-project-soak
  ```

  Fail-closed: a dirty tree after freeze, or any digest mismatch against the
  recorded freeze, aborts before staging contact.

### 2.2 Validate the provision identity for the existing root [control]

The Taskfile target does not expose `--root-exists`/`--bound-project`; for a
restart against the already-provisioned root, run the CLI directly so the
existing-root binding is explicitly checked:

```bash
# [control] (from a checkout of this repository)
./dist/workbench-project-soak validate-provision \
  --identity <redacted-provision-identity.json> \
  --observed-host master1 \
  --observed-root /data/ssd0/workbench-project-data-staging-soak-v1 \
  --observed-project workbench-project-data-staging-soak-v1 \
  --root-exists \
  --bound-project workbench-project-data-staging-soak-v1 \
  --runtime-material /run/operator-managed/identity-https-tls \
  --git-root "$PWD"
# expected stdout shape:
# project-data staging provision identity=valid host=master1 project=workbench-project-data-staging-soak-v1
```

Fail-closed: any host/root/project mismatch, an unsafe runtime-material path,
or a rejected action exits nonzero — abort. `validate-provision` never
creates the root, imports images, or modifies an existing container, network,
volume, listener, or Harbor object.

### 2.3 Render and start the r6 stack [control]

- Render the topology with the untracked runtime env (all image references
  replaced by approved immutable digests; credentials only through the
  approved secret mechanism):

  ```bash
  # [control]
  task project:data:staging:compose:render STAGING_ENV=/approved/runtime/workbench-staging.env
  task project:data:staging:compose:rotation:render STAGING_ENV=/approved/runtime/workbench-staging.env
  task project:data:staging:compose:principal:render STAGING_ENV=/approved/runtime/workbench-staging.env
  ```

- Start the stack through the approved kiki-infra start control in namespace
  `workbench.staging`, with a fresh `WORKBENCH_STAGING_IDENTITY_ROTATION_ATTEMPT_ID`
  for r6. The retained database and fixture are reused; migration is the
  ordinary one-shot and the `fixture`/`retention-setup` services are **not**
  started again.
- Start the soak observer only with the compose-pinned command shape (from
  `deploy/staging/compose.yaml`, service `soak`):

  ```
  run --base-url http://api:8787 \
      --fixture-receipt /evidence/workbench-project-fixture.json \
      --start-receipt /evidence/staging-start.json \
      --identity-rotation-attempt-id ${WORKBENCH_STAGING_IDENTITY_ROTATION_ATTEMPT_ID} \
      --output-dir /evidence \
      --token-file /run/workbench-secrets/bearer-token \
      --incident-evidence /run/workbench-secrets/incident-evidence.json
  ```

  There is no duration flag and no policy override; a fixture-only soak start
  is rejected.

  Fail-closed: any host-published port, any `default`-namespace resource for
  this project, or a missing long-running service aborts before the
  observation is considered started.

### 2.4 Record and validate the r6 start receipt [control, validated local]

The start control records a redacted
`workbench.project_data_staging_start.v1` receipt (mode `0600`, ≤64 KiB,
absolute path). Required field semantics (enforced by
`projectsoak.ValidateStartReceipt`):

- `candidate_id`: fresh `candidate:r6:<…>`; `worker_id`: fresh durable
  `worker:project-data-staging:r6-attempt<N>`; `source_digest`: 64-hex freeze
  digest.
- `compose_project`: `workbench-project-data-staging-soak-v1`.
- `fixture_task_ref` and `scope`: byte-identical to the retained
  `workbench-project-fixture.json` (task ref
  `a048fd98-0577-4f1b-a44b-e04477cd6914`).
- `previous_candidate_id`:
  `candidate:r5:bec333755f480ee09dd43bda095b51bd23cc71f89e689e264fb59ba2c39a7587`
  (from the r5 start receipt); `superseded_window: true`.
- `fixture_replayed: false`, `host_ports: 0`, `restart_counts: 0` — the
  zero-port/zero-restart proof of the fresh stack.
- `long_running_services >= 9`, `completed_jobs >= 4`; `started_at` set;
  `redaction: {status: verified, policy: safe_refs_and_metrics_only}`.

Validate locally without starting anything:

```bash
# [local]
task project:data:staging:start:validate \
  START_RECEIPT=<redacted-local-start-receipt.json> \
  FIXTURE_RECEIPT=temp/project-data-staging-soak-r5-preterminal-20260826/workbench-project-fixture.json
# equivalent CLI form:
./dist/workbench-project-soak validate-start \
  --receipt <redacted-local-start-receipt.json> \
  --fixture-receipt temp/project-data-staging-soak-r5-preterminal-20260826/workbench-project-fixture.json
# expected stdout shape:
# project-data staging start receipt=valid fixture_replayed=false host_ports=0
```

Fail-closed: a receipt that is not bound to the existing fixture, does not
supersede r5, reuses the r5 candidate/worker ref, or shows any host port,
restart, or fixture replay is rejected — abort and re-provision; never edit
the receipt to pass.

Record the observation wall-clock start (the soak container's actual start,
per the start binding artifact). The earliest valid terminal evidence
invocation is exactly 24h later; see §4.

## 3. 24h observation discipline

- The window is wall-clock and may not be compressed, paused, or shortened.
  The authorized restart is one full 24h window, same as the original gate.
- The `identity-principal-refresh` service keeps the short-lived
  Workbench-audience bearer fresh by atomically replacing the mode-`0600`
  `/run/workbench-secrets/bearer-token` file; the observer reloads it before
  every request and fails closed on a missing, unsafe, or expired file. The
  operator confirms the refresh loop stays live [control→master1] but never
  handles the token itself.
- The operator records the eight required action records during the window
  (each later bound by SHA-256 to the final SLO report):
  `scale_workers`, `drain_workers`, `identity_rotation`,
  `rollback`, `verify_workspace_kill_switch`,
  `verify_custom_fields_kill_switch`, `verify_canvas_kill_switch`,
  `verify_automation_kill_switch`.
  - `identity_rotation` runs after observation is already running; its raw
    owner receipt `{status,attempt_id,rotated_at,new_key_id,previous_key_id,rotation_digest}`
    must carry the run-authorized r6 attempt ref, with `rotated_at` inside
    the SLO window. (r5 example timing: rotated ~7 minutes after soak start.)
  - The four kill-switch verifications each prove an operator-recorded
    disabled observation followed by restoration, naming the public
    capability ID.
  - `rollback` evidence follows the approved allowlist/kill-switch boundary
    (`PROJECT_AUTOMATION=false` fences new Automation mutations; typed
    read-only POSTs and original-idempotency replay remain available). Never
    replay an unknown attempt or switch owner/channel.
- Each recorded action receipt is validated locally with no network call:

  ```bash
  # [local]
  ./dist/workbench-project-soak validate-action --receipt <redacted-local-file>
  # or: task project:data:staging:action:validate ACTION_RECEIPT=<redacted-local-file>
  # rollback receipts additionally:
  task project:data:staging:rollback:validate ROLLBACK_RECEIPT=<redacted-local-file>
  ```

  Fail-closed: an invalid, duplicate, unknown, foreign, or historical record
  (including a rotation receipt for the r5 attempt
  `attempt_workbench_project_soak_r5_20260826`) is a failed result and is
  never retried as a replacement mutation.
- Any failed SLO gate, observation gap, sequence gap, duplicated/unknown
  data, unreconciled `unknown_accept`, restart count, or tree change during
  the window voids r6; the only path is another explicitly authorized
  restart from §1.

## 4. Terminal handshake (fixed 30-minute window)

The 30-minute terminal handshake opens 24 wall-clock hours after the recorded
r6 observation start. Within it, the operator records the three-piece set
[control→master1]:

1. Incident evidence: atomically write the mode-`0600`
   `workbench.project_data_staging_incident_evidence.v2` record at
   `/run/workbench-secrets/incident-evidence.json` on the soak service mount.
   It must reproduce the exact fixture task ref and normalized full scope,
   declare a coverage window containing the entire SLO window (wider is
   valid), be already finished (not future-dated), and record explicit zero
   open P0/P1. A missing, unsafe, mismatched, early-ending, or late record
   yields a failed SLO report.
2. Identity rotation: confirm the raw owner receipt for the r6 attempt ref is
   the one recorded in §3, with `rotated_at` inside the SLO window.
3. Copy the observer's redacted `project-data-staging-slo.json`
   (`workbench.project_data_staging_slo.v1`) from its evidence output
   directory back to the local machine. The observer never creates a passing
   staging receipt by itself.

Expected soak stdout shape on completion:

```
project-data staging soak verdict=pass slo_sha256=<64-hex> final_action_evidence_required=true
```

Fail-closed: `verdict=fail`, a missing handshake piece, or any evidence
written after the 30-minute deadline is a failed run; do not modify and
re-read evidence to manufacture coverage.

Return path: the SLO report, the eight action status receipts, and the eight
paired strict-redacted action output files are copied back to this repository
checkout under an untracked local output directory (e.g.
`temp/project-data-staging-soak-r6-final-<date>/`, git-ignored). No tokens,
DSNs, private paths, raw payloads, or unredacted command lines may travel.

## 5. Local closeout handoff

Finalize locally (fail-closed; the finalizer performs no mutation, admin
call, owner call, or network request) per runbook §3:

```bash
# [local]
task project:data:staging:finalize \
  TASK_REF=a048fd98-0577-4f1b-a44b-e04477cd6914 \
  SLO_REPORT=<local-output>/project-data-staging-slo.json \
  ACTION_RECEIPTS=<eight-comma-separated-redacted-local-files> \
  ACTION_OUTPUT_FILES=<eight-comma-separated-strict-redacted-output-files> \
  OUTPUT_DIR=<local-output>
# expected stdout shape:
# project-data staging receipt verdict=pass slo_sha256=<64-hex>
```

Missing, duplicate, mismatched, unknown, or unbound records fail closed; the
rollback output must parse as the detailed rollback schema, and every action
output hash must match its paired strict-redacted file. Success produces
`project-data-staging-receipt.json`
(`workbench.project_data_staging_receipt.v1`).

Then land evidence through the runner (never hand-write `summary.json`),
per runbook §4:

```bash
# [local]
bun scripts/test-evidence/run.ts --layer system --environment staging \
  --project client/yeisme-workbench \
  --collect-structured-artifact <local-output>/project-data-staging-slo.json \
  --collect-structured-artifact <local-output>/project-data-staging-receipt.json \
  -- <approved one-shot staging soak command>
```

Only after a passing receipt: mark
`workbench-project-data-staging-soak-v1` 4.5/4.6 complete citing the
`temp/integration-test-runs/<run-id>/` evidence, independently validate the
receipt, update the frozen parent `workbench-project-data-workspaces-v1`
12.3/13.3, and re-run `openspec validate --all --strict` (runbook §6).
