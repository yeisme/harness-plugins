# @yeisme/dsh-client-ui-mcp-inspector

DSH Web 工具 Pane：通过 Pane Workbench 的 `+` 选择器或 `/mcp` 打开同一个右侧单例视图，默认筛选 MCP。

- 窄容器使用目录 / 活动 / 详情分段切换；宽容器使用双栏：紧凑目录覆盖度、Skills / MCP / 内置工具搜索筛选、详情和 generation-CAS 启停。
- 会话活动：从 ConversationSnapshot 安全派生 MCP / 内置工具 / 聚合 Skill 调用，提供列表与耗时时间线。
- MCP `enabled` 与连接健康分开显示；optional health provider 缺失时明确显示未提供，不猜测 offline。
- Host 目录缺失时活动仍可用；primary UI 只显示本地化安全错误码，不显示 raw transport payload。

Pane 跟随当前会话，切换会话清理旧选择；关闭释放会话订阅、目录 controller 和轮询。未选择会话仍可使用目录。Pane 服务缺失时不注册旧会话 tab，`/mcp` 明确报告不可用；服务晚到后自动注册。布局持久化不包含调用参数、结果或凭据。

验证：

```bash
pnpm --filter @yeisme/dsh-client-ui-mcp-inspector run test
pnpm --filter @yeisme/dsh-client-ui-mcp-inspector run test:integration
pnpm --filter @yeisme/dsh-client-ui-mcp-inspector run typecheck
```

`test:integration` 写入项目 `temp/integration-test-runs/<run-id>/`，失败也保留证据。既有导出的 `McpInspectorView` 兼容保留，生产入口改用 Pane。

生成待人工验收截图包：

```bash
pnpm run ui:acceptance -- prepare --change dsh-tools-center-observability-v1
```

只有人工查看 `board.html` 后才能运行 `record --decision accept`。Agent 或自动测试不得代签。
