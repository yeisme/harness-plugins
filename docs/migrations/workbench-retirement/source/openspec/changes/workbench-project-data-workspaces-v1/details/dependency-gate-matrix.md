# Project Data Workspaces V1 — 依赖门禁矩阵（Task 0.1）

> 生成时间：2026-08-23。本矩阵只记录可审计的当前状态：每个 required capability 标注 canonical owner、合同版本/digest、完成度、本 change 可消费的 operation 面、外部门禁与 `needs_contract` fallback。规则：**进行中 change 的本地组件证据不得当作 production-ready**；任何 provider 未 Provider Ready 时，消费方只能停在 fail-closed adapter / `needs_contract`。

## 0. 全局准入锚点

| 项 | 值 | 证据 |
| --- | --- | --- |
| Canonical operation registry 合同 | `workbench.operation_registry.v1` | `service/internal/registry/snapshot.go` |
| Canonical synthetic snapshot digest | `sha256:7a027f722beff64228771cd2684bad7591797df28b7b68391ee390a26aa369c1`（14 operations，synthetic+design+orbit+gateway） | `go run ./service/cmd/workbench-operation-contract --output <path>`（2026-08-23 本仓 HEAD） |
| Snapshot 校验规则 | digest 与 contract version 不符即拒绝（fail-closed） | `snapshot.go` `validSnapshotDigest` / `--check` |
| 跨 Release 顺序 | R1→R2→R3→R4→R5，DAG 见 `workbench-production-ga-r5/details/cross-release-integration-delivery-dag.md` | openspec |

Project/Automation 新 operation 只能以 additive 方式注册进同一 registry（tasks 1.4），digest 变化必须生成新的 canonical snapshot 并保持旧 consumer 可忽略新字段。

## 1. R1 Identity（ProjectRolePolicy 依赖）

| 字段 | 当前状态 |
| --- | --- |
| Canonical owner | Identity Platform（外部子项目）+ Workbench consumer（`workbench-identity-tenant-access` 已归档；剩余门禁在 `workbench-identity-tenant-access-r1-gates` 3/5） |
| 合同版本 | `workbench.identity.v0.1`（SDK `packages/task-sdk/src/identity-models.ts` `identityContractVersion`） |
| 完成度 | 6.2 disposable Identity/PostgreSQL integration **closed**（真实 provider PrincipalContext consumer 校验，evidence `20260822102347`、contract canary `20260822085940` 等 5 个 run）；6.3 security/browser/system gate **closed**（commit `49eed54`）；6.4 staging soak **blocked**（staging 环境外部）；6.5 closeout 依赖 6.4 |
| 可消费 operation | principal/tenant/readiness 只读投影（SDK `identity-client.ts`）；membership version 是 ProjectRolePolicy 绑定输入 |
| 外部门禁 | R1 `6.4` staging soak + `6.5` closeout；真实 Kratos 登录链未接入（memory：local principal Subject 为空） |
| 本 change 的用法 | ProjectRolePolicy 只消费 R1 membership version 做 revoke fail-closed；**不签发身份/token**（tasks 4.4） |
| needs_contract fallback | R1 不可用时：project 角色判定 fail-closed（拒绝而非降级匿名）；identity pane 已有 `agent.identity.v1` 只读投影，不受本 change 影响 |

## 2. R3 WorkItem（记录真源）

| 字段 | 当前状态 |
| --- | --- |
| Canonical owner | `WorkItemService`（`service/internal/workitems/**`；R3 主体 `workbench-desktop-daily-operations-r3` 已归档，门禁残项在 `workbench-daily-operations-r3-gates` 0/4） |
| 合同版本 | proto `workbench.workitems.v1alpha1`（13 RPC：create/get/list/update/transition/batch/event 等，`api/proto/workbench/workitems/v1alpha1/workitems.proto`） |
| Registry operation | `workbench.daily.workitem.read` / `workbench.daily.workitem.mutation`（`service/internal/registry/daily.go`） |
| 完成度 | R3 gates 8.2：SQLite+PostgreSQL 14 disposable projection/search/isolation 4/4 PASS（evidence `20260821131837`）；真实 Identity provider + Owner connector 集成仍需外部 CI（保持 pending）。8.3 browser/a11y、8.4 performance/soak、8.5 rollback+closeout 待外部环境 |
| 可消费面 | 本 change 全部 record mutation 经 WorkItemService（tasks 3.1-3.4 additive 扩展 projectRef/datasetRef/custom values，不改既有状态机）；`agent.work-items.v1` pane 已提供浏览器只读/受控投影（含 workitemshttp 薄 wire 层） |
| 外部门禁 | R3 `8.2` real provider 集成、`8.5` closeout（不影响本 change 的 additive schema 工作，但影响"production-ready"宣称） |
| needs_contract fallback | WorkItem project 扩展是本 change 自有交付物，不等待 R3 gates；但 R3 `8.2` 的 real Identity/Owner evidence 未完成前，不得宣称 project dataset 的生产 canary |

## 3. R4 Board / Workflow（Canvas 与 Automation 依赖）

| 字段 | 当前状态 |
| --- | --- |
| Canonical owner | `BoardService`（`service/internal/boards/**`）与 durable Workflow runtime（`service/internal/workflows/**`、`service/cmd/workbench-worker`）；change `workbench-spatial-workflow-automation-r4` 96/118 |
| 合同版本 | `workbench.board.v1alpha1`（board.proto 36 RPC，`service/internal/boards/query/viewport.go` `ContractVersion`）；`workbench.workflow.v1alpha1`（workflow.proto 17 RPC） |
| Registry operation | `workbench.board.v1alpha1.*` / `workbench.workflow.v1alpha1.*` 方法前缀（`service/internal/transport/jsonrpc/handler.go`；resource registry `service/internal/registry/resource.go` 绑定 proto descriptor） |
| 完成度 | 本地组件/PG 证据大量 closed（board event list PG evidence `20260821144414`、target resolver/reconciler component `20260821143248`/`20260821143442`；10.1 本地命令束 + 全量 race 145 包 0 fail）；剩余 22 项多为外部依赖：0.1b/0.1c/0.1e 上游 handoff（R1 6.5、R2 7.3、R3 8.5）、5.0b2b2d1 真实 R1 workload identity provider（终勘确认 identity-platform 不在 monorepo）、10.2-10.4 system/staging gate、9.2a container smoke（沙箱内核限制） |
| 可消费面 | Canvas view 只复用 BoardService 结构化画布（typed node/edge/viewport），画布连线仅表达组织关系或 workflow draft binding，不直接执行 mutation；Project Automation 只绑定**已发布** R4 `WorkflowDefinition`（pin version/checksum，tasks 1.2） |
| 外部门禁 | R4 `10.5` closeout 前，WorkflowDefinition publish/dispatch 的 managed promotion 未完成；automation binding 只能以低风险首切片交付（proposal Required Capability Ledger：deliver-now low-risk slice） |
| needs_contract fallback | WorkflowDefinition 不可发布/未验收时：automation binding 保持 `needs_contract`、UI 显示 catalog disabled；Canvas 结构化画布能力依赖 BoardService 既有 36-RPC 合同，已 closed 的 component/PG 证据可支撑本 change 复用，但 Canvas 内 workflow 编辑入口必须跟随 workflow 合同可用性降级 |

## 4. Agent Pane Registry（`/agent` 单壳宿主）

| 字段 | 当前状态 |
| --- | --- |
| Canonical owner | `workbench-agent-pi-workspace-v1` 84/88（Pane versioned registry + closed manifest + 共享四态 chrome + Sheet 降级 + a11y）；直连 pane 扩展已随 `workbench-agent-pane-direct-interfaces` 归档交付（31/31） |
| 合同版本 | pane kind 是 closed union：`agent.context.v1` … 共 15 种（`apps/web/src/workbench/agent/agent-pane-registry.ts` `agentPaneTypes`），manifest `AgentPaneManifestV1` 全量校验 fail-closed |
| 已注册关键 kind | `agent.assets.v1`、`agent.work-items.v1`、`agent.workflows.v1`、`agent.daily-ops.v1`、`agent.identity.v1`、`agent.gateway.v1`、`agent.cli.v1`（needs_contract 占位）、`project.workspace.v1`（首批 Table/Kanban/Todo 预切片） |
| 完成度 | Pi 剩余：7.4（依赖 PA 8.x 真实 Owner 验收）、8.2 unified workspace 只读 canary、8.3 directory background、8.4 presentation intents canary |
| 外部门禁 | Pi 8.2-8.4 需要 server-authorized cohort（外部）；不影响本 change 注册新 closed pane kind（additive，走 manifest 校验） |
| needs_contract fallback | 缺合同时 catalog disabled + `needs_contract` 四态（既有 `agent.cli.v1` 即此模式）；本 change 新增 `project.schema.v1`、`project.automation.v1`、`project.automation-run.v1` 必须沿用同一 fallback 语义（tasks 6.1） |

## 5. 汇总判定

| Required capability | 准入判定 | 理由 |
| --- | --- | --- |
| ProjectWorkspace/Dataset/schema（自有） | deliver-now | 不等待任何上游 closeout；contract lane 先行（tasks 1.x） |
| WorkItem project 扩展（自有 additive） | deliver-now | R3 主体已归档，扩展不改既有状态机 |
| Canvas 复用 BoardService | deliver-now（复用既有 v1alpha1 合同） | Board 36-RPC 合同稳定；workflow 编辑入口受 workflow 合同门禁 |
| Automation binding 复用 WorkflowDefinition | deliver-now low-risk slice + `needs_contract` fallback | R4 managed promotion（10.2-10.5）未完成，binding 只 pin 已发布 definition，未发布即 fail-closed |
| ProjectRolePolicy 绑定 R1 membership | deliver-now（fail-closed revoke） | R1 consumer 校验已 closed；R1 6.4/6.5 staging 部分不阻塞代码交付，只阻塞生产宣称 |
| Owner 专业对象/动作 | contract-gated（`needs_contract`） | 按 PA 8.1 selector，唯一可选 `eikona.generation.submit`；未验收 Owner 保持 disabled |

**本矩阵结论**：四个上游（R1/R3/R4/Pane registry）都有 canonical owner 与可审计证据；没有一项 required capability 依赖 fixture promotion。阻断条件均已显式列出，供 tasks 0.2 冻结范围时引用。
