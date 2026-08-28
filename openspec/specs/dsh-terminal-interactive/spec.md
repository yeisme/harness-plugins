# dsh-terminal-interactive Specification

## Purpose
TBD - created by archiving change dsh-terminal-interactive-v1. Update Purpose after archive.
## Requirements
### Requirement: Terminal Pane SHALL 只在官方 interactive capability 下启用输入
Terminal Pane SHALL 探测 `TerminalInteractiveCapabilityV1` 或 `TerminalHostV2`。缺失时 SHALL 显示 `contract_mismatch`，MUST NOT 渲染假 PTY，MUST NOT 用 `setInterval` 刷新占位输出，MUST NOT 解封 xterm 商品区实现。

#### Scenario: 无 interactive terminal seam
- **WHEN** profile 只有 TerminalHostV1 占位或无 terminal host
- **THEN** Pane SHALL 进入 `contract_mismatch`
- **AND** SHALL NOT 创建 xterm 实例或伪造 stream

### Requirement: 有 V2 host 时 MAY list/open/close，但 write/resize 仍要求 duplex
若 owner 提供 `TerminalHostV2`，Pane MAY 列出会话并允许新建/关闭。`attach`、`write`、`resize` SHALL 仍要求 owner duplex seam。View detach MUST NOT 默认终止 PTY。

#### Scenario: 只读或半交互列表
- **WHEN** owner 返回 terminal session refs 但 duplex 尚未就绪
- **THEN** Pane MAY 列出 opaque id 与 running/exited
- **AND** 输入框 SHALL 保持 disabled 并说明缺少 interactive capability

### Requirement: timeout 不得标成已连接
open/attach 超时或断线 SHALL 保持 `unknown` 或 `offline`。Pane MUST NOT 本地标记 connected。

#### Scenario: open 超时
- **WHEN** `openTerminal` 超时
- **THEN** Pane SHALL 显示失败原因
- **AND** SHALL NOT 创建可输入的假会话
