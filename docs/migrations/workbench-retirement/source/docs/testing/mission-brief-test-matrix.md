# Mission Brief requirement-to-test/evidence matrix

Status: local traceability artifact, not a release or provider-readiness claim.

- Matrix revision: 2026-08-11.
- Source of truth: `openspec/specs/workbench-mission-brief/spec.md`.
- The spec currently contains 15 requirements and 50 scenarios. The count was checked with `grep -c '^#### Scenario:'` against the spec; this matrix does not use the earlier 47-scenario draft count.
- This file maps evidence and gaps. It does not select a `BriefGenerator`, change a feature flag, approve a provider, or mark an OpenSpec task complete.

## Evidence profiles

| Profile | Meaning | What it can prove |
| --- | --- | --- |
| F | Focused/unit | Pure Go/SDK/domain behavior in an isolated test |
| C | Contract/conformance | Proto/JSON Schema, normalizer, fixture, or transport contract parity |
| I | Integration | Workbench Task/Goal/source/Owner dependencies in a disposable integrated profile |
| B | Browser/component | Web pane, accessibility, responsive, network and recovery behavior |
| S | Security/privacy | Independent trust-boundary, tenant, secret, redaction, SSRF and retention review |
| P | Performance/capacity | p95/p99, memory, concurrency, timeout and backpressure measurements |
| G | Generator/provider | Approved generator identity, version, data-processing, network, cost and tenant contract |
| R | Release/production | Staging, canary, promotion, rollback, production receipt and SLO authority |

## Interpretation rules

1. `pass` means only that the named direct local evidence exists for the stated profile. It never upgrades a local test to `I`, `G`, or `R`.
2. `partial` means some lower-level evidence exists but the scenario's required profile is incomplete.
3. `blocked: needs_contract` means the required authority or contract is absent. It is not a test pass and must remain visible to the next owner.
4. The current generator implementation is deterministic rules-only. It proves only `degraded` plus `generation_mode=rules_only`; it does not prove an approved provider or production generation.
5. Until Mission Brief task 0.2 freezes one approved `BriefGenerator` owner and contract, provider-dependent generation, real four-transport execution, default promotion, provider observability, performance claims, canary and production paths remain `blocked: needs_contract` or `blocked: required profile missing`.
6. Fixture, mock, SQLite, local component, and OpenSpec validation evidence cannot replace required R1-R5/Task/Owner, PostgreSQL, browser, security, performance, staging, canary, promotion, or production evidence.
7. Mission Preflight remains outside this capability; a brief may identify a prerequisite, but it must not implement or claim Preflight authority.

## Requirement matrix

| ID | Requirement | Scenarios | Direct local evidence currently available | Current status | Required next evidence |
| --- | --- | --- | --- | --- | --- |
| MB-R1 | Mission Brief is a bounded safe planning projection | S1-S3 | `service/internal/missionbrief/context/*_test.go`, `generator/rules/generator_test.go`, `projection/projector_test.go` | partial: F; missing integrated R1-R5 source proof | I with real authority/source projections and Task/Owner refs |
| MB-R2 | Authority and tenant isolation are enforced server-side | S1-S4 | Context builder/contract tests cover bounded authority shape and safe refs | partial: F; service/transport/browser cache isolation not proven | I+B+S with real identity/tenant profile |
| MB-R3 | Generation requests are typed, bounded, and idempotent | S1-S3 | `service/internal/missionbrief/repository/generation_request_test.go`, context/generator tests | partial: F/C; service/transport concurrency not proven | I with TaskService persistence and restart evidence |
| MB-R4 | Generator input and output are isolated as untrusted data | S1-S5 | `validation/validator_test.go`, `context/contract_test.go`, SDK conformance fixtures | partial; provider contract and independent security review missing | G+S with tenant-isolated approved provider |
| MB-R5 | Priority is policy-bounded and explainable | S1-S3 | `policy/priority_test.go`, rules generator tests | partial: F; explainability UI missing | B for the review surface; retain F rules-only proof |
| MB-R6 | Brief generations preserve lifecycle, freshness, and history | S1-S3 | `domain/brief_test.go`, repository store tests, projection tests | partial: F; service/transport/browser lifecycle missing | I+B with authoritative source lifecycle |
| MB-R7 | Item decisions are versioned and do not grant execution power | S1-S5 | `service/accept_test.go`, `decision_metadata_test.go`, domain item tests | partial: F; real proposal/Task receipt and UI missing | I+B with `orbit.proposal.accept` and receipt evidence |
| MB-R8 | Drift, expiry, revoke, and unknown acceptance fail closed | S1-S4 | accept/repository decision tests cover local CAS/unknown semantics | partial: F; Owner reconcile/browser rescue/production receipt missing | I+B+S with Owner control-plane evidence |
| MB-R9 | Generator outage and rules-only degradation are honest | S1-S3 | rules generator tests and `packages/task-sdk/test/mission-brief-client.test.ts` cover rules-only/`needs_contract` | partial; approved generator and production outage profile absent | G for approved generator, otherwise preserve blocked/Rules-only |
| MB-R10 | Registry and transport surfaces have contract parity | S1-S4 | SDK client/contract/conformance tests cover facade fixtures and cursor semantics | partial: C; real HTTP/gRPC/JSON-RPC runtime parity and streams missing | I+C across all four transports and TaskService |
| MB-R11 | Mission Brief Desktop pane is guarded default review surface | S1-S4 | No dedicated `apps/web/test/mission-brief-*` suite exists | blocked: missing Web pane/readiness/browser evidence | B with capability readiness and fixed browser journeys |
| MB-R12 | Observability, audit, privacy, and evidence are built in | S1-S3 | `scripts/test-evidence/run.ts` provides generic runner/redaction primitives | blocked: no Mission Brief observability/audit tests or integrated outcome evidence | S+I with Task/Owner correlation and redacted evidence |
| MB-R13 | Capacity, latency, and backpressure are bounded | S1-S3 | No Mission Brief-specific performance profile/test path found | blocked: required P profile missing | P with bounded candidates, provider timeout, stream backpressure |
| MB-R14 | Rollout and rollback preserve existing operations | S1-S2 | Design/tasks define rollback contract; no runtime/browser/staging evidence | blocked: required R profile missing | B+I+R with canary kill-switch and rollback drill |
| MB-R15 | Mission Preflight remains outside this capability | S1 | Spec/design non-goal is explicit; no dedicated negative test | partial: contract/document boundary only | Add a focused negative test without implementing Preflight |

## Scenario inventory

The rows below preserve the exact scenario names from the OpenSpec spec and provide the smallest current evidence pointer. A row marked `partial` or `blocked` must not be used as a completion claim.

| ID | Scenario | Current direct evidence | Status / required profile |
| --- | --- | --- | --- |
| MB-R1-S1 | Generate a brief from safe sources | `context/*_test.go`, rules generator tests | partial F; I with real sources |
| MB-R1-S2 | Required source capability is unavailable | context contract tests, rules-only generator tests | partial F; I for typed dependency state |
| MB-R1-S3 | Source state changes after generation | projection tests | partial F; I for real source watermark |
| MB-R2-S1 | Cross-tenant ref probing | context contract/builder tests | partial F; I+S with real identity |
| MB-R2-S2 | Membership is revoked while a brief is open | context/repository tests | partial F; I+B for cache and session cleanup |
| MB-R2-S3 | Authority changes during generation | context builder tests | partial F; I with authority race |
| MB-R2-S4 | Tenant switch | no dedicated Web Mission Brief test | blocked B/I |
| MB-R3-S1 | Equivalent concurrent generation requests | `repository/generation_request_test.go` | partial F; I for service replay |
| MB-R3-S2 | Idempotency key is reused with different input | generation request repository tests | partial F; I/C across transports |
| MB-R3-S3 | Request exceeds the generation budget | context/generator policy tests | partial F; I with server cost/concurrency gate |
| MB-R4-S1 | Owner safe text contains prompt injection | `validation/validator_test.go`, context contract tests | partial F/C; S+G required |
| MB-R4-S2 | Generator invents an invisible basis ref | validator and SDK normalization tests | partial F/C; S+G required |
| MB-R4-S3 | Generator emits an unsupported action or stale version | validator/SDK conformance tests | partial F/C; S+G required |
| MB-R4-S4 | Provider security or data contract is not current | no approved provider contract; `needs_contract` fixture only | blocked G/S |
| MB-R4-S5 | Only some generated items are valid | validator tests | partial F; G+I for provider result path |
| MB-R5-S1 | Generator attempts to demote a critical rescue | `policy/priority_test.go` | pass F only; G not implied |
| MB-R5-S2 | User inspects why an item is prioritized | no Mission Brief UI test | blocked B |
| MB-R5-S3 | Duplicate candidates describe the same source action | priority/rules generator tests | partial F; B/I for displayed dedupe |
| MB-R6-S1 | Successful refresh | domain/repository lifecycle tests | partial F; I+B required |
| MB-R6-S2 | Refresh fails | domain/repository tests | partial F; I+B required |
| MB-R6-S3 | Brief or proposal expires | domain/projection tests | partial F; I+B with clock/source authority |
| MB-R7-S1 | Accept a current valid item | `service/accept_test.go` | partial F; I+B with Task/receipt |
| MB-R7-S2 | Accepted item has not completed execution | service decision metadata tests | partial F; I with independent Task outcome |
| MB-R7-S3 | Defer an item | domain/service decision tests | partial F; I+B required |
| MB-R7-S4 | Skip an item | domain/service decision tests | partial F; I+B required |
| MB-R7-S5 | Decision version conflict | domain item and service tests | partial F; I+B CAS evidence |
| MB-R8-S1 | Source version drifts before accept | accept/repository decision tests | partial F; I with Owner source version |
| MB-R8-S2 | Permission is revoked before accept | accept/context tests | partial F; I+B+S required |
| MB-R8-S3 | Accept response is lost after dispatch | service/repository unknown tests | partial F; I with real receipt |
| MB-R8-S4 | Reconcile confirms no acceptance | service/repository reconcile tests | partial F; I+B with Owner control plane |
| MB-R9-S1 | Approved generator times out and fallback is allowed | rules-only generator tests | partial F; blocked G/R |
| MB-R9-S2 | Generator contract is not approved | SDK `needs_contract` tests | pass C for fail-closed mapping only; G remains blocked |
| MB-R9-S3 | Generator and fallback both produce no safe item | rules generator tests | partial F; G/I for provider outage |
| MB-R10-S1 | Generate through any unary transport | SDK contract/conformance fixtures | partial C; blocked I until all runtime transports exist |
| MB-R10-S2 | Read and decide through different transports | SDK facade fixtures | partial C; blocked I |
| MB-R10-S3 | Resume brief events from a cursor | SDK client/conformance tests | partial C; blocked I for real streams |
| MB-R10-S4 | Event cursor is invalid or outside retention | SDK normalization/conformance tests | partial C; I retention behavior missing |
| MB-R11-S1 | User opens a ready brief | no dedicated Web pane test | blocked B |
| MB-R11-S2 | Capability is disabled or not ready | no dedicated Mission Brief readiness UI test | blocked B |
| MB-R11-S3 | Decision outcome is unknown | no dedicated Mission Brief rescue UI test | blocked B/I |
| MB-R11-S4 | Accessible and responsive review | generic Workbench a11y tests cannot prove this pane | blocked B |
| MB-R12-S1 | Trace an accepted item to downstream outcome | generic evidence runner only | blocked I/S |
| MB-R12-S2 | Evidence redaction scan finds a secret-like value | generic redaction runner primitive | partial F for runner; S/I required |
| MB-R12-S3 | User decision telemetry is collected | no Mission Brief telemetry test | blocked S/I |
| MB-R13-S1 | Ten thousand active source candidates exist | no Mission Brief performance path | blocked P |
| MB-R13-S2 | Generator exceeds its time budget | no provider performance test | blocked P/G |
| MB-R13-S3 | Event consumer is slow | no Mission Brief stream backpressure profile | blocked P/I |
| MB-R14-S1 | Disable Mission Brief after canary | design/tasks rollback contract only | blocked R/B/I |
| MB-R14-S2 | Re-enable after rollback | design/tasks rollback contract only | blocked R/B/I |
| MB-R15-S1 | Brief identifies a missing prerequisite | spec/design boundary only | partial contract; add negative test |

## Handoff and update rules

- When task 0.2 receives an approved provider contract, update only the affected `G` rows with the contract/version, tenant profile, cost policy, retention, network allowlist and evidence command; do not convert every `partial` row to pass.
- When a direct test or evidence bundle is added, update the smallest scenario row with the exact file or evidence path and profile. Keep failed, skipped, expired, revoked and unknown outcomes visible.
- Before task 0.4 is marked complete, review all 50 scenario rows for stable IDs, direct evidence, required profile, and an explicit owner for every gap. Matrix completeness is not implementation completion.
