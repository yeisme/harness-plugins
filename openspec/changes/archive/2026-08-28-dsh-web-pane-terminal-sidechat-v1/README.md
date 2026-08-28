# dsh-web-pane-terminal-sidechat-v1

让 dsh web pane 现在就有可用的终端与侧边对话。

- 交付：`terminalPane` Typert Remote（官方 `ctx.terminals` 的 owner-scoped 行式投影，DSH ≥ 0.1.1-rc.2）+ 终端 console 视图（owner 会话选择/有界滚回/行发送/SIGINT/关闭，事件驱动重读无轮询）+ `/terminal` 命令面；侧边对话 pane（附着既有 session / 新建（runtime `create` 探测）/ 从当前 fork，主选择不变量：绝不调 `sessions.open()/clear()`）+ `/side-chat` 命令面；两个 bundle 的 cordis.patch 单行 insert 与 ModuleLoader 单文件合同。
- 不交付：xterm 原始 VT duplex/resize/全屏应用（官方 defer，Tier 2 seam 到位由既有 lane 接管）、插件侧 PTY 实现（PTY 进程永远由官方 `dsh-terminal-bash` 后端持有）、侧边对话 subagent 编排与 queue 管理 UI。
- 完成门不含官方 `dsh web`；能力缺席一律 fail-closed + typed 原因（`terminals_missing` / `sessions.create` 缺席 / Remote 不可达 / 形状漂移）。
