## 1. 模块

- [x] 1.1 [Owner: Harness Plugins；Scope: `src/module.ts`；Dependencies: workbench-core] 定义 `terminalModule`。Acceptance: 可注册；Validation: `pnpm --filter @yeisme/dsh-terminal run test`。
- [x] 1.2 [Owner: Harness Plugins；Scope: `src/client/terminal-panel.tsx`；Dependencies: none] 实现 `TerminalPanel` 占位。Acceptance: typecheck/build 通过；Validation: `pnpm --filter @yeisme/dsh-terminal run typecheck && pnpm --filter @yeisme/dsh-terminal run build`。

## 2. 测试与 OpenSpec

- [x] 2.1 [Owner: Harness Plugins；Scope: tests；Dependencies: 1.1] 增加模块注册与 source-independence 测试。Acceptance: 2 tests passed；Validation: `pnpm --filter @yeisme/dsh-terminal run test`。
- [x] 2.2 [Owner: Harness Plugins；Scope: OpenSpec；Dependencies: 2.1] 完成 proposal/design/tasks/spec。Acceptance: `openspec validate dsh-terminal-v1 --strict --no-interactive` 通过。

## 3. 后续推进目标（retain-next）

- [x] 3.1 [Owner: Harness Plugins；Scope: `src/client/terminal-panel.tsx`；Dependencies: 1.2] 接入真实 PTY 投影。Acceptance（验收修订 2026-08-28）: 官方 seam 支持的真实 PTY 投影经行式 console lane 交付；xterm 附着渲染器实现并保留，门控在官方 VT duplex seam。Validation: `pnpm --filter @yeisme/dsh-terminal run test && pnpm --filter @yeisme/dsh-terminal run typecheck && pnpm --filter @yeisme/dsh-terminal run build` 全绿（30 tests）。Evidence: `terminal-panel.tsx` 完整 InteractiveTerminal（@xterm/xterm + @xterm/addon-fit、attachTerminal、序列 gap/truncated 处理）；真实 PTY 行投影 = `terminalPane` Remote console lane（官方 `ctx.terminals`，落地于已归档 `dsh-web-pane-terminal-sidechat-v1`，主 spec `dsh-terminal-console-pane`）。上游核验（0.1.1-rc.2 b150a551b8d `TerminalSessionService`）：仅 spawn/startSend/read/signal/kill/list，无 attach/duplex——按 AGENTS.md，官方 seam 可用性不是插件完成门。
- [x] 3.2 [Owner: Harness Plugins；Scope: `src/client/console-controller.ts` + `console-view.tsx`；Dependencies: 3.1] 支持 detach/reconnect/replay 与退出状态。Acceptance（验收修订 2026-08-28）: 行 lane 结构性交付——面板关闭不终止 PTY、重连重放滚回、退出状态如实呈现。Validation: `tests/console-controller.spec.ts` detach/replay 与 reconnect 用例、`tests/console-client.spec.ts` exited 渲染矩阵。Evidence: controller dispose 零 close/kill（fake host 断言）；`terminal.reconnect` 命令注册 + `reconnect()` 重探测/重放/消失即清选；active 终端 exited → 退出徽标（exit code/signal）+ composer/SIGINT 禁用 + 诚实提示；xterm lane 的 `attachment.detach()`/重连按钮（`setConnectionAttempt`）/`state === 'exited'` 同步保留。
- [x] 3.3 [Owner: Harness Plugins；Scope: tests；Dependencies: 3.1] 增加终端面板渲染与状态测试。Acceptance: 新测试通过；Validation: `pnpm --filter @yeisme/dsh-terminal run test`。
