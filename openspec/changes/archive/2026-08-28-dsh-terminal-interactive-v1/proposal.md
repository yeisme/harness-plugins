## Why

Desktop Workbench 已有 Terminal Pane 探针：缺 `TerminalHostV2` 时诚实显示不可用。用户仍需要一份可执行的交互终端设计，明确 attach/write/resize 何时允许、何时必须 fail closed，以及为什么现在不解封 xterm。

现有 `dsh-terminal-v1` 只覆盖 Workbench Core 占位模块；`dsh-agent-context-subagent-terminal-panes-v1` 只冻结 probe。本 change 把交互合同写清楚，并允许探针 UI 继续完善，但不把商品区 xterm 当成本地实现。

## What Changes

- 冻结 `TerminalInteractiveCapabilityV1` 与 `TerminalHostV2` 的交互边界：list / open / close 可在 capability 存在时调用；attach、write、resize 必须走 owner duplex seam。
- Terminal Pane 缺 capability 时保持 `contract_mismatch`，不创建假 PTY、不轮询、不解封 xterm。
- 设计 session switch / view detach 不得终止 owner PTY。
- 上游缺口继续登记在 `upstream-prs/`；本 change 不向 deepseek-harness 提交合入。

## Capabilities

### New Capabilities

- `dsh-terminal-interactive`：交互终端 Pane 的 capability probe、typed host 动作与诚实降级。

### Modified Capabilities

无。不修改 File/Git/Agents 合同，不解封 BrowserSession。

## Impact

- Owner：`agent/harness-plugins`。
- 实现面：`@yeisme/dsh-terminal-host`、`@yeisme/dsh-client-ui-desktop-workbench` TerminalPane。
- 非目标：xterm.js 商品区、Codicons、任意 argv shell、第二个 PTY owner。
