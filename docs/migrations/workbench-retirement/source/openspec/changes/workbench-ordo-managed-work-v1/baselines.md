# WB-OMW 冻结基线与复用映射（task 1.1）

状态：2026-09-05 冻结。基线证据 `bun run test:contract` → 637 pass / 0 fail / 83 files / exit 0（同日复跑与 `workbench-text-development-studio-v1` 2.3 记录一致）；`openspec validate workbench-ordo-managed-work-v1 --strict --no-interactive` valid。

## 复用映射（旧 consumer 面 → 通用 adapter 接管点）

| 旧面 | 现落点（冻结，不改语义） | 本 change 接管方式 |
| --- | --- | --- |
| Ordo owner 注册与合同区间 | `service/internal/owners/catalog/catalog.go`（owner `ordo`，ContractRange 1.0–1.9，Readiness=Exploratory，ConnectorState=needs_contract） | adapter 复用同一 owner 合同校验，不改 ContractRange 语义 |
| Team control BFF 路由 | `service/internal/transport/textdevhttp/handler.go` `POST team/plans:preview`、`team/plans:simulate`、`team/runs:start`、`team/runs/<id>:cancel`、`team/runs/<id>:reconcile` | task 2.1 通用 adapter 承接 dispatch；旧路由保持 exact-plan/只读语义，不升级为 managed grant |
| SDK typed client | `packages/task-sdk/src/text-development-client.ts`（previewTeamPlan/simulateTeamPlan/startTeamRun/cancelTeamRun + operationId 映射 PreviewOrdoTeamPlan 等） | managed 新方法平行新增，不复用/不改名旧方法 |
| SDK normalizer/safe refs | `packages/task-sdk/src/text-development-models.ts`（normalizeOrdoTeamPlan/RunStatus/Simulation、isSafeTeamControlRef、OrdoTeamPlanProjectionV1alpha1/OrdoTeamRunStatusV1alpha1/OrdoTeamSimulationV1alpha1） | task 1.2 新协议 normalizer 参照同套 fail-closed 约定；unknown major/unsafe 字段拒绝 |
| Web 领域接线 | `apps/web/src/workbench/agent/text-development/team-plan.ts`、team-run.ts、team-simulation*.ts(x)、team-template*.ts(x)、team-canary*.ts(x)、`apps/web/src/features/team/team-panel.tsx`、`apps/web/src/pages/team.tsx` | 保留为 Text Development 领域面（studio 2.4 只做领域接线）；新 registered Pane 走 design-system/PaneFrame，不加第二 composer/业务侧栏 |
| Proposal/Task lifecycle | `service/internal/core`（TaskService 唯一权威）+ `service/internal/proposalauthority`（accept 仍进 TaskService） | Task↔owner operation↔work/run 固定 refs；不复制 Ordo work/run 状态机、不新增第二 scheduler |
| 服务接线 | `service/internal/workflowdeps/builder.go`、`service/internal/runtime/runtime.go` | adapter 注册走既有 workflowdeps/runtime 接线，不新增传输层 handler |

## Baseline fixtures

- 合同基线套件即 `bun run test:contract`（`bun test packages/task-sdk tests/conformance/sdk-transports.test.ts`，83 files / 637 tests），其中 `packages/task-sdk/test/text-development-models.test.ts`、`text-development-client.test.ts`、`harness-contract.test.ts` 为旧 Team/harness 消费合同的锚点 fixtures。
- 旧合同锚定不变量：`/agent` 主壳与既有 Task/Proposal/Team/locale 语义不改；旧 Team Plan exact revision approval 精确匹配、不自动升级；`unknown_accept` 不自动重试；Browser 不持 Ordo credential、不直连 owner。
- WB-OMW-LEGACY 后续验证一律先复跑本套件对比本冻结计数，计数漂移须归因后再引用。
