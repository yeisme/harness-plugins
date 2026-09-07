## Why

Workbench 已具备真实 Agent runtime、派生 session、tool proposal/receipt、版本化 Pane registry 和空间化 Operations 组件，但产品入口仍分散在 Overview、Orbit、Boards、Studio、Gateway 与多个专业页面中。当前 `/agent` 虽已拥有真实 session/timeline/composer，却只允许一个 detail pane，不能形成用户确认的“Agent 主对话 + 热插拔插件 Pane”工作方式。现在需要把 Agent workspace 提升为默认产品壳：Pi 是首个 runtime，Agent 对话是持续主画布，Context、Task、Review、Evidence、Operations 及后续 Files/Preview/Assets/Terminal 通过受控 Pane catalog 进入当前 session，同时保持 TaskService、Owner 合同和用户审批是唯一执行权威。

## What Changes

- 新增统一的 Agent-first 工作区：采用「compact rail + session rail + persistent conversation + bounded plugin Pane dock」布局；桌面默认允许 1–3 个可见 Pane、硬上限 4、split depth 最大 2，tablet/mobile 保持单 Pane Sheet，不复制第二套专业客户端或 pane registry。
- 新增版本化 Pane plugin catalog 与 session-scoped layout state；Pane 插入、关闭、聚焦、替换和布局恢复都必须经过 closed descriptor、capability、scope、version 和安全参数校验，达到上限时不得静默替换。
- session 继续是 turn Task 的只读派生分组；新增独立的、用户作用域的 session presentation metadata，用于安全标题覆盖、置顶、归档和已读游标。该 metadata 不成为 Agent/session 生命周期权威，不改变 Task 状态、Owner 状态或 receipt。
- 允许用户在 turn 后台运行时切换 session；当前和后台 session 通过服务端 activity cursor、attention projection 与有界刷新保持真实状态，不为每个 session 建立独立 SSE，也不把时间戳猜测为未读事实。
- 新增 allowlist 化的 Agent presentation intent：Pi 只能请求打开已注册面板、聚焦 safe ref、展示 evidence、请求 review 或预填未发送草稿；不得发送 DOM selector、任意 URL/HTML/JavaScript、组件 props，未知或过期 intent 必须 fail closed。
- presentation intent 只影响 UI 呈现，不具有 mutation 权限。所有工具执行仍保持 `tool proposal -> 用户复核 -> ActionDescriptor/TaskService gate -> receipt/reconcile`；`unknown_accept` 只进入 reconcile，不自动重试或伪造成功。
- 新工作区以 default-off canary 推进，保留现有 conversation workspace 回退；空间化 Operations v2 作为可复用 Pane/后续高级视图存在，不再成为第二条控制面。`/agent` 在产品迁移完成后成为默认入口，旧顶层页面迁入 Pane、advanced route 或 Owner deep link。

## Capabilities

### New Capabilities

- `workbench-agent-session-workspace`: 定义 Agent-first 工作区、派生 session directory、用户作用域 presentation metadata、后台 session 切换/未读/attention、热插拔 Pane dock、布局上限和响应式交互合同。
- `workbench-agent-presentation-intents`: 定义 Pi 对 Workbench UI 的 allowlist 语义控制合同、校验/去重/版本规则、失败行为，以及与现有 tool proposal、ActionDescriptor、TaskService 和 pane registry 的权限边界。

### Modified Capabilities

无。（本 change 组合既有 `workbench-agent-runtime-chat-v1`、`workbench-agent-spatial-operations-v2`、`workbench-orbital-owner-operations` 与 `workbench-task-control-plane`，但不改变它们的 canonical lifecycle、Owner authority、ActionDescriptor 或 PaneLayout 要求。）

## Impact

- 预计影响 `api/proto/workbench/agent/v1alpha1/**`、`api/schema/workbench/agent/**`、`service/internal/agent/**`、相关 repository/transport projection、`packages/task-sdk/src/agent-*`、`apps/web/src/{app,workbench/agent,workbench/navigation}/**`、UI reference 与 focused/component/Playwright/parity tests。
- session presentation 写入必须通过 typed service，以 server-resolved actor、expected revision/ETag 与 idempotency 约束；浏览器不得提交任意 actor identity，也不得直接访问 Owner 或持久化 raw prompt/provider payload/chain-of-thought/private path。
- 不新增 Task 状态机、gate kind、canonical session entity、第二套 pane/layout registry、任意第三方插件执行、DOM/browser automation、任意 shell、Provider 主选择器、多 Agent DAG 或 Owner 专业功能复制。Files/Terminal/Browser/Assets 只有在独立合同完备后才能从 catalog 的 `needs_contract` 晋级。
- 交付证据分为 focused local、四 transport parity、browser/E2E、Provider/canary、deployment/production；前一层通过不得表述为后一层已证明。
- Review Pane 的真实 accept/reject/request-changes/reconcile authority 由 `workbench-agent-proposal-authority-v1` 独立实现；在该 change 与真实 Owner adapter evidence 完成前，本 change 只消费只读 proposal/ActionDescriptor 投影并保持 action `needs_contract`。
