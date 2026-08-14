# dsh-ordo-command-surface Capability

`ordo` slash 命令的 host 合同：注册、语法、read/action 分类与 preview-before-mutate 调度。

## ADDED Requirements

### Requirement: One ordo command SHALL register only when a data source is mounted
`packages/host/ordo-commands` SHALL 注册单一 `ordo` 命令（带 description 与 `input.hint`），且 SHALL 仅在至少一个数据源（`ordoAgentOps` 或 `agentCompositionPreview`）可用时注册。注册 MUST 返回精确 disposer 并触发 `commands/change`；无数据源时 MUST NOT 注册。

#### Scenario: Deployment mounts no Ordo source
- **WHEN** 宿主既未 mount `ordoAgentOps` 也未 mount `agentCompositionPreview`
- **THEN** 命令目录 SHALL 不出现 `ordo`
- **AND** 挂载数据源后 SHALL 通过 `commands/change` 出现

### Requirement: Subcommand grammar SHALL accept safe refs only
`ordo` 命令 SHALL 自行解析 `rawInput` 为 `sub [args...]`：sub MUST 匹配 `[a-z][a-z0-9-]*`，preset-id MUST 匹配 `[a-z0-9][a-z0-9-]*`，run-ref/evidence-ref/decision-ref MUST 为非空且不含空白、路径分隔或 URL scheme。非法输入 SHALL 返回 typed error 与可用子命令列表，MUST NOT 交给 shell、URL、模型或任何外部解释器。

#### Scenario: User types a path as an argument
- **WHEN** 用户输入 `/ordo status ../../../etc/passwd`
- **THEN** handler SHALL 返回语法错误文本
- **AND** SHALL NOT 把该输入用于文件、进程或网络操作

### Requirement: Read subcommands SHALL return safe four-part summaries
read 子命令（`status`/`preview`/`approvals`/`evidence`/`capacity`/`help` 与无参 `ordo`）SHALL 返回「结论 · freshness/状态 · 关键 refs 安全摘要 · 下一个动作」四段式成功文本，且 MUST 只使用已冻结的 Ordo 状态词汇表。owner 源不可用 SHALL 返回 `needs_contract` + reason，MUST NOT 合成事实。

#### Scenario: Snapshot owner is unavailable
- **WHEN** `ordoAgentOps` 处于 `needs_contract`
- **THEN** `/ordo status` SHALL 返回 `needs_contract` 与 reason
- **AND** SHALL NOT 显示任何 run/task/lease 数值

### Requirement: Action subcommands SHALL preview before any mutation
action 子命令（`qualify`/`reconcile`）SHALL 先返回 exact target/effect/owner/expiry 与 `preview_digest` 的 preview 文本，MUST NOT 直接 mutate。`approve <decision-ref>` SHALL 对 `preview_digest`、`context_revision` 与 tenant/workspace 做 CAS；漂移 SHALL 拒绝为 stale 并要求重新 preview。`run launch|cancel|redispatch` SHALL 一律返回 `not_available` 与原因。

#### Scenario: Approve after the preview went stale
- **WHEN** preview 生成后 context revision 或 plugin digest 变化
- **THEN** `/ordo approve <decision-ref>` SHALL 返回 stale 错误
- **AND** SHALL NOT 提交任何动作

### Requirement: Qualify SHALL hand off the exact owner command until the remote action opens
在 Ordo 远端 `ordo.agent_qualify.request` 动作面开放前，`/ordo qualify <preset-id>` SHALL 返回组合 preview 与精确 owner CLI 行（`ordo agent qualify <preset> --approve --events`）作为 next action，MUST NOT 伪造远端调用或自行执行 canary。

#### Scenario: User asks to qualify a preset
- **WHEN** 组合投影可用但 Ordo 动作面未开放
- **THEN** 命令 SHALL 返回 preview 与精确 CLI 行
- **AND** SHALL NOT 在 DSH 进程内运行任何 canary 或资质判断

### Requirement: Command results SHALL be safe text only
命令结果文本 SHALL 只包含安全摘要、refs、reason codes 与一个 next action。MUST NOT 包含 raw prompt、provider payload、private tool arguments、credential、absolute host path、PID、URL 正文或完整思维链。生命周期事件 SHALL 仅为 registry 自有的 `command/run|done`。

#### Scenario: An action receipt references private evidence
- **WHEN** 结果需要引用 evidence
- **THEN** 文本 SHALL 只包含 evidence ref 与安全摘要
- **AND** 细节 SHALL 通过面板/Workbench 在授权后查看
