# dsh-ordo-command-ux Capability

`ordo` 命令的 Web 交互面：发现、popup 菜单、结果渲染、面板联动与可访问性。

## ADDED Requirements

### Requirement: ordo SHALL be discoverable with an argument hint and a bare-invocation popup
host 命令 SHALL 携带 `input: { hint }` 以获得 `leadingInput` dispatch，并 SHALL 通过 `CommandUiContract.decorate('ordo', spec)` 为裸 `/ordo` 提供 popup 菜单（子命令清单）。popup `onSelect` SHALL 提交精确的 `/ordo <sub>` 行，MUST NOT 直接执行 host handler 以外的路径。

#### Scenario: User types a bare slash
- **WHEN** 用户输入 `/ordo` 且未带参数
- **THEN** 客户端 SHALL 显示子命令 popup 菜单
- **AND** 选择任一子命令 SHALL 提交对应命令行

### Requirement: Command results SHALL render accessibly and never enter the model
命令结果 SHALL 由 `ui-commands` adapter 渲染为键盘可达的结果行，支持可预测焦点、screen reader 状态播报与 reduced motion；结果 MUST NOT 作为用户消息进入模型历史。错误行 SHALL 包含 reason code、安全解释与下一步。

#### Scenario: Keyboard user runs a read command
- **WHEN** 用户只用键盘执行 `/ordo status`
- **THEN** 结果行 SHALL 可达且状态被正确宣布
- **AND** 结果 SHALL 不出现在模型请求中

### Requirement: command/executed SHALL link results to the Agent Ops panel without mutation
`ui-ordo-agent-ops` SHALL 监听本地 `command/executed(sessionId, 'ordo', result)` 并打开/聚焦 Agent Ops 面板到相关资源。该联动 SHALL 只做导航，MUST NOT 自动执行 mutation、重放或重发动作。

#### Scenario: /ordo status completes
- **WHEN** 命令返回 run 摘要
- **THEN** 面板 SHALL 打开并聚焦该 run
- **AND** SHALL NOT 自动提交任何动作

### Requirement: Panel popups SHALL submit exact command lines from safe refs
面板「以命令运行」popup SHALL 使用 `popupSelect` 提交精确命令行（如 `/ordo reconcile <run-ref>`），refs MUST 只来自 authoritative safe snapshot，MUST NOT 来自用户输入拼接或浏览器 URL 参数。

#### Scenario: Reconcile is needed for a run
- **WHEN** 面板显示 `reconcile_required` 且 snapshot 提供 run ref
- **THEN** popup SHALL 提交 `/ordo reconcile <run-ref>` 精确行
- **AND** SHALL NOT 提交任意文本或额外参数

### Requirement: Disabled and stale states SHALL be visible and explained
命令结果与 popup 在 `stale`/`offline`/`permission_denied`/`contract_mismatch` 下 SHALL 用文本、图标与 accessible name 表明状态并解释原因；mutation 类子命令在这些状态下 MUST NOT 可提交。状态表达 MUST NOT 只靠颜色。

#### Scenario: Snapshot goes stale before an action
- **WHEN** 数据源变为 stale
- **THEN** action 子命令 SHALL 显示不可用与原因
- **AND** read 摘要 SHALL 标明 stale 与最后观察时间
