# @yeisme/dsh-token-usage

可安装的 DSH Web bundle：跨会话 token 用量面板 + DeepSeek 官方路由余额。

安装：

```
dsh plugin --profile web add @yeisme/dsh-token-usage
```

或从本仓库：`dsh plugin --profile web add ./packages/bundle/dsh-token-usage`

## 组成

- **Host**（`@yeisme/dsh-token-usage-host`）：进程级用量账本——只折叠官方
  `sessionProjections` 的 `tokenUsage` disjoint buckets 增量，按会话 / 提供方 /
  UTC 日 / 周 / 进程汇总；`bySession` 有界 20 条并声明 `truncated`。会话离开
  列表不回扣。DeepSeek 余额仅 `deepseek-official` 路由、Host 侧经凭据端口
  （`apiKeyEnv`，默认 `DEEPSEEK_API_KEY`）调用 `GET /user/balance`；15 秒限流，
  失败保留 stale 金额。API key / bearer / baseURL 永不进入投影、日志或 DOM。
- **Client**（`@yeisme/dsh-client-ui-token-usage`）：会话头 "Tokens" 入口。探测到
  Pane Workbench 时打开右侧栏 `workspace.token-usage` navigator；Pane 缺失时降级
  为 `shell.overlay` 弹窗（常驻 seat、空闲零渲染）。Remote 缺失时按钮 disabled
  且原因可读——无死按钮、无伪造账本。

## 边界

- 账本范围是「自 Host 进程启动以来」；重启后首次观察计一次，不做跨重启持久化。
- 不重放 session log、不自建 tokenizer、不做价格换算；金额只来自官方
  `balance_infos` 字符串。
- 浏览器零凭据、零 raw URL；面板 DOM 与投影经红线扫描测试钉住。

本包属 [agent/harness-plugins](https://github.com/yeisme/agent) 治理：不改 DSH
core，不抢 `shell.workspace.right` occupant，官方 `dsh web` 不是完成门。
