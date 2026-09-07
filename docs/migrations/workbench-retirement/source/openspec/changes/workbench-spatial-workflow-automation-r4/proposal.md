# Workbench Spatial 与 Durable Workflow R4 提案

## Why

R3 交付 Pane Desktop 与 Asset/WorkItem/Inbox/Approval/Delivery 日常闭环后，用户仍需要在更大空间中组织跨项目对象，并把重复运营过程交给自动化执行。如果仅在浏览器画布中连线并直接调用多个 Owner，会产生不可恢复 saga、重复 mutation、权限漂移和无法审计的“看似自动化”；R4 必须把 Spatial Board 定位为组织与观察界面，把真正执行放进服务端 durable workflow runtime。

## What Changes

- 建立 tenant-aware `BoardService`：Board、typed node/edge、group、viewport、template、ACL、version、tombstone、audit 与 relation policy。
- 实现可扩展 Spatial Board Pane：pan/zoom/lasso/connect/group/filter/auto-layout/undo/redo、LOD/virtualization、keyboard alternatives、mobile limited edit、10k node 性能预算。
- 建立版本化 WorkflowDefinition、WorkflowRun、WorkflowStep、trigger/input/output safe refs、condition、retry/timeout、approval、owner operation、compensation guidance 与 evidence contract。
- 建立服务端 scheduler/worker/lease/outbox：步骤 claim/heartbeat/expiry、pause/resume/cancel、bounded retry、dead-letter、operator intervention 与 crash recovery。
- 所有 Owner mutation 复用 R2 connector、R1 actor/delegation、Task/Gate/idempotency/receipt/reconcile；`unknown_accept` 必须进入 reconcile，不得自动重放。
- Board 与 workflow 只引用 R3 Asset/WorkItem/Team/Task/Delivery safe refs，不删除或修改 canonical Owner object。
- 增加 automation actor、quota/concurrency/cost/approval policy、workflow/operation kill switch、audit/metrics/traces、runbook 和 fault-injection evidence。
- 不在 R4 实现创作编辑器、任意代码执行、浏览器 saga、通用 BPMN 引擎、跨租户 workflow、无限循环、无审批高风险 mutation 或 production GA 发布流程。

## Capabilities

### New Capabilities

- `workbench-spatial-board`: 定义 BoardService、typed graph、ACL/version/tombstone、viewport/LOD、交互、template、性能与无障碍合同。
- `workbench-durable-workflow-runtime`: 定义 workflow definition/run/step、scheduler/lease、approval、Owner receipt/reconcile、pause/resume/cancel、operator controls、审计与恢复合同。

### Modified Capabilities

- 无；R4 在 R1 actor/access、R2 Owner contracts 和 R3 Asset/WorkItem/Daily Operations safe refs 上增量交付。

## Impact

- Go service：新增 `service/internal/boards/**`、`workflows/**`、`scheduler/**`、`workers/**`、`leases/**`、`operations/**`、GORM repositories/migrations/outbox。
- Web：新增 `apps/web/src/workbench/panes/board/**`、workflow designer/run/step/operator panes；Board 只发 typed command，不拥有 execution state。
- SDK/合同：新增 Board/Node/Edge/Viewport/Template、WorkflowDefinition/Run/Step/Lease/Approval/Intervention/Receipt/Evidence typed contracts与 four-transport parity。
- 数据：保存 Workbench-owned graph/workflow metadata、safe refs、state/version/lease/receipt/audit；不保存 Owner payload/blob/private path、credential、raw prompt 或完整内容。
- 运维：新增 worker deployment profile、queue/lease/readiness、quota、kill switch、dead-letter/reconcile dashboards、SLO/alerts/runbooks。
- 后续依赖：R5 只在 worker crash/recovery、unknown_accept、approval/revoke race、10k board、security/performance/rollback evidence 通过后允许 production GA。
