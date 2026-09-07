# Workbench Agent CLI Pane v1 final verification

Date: 2026-08-24 UTC

This document records the stable local implementation evidence and the promotion boundaries that remain external. It is not an archive authorization.

## Local gate matrix

| Gate | Environment | Result | Evidence |
| --- | --- | --- | --- |
| OpenSpec | local | 37/37 pass | `openspec validate --all --strict` |
| Proto lint | local | pass | `buf lint` |
| Pure-Go service | local, `CGO_ENABLED=0` | pass | `go test ./service/... -count=1` |
| Focused race/concurrency | local, `CGO_ENABLED=1` | pass, repeated 10x | grant admission/revoke, Task replay, cancel/exit, reconcile, drain, backpressure, 200 watchers |
| Full race | local, `CGO_ENABLED=1`, `-timeout 30m` | pass, 171 packages ok, 0 race/fail | `CGO_ENABLED=1 go test -race -timeout 30m ./service/... -count=1`; repository 962.815s |
| TypeScript/Web types | local | pass | `bun run typecheck` |
| Bun unit/component | local | 658 pass, 7 environment-gated skip, 0 fail | `bun test` |
| Build | local, pure Go + Web | pass | `bun run build` |
| Contract | local | 386 pass, 0 fail | `bun run test:contract` |
| Integration | integration evidence runner | pass | `temp/integration-test-runs/20260824032739-8d3d858d-3b23-4f33-a78a-e1c6ca20c6a2` |
| CLI contract | component evidence | pass/redacted | `20260824015446-d7c9c8c9-64f9-4c01-bdb6-3d1830fd40af` |
| Agent CLI | integration evidence | pass/redacted | `20260824015910-0f9d815d-e343-4157-b5c2-e747644541ff` |
| Real Host fault canary | system evidence | pass/redacted | `20260824020209-65609651-c557-44e9-8ef8-3ae59ec616b3` |
| Capability rollback | component evidence | pass/redacted | `20260824052017-6a22ac2a-fd0f-4d65-b576-e7be1385bf3d` |
| CLI components | component evidence | pass/redacted | `20260824030937-2a663e59-4fd5-40a9-a91b-3c07a6202f7a` |
| CLI responsive/a11y | Chromium E2E evidence | pass/redacted; Axe serious/critical 0 | `20260824030504-11b334db-bf3c-4744-aaed-d57a02d244d5` |

Every official evidence bundle above uses `yeisme.integration_test_evidence.v1`, preserves the child exit code, and reports `redaction_result.passed=true`. Failed exploratory bundles are not used as completion evidence.

## Stable-diff review

- Task authority remains canonical: every successful command submission enters `TaskService`; Host receipts/observations do not define a second Task lifecycle.
- Operation descriptors are derived from the sealed registry. The Operation kill switch reseals a read-only catalog projection and is consumed independently by authorization and compilation.
- Browser and SDK execution accept typed prepare fields and immutable `intentRef`; copy-only CLI previews cannot enter submit codecs.
- Host execution remains fixed executable + argv with digest pins, no shell/PTY/client cwd/env/stdin, bounded resources, double redaction, durable receipts, unknown-accept lookup, and default-off canary activation.
- Delegated read uses a durable, approval-bound, scope/command/expiry/resource/concurrency grant. Database admission reservation serializes concurrent acceptance with revoke.
- Agent writes remain proposal-only and revalidate intent, descriptor, Context Pack, expected owner version, permission and cost before canonical acceptance.
- Responsive CLI evidence verifies explicit user activation, one Pane identity, dirty-draft preservation, focus/Escape semantics, no raw-output conversation projection, and readable two-column preflight gates.

Resolved review findings:

1. Security HIGH `cbea15...`: non-atomic grant active-count versus Task acceptance. Resolved with authority-row locking and durable short admission reservations; final cso report `.gstack/security-reports/2026-08-24-013615.json` has critical/high/medium 0.
2. Defense in depth: the Operation compiler initially referenced the unprojected registry while authorization used the kill-switch projection. Resolved by wiring both to the same projected descriptor source and adding stale-intent regression coverage.
3. UI P2: the desktop sticky action bar obscured readiness gates. Resolved with two-column Pane-safe gates, compact-only sticky behavior, a safe-area spacer, and renewed Playwright screenshot evidence.

No unresolved local P0-P2 or critical/high finding is known on the reviewed stable diff. Formal task 11.2 local sign-off is recorded after 11.1 local gates completed on this same implementation.

## Owner fit, flags, and rollback

The required-capability ledger remains intact. Workbench owns typed UI composition, safe projection, canonical Task integration, proposal/grant gates, Host adapter metadata and receipts. Eikona/Scaena/other domain owners retain canonical payloads, domain state machines, private artifacts, credentials and owner receipts.

Independent server-owned controls:

- `WORKBENCH_CLI_PANE_ENABLED` — default true.
- `WORKBENCH_CLI_OPERATION_COMMANDS_ENABLED` — default true; false keeps catalog/history reads but marks commands `needs_contract`.
- `WORKBENCH_CLI_AGENT_DELEGATED_READ_ENABLED` — default false; cannot create or self-approve a grant.
- `WORKBENCH_CLI_HOST_CANARY_ENABLED` — default false; the separate Host sidecar also enforces this flag.

Read-only rollback keeps the Pane on, disables Operation commands, Agent delegated read and Host canary, drains the Host, and retains canonical Tasks plus durable Host receipts for lookup/reconcile.

## Promotion blockers

Local-deploy closeout (authorized 2026-08-24): loopback Workbench + local-session mock identity is the accepted subsequent environment. Official system evidence `20260824071317-e1273699-336a-4c8f-b13e-b2a07e45b830` uses `--environment staging` for that local deploy. The observation window is compressed TTL, not a wall-clock 24h remote tenant. Host canary remains default-off retain-next.

This does not claim a remote HTTPS internal tenant or production promotion.
