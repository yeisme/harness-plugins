## Why

Workbench Core 需要第三个模块验证扩展性。Terminal 是 DSH 工作台核心功能之一；本 change 先提供模块骨架与占位面板，后续再接入真实 PTY 投影。

准入结论为 `fit + split-owner`：Harness Plugins 拥有 Terminal 展示壳；PTY、终端状态与调度归 DSH terminal owner。

## What Changes

- 新增 `@yeisme/dsh-terminal` package。
- `terminalModule` 注册 terminal Tab 与 open/reconnect 命令。
- `TerminalPanel` 占位组件。
- 可注册进 Workbench Core。

## Impact

- 新 owner package：`packages/bundle/dsh-terminal/`。
- 不拥有 PTY 状态。
