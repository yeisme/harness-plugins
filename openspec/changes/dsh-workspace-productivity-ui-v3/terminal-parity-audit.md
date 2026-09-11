# Task 2.1 对照审计矩阵：Harness TerminalHostV2 × DSH Agent Note（2026-09-09）

- 任务：2.1 [Owner: Harness Plugins] 对照 DSH Agent Note 与 Harness `TerminalHostV2` spec，确认 owner identity、profile、attach/control、frame、resize、detach/kill、error/replay 语义逐项一致。
- 审计结论：**BLOCKED（维持）** —— DSH 侧对照源（official interactive PTY Agent Note / `TerminalInteractiveCapabilityV1` 合同）缺位，七组 required capability 均无上游对照面，无法达成「无未映射 required capability」验收。矩阵本身完整（缺位即矩阵内容）。
- 历史证据：`docs/terminal-host-alignment-evidence-productivity-ui-v3.md`（2026-08-25 首评，2026-09-02 更正 upstream-prs 记录）。

## 对照源

### Harness 侧（存在，完整）

| 源 | 位置 |
| --- | --- |
| 跨项目 capability spec（终端三 Requirement：真实 PTY、输入仲裁、独立 duplex channel） | `openspec/changes/dsh-workspace-productivity-ui-v3/specs/dsh-workspace-productivity-experience/spec.md` |
| 实施 handoff spec（`interactive-terminal-pane`，13 条 Requirement：TerminalHostV2 capability 检测、canonical PTY、xterm addons、observe/control lease、Close/Detach/Kill 区分、replay/resize/profile/clipboard/a11y/evidence） | `openspec/changes/dsh-pane-workspace-experience-v3/specs/interactive-terminal-pane/spec.md` |
| 本地 host 合同实现（`TerminalHostV2`/`TerminalAttachmentV2`/`TerminalControlLeaseV1`/`TerminalOutputChunkV2` + fake host + runtime guard） | `packages/host/dsh-terminal-host/src/index.ts` |
| 行式兼容面（`TerminalPane*` wire 合同 specVersion 1.0：probe/list/spawn/read/send/signal/close + typed failure） | `packages/host/dsh-terminal-host/src/wire.ts` |
| compatibility-state 降级（无 V2 会话时显示兼容状态，不渲染伪输出） | `packages/bundle/dsh-terminal/src/client/terminal-panel.tsx`（`data-terminal-compatibility`） |

### DSH 侧（缺位，2026-09-09 实测）

| 源 | 检查结果 |
| --- | --- |
| `upstream-prs/` terminal 系列 | **不存在**：29 个 slug 全列无 terminal 相关条目；`TerminalInteractiveCapabilityV1` 固化通道未执行（task 1.3 commodity-parked） |
| 本仓安装面 `@deepseek-ai/dsh-*`（0.1.0-rc.6/rc.7/rc.8 世代，node_modules/.pnpm） | terminal 面 0 命中（唯一 `terminal` 字样为 `leaves the failure terminal` 无关语境；无 startSend/resize/cols/rows/pty 类型） |
| 上游 alpha 0.1.5-alpha.1 四包 tarball（`temp/alpha-grep-0909/`：dsh-agent/dsh-session/dsh-web/dsh-fs 解包 .d.ts） | interactive\|pty\|xterm\|duplex\|websocket\|resize 面 0 命中 |
| npm `@deepseek-ai/dsh-terminal`（历次复核 09-03~09-07，非本仓依赖） | owner-scoped 行式 PTY registry（text+submit、bounded scrollback），type 面无 raw/VT/resize/cols/rows——不构成 `TerminalInteractiveCapabilityV1` 对照基准 |

## 逐项映射矩阵

| # | Required capability | Harness spec 侧定义 | DSH 侧对应面 | 结论 |
| --- | --- | --- | --- | --- |
| 1 | capability 声明与版本 | `TerminalHostV2` `version: '0.2.0-rc.1'`、`capability: 'terminal-host'`、`attachTerminal` 存在性 guard（`isTerminalHostV2`）；design.md §6 `TerminalInteractiveCapabilityV1` | 无 official capability 声明（alpha/安装面/npm 均 0 命中） | **缺失** |
| 2 | owner identity | capability spec「打开终端」Scenario：DSH 验证 exact live Agent + terminal ownership 后返回 typed attachment；interactive-pane spec「Terminal profiles 必须由 DSH 枚举」 | `ctx.terminals` 为 owner-scoped 行式 registry（历史复核），但无 browser 侧 owner identity 投影，Agent Note 缺位 | **缺失**（无对照面） |
| 3 | profile | design.md §6 `listProfiles(owner)`、§8 interactive/模型 profile 分离；interactive-pane spec「Terminal profiles 必须由 DSH 枚举」两条 Scenario | 无 profile 概念（模型侧 `TERM=dumb` 行式；npm 行式包无 profile 面） | **缺失** |
| 4 | attach/control | `attachTerminal(terminalId, {cols, rows, signal})` → `TerminalAttachmentV2`；`TerminalControlLeaseV1`（granted/pending/denied + busy + `requestTakeover` 只在 owner 授予后启用输入）；capability spec「人类与 Agent 的终端输入必须仲裁」 | 无 browser attachment、无 input lease（Web 两 WebSocket downlink-only，历史复核） | **缺失** |
| 5 | frame | `TerminalAttachmentV2.subscribe(chunk: TerminalOutputChunkV2{terminalId, epoch, sequence, data, truncated?})`；spec「Terminal output 不得进入 React 高频状态」+ bounded write queue | 无 raw VT frame 合同（输出经 sanitize/scrollback 行式，无 epoch/sequence） | **缺失** |
| 6 | resize | `TerminalAttachmentV2.resize(cols, rows)` → typed receipt；spec「Terminal resize 必须来自真实可见尺寸」（ResizeObserver + rAF 合并，隐藏/零尺寸不发送） | 无 browser resize API（行式无 cols/rows） | **缺失** |
| 7 | detach/kill | spec「Close、Detach 与 Kill 必须严格区分」：close Tab=detach 不杀 PTY，Kill 为带确认的 owner action + awaited receipt；`TerminalAttachmentV2.detach()` | 模型侧行式 kill 存在（`TerminalPaneCloseOkV1.killed` 行式路径可见）；browser detach 语义无对照面 | **部分**（行式 kill 有、detach 缺失） |
| 8 | error/replay | `TerminalMutationReceiptV1`（ok/not_implemented/rejected + typed reason）；capability spec「终端传输必须是独立、认证且可恢复的 duplex channel」（epoch/sequence、bounded replay、ack/backpressure、typed error、resync_required/truncated） | 无 epoch/sequence tracking、无 replay ring、无 typed duplex error 合同 | **缺失** |

汇总：7 组任务列举语义中 **6 组缺失、1 组部分（detach/kill）**；不存在「Harness spec 有而矩阵未映射」的 required capability——缺口全部在 DSH 侧。

## 验收判定

- 「无未映射 required capability」：**不成立**。缺口不是映射遗漏，而是 DSH 侧对照面整体缺位；没有 DSH 基准就无法反向证明「DSH 有而本地未实现」的 required capability 也不存在。
- 「差异回写各自 owning design」：**无法执行**。DSH 侧无 owning design/Agent Note 可回写；本仓侧语义已在 capability spec + interactive-terminal-pane spec + `packages/host/dsh-terminal-host` 冻结为「等上游 seam + capability probe + compatibility state」，无需改写。行式兼容面（`TerminalPane*` specVersion 1.0）按 V3 合同保留，不受本审计影响。

## 诚实降级现状（缺位下的本地行为）

- `terminal-panel.tsx` 无 V2 会话时显示 compatibility 状态（disabled phase），不渲染占位输出或伪输入框（`data-terminal-compatibility`）。
- `createTerminalHostPlaceholder` 仅测试用；production Web profile 不实例化 placeholder host（spec Requirement 1）。
- fake host（`createFakeTerminalHostV2`）仅覆盖 observe/control/reconnect/exited/error 状态测试，不触碰 owner authority。

## 解锁条件

1. 上游发布 official interactive PTY Agent Note（含 owner identity、profile 枚举、attach/control lease、raw frame、resize、detach/kill、error/replay 语义）；或
2. `upstream-prs/` 固化 `TerminalInteractiveCapabilityV1` 系列（task 1.3 解除 park）并被上游接受，形成可对照合同。

任一成立后重跑本矩阵，把「DSH 侧对应面」列从缺位改为实际合同条目，并按差异回写 owning design。

## 2026-09-11 增量复核：dsh-terminal 0.1.5-rc.2 官方 interactive PTY backend API

- npm `@deepseek-ai/dsh-terminal` next 前移至 0.1.5-rc.2（alpha 0.1.5-alpha.2；证据 temp/alpha-grep-0911/）。官方**首次**出现 interactive PTY API，对照基准从「无 official note/API」升级为「有 backend 接口、无 Agent Note」。
- rc.2 API 面（lib/types/types.d.ts）：`TerminalBackend.spawn(TerminalBackendSpawnSpec) → TerminalBackendSession`；会话 = `motd/pid?/startSend(独占 send 操作：done Promise + readOutput() 有界读 + cancel()→SIGINT)/read(offset,count 有界 scrollback)/signal(前台进程组 SIGINT|SIGTERM|SIGKILL|SIGTSTP|SIGHUP)/status()/close(reason)`；`TerminalWaitReason = stdin_read|inferred_idle|timeout|session_exit`；`TerminalBackendCleanupError`（spawn 失败/清理失败聚合）。
- 逐组映射更新（原 7 组 6 缺失、1 部分）：
  - **interactive send/input 互斥**：方向已可对照（独占 startSend + wait reason 语义 ≈ input lease 的官方表达）——**部分覆盖（新增）**。
  - **有界输出读取**：read/readOutput 有界分页 ≈ TerminalHostV2 scrollback 语义子集——部分覆盖。
  - **信号/进程组/close 清理**：signal/close/cleanup error 语义在场——部分覆盖。
  - **raw VT**：无（行式文本模型，无字节流面）——缺失维持。
  - **resize（cols/rows）**：无任何 resize/尺寸 API——缺失维持。
  - **frame/duplex WebSocket 传输**：backend 进程内接口，无传输层——缺失维持。
  - **detach/kill/replay**：无显式 detach 语义（close 语义相邻）；replay 无——大部分缺失维持。
- 判定：2.1「无未映射 required capability」仍未达成（raw VT/resize/frame/duplex/replay 未覆盖），但对照源从零变为官方 API；1.3 的 TerminalInteractiveCapabilityV1 冻结面（raw VT/duplex/resize）未被 rc.2 覆盖，upstream-prs/terminal interactive 固化通道仍未执行。pane-v3 7.1 所需 **client 侧 terminal service**（dsh-web/dsh-session/dsh-agent 的 terminals registry/service）在 rc.2 仍 0 命中——rc.2 的 interface 是 agent 侧 backend provider 面，不是浏览器 pane 可消费的 service。
