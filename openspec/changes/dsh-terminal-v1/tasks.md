## 1. 模块

- [x] 1.1 [Owner: Harness Plugins；Scope: `src/module.ts`；Dependencies: workbench-core] 定义 `terminalModule`。Acceptance: 可注册；Validation: `pnpm --filter @yeisme/dsh-terminal run test`。
- [x] 1.2 [Owner: Harness Plugins；Scope: `src/client/terminal-panel.tsx`；Dependencies: none] 实现 `TerminalPanel` 占位。Acceptance: typecheck/build 通过；Validation: `pnpm --filter @yeisme/dsh-terminal run typecheck && pnpm --filter @yeisme/dsh-terminal run build`。

## 2. 测试与 OpenSpec

- [x] 2.1 [Owner: Harness Plugins；Scope: tests；Dependencies: 1.1] 增加模块注册与 source-independence 测试。Acceptance: 2 tests passed；Validation: `pnpm --filter @yeisme/dsh-terminal run test`。
- [x] 2.2 [Owner: Harness Plugins；Scope: OpenSpec；Dependencies: 2.1] 完成 proposal/design/tasks/spec。Acceptance: `openspec validate dsh-terminal-v1 --strict --no-interactive` 通过。

## 3. 后续推进目标（retain-next）

- [ ] 3.1 [Owner: Harness Plugins；Scope: `src/client/terminal-panel.tsx`；Dependencies: 1.2] 接入真实 PTY 投影（xterm + DSH terminal seam）。Acceptance: TerminalPanel 显示真实终端流；Validation: 本地 DSH profile + browser。（blocked: 需要真实 DSH terminal seam/xterm 接入，本环境无法执行本地 DSH profile + browser）
- [ ] 3.2 [Owner: Harness Plugins；Scope: `src/client/terminal-panel.tsx`；Dependencies: 3.1] 支持 detach/reconnect/replay 与退出状态。Acceptance: 关闭面板不终止 PTY，重连可恢复；Validation: integration test。（blocked: 依赖 3.1 真实 PTY seam）
- [x] 3.3 [Owner: Harness Plugins；Scope: tests；Dependencies: 3.1] 增加终端面板渲染与状态测试。Acceptance: 新测试通过；Validation: `pnpm --filter @yeisme/dsh-terminal run test`。
