## 1. Staging contract and topology

- [x] 1.1 Add an internal-only pinned `nerdctl compose` topology and ignored safe configuration template for API, worker, migration, PostgreSQL, Identity, Eikona canary, rotation hook, and soak runner.
- [x] 1.2 Add static compose/config validation tests that reject ports, non-internal networking, unpinned images, secret fields, and admin/owner exposure.

## 2. Fail-closed soak implementation

- [x] 2.1 Implement the fixed Project-data staging policy, redacted SLO/receipt schema, integrity checks, and rollback action receipt validator.
- [x] 2.2 Implement the public-Workbench-contract, read-only soak command with environment-only token handling and evidence artifact output.
- [x] 2.3 Add focused unit and command tests for real 24-hour enforcement, SLO bounds, gap/duplicate/unknown failures, redaction, and no mutation/admin/owner route use.

## 3. Operational entrypoints and closeout

- [x] 3.1 Add non-promoting Taskfile build, validation, plan, and evidence-collection targets.
- [x] 3.2 Document safe configuration, 24-hour execution boundary, receipt collection/validation, rollback/action receipt validation, and evidence-tier limits.
- [x] 3.3 Run focused Go/Bun/OpenSpec/static-compose validation, record exact results, and check completed tasks.

## Remediation (reviewed P1/P2)

- [x] R1 Trace compose commands and image targets to checked-in Workbench entrypoints; add an untracked-env static render gate and external-owner rotation profile.
- [x] R2 Require cadence-complete public Task/Project/Automation/capability observations and strict redacted action/rollback receipt validation.
- [x] R3 Update the contract tests and operations documentation without claiming a staging execution.
- [x] R4 Bind the exact external Identity rotation CLI contract, Task SSE watch evidence, and eight operator-recorded finalization records fail closed.
- [x] R5 Separate the four Workbench release image inputs; add restricted bearer-file reload, SSE cursor resume, bounded Automation pagination, strict paired action-output hashing, and Identity database initialization before rotation.
- [x] R6 Align Automation terminal paging with its facade, require incident evidence and scope-bound finalization, validate the source Identity rotation receipt, add normal-verify JWKS CA support, isolate TLS database networks, and include soak in deterministic release builds.
- [x] R7 Preserve managed worker authority readiness in staging by adding the
  Identity-owned read-only disposable authority sidecar, candidate-bound typed
  service-identity/delegation documents, and explicit normal-verify CA support;
  do not treat process health as readiness.
- [x] R8 Isolate all live nerdctl operations in the dedicated
  `workbench.staging` containerd namespace after the shared default namespace
  proved list-unresponsive; permit only exact-name, hard-timeout legacy cleanup
  and never restart or repair unrelated host workloads.
- [x] R9 Add explicit claim-enabled readiness for the real managed scheduler
  engine while preserving claim-disabled defaults; require dependencies,
  durable registration, engine supervisor, non-draining state, and no lifecycle
  error before worker `/readyz` can pass.
- [x] R10 Keep the Eikona Owner credential out of Workbench fixture/soak
  processes; authenticate the canonical `/api/v1/health` contract only from a
  disposable internal start-control probe and validate its typed ready status.
- [x] R11 Add a managed-only exact HTTP authority gate for compose service
  clients; disposable staging requires `api:8787`, rejects every other Host,
  and preserves exact browser Origin matching when Origin is present.
- [x] R12 Make the staging release entrypoint rebuild the complete deterministic
  API/worker/migration/job artifact set so a focused rerun cannot combine new
  one-shot controls with a stale long-running service binary.
- [x] R13 Replace status-only Identity startup probing with structured JWKS
  readiness; require a complete active EdDSA signing key before the authority
  sidecar starts so restart-count evidence remains zero.
- [x] R14 Make the public Automation fixture satisfy its existing closed
  contract with a nonempty safe system-field input mapping; keep empty mappings
  rejected instead of weakening the production validator.
- [x] R15 Move the Automation kill switch to the shared facade across HTTP,
  JSON-RPC, and gRPC; preserve the closed HTTP POST read methods and exact
  original-key replay while rejecting every new mutation.
- [x] R16 Give a superseding source/artifact candidate a fresh durable worker
  ID and bind its runtime override digest into the start receipt; never delete
  the previous registration or replay the public fixture to force readiness.
- [x] R17 Add a fixed terminal incident-evidence handshake so independent
  coverage can be recorded after the real observation endpoint; reject unsafe,
  early-ending, mismatched, and future-dated records instead of predicting the
  24-hour finish time.
- [x] R18 Add a profile-gated, candidate-bound retention setup remediation:
  a separate fixed-scope Identity principal, public-HTTP-only Board/Workflow/
  Automation setup, exact disposable-staging Automation policy allowlists, and
  separately pinned one-shot images. Focused local Go/Bun contract checks
  passed; this does not start 4.5, establish staging success, or close 4.6.

## 4. Authorized master1 staging execution

- [x] 4.1 Run a read-only kiki-infra Ansible preflight against `master1`; record host identity, UTC time, capacity, containerd/nerdctl/BuildKit versions, existing workloads/listeners, and target-root absence without changing existing services.
- [x] 4.2 Add and test the strict ProjectRef allowlist, disposable Workbench policy bootstrap, and Identity short-lived principal refresh controls required by an empty managed-profile database.
- [x] 4.3 Freeze source/config/image content digests, generate runtime TLS and secret material outside Git, and provision only `/data/ssd0/workbench-project-data-staging-soak-v1` plus its uniquely named compose project through kiki-infra Ansible.
- [x] 4.4 Run migration and disposable bootstrap, create the allowlisted Project/Dataset/WorkItem/Task/Automation fixture through public Workbench contracts, and prove API/worker/Identity/Eikona internal readiness with no host ports.
  Evidence: `workbench-project-fixture.json` completed at
  `2026-08-26T11:47:36Z`; `staging-start.json` recorded nine long-running
  services, four exit-zero jobs, zero host ports, and zero restart counts.
  The first observation window was then explicitly superseded without deleting
  the database or replaying the fixture after R15 exposed the Automation
  read-POST boundary defect; 4.5 therefore remains open and restarts from a new
  candidate receipt.
- [ ] 4.5 Start the fixed 24-hour runner with short-lived principal refresh; execute and record scale, drain, Identity rotation/new-JWKS principal, four capability disable/restore checks, read-only rollback, retention, and original-idempotency reconciliation. **Re-check (2026-09-03，仍不勾——staging 接入材料缺席)**：`task release:soak ENV=staging SCENARIO=project-data` 当日复验 fail-closed exit 5（"release-soak candidate custody is not provisioned"）；本沙箱无 master1 地址/凭据/fixture 与 start receipt 预置。v3 scenario-bound contract、observer compose-private 单源化与 custody 校验已就位（见 design/spec 同日修订与 4.4 证据），24h runner 启动等待 operator 预置。
  In-progress evidence: generation `r5`, worker
  `worker:project-data-staging:r5-attempt17`, and the non-replayed fixture were
  bound at `2026-08-26T17:19:49.378932111Z`; the soak container started at
  `2026-08-26T17:19:50.458956257Z`. Scale/drain, the disposable Identity
  rotation, all four disable/restore probes, retention, rollback validation,
  and original-key reconciliation completed inside that observation window.
  The observer and principal refresh remain live with zero restart counts.
  The earliest terminal evidence invocation is approximately
  `2026-08-27T17:20:50Z`; no SLO or final receipt exists before that wall-clock
  boundary, so this task remains open. Fresh local verification on the current
  source passed `CGO_ENABLED=0 go test ./service/...`, all 41 strict OpenSpec
  items, `buf lint`, and `CGO_ENABLED=1 go test -race ./service/...` (the full
  race run completed in approximately 510 seconds with no race). These are
  local source gates only and do not substitute for the running staging window.
  Supersede record (2026-08-28): the r5 window is void on two hard grounds —
  the fixed 30-minute terminal handshake (from ≈2026-08-27T17:20:50Z) expired
  without the terminal evidence trio being recorded on master1, and the frozen
  candidate source tree changed after the freeze. Per runbook §5 the database
  and immutable fixture are kept and no fixture mutation is replayed; a fresh
  candidate (r6, new durable worker ID, new Identity rotation attempt ID) must
  restart the full 24h observation. The user explicitly authorized the restart
  on 2026-08-28. Operator materials: restart operator pack
  `details/master1-soak-restart-operator-pack.md` and the kiki-infra Ansible
  suite `iac/ansible/playbook/workbench-staging-soak/` (local branch
  `feat/workbench-staging-soak`, ansible commit 20ac80c / infra commit
  c647002, syntax-checked, not yet pushed; push and execution await the
  master1 credential channel).
- [ ] 4.6 Collect the six-piece evidence set and strict structured artifacts, independently validate the staging receipt, then and only then update the frozen parent change's `12.3`/`13.3` and archive it.
