## 1. Agent Context

- [x] 1.1 定义 Plan/Skills/Invocations 投影类型与 redaction。Validation: focused Vitest。
- [x] 1.2 实现三 tab Client view，订阅 plan projection 与 `skills/change`，无轮询。
- [x] 1.3 session/context switch 重置与 dispose 测试。

## 2. Subagent 与 Terminal

- [x] 2.1 文档与 bundle 引用既有 Subagent Pane；不复制 reducer。
- [x] 2.2 Terminal capability probe：缺 `TerminalInteractiveCapabilityV1` 显示 `contract_mismatch`。Validation: 负向 fixture。

## 3. Bundle 与验证

- [x] 3.1 可安装 bundle 行；`dsh plugin --profile web add` dump 可见。
- [x] 3.2 `openspec validate dsh-agent-context-subagent-terminal-panes-v1 --strict --no-interactive`。
