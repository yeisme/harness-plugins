## 1. Contract and service composition

- [x] 1.1 Add FilmProjectIndex and readiness projection contracts
  - Owned paths：`api/proto`、`packages/task-sdk` models、Go service types。
  - Acceptance：refs/revision/digest/freshness、scene summaries、roles/decisions/receipts；no owner payload/blob/path。
  - Verify：contract/model tests and `buf lint`。

- [x] 1.2 Add owner adapter composition and projection service
  - Owned paths：`service/internal/adapters`、application/service packages。
  - Depends on：1.1。
  - Acceptance：allowlisted typed owner APIs；stale/unavailable/partial behavior；no browser direct owner access。
  - Verify：Go service unit/integration tests。
  - Note：当前为 allowlisted provider-free fixture adapter；Auctra/Eikona/Sonora/Aigora/Scaena/Ordo 的 exact published SDK binding 仍待各 Owner 发布稳定消费合同后单独接线，未被标记为 production available。

- [x] 1.3 Register Film operations across SDK/HTTP/gRPC/JSON-RPC
  - Depends on：1.2。
  - Acceptance：permission/cost/expected-version/idempotency/error/receipt parity；`unknown_accept` 端到端保留且只可 reconcile/refetch。
  - Verify：`service/test/conformance/film_production_transport_parity_test.go`、SDK mapping tests and Go transport parity tests。

## 2. Web experience

- [x] 2.1 Add Film Production Readiness lens inside `/agent`
  - Owned paths：`apps/web/src/workbench/agent/spatial` and approved pane registry paths。
  - Depends on：1.1–1.3。
  - Acceptance：Project→Sequence→Scene→Shot/Asset hierarchy、milestones、scene closure、audio/budget/run/continuity/final summaries。
  - Verify：Vitest/Testing Library component tests。

- [x] 2.2 Add shared decision box and owner receipt refresh
  - Depends on：2.1。
  - Acceptance：no optimistic canonical terminal；cross-client completion/stale/unknown-accept/already-decided；project-lead-only actions。
  - Verify：component/SDK tests。

- [x] 2.3 Add editorial/package handoff projection without timeline editor
  - Depends on：2.1。
  - Acceptance：working/sealed package、external editor status、return/rebase/final verification refs；no local NLE state。
  - Verify：component and route tests。

## 3. Evidence and docs

- [x] 3.1 Add browser and service integration evidence
  - Depends on：2.2、2.3。
  - Acceptance：blocked/stale/unavailable-or-needs-contract/decision-unknown-accept/external-return/final-receipt paths；`scripts/test-evidence/run.ts` 生成标准六件 bundle，redaction violation 为 0。
  - Verify：`bun run test:integration` and focused Playwright scenario。

- [x] 3.2 Update product/interface/operation docs
  - Acceptance：Workbench composition boundary、four profiles、milestones and no-second-NLE/state-machine are explicit。
  - Verify：`git diff --check -- docs openspec/changes/workbench-film-production-readiness-v1`。

- [x] 3.3 Run final gates
  - Depends on：3.1、3.2。
  - Verify：`openspec validate --all --strict`、`buf lint`、`CGO_ENABLED=0 go test ./service/...`、`bun run typecheck`、`bun test`、`bun run build`、`bun run test:contract`。
  - Final gate run（2026-08-31 13:1x，共享脏树上复跑全绿）：`openspec validate --all --strict` 59/59；`buf lint` 0；`CGO_ENABLED=0 go test ./service/...` 全 ok；`bun run typecheck` 通过；`bun test` 790 pass/0 fail；`bun run build` 四产物；`bun run test:contract` 489 pass/0 fail——上一轮记录的 watcher 5 秒瞬态超时未复现。全局 `check:i18n` 仍由并行未登记的 project/login key 阻断，与本 change 的 film locale keys 无关（非本 change 门）。
