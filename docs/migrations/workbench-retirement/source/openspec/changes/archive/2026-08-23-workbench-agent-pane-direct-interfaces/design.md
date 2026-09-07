# Workbench Agent Pane Direct Interfaces — Design

## Context

`/agent` 壳已有 versioned Pane registry（closed params + SAFE_REF 校验 + singleton identity）、load-time fail-closed 的 closed manifest、四态共享 chrome（`panes/agent-pane-state.tsx`）、Sheet 降级（`AgentPaneSheetFrame`）与 ⌘K palette。现有 6 种 pane 中 Operations/Context Map 均为 truthful 禁用。SDK 侧 `WorkbenchClient` 已暴露 assets/workItems/workflow/dailyOps/identity/gateway 等 typed facade（读接口 + 内部提交 Task 的受控 mutation）。本 change Phase 1 在**不新增任何后端代码**的前提下把这批接口注册为 Agent 壳 first-party Pane，并为 `workbench-agent-cli-pane-v1` 与 `workbench-project-data-workspaces-v1` 提前交付注册脚手架与预切片；Phase 2 追加 workItems 的浏览器传输投影（薄 wire 层，业务规则仍在既有 wiservice）。

权威边界：

| 边界 | 决策 | 责任 |
|---|---|---|
| Agent 壳 Pane 组合与四态呈现 | `fit` | 本 change（复用既有 chrome） |
| 数据/动作真相 | `fit`（既有） | 各 domain service + TaskService；Pane 只消费 typed 投影 |
| CLI Pane 合同 | `split-owner` | `workbench-agent-cli-pane-v1`；本 change 仅注册 + fail-closed |
| Project Workspace 完整合同 | `split-owner` | `workbench-project-data-workspaces-v1`；本 change 仅 WorkItem 预切片 |
| 新后端 Operation / 第二执行状态机 | `reject-now` | 不提供（Phase 2 的 workitemshttp 是既有服务的薄 wire 投影，不是新 Operation） |

## Goals / Non-Goals

**Goals:**

- 8 个新 pane kind 全部通过现有三文件声明式注册（registry/manifest/catalog）+ host 渲染分支 + palette 可用性分支落地。
- 可用性永不来自浏览器猜测：identity/gateway 由真实 readiness/overview 投影门控；数据面 Pane 在 pane 内以四态诚实呈现。
- mutation 只走既有 typed client 方法（内部已带 idempotencyKey/expected-version 提交 Task）；identity/gateway Pane 严格只读。
- `project.workspace.v1` 首批 Table/Kanban/Todo 复用现有 `workItems` 接口并共享 SSE 收敛。
- 双语文案齐备；Phase 1 `packages/task-sdk` 零改动，Phase 2 仅新增 http.ts 路由表条目（不改 client/模型语义）。

**Non-Goals:**

- 不实现 CLI command catalog/参数表单/结果视图（无 `cli-client.ts` 前任何此类视图都是伪造投影，违反 pane-composition fail-closed requirement）。
- 不实现 Canvas、automation binding、custom field schema、saved view、batch mutation、WIP policy（留在 project change）。
- 不复用/挂载旧 workspace pane 组件（其全局 CSS 与裸 div 违反四态矩阵）；只复用 client-subset 接口与 query-key 约定。
- 不调高 pane 数量上限（默认 3 / 硬 4 / split depth 2 不变）。
- 不引入 dnd 库；Kanban v1 用键盘/菜单移动。

## Decisions

### 1. 注册形态与 closed params

沿用 `entry(kind, paneType, closedParams(可选集, 必填集, 必填任一集), documentKey, requiredAction)`：

| kind | paneType | closedParams（必填加粗） | requiredAction | group |
|---|---|---|---|---|
| assets | `agent.assets.v1` | **sessionRef**, collectionRef, assetRef, requestedView | `agent.assets.read` | context |
| workItems | `agent.work-items.v1` | **sessionRef**, workItemRef, requestedView | `agent.work-items.read` | workspace |
| workflows | `agent.workflows.v1` | **sessionRef**, definitionRef, runRef | `agent.workflows.read` | workspace |
| dailyOps | `agent.daily-ops.v1` | **sessionRef**, requestedView | `agent.daily-ops.read` | operations |
| identity | `agent.identity.v1` | **sessionRef** | `agent.identity.read` | operations |
| gateway | `agent.gateway.v1` | **sessionRef**, requestedView | `agent.gateway.read` | operations |
| cli | `agent.cli.v1` | **sessionRef**, runtimeRef, scopeRef, projectRef, taskId | `agent.cli.read` | execution |
| projectWorkspace | `project.workspace.v1` | **sessionRef**, projectRef, requestedView, workItemRef | `project.workspace.read` | workspace |

- document key 统一 `standardDocumentKey("sessionRef")`：同 session 重复打开聚焦既有实例（singleton）；CLI 的 runtime/scope/project 后续按其 change 升级为 identity 组成部分时再收紧。
- `REQUESTED_VIEWS` 是共享 closed set，additive 增加 `table|kanban|todo|inbox|approvals|activity|deliveries`；未知值仍 fail-closed。
- manifest `permission` 保持 `"read"`：v1 manifest schema 是 closed 的，pane 投影本身只读，动作委托 typed facade（与 Review pane 的 decide 同先例）。

### 2. 可用性派生（浏览器不猜服务端，也不伪造传输）

可用性分两层（实现于 `use-agent-pane-availability.ts`）：

- **传输投影层（静态）**：`TRANSPORT_READY` 表镜像 SDK http.ts 路由表与服务端 transport 挂载。事实基线（2026-08-22，Phase 2 后）：identity（identityhttp）、workflows（workflowhttp）、workItems（**Phase 2 新增 workitemshttp**：list/get/update/transition 直连 RPC，业务规则全在 wiservice）及 projectWorkspace（全部视图建在 workItems 接口上）可达；gateway SDK 路由已注册但服务端 handler 属 MC 8.3 外部门控（运行时以 offline 诚实呈现）；assets / dailyOps 仍无 SDK 路由与服务端直连 handler（dailyOps 的 inbox action/approval decide mutation 连服务实现都没有，registry 保持 ModeUnavailable），继续 fail-closed。落地新的传输投影后只翻转 `TRANSPORT_READY` 表即可启用，无需重注册。
- **服务端能力层（运行时探测）**：新 hook 集中探测 `identity.getReadiness()` 与 `gateway.getOverview()`，TanStack Query（`retry:false`、`staleTime`、palette 打开时 refetch）。映射：identity `ready|integration_ready|degraded` → 启用（degraded 在 pane 内显示降级横幅）；`needs_contract|unavailable|contract_mismatch` → 禁用 + 原因键。gateway `capabilityState:"available"` → 启用；`needs_contract|degraded|unknown` → 禁用 + 原因键；`{status:"error"}` 或 transport error → offline。
- 传输已注册的数据面（当前为 workflows）：palette 启用，服务端失败在 pane 内由 query error → `PaneUnavailableState` 诚实呈现。
- CLI：恒禁用 `needs_contract`（locale 键 `agent.pane.palette.disabled.cliNeedsContract`），host 渲染分支 `() => null`（contextMap 先例，主 spec 禁止开 stub pane）。

### 3. 渲染器：`panes/direct/**` 轻量实现

- 共享 `direct-pane-shared.tsx`：各 domain 的 client-subset 接口（测试注入点，镜像 workspace pane 的 `WorkItemClient` 模式）、scope hook、与桌面 workspace pane 一致的 query-key 工厂（共享缓存）、错误→四态映射助手。
- 视图只用 `agent-pane-state.tsx` 原语 + design-system composites（status-chip、data-state、inspector-layout、evidence-block）+ TanStack Query。
- workflow run 事件仅在选中 run 时经 `listRunEvents` 拉取；SSE watch 只在确实存在实时面的 hook 中使用且必须 AbortController + sequence 去重（参照 conversation SSE 模式）。

### 4. Project 首批视图（预切片）

- Table：`listWorkItems` 服务端分页（pageToken/pageSize），列 title/status/priority/assignee/updatedAt；行选中 → inspector；`createWorkItem`/`updateWorkItem(fieldMask)`/`transitionWorkItem`。
- Kanban：按 `status` 客户端分组；移动 = `transitionWorkItem(expectedVersion)`；版本冲突保留选择并显示类型化提示；键盘/菜单移动。
- Todo：按 `dueAt` 分区（今天/即将/无日期/已完成）；完成 = transition to `done`；blocked/有验收项的工作项显示不可本地完成的原因。
- 收敛：三个视图共享 `use-workitem-stream.ts`（`watchWorkItemEvents` → `invalidateQueries`），一个事件源同时刷新三视图，不复制 canonical 状态。
- 后续 project change 落地服务端 ProjectQuery/view 语义后替换客户端分组；本预切片不建立第二状态机（所有真相仍来自 WorkItemService 投影）。

### 5. 跨 change 记录（避免路径租约冲突）

- `workbench-agent-cli-pane-v1/design.md` 增加"切片说明"：7.1 的注册脚手架（kind/manifest/禁用 palette 条目/locale）由本 change 提前交付；7.1 保持未勾，待 1.5/6.2 合同与 SDK 落地后由该 change 完成剩余验收。
- `workbench-project-data-workspaces-v1/design.md` 增加"预切片说明"：6.1 的 `project.workspace.v1` 注册与 Table/Kanban/Todo 预切片由本 change 提前交付；6.1–6.3、7.1–7.5 保持未勾，落地后以服务端语义替换客户端分组。
- 本 change 本轮拥有 `agent-pane-{registry,manifest,catalog}.ts` 的写入租约；两个既有 change 的后续实现者应扩展而非重注册。

## Risks / Trade-offs

- **manifest load-time fail-closed**：manifest 与 locale 键必须同 commit；依赖扩展的 manifest/registry 测试兜底。
- **palette 16 kind vs 3 可见上限**：沿用 singleton focus + limit banner，不调上限。
- **共享 closed enum**：`REQUESTED_VIEWS` 新值必须双语文案 + registry 测试矩阵覆盖。
- **探测成本**：仅 identity/gateway 两个 palette 探测，`staleTime` + 打开时 refetch，避免每次击键扇出请求。

## Migration Plan

纯新增注册 + 新文件，无数据迁移。palette 条目对不存在 readiness 投影的面默认启用、失败在 pane 内诚实呈现；CLI 条目从第一天就以 `needs_contract` 禁用出现，合同就绪后同一 catalog 条目转可用（`workbench-agent-cli-pane-v1` 的 MODIFIED 措辞已允许）。

## Open Questions

无。实现顺序与验收以 tasks.md 为准。
