# dsh-mcp-inspector-v1

## Why

DSH 官方 web ui 对 MCP 完全没有可视化（grep `mcp` 在 `packages/client/*` 零命中）：MCP 工具调用只以 generic 行出现在 trajectory/details 里，用户无法回答"哪些 MCP server 在被使用、每次调用花了多久、有没有失败"。与此同时 `@deepseek-ai/dsh-mcp-client`（0.1.1-rc.2）只把工具注册为 `mcp__<server>__<tool>` 进 `ctx.tools`，server 连接状态只写 `ctx.logger`，无公开合同——任何 UI 都读不到连接健康。

用户需求（2026-08-26）：把 plan/MCP/tasks 可视化对接到 dsh 官方 web ui，以插件形态辅助官方交互体验。plan 已由 `upstream-prs/plan-dock` 覆盖（fork-ready）；tasks 由 `ordo-dsh-plugin-visualization-v1` 与官方 TodoPanel 覆盖；MCP 是唯一空白，由本 change 补齐。

## What Changes

- 新增 client 插件 `@yeisme/dsh-client-ui-mcp-inspector`：在 `conversation.view` 注册一个 "MCP" 只读视图 tab，从会话 ConversationSnapshot（`nodes` 的 tool-result 与 `runningCalls`）按 `mcp__<server>__` 前缀分组派生 per-server 调用活动：调用列表、耗时、错误、运行中标记。零 seam、零 host 改动、纯只读（无调用按钮）。
- 新增 bundle `@yeisme/dsh-mcp-inspector`（`dsh plugin --profile web add`）。
- **L2（本 change 只设计不实现）**：server 目录与连接状态需要 host seam——mcp-client 发布进程级 `ctx.mcpServers.list()`（白名单 schema `mcp.inventory.v1alpha1`：serverName/transport/toolCount/status/lastSyncAt，不含 command line/env/headers）。seam 落地前 tab 头显示 `catalog: unavailable in this version`（capability probe，禁死按钮原则）。seam 的 patch/apply.sh/推 fork pr 分支按治理留待专门会话（用户 2026-08-26 确认）。

## Boundary Decision

`split-owner`：调用事实来自 DSH canonical session events（ConversationSnapshot 投影）；连接状态属 DSH host（缺合同 → 诚实降级）。插件不自建 MCP client、不复制 server 配置、不写任何 owner 状态。

## Capabilities

### New Capabilities
- `dsh-mcp-inspector`: MCP 调用活动的只读会话视图合同（L1）+ server 目录/状态的 degraded 呈现合同（L2 留 seam）。

### Modified Capabilities
无。

## Impact

- 新增 `packages/client/ui-mcp-inspector/`、`packages/bundle/dsh-mcp-inspector/`；不改官方代码、不改既有包。
- 完成门：`pnpm run typecheck && pnpm run test && pnpm run build && pnpm run check:bundles` + `openspec validate dsh-mcp-inspector-v1 --strict`；不含启动官方 `dsh web`（治理约定）。
