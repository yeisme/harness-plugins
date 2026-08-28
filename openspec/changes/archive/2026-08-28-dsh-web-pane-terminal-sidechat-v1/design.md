# 设计：dsh web pane 终端与侧边对话

## 0. 背景与决策链

| 问题 | 选项 | 决策 |
| --- | --- | --- |
| 终端 PTY 从哪来 | A. 插件自建 node-pty + WS 路由；B. 等官方 `TerminalHostV2` duplex seam；C. 适配上游 master 已有的官方 `ctx.terminals`（行式） | **C**。A 违反 `docs/plugin-host-protocol.md`（PTY duplex 属 host 职责，插件不另起第二套）；B 无限期阻塞。上游 0.1.1-rc.2 的 `packages/terminal/` 家族是官方 PTY owner，`@yeisme/dsh-terminal-host` 的章程本来就是"adapts official DSH terminal services through a typed seam"——本设计把该章程做实。 |
| 浏览器怎么到达 host 服务 | A. 上游 patch 新增 api-remotes namespace；B. 插件 Typert Remote（`TypertRemoteService` + `@Remote`） | **B**。`sessionTags`/`sessionOrganization`/`tokenUsage` 已用同通道发布；client 侧 `$mount` 自挂是官方公开 API。零上游改动。 |
| 终端交互形态 | A. xterm 原始 VT duplex；B. 行式（send 一行 → 有界 viewport delta + waitReason；滚回分页读） | **B**。官方 `ctx.terminals` 明确 defer 全屏应用与 keystroke 序列（agent note 2026-07-16）；行式是官方合同今天允许的全部。xterm 路径保持 Tier-2 探针门（见 §4）。 |
| 侧边对话数据面 | A. 只读投影；B. 完整双向（prompt/cancel） | **B**。`SessionFace.prompt/cancel` 是官方 client face；side pane 是 browser UI 的新消费者，不改变 session 所有权。 |
| 侧边对话怎么不干扰主区 | 调 `open()` 切换 vs 只用 `binding()` | **只用 `binding()`**。`open()` 会改 current selection 并触发主对话区重挂载——侧边栏语义要求主选择不变。 |

## 1. 终端 lane：`terminalPane` Remote

### 1.1 官方面（结构化探测，无 npm 依赖）

`packages/terminal/terminal`（上游 master，未随 0.1.0-rc.x 发布）暴露 `ctx.terminals: TerminalSessionService`。本仓以本地结构化类型声明消费（与 `ui-session-tags` 消费 `ctx.sessionGroupings` 的能力探测同一手法）：

```ts
interface TerminalsFace {
  backends(): readonly { type: string }[]          // 注册的后端类型
  spawn(spec: { type: string; name?: string; cwd?: string; sessionId: TerminalId; owner: Agent; signal?: AbortSignal }): Promise<TerminalSessionHandle>
  list(owner: Agent): readonly TerminalSummary[]
  session(id: TerminalId, owner: Agent): TerminalSessionHandle | undefined
}
interface TerminalSessionHandle {
  send(request: { text: string; submit: boolean; signal?: AbortSignal }): TerminalSendOperation
  read(request: { offset?: number; count?: number }): TerminalReadResult
  signal(sig: 'SIGINT'|'SIGTERM'|'SIGKILL'|'SIGTSTP'|'SIGHUP'): Promise<{ delivered: boolean; targetPgid: number | null }>
  close(): Promise<{ killed: boolean }>
  status(): TerminalSessionStatus
}
```

（以 staging checkout `/tmp/dsh-staging` 的 `packages/terminal/terminal/src/{index,types}.ts` 为准；adapter 内做 `typeof` 逐方法探测，形状漂移 → typed `contract_mismatch`。）

owner 解析：`ctx.agents.get(sessionId)`（官方 AgentRegistry，agent id = session id 同轴）。session 不 live → `spawn/list` 返回 `session_not_live`，`read/send/signal/close` 对已持有 sessionId 的终端照常工作（owner 已在 spawn 时绑定，agent 结束会随 agent-scope disposal 关闭终端——与官方语义一致）。

### 1.2 wire 合同（`wire.ts`）

namespace `terminalPane`，全部方法返回 `{ok:true,...} | {ok:false, code, message}` 业务判别（传输层 `{ok,value|error}` 由 Remote 框架包）：

| 方法 | 入 | 出（ok） | 失败码 |
| --- | --- | --- | --- |
| `probe` | `{}` | `{specVersion:'1.0', serviceAvailable, backendTypes, contractMismatch?}` | — |
| `list` | `{sessionId}` | `{sessions: TerminalPaneSummaryV1[]}`（opaque id、name、type、status 投影，无 cwd/路径） | `service_unavailable`、`session_not_live` |
| `spawn` | `{sessionId, type?, name?}` | `{terminalId, name, type}` | + `backend_missing`、`spawn_rejected`、`too_many`（owner 名下上限 8） |
| `read` | `{sessionId, terminalId, offset?, count?}` | `{text, totalLines, lineBegin, lineEnd, truncated}` | + `terminal_not_found`、`not_owner` |
| `send` | `{sessionId, terminalId, text, submit, timeoutMs?}` | `{viewport, waitReason, sessionStatus, truncated}` | + `send_active`（官方单 send 保留语义透传） |
| `signal` | `{sessionId, terminalId, signal}` | `{delivered, targetPgid}` | + `signal_rejected` |
| `close` | `{sessionId, terminalId}` | `{killed}` | + `close_failed` |

安全边界：出参只有 opaque `terminalId`（branded id 的字符串面）、显示名、状态与有界滚回文本；不透出 cwd、pid 之外的进程细节、环境变量。`send` 文本即用户输入，host 不做内容启发式（与官方 `terminal_send` 一致：submit 显式、无隐藏内容逻辑）。上限：单 `read` count ≤ 500 行、`send` timeout ≤ 30s（超时透传官方 `timeout` waitReason，不失败）。

### 1.3 client face（bundle `./client`）

- `resolveTerminalPaneRemote(ctx)`：优先 `remote.terminalPane` 已挂；否则 `remote.$mount(terminalPaneRemoteContribution)`；均失败 → `undefined`（视图禁用+原因 `terminal_pane_remote_unavailable`）。
- `TerminalConsoleController`：状态机 `probing → disabled(reason) | ready`；owner session 选择（默认 current，可切列表内任意 session）；终端列表 + active 终端；`send` 期间输入锁定（单 send 保留）；`read` 于 (a) 视图激活时，(b) 绑定 session 的 `ConversationSnapshot` 出现新 terminal 工具调用节点时（事件驱动重读，无定时器）。
- 视图：`Surface` 框架 + 滚回 `<pre>`（等宽、`text` 按行渲染）+ composer（`textarea` 单行语义 + submit 开关）+ 信号按钮（SIGINT 优先）+ 状态徽标（waitReason/sessionStatus）。终端选择器列出 `list()` 结果与"新建终端"动作（spawn）。
- 注册：`paneWorkbench.registerView({descriptor:{kind:'dsh-terminal.console', role:'general', preferredRegion:'bottom', retention:'keep-alive', singleton:false}})`；命令 `terminal.open`（打开 console 视图）+ slash `terminal`（category pane）。
- 与 xterm lane 的关系：`TerminalHostV2` 探针命中（未来官方 duplex seam）时 console 视图照常可用（两者并存），`InteractiveTerminal` 路径不改、不拆。

### 1.4 降级矩阵

| 环境 | 表现 |
| --- | --- |
| DSH ≥ 0.1.1-rc.2（host 带 `ctx.terminals` + bash 后端） | 全功能 |
| DSH 0.1.0-rc.x | `probe → serviceAvailable:false`；视图显示"需要带 terminals 能力的 DSH（≥0.1.1）"禁用态；`/terminal` 命令禁用+原因 |
| `ctx.terminals` 在但形状漂移 | `contract_mismatch` + 缺失方法名 |
| `terminalPane` Remote 不可达（旧 runtime 无 `$mount`） | 视图禁用 + `terminal_pane_remote_unavailable` |

## 2. 侧边对话 lane

### 2.1 数据面（全部官方 client services）

```
ctx.sessions (ISessions)
├─ list: ObservableSnapshot<SessionListState>        // 选择器数据源
├─ binding(id): SessionBinding | undefined           // { sessionId, session: SessionFace, ctx }
│    └─ SessionFace = ISession & ObservableSnapshot<ConversationSnapshot>
│         ├─ prompt(PromptContentPart[], 'queue'|'steer')
│         ├─ cancel() / rename() / loadOlder()
│         └─ subscribe/getSnapshot                    // 渲染源
├─ fork({sessionId, increaseTitle?}): Promise<SessionId>   // 无痕子会话
└─ (runtime face 附加) create({workspaceId?|cwd?}): Promise<SessionId>   // 结构化探测
```

- **附着**：picker 选 session → `binding(id)`；`undefined`（未列出且未 scope）→ 行内提示该 session 不可附着。
- **新建**：`typeof sessions.create === 'function'` 探测通过才显示"新建会话"；调用后不 `open()`，直接 `binding(child)` 进 pane。探测失败 → 按钮禁用 + `sessions.create` 缺席原因（fallback 引导用 fork）。
- **fork**：`fork({sessionId: 当前主选择或 picker 选中的源, increaseTitle: true})` → `binding(child)`。子会话 `parentSessionId`/`origin:'fork'` 由官方标记。
- **发送**：`session.prompt([{type:'text',text}], mode)`；`running` 时默认 `steer`（可切 `queue`，对齐官方 busy-Enter 语义）；`promptError` 透传显示。`cancel()` 按钮绑定 running 态。
- **渲染**（`ConversationSnapshot.nodes` 有序投影）：user（text 块）/ assistant（text 块，reasoning 折叠）/ tool-result 与 running tool-call（折叠单行 `name ± args 摘要`，不含原始 args 全文）/ TurnError/TurnMaxTokens（错误样式）。图片附件显示占位（`readAttachment` 不在 v1 范围）。`loadOlder()` 挂"加载更早"。
- **订阅**：`useSyncExternalStore(session.subscribe, session.getSnapshot)`（shallow 比较节点数 + running 位，避免每 token 重渲列表整体——组件内 memo 行级）。

### 2.2 主选择不变量（spec 级 SHALL）

Side chat 的任何路径不得调用 `sessions.open()/openSubagent()/clear()`。实现上 controller 不持有这些方法的引用；测试断言 fake sessions 服务上 `open` 调用计数为 0。

### 2.3 装配与命令

- 包 `@yeisme/dsh-client-ui-pane-side-chat`：`controller.ts`（状态机 + 绑定管理 + dispose）、`view.tsx`（渲染 + composer）、`register.ts`（pane 视图/命令注册，`paneWorkbench` 探针缺席 → 零注册 + sidebar launcher 禁用态）。
- bundle `@yeisme/dsh-side-chat`：host face 透传（无 host 职责，纯 client bundle——cordis patch 仍单行 insert，profile 加载 client 行）；`dsh.client = {inject:['@deepseek-ai/dsh-client-runtime','@deepseek-ai/dsh-client-locale'], platform:'web'}`。
- 视图 descriptor：`kind:'dsh-side-chat.session'`，`role:'content'`，`preferredRegion:'right'`，`retention:'keep-alive'`，`singleton:false`（可开多个侧边会话 tab）。resource key 形如 `side-chat:<sessionId>`，session 消失（removed）时视图显示已移除态。
- 命令：`side-chat.open`（打开空 picker 视图）+ slash `side-chat`（category pane）。

## 3. 测试策略

- host：`wire` 合同单测（判别式/上限/失败码穷举）；`adapter` 用 fake `ctx.terminals`（含形状漂移 fixture）验证探测与透传；`remote` 用 cordis 测试上下文验证 `$mount`-可见的注册与 owner 校验（非 owner session 的 terminal → `not_owner`）。
- terminal client：controller 状态机（probe 失败/ready/send 锁/read 事件触发）；视图渲染矩阵（禁用态文案、滚回、waitReason 徽标）。
- side chat：controller 用 fake sessions（binding/fork/create/SessionFace 快照序列）验证附着/新建/fork/prompt/cancel/**open 零调用**；渲染矩阵（节点类型、折叠、错误、composer 禁用态）。
- 集成证据：`tests/integration/terminal-pane-remote.spec.ts` + `side-chat-binding.spec.ts` 于 fake host 装配上跑端到端，落 `temp/integration-test-runs/<run-id>/`（脱敏：无 cwd、无用户名、无 prompt 原文——fixture 全用合成数据，天然脱敏）。
- 完成门：`pnpm run typecheck && pnpm run test && pnpm run build && pnpm run check:bundles && openspec validate dsh-web-pane-terminal-sidechat-v1 --strict --no-interactive`。

## 4. 边界与不做

- 不实现 xterm 原始 VT duplex、resize、全屏应用（官方 defer；Tier 2 seam 到位后由既有 lane 接管）。
- 不在插件里 spawn PTY（PTY 进程永远由官方 `terminal-bash` 后端经 `ctx.subprocess.spawnTerminal` 创建；本插件只做 typed 投影）。
- 不做侧边对话的 subagent 编排、queue 管理 UI（官方 queue 镜像只在渲染层展示计数）。
- 不改 `experience-tier.ts` 的 seam 表（console 视图自带独立探针，能力矩阵新增行由视图注册自带，不动 Tier 定义）。
