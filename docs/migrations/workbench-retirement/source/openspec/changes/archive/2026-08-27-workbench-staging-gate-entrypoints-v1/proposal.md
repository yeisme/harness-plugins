# Workbench Staging 门禁入口提案

## Why

跨 release 关键路径第一段卡在缺 staging 门禁入口：R1 6.4（staging soak、revoke 与 rollback drill）的验证命令 `task identity:soak ENV=staging && task identity:revoke-drill ENV=staging && task release:rollback:dry-run ENV=staging` 中，`identity:soak` 与 `release:rollback:dry-run` 两个 Taskfile target 尚未建立；R3 8.2–8.5 的 verification 同样引用 `task release:rollback:dry-run ENV=staging`。`docs/operations/production-incident-runbook.md` 的 P0/P1 事件矩阵已把 `release:rollback:dry-run` 登记为 INC-CONFIG/INC-DEPLOYMENT/INC-IDENTITY/INC-WORKFLOW 的 Recovery target，registry 定义（`workbench.production_target_registry.v1alpha1`）也已预声明其 available-when-present 合同。仓内 staging soak/rollback 资产（`workbench-project-soak` CLI、`deploy/staging/compose.yaml`、runbook、rollback receipt 验证）已就绪，缺的是可执行、fail-closed、带脱敏证据的门禁入口。

## What Changes

- Taskfile.yml 追加 `identity:soak` target：经 `production:guard`（EFFECT=read）与 `scripts/test-evidence/run.ts` 证据包装，preflight 检查 staging 输入，齐全时驱动既有 `workbench-project-soak run`（含 `--identity-rotation-attempt-id`）执行 24h staging soak；缺 staging 环境时 fail-closed 并输出脱敏缺失说明。
- Taskfile.yml 追加 `release:rollback:dry-run` target：经 `production:guard`（EFFECT=plan）与证据包装，preflight 检查 staging 输入，齐全时驱动既有 `workbench-project-soak validate-rollback` 验证已记录的 staging rollback receipt，并用 `workbench-release runbook validate` 复核 rollback 命令合同；不执行真实 rollback、不授予 promotion authority。
- 新增 `scripts/staging-gate-entrypoints.ts` fail-closed preflight/分发脚本与 `tests/staging-gate-entrypoints.test.ts`：缺失输入只输出变量名（不输出值），exit 5。
- 一致性核验：`release:rollback:dry-run` 出现在 Taskfile 后，registry 中该 target 由 `planned` 翻转为 `available`；经核验，runbook 四个事件行仍引用其他 planned/provider-blocked target，聚合 Current gate 不变，`docs/operations/production-incident-runbook.md` 与既有 runbook/drill 合同测试无需改动且保持全绿。

## Capabilities

### New Capabilities
- `workbench-staging-gate-entrypoints`: staging 门禁入口（`identity:soak`、`release:rollback:dry-run`）的 fail-closed 执行合同、证据与脱敏要求。

### Modified Capabilities
<!-- 无既有 spec 的 requirement 变更；runbook/registry 为合同一致性后果，不改需求语义。 -->

## Impact

- Affected code: `Taskfile.yml`（追加两个 target）、`scripts/staging-gate-entrypoints.ts`（新增）、`tests/staging-gate-entrypoints.test.ts`（新增）。
- 复用资产：`service/cmd/workbench-project-soak`、`service/internal/projectsoak`、`deploy/staging/compose.yaml`、`scripts/test-evidence/run.ts`、`scripts/production-task-contract.ts`（production:guard）、`workbench-release runbook validate`。
- 解锁：R1 6.4→6.5、R3 8.2→8.5 的 staging operator 执行面；不授予 staging/production authority，不执行真实 rollback。
