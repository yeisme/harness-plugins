## ADDED Requirements

### Requirement: Director Pack 必须提供 typed /drama 命令

插件 SHALL 提供 /drama、new、open、plan、generate、review、repair、evidence 和 handoff 命令，并通过稳定 selector、current context 和 typed handler 执行。命令 MUST NOT 接受任意 shell、argv、absolute path、raw prompt 或 provider payload。

#### Scenario: 用户请求下一项审查

- **WHEN** 用户执行 /drama review
- **THEN** Host SHALL 读取 current context 和最新 Review projection
- **AND** SHALL 打开下一项 owner-authored review
- **AND** MUST NOT 自行推断 accept 或 repair action

### Requirement: Mutation 命令必须一次性提交并保真未知状态

generate、review、repair 或 handoff mutation SHALL 在提交前重新验证 descriptor、target/version、context revision、permission、cost、rights 和 idempotency。unknown 或 partial SHALL NOT 自动重试。

#### Scenario: 提交后连接中断

- **WHEN** action dispatch 后无法验证 owner settlement
- **THEN** 命令 SHALL 返回 unknown 和 receipt/reconcile refs
- **AND** SHALL 禁止以新 idempotency identity 自动重发
