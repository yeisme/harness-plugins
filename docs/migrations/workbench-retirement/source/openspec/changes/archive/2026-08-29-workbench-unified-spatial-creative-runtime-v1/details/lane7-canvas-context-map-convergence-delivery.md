# Lane 7.3 交付报告：Project Canvas 与 Context Map 重复 viewport/state owner 收敛到 Spatial Surface 适配器

状态：实现 + 测试全部完成，验证全绿（见 §5）。未勾选 tasks.md（按指示留给主代理统一验收）；未做 git commit。
范围：仅 7.3。6.4（Show 投影迁移）、6.6（E2E）归并行 lane；`spatial-surface.tsx`、`spatial-ingress.ts`、`agent-route.tsx`、`spatial-surface-kernel.test.tsx` 的工作区改动属 6.4 agent，本 lane 未触碰。

## 1. 裁决与理由（按裁决阶梯记录）

### Project Canvas → 裁决阶梯第 2 档：「单 viewport owner + 领域组件」

- **证据**：`canvas-view.tsx` 旧实现维护 `useNodesState`/`useEdgesState` 第二 graph owner + 一个 reconcile effect（把投影 nodes 合并进本地 nodes 状态、保留拖拽位置）。这正中 design.md §1「Web 只维护 camera、selected refs、active Lens、temporary overlay、focus return 与未提交 draft」与 §6「selection 单独存储，不能订阅完整 nodes array」的违例模式。
- **为何不是第 1 档（纯收敛删除）**：Canvas 的数据面是 `ProjectRecordRow`（project-data 6.2 records typed rows），而 Spatial Surface viewport（`SpatialPrimitiveV1`）没有 `version/statusToken/versioned work_item` 语义的等价合同（`sourceVersion` 字符串无 expected-version 含义）。领域特有的「组织关系草稿 + 键盘等价移动」也非 Surface 投影覆盖。强行把 rows 升维成 surface query 需要 service 端新投影（越出租约）。
- **落地**：Canvas 保留为 Pane 内领域视图（`projectWorkspace` pane 的 `canvas` view），但**删除重复的 viewport/graph state owner**——所有 graph 状态改为「typed rows + 未提交 draft → 纯投影」派生，与 `WorkflowSubgraph` 先例（Lane 6 报告 §1：nodes/edges 只从 server 模型 useMemo 派生，不使用 useNodesState/useEdgesState）同构。

### Context Map → 裁决阶梯第 1 档：收敛删除 Web 端重复注册

- **证据**：`contextMap` pane（`agent.context-map.v1`）在 Web 上的实现从未完成注册合同：`agent-pane-host.tsx` 的 runtime slot 恒渲染 `null`（注释自证「此分支不再可达」），palette 恒 fail-closed 禁用（「上下文地图合同尚未注册」）。它只是 manifest/registry/palette/resolver 里的一个**死注册面**，却让 Context pack 的对象关系视图出现第二个候选 owner。
- **数据面等价覆盖成立**：context pack 的对象只读视图已由 context pane（`ContextCanvas`，`AgentContextPackV1` safe projection：objects/ref/summaryLabel/freshness/capabilityState）承载；Board 级对象关系归属 Spatial Surface viewport（`workbench-spatial-surface` spec：bounded tiles + accessible object list「without creating a second data owner」）。
- **合同边界（不动）**：SDK `AgentPaneType` enum 与 service `AgentPaneContextMap` 常量按 additive closed enum 保留（租约禁止改 `service/**`、`packages/task-sdk/**`）；Web 注销后，指向该 paneType 的 intent 在 resolver 反查处自然 fail-closed（`unknown pane type → null → unsupported_safe_view`），与 palette 原禁用语义一致，只是从「UI 禁用」收敛为「注册表 fail-closed」——更诚实且少一个死分支。

## 2. 收敛清单：删除项 → 职责去向表

### Project Canvas（`apps/web/src/workbench/project/canvas/canvas-view.tsx` 重写 + 新投影适配器）

| 删除的重复 owner | 职责去向 |
| --- | --- |
| `useNodesState(projectedNodes)` 本地 nodes 副本 + reconcile effect（`setNodes` 合并投影与拖拽位置） | **删除**。nodes 由 `buildProjectCanvasNodes()`（新 `agent/spatial/project-record-projection.ts`）从 `rows + draftPositions` 每次渲染纯派生；拖拽位置收进未提交 `draftPositions` draft（design §1 允许的「未提交 draft」） |
| `useEdgesState<Edge>([])` 本地 edges 副本 | **删除**。边由 `buildProjectCanvasEdges()` 从 `draftRelations` draft + 可见引用集纯派生 |
| `CanvasLOD`/`lodForZoom` 私有 zoom 阈值表（1.2/0.6 断点，与 spatial kernel 0.9/0.45 双轨） | **删除**。LOD 一律消费 `agent/spatial/spatial-state.ts` 的 `spatialLOD()`（Spatial Surface kernel 唯一 resolver）；组件只镜像 zoom 数值供 badge/LOD 展示 |
| 网格布局内联公式 | 收进 `projectCanvasGridPosition()`（投影适配器，同输入恒等输出） |
| `onNodeClick → onSelect`、搜索/图层过滤、键盘 nudge/connect、空态画布 chrome | **保留**（领域交互，单 viewport owner 下只消费投影；Mutation 边界注释不变：onConnect 绝不 dispatch workflow / transition WorkItem） |

新增文件：`apps/web/src/workbench/agent/spatial/project-record-projection.ts`（纯投影模块，无 React 状态；中文注释固化「单 viewport owner / draft 不回写 canonical / LOD 唯一 resolver」不变量）。

### Context Map（Web 注册面删除）

| 删除项 | 文件 | 职责去向 |
| --- | --- | --- |
| `contextMap: "agent.context-map.v1"` 注册 + `contextMap` entry + `AgentPaneComponentRuntime.contextMap` slot + `registeredComponents.contextMap` + `keysByKind.contextMap` | `agent-pane-registry.ts` | context pack 只读关系视图 → context pane（`ContextCanvas`，既有，未改）；Board 对象关系 → Spatial Surface viewport |
| `workbench.agent-pane.contextMap` manifest + `"contextMap"` iconName 枚举值 | `agent-pane-manifest.ts` | palette 候选消失（原为恒禁用死项）；`MapIcon` 图标映射保留（icons/registry 未动，合同不变） |
| `case "contextMap"` palette 候选分支 | `agent-conversation-workspace.tsx` | 同上；候选列表由 catalog 派生，自动少一项 |
| `case "contextMap"` intent→request 映射 | `agent-presentation-intent-resolver.ts` | fail-closed 语义保留：`kindByPaneType`（字符串比较）反查 null → `unsupported_safe_view`；SDK enum 收窄的类型差异在注释中记录 |
| `contextMap: () => null` runtime slot | `panes/agent-pane-host.tsx` | 死分支移除；行为等价（原本也渲染 null） |

**明确保留**：`ContextCanvas` 组件本体（context pane 的 read-only pack 视图，非 viewport owner）、`prepare/refresh/reauthorize/detach` 显式动作链、i18n locale keys（`agent.detail.pane.contextMap` 等留在 catalog——删除 locale 条目属 `api/locale/**` 与 codegen 面，超出本 lane 允许目录；多余 key 不触发 check-i18n 失败，只增 bootstrap 预算余量压力，见 §4 handoff）。

### 测试收敛（断链清零）

| 测试 | 收敛 |
| --- | --- |
| `test/canvas-view.test.tsx` | 删除 `useNodesState/useEdgesState` mock（不再需要）；新增投影适配器四测：`spatialLOD` 唯一 resolver 阈值、网格投影确定性（同输入恒等输出）、draft 位置覆盖、draft 边可见性过滤（含越界引用不投影）；组件五测保留（渲染/过滤/草稿无 mutation/键盘等价/空态 chrome） |
| `test/agent-pane-layout.test.ts` / `test/agent-pane-manifest.test.ts` | catalog 封闭清单 17→16；closedParams 期望表删 contextMap 行；「contextMap 已收敛」负断言（`builtinAgentPaneManifests` 无 `agent.context-map.v1`） |
| `test/agent-pane-registry.test.ts` | 删 contextMap resolve/invalid fixtures；两处 runtime slot Provider 值删 `contextMap` 键 |
| `test/agent-pane-palette.test.tsx` | fail-closed 用例改以 `operations` 禁用项为代表（contextMap 候选已不存在）；断言语义不变（禁用项可见+原因+点击不打开） |
| `test/agent-conversation-workspace.test.tsx` | palette 可用性测试改为负断言「上下文地图候选已收敛不再渲染」；stale Context Map intent 测试**保留原样**——它验证 SDK 合同层的 `stale_view_request` fail-closed，与 Web 注册无关，恰好证明收敛后 intent 面依旧诚实拒绝 |

## 3. 不变量记录（代码中文注释同步落位）

- 单 viewport owner：Canvas 的 nodes/edges 全部由投影派生，无第二 graph 状态；Web 侧 context 对象关系只有一个读面（context pane pack 视图），Board 关系唯一归 Spatial Surface。
- 投影消费不复制状态：`project-record-projection.ts` 无 React 状态、无副作用；`WorkflowSubgraph` 先例模式（Lane 6）在 project 域复用。
- Draft 不回写 canonical：组织关系草稿/布局草稿只在渲染层投影，onConnect 零 mutation（原 8.3 语义原样保留）。

## 4. Handoff（非本 lane 文件，交接给主代理/容器 owner）

1. **i18n 死键**：`agent.detail.pane.contextMap`、`agent.pane.catalog.contextMap`、`agent.detail.contextMap.unavailable` 在 Web 源码中已无消费者，但仍在 `api/locale/source/**` 与 generated catalog 中（删除需 locale codegen 流程，超出本 lane 文件租约）。bootstrap 预算（MAX_BOOTSTRAP_KEYS）有富余，不阻塞；建议归档 change 时顺带清理。
2. **基线噪声（非 7.3 引入，已用 stash 双向验证）**：`bun scripts/check-i18n.ts` 在改动前即失败（大量 `agent.detail.project.*`/`agent.spatial.review.*` 死键或未注册键，属 R3–R5 历史基线）；`test/spatial-surface-kernel.test.tsx` 一度失败系 6.4 agent 在 `spatial-surface.tsx` 挂 `create-show-entry`（双 `role="status"`）所致，6.4 随后自行修复，本 lane 最终回归 19/19 全绿。
3. **`tsc --noEmit` 当前唯一错误**位于 6.4 agent 未跟踪 WIP 文件 `test/creative-production-lens.test.tsx:260`（`gates` 属性类型），该文件自身 29 vitest 用例全过——归 6.4 owner 收口，与 7.3 无关（7.3 全部触达文件 0 类型错误）。

## 5. 验证结果（全部通过）

| 检查 | 结果 |
| --- | --- |
| `cd apps/web && bunx tsc --noEmit` | 7.3 触达文件 0 错误（全量唯一错误在 6.4 未跟踪 WIP 文件，见 §4.3；本 lane 早期全量跑过 EXIT:0） |
| `bunx vitest run test/canvas-view.test.tsx test/agent-pane-{registry,manifest,layout}-test…`（9 个受影响文件，含 workspace/resolver/palette/project pane/ui-quality） | 9 files / 198 tests 全通过 |
| 回归抽查 `bunx vitest run test/spatial- test/project-` | 19 files / 124 tests 全通过（含 6.4 修复后的 spatial-surface-kernel） |
| `bunx vitest run test/agent-`（额外加固） | 14 files / 240 tests 全通过 |
| `openspec validate workbench-unified-spatial-creative-runtime-v1 --strict` | valid |
| e2e 引用扫描 | `e2e/**` 无 `contextMap/上下文地图` 引用；`project-workspace-responsive.spec.ts` 的 canvas 键盘等价断言（`data-canvas-*`）与收敛后实现标记完全兼容 |
