# master1 24h staging soak execution runbook

Scope: completes `workbench-project-data-staging-soak-v1` tasks 4.5 and 4.6 on
inventory host `master1`, and unblocks the frozen parent change
`workbench-project-data-workspaces-v1` tasks 12.3/13.3. This runbook is an
execution checklist only. It does not by itself authorize or start any staging
operation; every live step still requires separate staging operator approval,
and no step may be executed from a browser or by editing owner state.

Authoritative references (do not restate or weaken them here):

- `docs/operations/project-data-staging-soak.md` — topology, fixed SLO gates,
  receipt schemas, redaction rules, and the execution boundary.
- `deploy/staging/compose.yaml` and `deploy/staging/.env.example` — pinned
  topology and safe configuration template.
- Taskfile targets under `project:data:staging:*` and
  `test:project-data-staging-soak:component`.

Fixed identifiers for this run:

- Host: `master1`; containerd namespace: `workbench.staging` (never the shared
  `default` namespace except exact-name, hard-timeout legacy cleanup).
- Isolated root: `/data/ssd0/workbench-project-data-staging-soak-v1`;
  compose project: `workbench-project-data-staging-soak-v1`.
- Active candidate (r5): worker `worker:project-data-staging:r5-attempt17`,
  observation start `2026-08-26T17:19:50.458956257Z`; earliest terminal
  evidence invocation ≈ `2026-08-27T17:20:50Z`. No SLO or final receipt may be
  claimed before that wall-clock boundary.
- Pre-terminal artifacts already collected:
  `temp/project-data-staging-soak-r5-preterminal-20260826/`
  (fixture receipt, start receipt/binding, scale/drain/rotation/kill-switch
  raw records, rollback action receipt, in-progress SLO snapshot).

## 0. Preconditions (local, no staging contact)

Run every gate and record exact output; any failure stops the run before any
staging contact:

```bash
openspec validate --all --strict
buf lint
CGO_ENABLED=0 go test ./service/internal/projectsoak ./service/cmd/workbench-project-soak \
  ./service/internal/stagingcontrol ./service/cmd/workbench-project-bootstrap \
  ./service/cmd/workbench-project-fixture -count=1
task project:data:staging:compose:validate          # static only; no pull/start
task project:data:staging:soak:test                 # local policy/observer/redaction gates
```

Confirm before proceeding:

- The r5 start receipt validates against the immutable fixture receipt:
  `task project:data:staging:start:validate START_RECEIPT=<staging-start.json> FIXTURE_RECEIPT=<workbench-project-fixture.json>`.
- The wall clock is at or after `2026-08-27T17:20:50Z` (24h after the observed
  soak container start). Earlier invocation is invalid evidence.
- No tracked source, test, fixture, or config changed since the candidate was
  frozen; a changed tree requires a fresh candidate (see §4 failure path).

## 1. Host preflight (read-only, kiki-infra Ansible against master1)

Re-confirm, without changing any service:

- Host identity and UTC clock skew; containerd/nerdctl/BuildKit versions.
- All live resources exist only in namespace `workbench.staging`; unrelated
  `default`-namespace workloads are left untouched.
- Nine long-running services report zero restart counts; zero host-published
  ports; the observer and `identity-principal-refresh` loops are live.

Any restart, unexpected port, missing service, or clock anomaly fails the run
closed; do not repair or restart anything from this runbook.

## 2. Terminal evidence (operator-recorded, after the 24h boundary)

1. Incident evidence: within the fixed 30-minute terminal handshake, the
   operator atomically writes the mode-`0600`
   `workbench.project_data_staging_incident_evidence.v2` record at
   `/run/workbench-secrets/incident-evidence.json` on the soak service mount.
   It must reproduce the exact task ref and normalized scope, declare a
   coverage window containing the entire SLO window (wider is valid), be
   already finished (not future-dated), and record explicit zero open P0/P1.
2. Identity rotation: the raw owner receipt
   `{status,attempt_id,rotated_at,new_key_id,previous_key_id,rotation_digest}`
   must carry the run-authorized `--identity-rotation-attempt-id` recorded at
   soak start, with `rotated_at` inside the SLO window.
3. Copy the observer's redacted `project-data-staging-slo.json`
   (`workbench.project_data_staging_slo.v1`) from its output directory. The
   observer never creates a passing staging receipt by itself.

Validate each recorded action locally (no network call):

```bash
./dist/workbench-project-soak validate-action --receipt <redacted-local-file>
```

Required distinct records, each bound by SHA-256 to the SLO report: eight in
total — `scale_workers`, `drain_workers`, `identity_rotation`, `rollback`,
`verify_workspace_kill_switch`, `verify_custom_fields_kill_switch`,
`verify_canvas_kill_switch`, `verify_automation_kill_switch`.

## 3. Finalization (local, fail-closed)

```bash
task project:data:staging:finalize \
  TASK_REF=<opaque-task-ref> \
  SLO_REPORT=<local-output>/project-data-staging-slo.json \
  ACTION_RECEIPTS=<eight-comma-separated-redacted-local-files> \
  ACTION_OUTPUT_FILES=<eight-comma-separated-strict-redacted-output-files> \
  OUTPUT_DIR=<local-output>
```

The finalizer performs no mutation, admin call, owner call, or network request.
Missing, duplicate, mismatched, unknown, or unbound records fail closed; the
rollback output must parse as the detailed rollback schema (new-mutation
disablement plus original-idempotency reconciliation), and every action output
hash must match its paired strict-redacted file. Success produces
`project-data-staging-receipt.json`
(`workbench.project_data_staging_receipt.v1`).

## 4. Evidence landing and redaction

Collect the approved one-shot run into `temp/integration-test-runs/<run-id>/`
through the evidence runner; never hand-write `summary.json`:

```bash
bun scripts/test-evidence/run.ts --layer system --environment staging \
  --project client/yeisme-workbench \
  --collect-structured-artifact <local-output>/project-data-staging-slo.json \
  --collect-structured-artifact <local-output>/project-data-staging-receipt.json \
  -- <approved one-shot staging soak command>
```

Redaction requirements (the runner rejects violating structured artifacts):

- No tokens, bearer files, cookies, private keys, DSNs, `Authorization`
  headers, credential-bearing URLs, raw Workbench/owner responses or payloads,
  private host paths, or the unredacted real command line in any artifact.
- Receipts contain only opaque refs, counts, timings, reason codes, SHA-256
  bindings, and `redaction.status`; the Identity rotation raw receipt is bound
  by byte hash through its scope-bound action status receipt, never embedded
  verbatim beyond its fixed six-field schema.
- Evidence stays under `temp/` (git-ignored); it is never committed.

## 5. Failure and rollback path

- Any failed SLO gate, evidence-window gap, task/scope mismatch, foreign or
  historical rotation receipt, duplicate/unknown data, unreconciled
  `unknown_accept`, or nonzero open P0/P1 is a failed result. It is never
  retried as a replacement mutation and never auto-closes 4.5.
- Operational rollback only stops new mutations at the approved
  allowlist/kill-switch boundary (`PROJECT_AUTOMATION=false` fences Automation
  mutations across HTTP/JSON-RPC/gRPC while typed read-only POSTs and exact
  original-idempotency replay remain available). Existing attempts stay
  terminal or reconcile under their original idempotency key; never replay an
  unknown attempt or switch owner/channel. Record and check the receipt with
  `task project:data:staging:rollback:validate ROLLBACK_RECEIPT=<file>`.
- If the window must be superseded (source/config change, restart count,
  unrecoverable gap): keep the database and immutable fixture, do not replay
  fixture mutations, provision a fresh candidate with a new durable worker ID
  and a fresh start receipt proving zero host ports/restarts, then restart the
  full 24h observation from §1. A shortened or compressed window is not
  accepted without explicit user authorization.

## 6. Closeout linkage (only after a passing receipt)

1. Mark `workbench-project-data-staging-soak-v1` 4.5 and 4.6 complete, citing
   the `temp/integration-test-runs/<run-id>/` evidence and the validated
   staging receipt.
2. Independently validate the staging receipt, then update the frozen parent
   `workbench-project-data-workspaces-v1` 12.3 and 13.3 with the same evidence
   before any archive decision.
3. Re-run `openspec validate --all --strict`; keep any mismatch between a
   checkbox and its evidence reported, never silently checked.
