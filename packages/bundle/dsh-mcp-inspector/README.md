# @yeisme/dsh-mcp-inspector

DSH 官方 web ui 的 MCP 调用活动只读视图 bundle。

```bash
dsh plugin --profile web add @yeisme/dsh-mcp-inspector
# 或从本仓：
dsh plugin --profile web add ./packages/bundle/dsh-mcp-inspector
```

- 在会话视图环（conversation.view）注册 "MCP" tab：按 `mcp__<server>__` 分组显示
  每次调用的工具名、耗时、错误与运行中状态；数据纯来自会话快照，只读。
- server 连接状态在 host 侧无公开合同：tab 头显示
  `catalog: unavailable in this version`（诚实降级；seam 设计见
  `openspec/changes/dsh-mcp-inspector-v1/design.md` 的 L2 节）。
- Session log、prompt、plan selection 均归 DSH Host；本 bundle 不写任何 owner 状态。
