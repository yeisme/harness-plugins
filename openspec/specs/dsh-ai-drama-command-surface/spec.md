# dsh-ai-drama-command-surface Specification

## Purpose
Define the typed `/drama` command family, additive show-control navigation, and owner-gated single-submit mutation semantics.
## Requirements
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

### Requirement: Drama command surface SHALL add full-show navigation commands
命令面 SHALL additive 注册 `/drama show`、`/drama inbox`、`/drama assets` 和 `/drama delivery`，旧命令的 id、selector 和 mutation 语义 MUST 不变。

#### Scenario: User executes drama show
- **WHEN** Show Control capability available 且用户执行 `/drama show`
- **THEN** Client SHALL 应用 show-control preset 并聚焦 Show Board

#### Scenario: Show Control remote is missing
- **WHEN** 用户发现新增命令但 remote 未安装
- **THEN** 命令 SHALL disabled 并显示 needs_contract reason，旧 `/drama open` SHALL 继续可用
