# Workbench Agent Pane Direct Interfaces

## Why

`/agent` 壳的 Pane 基建（versioned registry、closed manifest、共享四态 chrome、Sheet 降级、a11y）已经完备并通过 `workbench-agent-pi-workspace-v1` 交付，但 catalog 中只有 6 种 pane，其中 Operations 等待 Owner target、Context Map 等待合同。与此同时，SDK 已经由四 transport 投影提供了大量可直接消费的 typed 只读/受控接口：assets、workItems、workflow definitions/runs、daily ops inbox/approvals/activity、identity principal/tenant/readiness、gateway overview。这些接口没有任何一个进入 Agent 壳，用户在会话中查看工作项、资产、身份或网关状态必须离开 `/agent` 去旧 route。

`workbench-agent-cli-pane-v1` 与 `workbench-project-data-workspaces-v1` 的 Web lane 正式依赖各自的合同 lane，短期内不会开 pane。本 change 以"直连接口"为原则补齐这批 Pane：不新建任何后端 Operation、contract 或状态机，仅把现有 typed 接口投影为 first-party Pane，并在两个既有 change 中记录提前交付的注册脚手架与预切片，避免路径租约冲突。

## What Changes

- 新增 8 个 first-party pane kind 并通过现有 versioned registry + closed manifest 注册：`agent.assets.v1`、`agent.work-items.v1`、`agent.workflows.v1`、`agent.daily-ops.v1`、`agent.identity.v1`、`agent.gateway.v1`、`agent.cli.v1`（仅注册 + fail-closed `needs_contract` 占位）、`project.workspace.v1`（首批 Table/Kanban/Todo 视图）。
- 所有数据面 Pane 直接消费现有 SDK typed client（`workbenchClient.assets/workItems/workflow/dailyOps/identity/gateway`）。Phase 2 为 workItems 补齐浏览器传输投影：`workitemshttp` 薄 wire 层（list/get/update/transition 直连 RPC + SDK http.ts 路由），业务规则（authorization/版本 CAS/acceptance gate）全部留在既有 `wiservice.Service`，不新增 Operation 或第二执行状态机；其余域的 mutation 仍只经 Task 控制面。
- 可用性由「传输真值 + 服务端真实投影」两层派生：Phase 2 已交付 workItems 传输投影（`workitemshttp` 直连 RPC + SDK 路由，解锁 workItems pane 与 project 预切片）；assets/dailyOps 仍无浏览器传输投影，以 `needs_contract` 传输原因在 palette fail-closed，渲染器就位、落地后翻转静态表即启用；传输已注册的面中，identity/gateway 由 `identity.getReadiness()` 与 `gateway.getOverview().capabilityState` 门控并给出诚实禁用原因（gateway 服务端 handler 属 MC 8.3 外部门控，运行时以 offline 诚实呈现），workflows 开放进入、由 query `retry:false` + 类型化错误在 Pane 内呈现四态；CLI Pane 保持 `needs_contract` 禁用直至 `workbench-agent-cli-pane-v1` 合同就绪（该 change 已持有 pane-composition 对应 requirement 的 MODIFIED，本 change 只交叉引用、不重复修改）。
- Pane command palette 新增 `workspace` 分组（工作区），全部文案 zh-CN/en-US 双语落库，不以 inline fallback 作为完成证据。
- `project.workspace.v1` 首批视图在现有 `workItems` 接口上交付 Table（服务端分页 + 字段编辑）、Kanban（status 分组 + `transitionWorkItem(expectedVersion)` + 冲突保留选择）、Todo（dueAt 分区 + 完成 transition + blocked/acceptance 诚实不可本地完成）；三个视图共享一个 `watchWorkItemEvents` SSE hook 实现同源收敛。Canvas、automation、custom fields、saved views 继续保留在 `workbench-project-data-workspaces-v1`。
- 渲染器不复用旧 workspace pane 的全局 CSS 组件，只复用其 client-subset 注入接口与 query-key 约定（与桌面 workspace pane 共享 query cache）；Agent 壳渲染器全部基于 `agent-pane-state.tsx` 四态原语与 design-system composites。

### Required Capability Ledger

| 能力 | 准入 | 交付状态 | Canonical owner | 可见宿主 |
| --- | --- | --- | --- | --- |
| Workflows / Identity 直连只读 Pane（传输已注册，立即可用） | `fit` | deliver-now | 既有 domain service | Agent 壳注册 Pane |
| Assets / Daily Ops 直连 Pane | `fit` | 注册+渲染器交付，palette `needs_contract`（无 SDK 路由/直连 handler；dailyOps mutation 无服务实现，registry ModeUnavailable） | 既有 domain service + TaskService | Agent 壳禁用条目 |
| Gateway console 只读投影 Pane | `fit` | deliver-now（SDK 路由已注册；服务端 handler 等 MC 8.3，offline 诚实呈现） | 既有 gateway read 接口（无 mutation） | Operations 分组 Pane |
| WorkItems 直连 Pane | `fit` | deliver-now（Phase 2 传输投影已落地：workitemshttp list/get/update/transition） | wiservice.Service（authorization/CAS/acceptance gate 不变） | workspace 分组可用条目 |
| CLI Pane 注册脚手架 | `fit` | 提前交付注册 + fail-closed | `workbench-agent-cli-pane-v1` 合同（后续） | execution 分组禁用条目 |
| Project Workspace 首批 Table/Kanban/Todo 视图 | `fit + reuse` | deliver-now（随 workItems 传输翻转启用；服务端 ProjectQuery 语义仍留 project change） | WorkItemService（既有接口） | workspace 分组可用条目 |
| Files / Browser Preview Pane | `fit` | retain-next（无合同不注册渲染） | 获批 host/proxy 合同（后续） | 不提供入口 |
| Canvas / automation / custom fields / saved views | `fit` | 保留在 project change | Project service（后续合同） | project change 交付 |
| 新后端 Operation / transport endpoint / 第二执行状态机 | — | `reject-now` | 无 | 不提供 |

## Capabilities

### New Capabilities

- `workbench-agent-pane-interfaces`: 直连接口 Pane 的注册、服务端派生可用性、四态与共享 chrome、typed mutation 边界、palette 分组与双语、共享 query cache、以及 project 首批视图预切片的合同。

### Modified Capabilities

- 无。`workbench-agent-pane-composition` 的既有 requirement 继续约束本批 Pane（四态矩阵、共享 chrome、fail-closed、人类可读标签）；其"Panes without a contract" requirement 的 MODIFIED 已由 `workbench-agent-cli-pane-v1` 持有，本 change 交叉引用而不重复修改。

## Impact

- Web：`apps/web/src/workbench/agent/agent-pane-{registry,manifest,catalog}.ts`、`panes/pane-command-palette.tsx`、`panes/agent-pane-host.tsx`、`agent-conversation-workspace.tsx`、新 `panes/direct/**` 渲染器、design-system 图标注册。
- Locale：`api/locale/source/{zh-CN,en-US}/agent/{pane,detail}.json` 与生成 bundle。
- 合同：不新增 proto/JSON Schema/Operation；SDK 仅新增 http.ts workitem 路由条目（路由合同测试覆盖），client/模型语义零改动。
- 既有 change：`workbench-agent-cli-pane-v1/design.md` 记录 7.1 注册脚手架提前交付（7.1 保持未勾）；`workbench-project-data-workspaces-v1/design.md` 记录 6.1/7.x 预切片。
- 文档：blueprint §6.4 目录、UI Spec §5.2 首批 Pane、interfaces §5.4 pane↔接口映射。
- 测试：registry/manifest/palette/availability Vitest、各 Pane 组件测试、Playwright palette 与直连 Pane 流程。
