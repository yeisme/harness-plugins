# dsh web pane：终端与侧边对话

## Why

用户在真实 `dsh web` 上使用 Pane Workbench 时，两个高频能力仍然缺席：

1. **终端。** `@yeisme/dsh-terminal` 的 xterm 视图等官方 duplex seam（`TerminalHostV2`），而上游 master（0.1.1-rc.2）已落地 **agent-owned 持久 PTY 家族**（`packages/terminal/`：`ctx.terminals` 注册表、`terminal-bash` 后端、六个模型工具），只是它只面向工具调用，浏览器没有任何入口。真实可用的终端（哪怕先做行式）比无限期等待 duplex seam 更符合"杜绝死按钮"的治理方向。
2. **侧边对话。** `dsh web` 的主对话区一次只能挂一个 current session；用户想在 pane 里并行跟进另一个 session（新开或选既有），只能反复切换主选择。官方 client runtime 已具备全部所需面：`ISessions.binding()` 提供任意 session 的 `SessionFace`（`prompt/cancel` + `ConversationSnapshot` 订阅），`fork()` 可无痕开子会话，运行时实例另有 `create()`——没有一个 UI 消费它们做"侧边栏对话"。

本 change 在插件侧把两条 lane 一次做实：终端走"官方 `ctx.terminals` 行式投影 + 插件 Typert Remote"通道（不实现第二套 PTY，不碰 AppFrame 几何），侧边对话走官方 client services（不改 current selection）。

## What Changes

- **终端 lane（行式 console）**
  - `@yeisme/dsh-terminal-host` 从纯合同库升级为真实 Host 插件：动态注入官方 `ctx.terminals`（结构化探测，无对未发布包的 npm 依赖），注册 `terminalPane` Typert Remote（namespace `terminalPane`，方法 `probe/list/spawn/read/send/signal/close`），把官方 owner-scoped PTY 服务投影为浏览器可消费的行式合同；owner 一律解析为目标 session 的 live Agent（`ctx.agents.get(sessionId)`），沿用官方 exact-Agent authority。
  - `@yeisme/dsh-terminal` bundle 增加真实 client face：`$mount` 自挂 `terminalPane` Remote，注册 pane 视图 `dsh-terminal.console`（会话选择 → 终端列表 → 滚回/发送/信号），并贡献 `/terminal` 命令面。刷新为事件驱动（绑定 session 的 ConversationSnapshot 变化触发重读），不做定时轮询。
  - 既有 xterm `InteractiveTerminal` + `TerminalHostV2` 探针路径原样保留（等官方 duplex seam，Tier 2）；本 lane 不改 `dsh-terminal-v1` 3.2 / `dsh-terminal-interactive-v1` 2.2 的归属。
  - 缺 `ctx.terminals`（DSH < 0.1.1-rc.2）时：Remote 仍注册，`probe/list` 返回 typed `service_unavailable`；视图禁用并给出"需要带 terminals 能力的 DSH"原因，不伪造输出。
- **侧边对话 lane**
  - 新增 `@yeisme/dsh-client-ui-pane-side-chat`（纯 client 包）与 `@yeisme/dsh-side-chat` bundle：pane 视图 `dsh-side-chat.session`，支持 (a) 从 session 列表选择既有 session 附着，(b) 新建空白 session（对 runtime `create` 做结构化探测，缺席则禁用+原因），(c) 从 current session fork 子会话（官方 `fork()`）。
  - 对话渲染消费 `binding(id).session`（`ObservableSnapshot<ConversationSnapshot>`）：用户/助手消息、折叠工具卡摘要、错误节点；composer 走 `prompt(content, 'queue' | 'steer')` 与 `cancel()`。
  - **主选择不变量**：侧边对话的一切读写都不得调用 `sessions.open()`/`clear()`；主对话区 current session 全程不动。close pane 只 detach 视图，不归档不终止 session。
  - 贡献 `/side-chat` 命令面（slash 目录可用时；缺失则禁用+原因，pane 内操作不受影响）。
- **验证与证据**：包测试 + `check:bundles` + `openspec validate --strict`；集成证据（fake `ctx.terminals`/`ctx.sessions` 的端到端 remote 调用）落 `temp/integration-test-runs/<run-id>/`，脱敏。

## Capabilities

### New Capabilities

- `dsh-terminal-console-pane`：终端行式 console 的插件合同——`terminalPane` Remote wire 合同（owner 解析、typed failures、有界滚回）、事件驱动刷新、能力探测与诚实降级、与既有 xterm/TerminalHostV2 lane 的边界。
- `dsh-side-chat-pane`：侧边对话 pane 的插件合同——session 附着/新建/fork 的探测链、prompt/cancel 语义、主选择不变量、渲染边界（脱敏、折叠工具卡）、bundle 装配与命令面。

### Modified Capabilities

无。既有 `dsh-terminal-probe-pane`（xterm 探针路径）与 `pane-workbench-*` 合同不变；本 change 只新增能力，不改主 spec。

## Impact

- `packages/host/dsh-terminal-host/`：新增 `wire.ts`、`adapter.ts`（结构化 `ctx.terminals` 面）、`remote.ts`（TypertRemoteService）、`plugin.ts`（装配），既有导出全部保留。
- `packages/bundle/dsh-terminal/`：重组为 host face + `./client` face 双入口，新增 `cordis.patch.yml`（单行 insert）、client 控制器与 console 视图；`module.ts` workbench-core 声明保持。
- `packages/client/ui-pane-side-chat/`（新）、`packages/bundle/dsh-side-chat/`（新）。
- `pnpm-workspace.yaml` 无需改动（`packages/*/*` 已覆盖）；依赖只用已发布 `@deepseek-ai/dsh-*` peer 面与 `@yeisme/dsh-client-ui-surface` 等仓内包。
- 相邻 change：不接管 `dsh-pane-workspace-experience-v3` 的 preview/终端 Tier-2 lane；不代行 `dsh-terminal-v1`/`dsh-terminal-interactive-v1` 的 retained 任务；`dsh-web-pane-experience-completion-v1` 的能力矩阵只新增行不改旧行。
- 文档：`docs/design/` 增设计说明，`docs/README.md` 挂索引。
