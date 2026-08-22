# @yeisme/dsh-terminal

DSH Pane Workbench 的终端视图。浏览器只渲染 xterm.js，PTY、输出顺序、控制权和生命周期仍由 DSH Terminal Host 拥有。

## 包边界

- `src/module.ts`：`terminalModule` Workbench 模块描述符。
- `src/client/terminal-panel.tsx`：xterm.js 终端渲染器，支持输出订阅、输入转发、FitAddon 自适配、重连和对称 detach。
- `@yeisme/dsh-terminal-host`：V2 attachment 合同；不拥有 PTY、terminal state 或调度状态。

未接入 V2 Host 时，界面会显示明确的连接占位，不会伪造终端输出。接入真实 Host 后，终端支持 ANSI/VT 输出、键盘输入、滚动缓冲与 Pane 尺寸变化。

## 开发

```bash
pnpm --filter @yeisme/dsh-terminal run typecheck
pnpm --filter @yeisme/dsh-terminal run test
pnpm --filter @yeisme/dsh-terminal run build
```
