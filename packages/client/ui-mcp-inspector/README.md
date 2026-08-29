# @yeisme/dsh-client-ui-mcp-inspector

DSH Web Tools inspector：`conversation.view` 的 **Tools** tab。

- 双栏工作台：紧凑目录覆盖度、Skills / MCP / 内置工具搜索筛选、详情和 generation-CAS 启停。
- 会话活动：从 ConversationSnapshot 安全派生 MCP / 内置工具 / 聚合 Skill 调用，提供列表与耗时时间线。
- MCP `enabled` 与连接健康分开显示；optional health provider 缺失时明确显示未提供，不猜测 offline。
- Host 目录缺失时活动仍可用；primary UI 只显示本地化安全错误码，不显示 raw transport payload。

生成待人工验收截图包：

```bash
pnpm run ui:acceptance -- prepare --change dsh-tools-center-observability-v1
```

只有人工查看 `board.html` 后才能运行 `record --decision accept`。Agent 或自动测试不得代签。
