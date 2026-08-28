# @yeisme/dsh-terminal-host

DSH Terminal Host：把 DSH/领域拥有的 PTY 服务投影为安全、版本化的合同。本包承载两条线：

1. **`terminalPane` Remote（行式投影，本包的 Host 插件面）**：`plugin.ts` 动态探测官方 `ctx.terminals` / `ctx.agents`（DSH ≥ 0.1.1-rc.2，未随 0.1.0-rc.x 发布，故为结构化类型、无 npm 依赖），注册 `terminalPane` Typert Remote——`probe/list/spawn/read/send/signal/close`。PTY 进程、sandbox 策略与 owner 校验全部留在官方 `dsh-terminal-bash` 后端；owner 一律解析为目标 session 的 live agent（`not_owner` fail-closed）。发送等待有界（默认 60s，测试可注入 `sendWaitCapMs`），触顶按官方取消语义收敛，不遗留 active send。
2. **V1/V2 attachment 合同（既有）**：V1 会话列表与 mutation receipt；V2 带 epoch/sequence 的输出订阅、输入、resize 和 detach attachment，供 xterm.js 渲染器在官方 duplex seam（`TerminalHostV2`）出现后接入。

浏览器永远不会持有 PTY、原始进程句柄或终端 canonical state；`terminalPane` 出参只有 opaque id、显示元数据、状态与有界滚回文本（无 cwd/pid/环境变量）。detach 不会关闭 PTY。

## 入口分层

- `./wire`：`terminalPane` wire 合同（typed 失败码、上限、入参校验）。
- `./adapter`：官方 `ctx.terminals`/`ctx.agents` 结构化探测与适配（形状漂移 → probe reason 列缺失方法）。
- `./remote`：`TerminalPaneRemoteService`（TypertRemoteService，namespace `terminalPane`）。
- `./plugin`：Cordis host 插件装配（无静态依赖，官方能力缺席照常载入、typed `service_unavailable`）。

真实 Host 亦可经 Cordis context key `dsh.terminalHost` 提供给 Desktop Workbench（V2 attachment）；未提供时 bundle 保留明确的空状态，不伪造输出。

## Development

```bash
pnpm --filter @yeisme/dsh-terminal-host run typecheck
pnpm --filter @yeisme/dsh-terminal-host run test
pnpm --filter @yeisme/dsh-terminal-host run build
```

消费方：bundle `packages/bundle/dsh-terminal/`（console 视图 + `$mount` 自挂）；设计合同见 `openspec/changes/dsh-web-pane-terminal-sidechat-v1/`（capability `dsh-terminal-console-pane`）。
