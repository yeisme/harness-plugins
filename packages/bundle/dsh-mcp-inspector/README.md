# @yeisme/dsh-mcp-inspector

DSH 官方 web ui 的 **Tools** 会话视图 bundle：管理 Skills / MCP / 内置工具，并显示本会话工具活动与可选 MCP health。

```bash
dsh plugin --profile web add @yeisme/dsh-mcp-inspector
# 或从本仓：
dsh plugin --profile web add ./packages/bundle/dsh-mcp-inspector
```

- 在会话视图环（`conversation.view`）注册 **Tools** tab（原 MCP tab）。
- 目录：skills（`ctx.skills`）、MCP server（`mcp__*` 工具与可选 plugin inventory）、内置工具。支持搜索、按类型/availability 筛选、详情与启用/关闭。
- 启停是用户偏好 overlay，经 `toolHub.setEnabled` 写入 `yeisme_tool_hub_v1`，并由 `ctx.tools.guard` 拒绝已关闭项。不开关 Cordis Loader 行。
- 本会话 MCP/native/聚合 Skill 调用活动从 ConversationSnapshot 派生（只读，无调用按钮），支持列表与耗时时间线。
- Host catalog 不可用时显示安全、本地化 recovery；活动区照常工作，raw transport error 不进入主界面。
- 可选 `ctx.mcpServers.list()` 不存在时只显示“未提供连接健康”，不得把 enabled 解释为 connected。
