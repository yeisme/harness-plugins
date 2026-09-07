# Lane 6 交付报告：6.1–6.3 Workflow Lens（typed 子图 / descriptor 驱动控制 / selected-run overlay）

状态：实现 + 测试全部完成；验证全绿（见 §5）。未勾选 tasks.md（按指示留给主代理统一验收）；未做 git commit。6.4（Show 投影迁移）与 6.6（E2E）按指示不在本轮。

## 1. 逐任务交付清单（文件级）

全部新文件位于 `apps/web/src/workbench/agent/spatial/workflow-lens/`（未修改 spatial 既有文件）：

- `workflow-lens-models.ts` — 纯模型层（closed 类型 + 纯函数，组件层不可绕过的不变量都在这里固化）：
  - 6.1 `buildWorkflowSubgraphModel`：server canonical `WorkflowDefinition` → React Flow 子图的确定性投影（有向分层布局、typed ports、marker 归并、runtime unknown 覆盖）；同输入恒等输出。
  - 6.1 `draftFromDefinition`：definition → validate 用 draft 的只读重投影（不是本地创作状态）。
  - 6.2 `selectRuntimeActions`：7 个动作（validate/publish/start/pause/resume/cancel/reconcile）的 fail-closed 决策矩阵。优先级：descriptor 缺失→`visible:false`（控件不渲染）→ 过期→`descriptor_expired` → `state≠available`→server reasonCode → unknown 锁（run 级 `unknown_accept` 或 step 级 unknown）→除 reconcile 外全禁 → 动作特定事实缺失（definition/trigger/run optimistic version）→ 对应 unavailable reason → 全过才 enabled。`requiredDecision` 交 server gate，UI 仅展示。
  - 6.3 `nextSequenceOutcome`：封闭 cursor 判定（seed/duplicate/advance/gap），gap 语义对齐 2.4 SurfaceResync。
  - 6.3 `classifyStepRows`：有界 overlay 行（attempt/lease/approval/failure/receipt/evidence），runtime `unknown_accept` 覆盖显示且抑制 failed 终态呈现（spec：MUST NOT mark the step terminal）。
  - `evaluateConnection`：typed port 连接评估（schemaRef 相等才兼容；自环→`workflow_cycle_detected`；端点越界→`workflow_invalid_contract`）——仅本地 UX 提示，绝不写入状态。
  - 预算常量：子图节点 ≤120 / 边 ≤240 / overlay 行 ≤48 / 引用列表 ≤8（与 Spatial Surface 富 DOM ≤200 预算协同）。
- `workflow-lens-subgraph.tsx` — 6.1 typed React Flow 子图组件：nodes/edges 只从 server 模型 useMemo 派生，不使用 `useNodesState/useEdgesState`（不建第二 graph owner）；`WorkflowLensStepNode`/`WorkflowLensStepEdge` 均 memo；`onlyRenderVisibleElements` visible-only 渲染；selection 由父层单独存储不进 nodes 数组；`onConnect` 只产生 UX 提示回调。
- `workflow-lens-controls.tsx` — 6.2 控制条：只渲染 `visible:true` 的动作；descriptor 全缺 → `data-controls-state="needs_contract"` 诚实空态文本（无灰按钮、无伪造控件）；禁用动作 title/data-reason 暴露稳定 reasonCode；激活经父层权威链。
- `selected-run-overlay.tsx` — 6.3 有界 run overlay：只对选中 run 订阅（runRef 变化重建订阅）；`getRun` canonical snapshot 为事实源；watch/listRunEvents 双路径过同一 cursor reducer；gap → stale 标记 + 空 cursor 重入 `getRun`（对齐 2.4 SurfaceResync）→ resynced 清 stale；unknown 步骤渲染 `data-unknown=true` + reconcile-only 提示并保留原 receipt/evidence refs；有界渲染（行 ≤48、evidence ≤8、事件缓冲 ≤64、截断计数如实）。
- `workflow-lens.tsx` — 顶层容器（未来 lens 容器挂载点）：三态可用面（client 缺失→`needs_contract`、查询失败→`offline`、投影到位→`server-authored`）；definition/validation/runs 全部来自 server query；draft 只是重投影；控制动作全部经 `WorkbenchWorkflowClient` typed 方法 + `expectedVersion` + `idempotencyKey`；publish 前强制 server validate + checksum；成功刷新只来自 canonical 返回值。
- `index.ts` — 类型/组件聚合入口；`workflow-lens.css` — 独立 `.workflow-lens-*` 类名（复用既有 `--color-spatial-*` tokens，带 fallback，不与 `.spatial-*` 冲突）。

测试（`apps/web/test/`）：

- `workflow-lens-models.test.ts`（17 条）：typed 子图确定性/分层布局/typed ports、marker 归并、unknown 覆盖、120/240 有界与截断计数、draft 只读重投影（含严格缺省字段）、version 数值化、控制矩阵（缺失→不渲染、过期、`permission_required`、run/step 级 unknown→reconcile-only、definition/trigger/run 事实缺失、definition 级动作不受 run 缺失影响）、cursor 四态、overlay 行分类与 48/8 有界、typed port 连接四路判定。
- `workflow-lens-components.test.tsx`（13 条）：三态可用面（needs_contract/offline/available）、memoization 断言（同输入模型恒等 + rerender 后子图 DOM 集合稳定）、bounded 渲染计数（mounted ≤120、截断如实）、typed ports `data-schema-ref`、descriptor 全缺 → needs_contract 空态无控件、server descriptors → 仅授权动作渲染 + unknown_accept → 仅 reconcile 可用 + 激活被拒零 mutation + reconcile 携带 `runRef/expectedVersion:5`、overlay attempt/lease/receipt/evidence 渲染、unknown 步骤 reconcile-only 且原 receipt/evidence 保留、cursor gap → `gap@9` 摘要 + canonical 重取（`getRun` ≥2 次）+ step:3 来自新快照 + stale 清除、run 缺失 → overlay 空态。

## 2. 挂载点 handoff（未改容器文件，按文件租约）

`spatial-surface.tsx` 的 lens 容器当前在 `lens === "workflow"` 时渲染既有 `WorkflowSubgraph`（L118）。等 Lane 5 稳定后由容器 owner 二选一（不改本 lane 的任何文件即可完成）：

1. **渐进**（推荐先做）：保留既有 `WorkflowSubgraph`，在 `spatial-stage-shell` 内追加完整 Lens：

   ```tsx
   // spatial-surface.tsx imports 增加一行：
   import { WorkflowLens } from "./workflow-lens";
   // L118（lens === "workflow" 分支）之后并列追加：
   {lens === "workflow" && <WorkflowLens client={workflowClient} tenantRef={/* route 既有 tenant */ "tenant:local"} workspaceRef={workspaceRef} runtime={runtime} runtimeActions={actions} />}
   ```

2. **收敛**（6.4 同期）：以 `WorkflowLens`（含 6.2 控制与 6.3 overlay）替换 `WorkflowSubgraph` 挂载点；既有 geometry preview 回调语义已由容器 `previewGeometry` 承担，`WorkflowLensSubgraph.onSelectStep` 可对接 `select()`。

注意：容器现取 `tenantRef` 未透传（route 层有 `tenant` 参数），接线时需一并传入；`startTriggerRef` 需要一个 server-authored trigger 来源（Agent spatial intent `open_runtime_action` 或 ingress），当前缺省 start 诚实禁用（`trigger_unavailable`）。

## 3. design.md 歧义点与裁决

1. **"server validation 驱动"的 validation 范围**：design §5 说"validation markers"来自 server。裁决：子图 marker 只消费 `ValidateDefinition` 的 `WorkflowErrorDetail`（`resourceRef`→stepRef 归并）；本地不做任何 schema 推断，validate 由容器在 definition 到位时自动发起一次（server 仍是唯一发布权威，publish 前强制复验 + `expectedChecksum`）。
2. **ActionDescriptors 的来源面**：`SpatialRuntimeActionDescriptorV1` 目前只从 `SpatialSurfaceSnapshot.overlays[].runtime.allowedActions` 投影。裁决：容器以 props（`runtime` + `runtimeActions`）注入 snapshot 派生的 runtime 面（与既有 `SpatialInspector` 同源），同时在容器内保留纯 SDK 面的 definition 级动作（validate/publish/start 不需要 run 投影），二者统一过同一 `selectRuntimeActions` 矩阵——descriptor 缺失的诚实语义在两个来源上一致。
3. **`start` 的 triggerRef**：spec 允许 start 控件，但 trigger 是 server-authored 事实，v1 无投影来源。裁决：`hasTriggerRef=false` 时 start 渲染但禁用（`trigger_unavailable`），不接受 UI 拼接 trigger；等 5.4/ingress 交付 server trigger 后点亮。
4. **6.3 gap 与 2.4 SurfaceResync 的对齐语义**：SDK `watchRunEvents` 流没有显式 resync 帧（spatial 流才有）。裁决：以"序列跳变 = gap"为唯一判定（`nextSequenceOutcome`），gap → 保留最近确认 overlay 为 stale + 立即空 `afterSequence` 语义重取 canonical `getRun`（等价于 SurfaceResync 空 cursor 重入），不伪造中间 step 迁移；测试以 seq 5→9 跳变验证。
5. **unknown_accept 与 failed 的显示关系**：step 同时投影 `failed`（WorkflowStepRun）与 `unknown_accept`（runtime projection）时。裁决：显示 `unknown_accept` 且抑制 failed 终态语义（`failed:false`）——spec 要求不得自动标记 terminal，原 receipt/correlation refs 照常展示。
6. **React Flow 依赖复用**：`@xyflow/react@^12.11.2` 已在依赖中（既有 Workflow Pane / Project Canvas 同栈），本 lane 零新依赖；custom node/edge、callbacks、options 全部 memoized，selection 单独存储（design §6 硬性要求逐条落实）。

## 4. 明确不做（本轮边界）

- 不修改 `spatial-surface.tsx` / `spatial-state.ts` / `workflow-subgraph.tsx` / lens catalog / worker / pixi renderer（Lane 5 与容器 owner 领地；挂载点见 §2 handoff）。
- 不动 tasks.md checkbox、`Taskfile.yml`、`docs/**`、`service/**`、`packages/task-sdk/**`、evidence runner、全量 gate。
- 6.4（Show 投影迁移）、6.6（E2E）、7.3（Project Canvas 收敛）不在本轮。

## 5. 验证结果（全部通过）

| 检查 | 结果 |
| --- | --- |
| `cd apps/web && bunx vitest run test/workflow-lens-models.test.ts test/workflow-lens-components.test.tsx` | 2 files / 30 tests 全通过 |
| `cd apps/web && bunx tsc --noEmit` | 0 错误 |
| `openspec validate workbench-unified-spatial-creative-runtime-v1 --strict` | valid |
| 回归（spatial-state / spatial-surface-kernel / spatial-ingress / spatial-board / agent-route / canvas-view） | 6 files / 46 tests 全通过 |

## 6. 交接事项（非本 lane 文件）

- `spatial-surface.tsx` L118 附近：§2 的两个挂载选项 + `tenantRef`/`startTriggerRef` 透传需求。
- 5.4 ProposalAuthority 桥接线后，`SpatialRuntimeProjectionV1.allowedActions` 会开始携带真实 descriptor，本 lens 控制面自动点亮，无需本目录改动。
- `startRun` 的 server trigger 投影（`AgentSpatialIntentV1.open_runtime_action` 或 ingress 字段）落地后，把来源传给 `WorkflowLens.startTriggerRef` 即可移除 `trigger_unavailable` 禁用。
