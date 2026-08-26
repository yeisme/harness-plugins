# dsh-mcp-inspector

## ADDED Requirements

### Requirement: MCP 调用活动只读视图
系统 SHALL 在官方 web ui 的会话视图环（`conversation.view`）提供一个 "MCP" 只读 tab，从会话 ConversationSnapshot 按 `mcp__<server>__<tool>` 前缀分组派生 per-server 调用活动（调用列表、耗时、错误、运行中），且 MUST NOT 提供任何直接调用工具的用户动作。

#### Scenario: 会话中存在 MCP 工具调用
- **WHEN** 会话事件流包含 `mcp__github__create_issue` 的 tool/call 与 tool/result
- **THEN** MCP tab SHALL 显示 `github` server 卡片，含工具名、耗时与结果状态（错误带 badge）

#### Scenario: 运行中的 MCP 调用
- **WHEN** 某 `mcp__` 工具的 tool/call 已发生而 tool/result 未到
- **THEN** 卡片 SHALL 将其标记为运行中，不显示耗时

#### Scenario: 没有任何 MCP 活动
- **WHEN** 会话内没有 `mcp__` 前缀的调用
- **THEN** tab SHALL 显示 `No MCP tool activity in this session` 空态

#### Scenario: 名称解析不唯一
- **WHEN** 工具名以 `mcp__` 开头但解析不出唯一 server（无第二个 `__` 或空 server 名）
- **THEN** 该条目 SHALL 被丢弃，不得归入猜测的分组

### Requirement: server 目录缺失的诚实降级
系统 SHALL 在 host 侧 MCP server 目录合同（`ctx.mcpServers.list()`）不可用时显示 `catalog: unavailable in this version` 降级横幅，且 MUST NOT 渲染任何连接状态暗示（connected/healthy 等）。

#### Scenario: seam 未落地
- **WHEN** 插件 probe 不到 mcp inventory 服务
- **THEN** tab 头部 SHALL 显示降级横幅；活动数据仍从会话事件正常派生

### Requirement: 只读与卸载边界
插件 MUST 只消费公开 slot 与会话快照；MUST NOT 写 owner 状态、不自建 MCP client、不复制 server 配置；插件卸载 SHALL 移除其注册的 tab 与 locale 而不残留。

#### Scenario: 卸载插件
- **WHEN** bundle 被移除或插件上下文销毁
- **THEN** conversation view 环与 locale 字典 SHALL 恢复到注册前状态
