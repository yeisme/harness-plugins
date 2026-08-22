## Why

根级 Wave 1 要求 Plan+Skills、Subagent、Terminal 接入同一 Pane 平台。Subagent Pane 已交付。Plan 与 Skills 应组成一个 Agent Context Pane（Plan / Skills / Invocations 三 tab），复用 DSH 已有 plan projection 与 skills registry。Terminal 在 `TerminalInteractiveCapabilityV1` 未合入前只做 capability probe，缺 seam 显示 `contract_mismatch`，不解封 V3 xterm 商品区。

## What Changes

- 新增 Agent Context Pane：Plan、Skills、Invocations；snapshot + push，无 TTL poll。
- Subagent：引用已完成 `dsh-pane-subagent-monitor-v1`，本 change 不复制实现。
- Terminal：probe-only；有 `TerminalHostV1` 则投影 coarse state；无 `TerminalInteractiveCapabilityV1` 则 `contract_mismatch`，不渲染假 PTY。
- session/context switch 与 teardown 测试入口明确。

## Capabilities

### New Capabilities

- `dsh-agent-context-pane`：Plan+Skills+Invocations 组合面。
- `dsh-terminal-probe-pane`：Terminal capability probe 与诚实降级。

### Modified Capabilities

无。不修改 Subagent 已交付 requirement。

## Impact

- Owner：`agent/harness-plugins`。
- 依赖：`dsh-pane-plugin-platform-v1`、`dsh-pane-subagent-monitor-v1`、DSH plan/skills。
- 根 handoff：任务 3.1。
