## Context

Workbench Core 已支持模块注册；Terminal 作为第三个模块验证可扩展性。当前只提供安全占位，真实 PTY 流待 DSH terminal seam。

## Goals / Non-Goals

**Goals:**

- 提供 `terminalModule` Workbench 模块。
- 提供 `TerminalPanel` 占位。
- 可注册进 Workbench Core。

**Non-Goals:**

- 不实现 PTY、xterm、终端状态。
- 不拥有终端 canonical state。

## Decisions

### 1. 模块描述符独立

`terminalModule` 是纯 headless 描述符，可被组合包直接注册。

### 2. 面板不拥有 PTY 状态（原「只做占位」，验收修订）

`TerminalPanel` 不创建终端、不复制 canonical state。渲染走诚实降级梯：无附着 seam → 占位/禁用+原因；owner 提供 V2 附着 seam → xterm 附着（`InteractiveTerminal`：输入转发、序列化输出、对称 detach、重连按钮、exited 态）。

### 3. 真实 PTY 投影的双 lane 交付（2026-08-28 验收修订）

官方 seam 决定 lane：

- **行式 lane（已交付，官方现有能力）**：官方 `ctx.terminals`（`TerminalSessionService`，0.1.1-rc.2+）提供 owner 制的 spawn/startSend/read/signal/kill/list。经 `terminalPane` Remote（Typert）投影为 console 视图：真实 PTY、滚回分页、行发送、信号、退出状态、重连重放。落地与规格在已归档 `dsh-web-pane-terminal-sidechat-v1` / 主 spec `dsh-terminal-console-pane`。
- **VT duplex lane（渲染器已备，门控官方 seam）**：xterm.js 附着渲染器与 `TerminalHostV2` typed seam 已实现并保留；上游 0.1.1-rc.2（b150a551b8d）核验无 attach/duplex API，官方 seam 合入前不得伪造字节流。按 AGENTS.md，官方 seam 可用性不是插件完成门。

重连语义（本 change 落地）：`terminal.reconnect` 与行 lane `reconnect()` 只同步投影（重探测 + 列表/滚回重放 + 消失即清选），永不触碰 PTY；面板关闭（controller dispose）零 close/kill。

## Test Specification

| 层 | 场景 | 命令 | 证据 |
| --- | --- | --- | --- |
| unit | terminalModule 注册进 Workbench Core | `pnpm --filter @yeisme/dsh-terminal run test` | Vitest result |
| unit | console 控制器：退出守卫 / 重连重放 / detach 保活 | 同上 | `tests/console-controller.spec.ts` |
| unit | 视图渲染矩阵：disabled / ready / exited | 同上 | `tests/console-client.spec.ts` |
| build | typecheck/build | `pnpm --filter @yeisme/dsh-terminal run typecheck && pnpm --filter @yeisme/dsh-terminal run build` | exit 0 |

## Risks / Trade-offs

- [占位可能被误当可用] → 降级梯文案明确原因（缺 seam / 缺能力 / 已退出），不显示伪输出或伪输入框。
- [VT duplex lane 长期无官方 seam] → 渲染器保留为 probed dead code（零运行成本），行 lane 独立交付真实能力；上游合入后由既有 lane 接管，不阻塞本 change 验收。

## Migration Plan

1. 发布 `@yeisme/dsh-terminal@0.1.0-rc.1`。
2. ~~DSH terminal seam 就绪后接入真实 PTY 投影。~~ → 已按双 lane 交付（见 Decision 3）：行 lane 经官方 `ctx.terminals` 落地；VT duplex lane 等官方 attach seam 合入后由既有 `InteractiveTerminal` 路径接管。
