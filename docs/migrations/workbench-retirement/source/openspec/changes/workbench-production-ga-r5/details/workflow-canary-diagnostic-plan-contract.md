# Workflow Canary Offline Diagnostic Plan Contract

Status: local diagnostic contract only; it is not managed canary authority.

`workbench-release workflow-canary generate` reads one private `0400` or `0600`
source under a `0700` non-symlink parent, validates one exact
`workbench.workflow_canary_plan.v1alpha1` JSON object, and creates a new `0600`
O_EXCL plan. The schema binds `environment=canary`, candidate/manifest/allowlist
digests, Owner issuer plus contract/schema/capability digests, approval receipt,
managed trust digest/expiry/revocation, opaque tenant/project scopes, exactly one
allowed/original operation and idempotency key, cost ceiling, kill-switch receipt,
and rollback-drain plan/receipt.

The generated plan fixes `plan_valid=true`, `execution_authorized=false`,
`external_actions_executed=false`, and `production_authorized=false`.
`validate` re-reads both private files, detects source drift and expiry, then exits
5 even for a valid plan. It performs no network operation, Provider call, spawn,
or acceptance-evidence write.

`task tenant:cutover:workflow-canary ENV=canary DRY_RUN=1` remains a separate
public fixed exit-5 sentinel. It neither reads this plan nor validates any caller
material. A future managed authority must independently establish trust, execute
the original idempotent operation, reconcile its receipt, and own all external
evidence before C7 can progress.
