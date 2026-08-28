# @yeisme/dsh-terminal

DSH Web 终端 bundle。两条能力线并存：

1. **行式 console（本 bundle 新增）**：`terminalPane` Typert Remote——官方 `ctx.terminals` 的 owner-scoped 行式投影，加 pane console 视图（owner 会话选择、终端列表、有界滚回、行发送、SIGINT、关闭、退出状态、重连重放）。
2. **xterm.js 交互终端（既有）**：`TerminalPanel` 等官方 duplex seam（`TerminalHostV2`）的探针门路径，本 bundle 不改不拆。

PTY 进程、sandbox 策略与 owner 校验全部由官方 `dsh-terminal-bash` 后端持有；本插件零 PTY 实现。

## 安装

```
dsh plugin --profile web add @yeisme/dsh-terminal
# 或从本仓
dsh plugin --profile web add ./packages/bundle/dsh-terminal
```

## 包边界

- `src/index.ts`（host face）：组合 `@yeisme/dsh-terminal-host` 插件——动态探测 `ctx.terminals`/`ctx.agents`，注册 `terminalPane` Remote。
- `src/client/`：console 控制器/视图/Remote `$mount` 解析 + 既有 xterm 面板。
- `src/module.ts`：`terminalModule` Workbench 模块描述符（保留）。

## 兼容锚点

- `ctx.terminals` 家族随 DSH **0.1.1-rc.2+**（`packages/terminal/`）提供。更早版本：host 行照常载入，`terminalPane.probe` 返回 `serviceAvailable:false`，视图与 `/terminal` 命令显示禁用原因（"需要带 terminals 能力的 DSH"），不伪造输出。
- 发送等待触顶（60s）按官方取消语义中断前台进程组并如实标注 `cancelledByWaitTimeout`；不遗留 active send。
- 滚回重读为事件驱动（绑定 session 的 ConversationSnapshot 变化触发），无定时轮询。
- 关闭面板不终止 PTY（controller dispose 零 close/kill）；重开经滚回读取恢复输出。
- 已退出终端如实呈现 exit code/signal，composer 与 SIGINT 禁用并提示新建；列表项同样标注退出态。

## 命令

- `/terminal`（slash 目录可用时；`category: pane`）→ 打开 console 视图。
- `terminal.reconnect`（launcher）→ 打开 console 并重连：重探测能力 + 重放列表/滚回；只同步投影，不触碰 PTY。

## 开发

```bash
pnpm --filter @yeisme/dsh-terminal-host run test
pnpm --filter @yeisme/dsh-terminal run typecheck
pnpm --filter @yeisme/dsh-terminal run test
pnpm --filter @yeisme/dsh-terminal run build
node scripts/check-bundle-contracts.mjs
```

设计合同见 `openspec/changes/archive/2026-08-28-dsh-web-pane-terminal-sidechat-v1/`（capability `dsh-terminal-console-pane`）与 `openspec/changes/archive/2026-08-28-dsh-terminal-v1/`（capability `terminal`）。
