# PA 8.1 Owner Operation Selector

Selected first real Owner Operation for proposal-authority canary:

| Field | Value |
| --- | --- |
| Owner | Eikona |
| Operation | `eikona.generation.submit` |
| Contract | `eikona.generation.submit.v1` / `eikona.owner` `1.0.0` |
| Test project | disposable `proj_canary` only |
| Cost ceiling | dry-run / no paid provider call |
| Cancel | supported; review decide is not cancelable |
| Receipt/status/reconcile | durable owner refs; reconcile never redispatches |
| Kill switch | `EIKONA_OWNER_CANARY` + per-operation `new_mutations_enabled` |
| Rollback owner | Eikona owner provider receipts remain readable after kill switch |
| Evidence tier | Workbench consumer + real loopback process; not production |

Rejected for this first selector:

- `eikona.review.decide`: metadata-only, not cancelable, not the lowest-risk mutation spine.
- `eikona.handoff.prepare`: needs asset version pins and child receipts; keep as follow-on.
- Scaena / Pinax / Sonora mutations: still `needs_contract` on Workbench.

Browser must not hold owner credentials or private endpoints. R2 4.4 production-registry JWT canary is closed (`20260822170843`, `ModeOwner`, receipt `own_c8ca15938f6afe2fd59ba393`). Default/flag-off catalog capability stays `needs_contract`/`offline` and must not be claimed `available`; only the disposable, process-local canary configuration promotes the sealed proxy.

PA 8.2 consumer wiring evidence is closed:

- component: `temp/integration-test-runs/20260823132113-5be6fb3a-207b-43d1-8cb3-9ebfb0547bd7/`;
- real Identity HTTP exchange + JWKS → Eikona loopback: `temp/integration-test-runs/20260823131904-3d53d0cf-3c5d-44dc-8f03-5eccaa17c7d3/`;
- outcome: one canonical `orbit.proposal.accept` Task, permission + cost gates, target observed version `v1`, `eikona.generation.submit`, status `succeeded`, safe receipt `own_c8ca15938f6afe2fd59ba393`, redaction 0;
- rollback invariant: disabling the PA flag or removing either real owner endpoint keeps new proposal mutations unavailable; existing Task/proposal/receipt records are not deleted.

PA 8.4 capability-scoped rollout is closed:

- exact server cohorts: `WORKBENCH_AGENT_PROPOSAL_{READ,DECISION,RECONCILE,TOOL_ACTION}_COHORT`;
- component/process-restart rollback: `temp/integration-test-runs/20260823151219-bc36bd64-521c-4a26-90c9-c23416130e5a/`;
- refreshed real Identity/JWKS → Eikona selected-tool canary: `temp/integration-test-runs/20260823150803-736d20d2-d3bc-4200-9417-ed46397f6259/`;
- browser decision-off/reconcile-on and typed-conflict rollback: `temp/integration-test-runs/20260823151115-d96d9e6a-3449-4ca1-ba22-2165e9b73fa0/`;
- kill switch: empty decision/tool cohorts stop new decisions before repository claim; read/reconcile cohorts keep accepted/unknown records readable and original-attempt-only reconcilable.

Verification: this selector plus `openspec validate workbench-agent-proposal-authority-v1 --strict`. HMAC loopback is historical adapter evidence only; 8.2 must keep Identity HTTP exchange + JWKS.
