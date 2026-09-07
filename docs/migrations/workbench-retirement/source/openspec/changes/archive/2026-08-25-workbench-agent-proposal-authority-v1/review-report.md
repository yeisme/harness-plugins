# Workbench Agent Proposal Authority v1 — final review

Date: 2026-08-23

Verdict: approved for capability-scoped local/component, browser, and real loopback
Owner canary handoff. No P0/P1/P2 correctness, concurrency, compatibility, or
security findings remain open. This review does not claim staging or production
readiness.

The current user request did not authorize subagents, so the root integrator
performed this stable-diff review and verification directly. No independent
reviewer/security-reviewer/test-engineer agent sign-off is claimed.

## Findings resolved during final review

1. Canonical completion responses were empty after accepted/not-dispatched/
   reconciled repository updates. The service now reloads and attaches the
   current proposal with a cancellation-safe durable context. The real Eikona
   canary asserts `accepted`, revision `3`, and the exact active decision ref.
2. Transport conformance previously proved only reject plus cross-transport
   replay. It now proves acceptance fields and stale-revision behavior across
   HTTP, gRPC, and JSON-RPC, including canonical projection reload.
3. JSON-RPC and parts of HTTP/gRPC collapsed valid proposal errors to `internal`.
   All three transports now use closed `errors.Is` mappings for capability,
   cost, approval, expiry, source drift, safety/precondition, revision,
   idempotency, and in-progress outcomes; arbitrary labels remain internal.
4. Web decision capability previously had two fail-open compatibility risks:
   legacy tool-action state could elevate decision authority, and decision-off
   did not independently preserve reconcile. Exact server capabilities now gate
   read, decision, reconcile, and selected tool action separately.
5. Only accept reloaded canonical state after a typed conflict. Accept, reject,
   request-changes, and reconcile now share one closed-code conflict reload path.
6. The 1024×768 metadata browser journey read fixture observations before the
   keyboard-triggered request completed. It now waits for the user-visible
   server-confirmed message. The failed diagnostic bundle
   `20260823150313-04f83b34-3647-4bf2-ad71-2aa6a1552794` is retained as failed
   evidence and is superseded by the passing browser bundle below.

## Requirement-to-evidence map

| Requirement group | Evidence and review conclusion |
| --- | --- |
| Server-canonical proposal; closed decision input; revision/idempotency | repository/service tests plus transport parity in component run `20260823151219-bc36bd64-521c-4a26-90c9-c23416130e5a`; exactly one claim, typed conflict, replay, and current projection reload pass under CGO0 and focused race |
| Decision-time authority reload; existing Task control plane | sealed snapshot/bridge/runtime tests in the component run; real loopback run `20260823150803-736d20d2-d3bc-4200-9417-ed46397f6259` reaches one `orbit.proposal.accept` Task, permission/cost gates, `eikona.generation.submit`, and safe receipt `own_c8ca15938f6afe2fd59ba393` |
| Metadata-only reject/request-changes; unknown reconcile-only | service zero-dispatch tests, restart rollback tests, and browser run `20260823151115-d96d9e6a-3449-4ca1-ba22-2165e9b73fa0` (6/6) cover metadata-only decisions, decision-off/reconcile-on, original-attempt reconcile, and no mutation replay |
| Decision/Task/Owner truth separation | service/domain tests plus Review Pane component tests (93/93) and real canary; accepted proposal remains distinct from Task/Owner status |
| HTTP/gRPC/JSON-RPC/SDK parity | component run covers three wire adapters, conformance acceptance/conflict tests, SDK proposal normalizers, HTTP/JSON-RPC closed error parsing, and TypeScript typecheck |
| Bounded Agent events and safe Review consumer | agent directory/event tests, component Web tests, and browser responsive/accessibility journeys; no per-proposal stream or hover/focus mutation path was introduced |
| Privacy-bounded persistence and diagnostics | component redaction passed with one workspace-path redaction; browser and real canary redaction passed with zero findings; persisted Task input remains only `proposalDecisionRef`, and evidence contains no bearer, signing key, private endpoint, provider payload, or arbitrary tool arguments |
| Independent capability layers and scoped readiness | exact-principal default-empty read/decision/reconcile/tool cohorts, process-restart rollback, outside-principal denial, and selected-operation-only catalog promotion pass; unselected Owners remain disabled/`needs_contract` |

## Final verification envelope

- status: approved
- component/restart/race: `temp/integration-test-runs/20260823151219-bc36bd64-521c-4a26-90c9-c23416130e5a/` — passed
- browser: `temp/integration-test-runs/20260823151115-d96d9e6a-3449-4ca1-ba22-2165e9b73fa0/` — 6/6 passed, four screenshots, redaction 0
- real Owner: `temp/integration-test-runs/20260823150803-736d20d2-d3bc-4200-9417-ed46397f6259/` — passed, redaction 0
- contract/static gates: `openspec validate workbench-agent-proposal-authority-v1 --strict --no-interactive`, `buf lint`, `bun run typecheck`, and `git diff --check` — passed
- files_modified: none by the review report itself beyond this report/task evidence metadata; findings above were repaired before approval
- remaining risks: managed PostgreSQL/staging/production rollout and production SLO evidence remain separate higher tiers and are not claimed
- confidence: high for the reviewed local/component/browser/real-loopback scope
