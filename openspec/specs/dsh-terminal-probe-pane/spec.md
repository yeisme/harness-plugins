# dsh-terminal-probe-pane Specification

## Purpose
TBD - created by archiving change dsh-agent-context-subagent-terminal-panes-v1. Update Purpose after archive.
## Requirements
### Requirement: Terminal Pane SHALL probe 官方 capability 并诚实降级
Terminal Pane SHALL 探测 `TerminalInteractiveCapabilityV1` 或等价官方 duplex PTY seam。缺失时 SHALL 显示 `contract_mismatch` 与所缺 capability，MUST NOT 渲染假 PTY、MUST NOT 用轮询刷新占位输出、MUST NOT 解封 V3 xterm 商品区实现。

#### Scenario: 无 interactive terminal seam
- **WHEN** profile 只有旧 TerminalHostV1 占位或无 terminal capability
- **THEN** Pane SHALL 进入 `contract_mismatch`
- **AND** SHALL NOT 创建 xterm 实例或伪造 stream

### Requirement: 若 coarse terminal 投影可用 MAY 显示只读状态
若 owner 提供 session list 与 exited/error 粗状态，Pane MAY 显示只读列表。View detach MUST NOT 终止 PTY。真实 attach/write/resize SHALL 仍要求 interactive capability。

#### Scenario: 只读列表
- **WHEN** owner 返回 terminal session refs 但无 duplex stream
- **THEN** Pane MAY 列出 opaque id 与 exited 状态
- **AND** input SHALL 保持 disabled 并说明原因

