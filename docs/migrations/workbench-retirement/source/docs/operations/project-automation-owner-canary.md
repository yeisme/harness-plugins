# Project Automation real Owner canary

This canary is the release gate for the first Project Automation Owner mutation.
It creates disposable Project/WorkItem metadata in a private SQLite database,
publishes one closed `workbench.submit_operation.v1` workflow, and sends exactly
one dry-run `eikona.generation.submit` mutation to an explicitly allowlisted test
project. It never grants a browser a direct Owner route and never stores Owner
payloads or credentials.

## Preconditions

- `EIKONA_URL` and `IDENTITY_URL` point to approved loopback or HTTPS test
  processes. They must not point at production.
- `TEST_PROJECT_REF` names a disposable Eikona test project and appears exactly
  in `PROJECT_AUTOMATION_CANARY_ALLOWED_PROJECT_REFS`.
- `WORKBENCH_SOURCE_TOKEN` is supplied through the process environment. Do not
  place it in a command argument, shell transcript, issue, document, or evidence
  artifact.
- The principal subject, membership and membership version match the source
  token accepted by the test Identity issuer.
- `PROJECT_AUTOMATION_CANARY_DRY_RUN`,
  `PROJECT_AUTOMATION_CANARY_NEW_MUTATIONS_ENABLED`, and
  `PROJECT_AUTOMATION_CANARY_RECONCILE_ENABLED` are all explicitly `true`.
- `EIKONA_DELEGATION_TOKEN` is unset. The canary uses the real Identity HTTP
  delegation exchange and does not permit a static-token fallback.

Example safe configuration (replace refs with the approved test-tenant values):

```bash
export PROJECT_AUTOMATION_CANARY_ENV=integration
export PROJECT_AUTOMATION_CANARY_TENANT_REF=t:pdw
export PROJECT_AUTOMATION_CANARY_WORKSPACE_REF=pdw-main
export TEST_PROJECT_REF=proj_canary
export PROJECT_AUTOMATION_CANARY_DATASET_REF=workitems.default
export PROJECT_AUTOMATION_CANARY_OPERATION_REF=eikona.generation.submit
export PROJECT_AUTOMATION_CANARY_ACTOR_REF=service:automation-canary
export PROJECT_AUTOMATION_CANARY_SUBJECT_REF=usr_canary
export PROJECT_AUTOMATION_CANARY_MEMBERSHIP_REF=mem_canary
export PROJECT_AUTOMATION_CANARY_MEMBERSHIP_VERSION=1
export PROJECT_AUTOMATION_CANARY_COST_POLICY_REF=cost:dry-run
export PROJECT_AUTOMATION_CANARY_APPROVAL_POLICY_REF=approval:canary
export PROJECT_AUTOMATION_CANARY_ALLOWED_PROJECT_REFS=proj_canary
export PROJECT_AUTOMATION_CANARY_DRY_RUN=true
export PROJECT_AUTOMATION_CANARY_NEW_MUTATIONS_ENABLED=true
export PROJECT_AUTOMATION_CANARY_RECONCILE_ENABLED=true
```

Set `EIKONA_URL`, `IDENTITY_URL`, and `WORKBENCH_SOURCE_TOKEN` only in the
approved secret-bearing environment, then run:

```bash
task test:project-automation-owner-canary:e2e
```

The evidence runner preserves both passing and failing runs under
`temp/integration-test-runs/<run-id>/` with redacted `summary.json`, command,
stdout, stderr, environment metadata and artifacts. A fixture, a direct browser
call, a production project, a hardcoded credential, or a run without this
evidence directory does not satisfy the gate.

## What the gate proves

- crash before the durable dispatch intent sends no Task or Owner mutation;
- loss of the post-send workflow outcome response leaves one durable Task and
  a fenced workflow state;
- loss of the Owner response produces `unknown_accept` and does not auto-resend;
- explicit reconciliation uses the original idempotency identity and returns a
  safe Owner receipt;
- the mutation count remains exactly one;
- disabling new mutations blocks a second dispatch while reconciliation and
  prior receipts remain readable;
- disabling the automation binding prevents new runs without deleting its run
  history.

## Rollback

First set the external canary new-mutation switch to false (or remove the
allowlisted project), then disable the binding through the Project Automation
authority. Keep reconciliation enabled until every previously sent mutation is
terminal or has an operator-owned unknown-accept record. Do not retry an unknown
mutation with a new idempotency key.
