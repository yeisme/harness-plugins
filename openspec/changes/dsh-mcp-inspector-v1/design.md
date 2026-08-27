# Design: dsh-mcp-inspector-v1

## L1 数据路径（零 seam，本 change 交付）

`conversation.view` 是 session-scope list slot（view tab 环；trajectory 同款注册法）。
组件经 `ConvViewProps.useSession(selector)` 订阅 `ConversationSnapshot`：

- `nodes` 中 `kind === 'tool-result'` 的节点携带 `call.name`（配对 tool/call 回填）、
  `callTime`、`time`、`isError`——已落地的调用。
- `runningCalls`（`RunningToolCall { name, time }`）——进行中的调用。
- `mcp__<server>__<tool>` 命名解析：server 名允许 `[A-Za-z0-9_-]`（含下划线），
  超长/非法名由 mcp-client 追加 12 位 hash；取 `mcp__` 后到下一个 `__` 为 server；
  解析不出唯一 server 的条目丢弃（不猜）。

派生为纯函数 `deriveMcpActivity(nodes, runningCalls) -> McpServerActivity[]`（结构化
输入类型，不依赖 React/框架，单测覆盖）；组件只做渲染。

## 视图

- tab 名 "MCP"（locale zh/en），注册 `order: 20`（trajectory 为 10）。
- 每个 server 一张卡：server 名、调用数、错误数；最近调用列表（工具名、相对时间、
  耗时 `time - callTime`、错误 badge、运行中 spinner 文本）。
- 空态：`No MCP tool activity in this session`。
- 头部横幅：`catalog: unavailable in this version`——L2 seam 未落地时的诚实降级，
  不渲染任何连接状态暗示。

## L2 seam 设计（只设计不推送）

mcp-client 增加进程级 cordis service：

```ts
ctx.mcpServers.list(): Array<{
  serverName: string       // 白名单字段；不含 command line/env/headers
  transport: 'stdio' | 'streamable-http'
  toolCount: number
  status: 'connected' | 'disconnected' | 'syncing'
  lastSyncAt: number
}>
```

wire 值 schema `mcp.inventory.v1alpha1`（对齐 ordo agent_ops 先例的 safe projection
要求）。实现载体：`upstream-prs/mcp-inventory/`（changes.patch + new-files +
apply.sh + README，推 `yeisme/deepseek-harness` 的 `pr/mcp-inventory` 分支）。
**用户 2026-08-26 决定：本 change 只写入本设计，patch 与推送留待专门会话。**

## Non-goals

- 不提供工具调用按钮（调用是模型行为，不是用户 affordance）。
- 不复制 DSH MCP 配置或自建 client。
- 不做跨 session 聚合（本 tab 是 session-scope）。
- 不占用 `shell.workspace.right`（pane-workbench 的深度集成留待 visual-system
  adoption 后续任务，避免与在途 pane-workspace 体验工作冲突）。

## 一致性

- 与 `dsh-unified-panel-visual-system-v1` 的 token 体系对齐是后续 adoption 任务
  （本 change 先以内联最小样式交付，tab 环复用官方 chrome）。
- capability probe 先行（L2 横幅）、禁死按钮，与 `ui-conversation-rewrite` 模式一致。
