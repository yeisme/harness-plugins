## ADDED Requirements

### Requirement: Agent Context Pane SHALL 组合 Plan、Skills 与 Invocations
单一 Pane SHALL 提供 `Plan`、`Skills`、`Invocations` 三个 tab。Plan SHALL 投影 `plan/mode`、步骤、acceptance、阻塞与 evidence。Skills SHALL 按 provider/source/version 分组并标明 agent/session/preset/workspace scope。Invocations SHALL 显示结果/evidence timeline，MUST NOT 保存 raw prompt、private arguments 或完整思维链。

#### Scenario: 选中 plan step
- **WHEN** 用户选中一个 plan step
- **THEN** Skills tab SHALL 高亮 required/recommended skills
- **AND** 缺失 capability SHALL 显示 typed blocker

### Requirement: Plan 与 Skills SHALL 使用 push 而非轮询
Plan SHALL 消费 `session/event` projection。`skills/change` SHALL 触发 registry snapshot 更新。Refresh SHALL 仅为用户显式 reconcile。

#### Scenario: skills/change 到达
- **WHEN** owner 发出 skills/change
- **THEN** Skills 列表 SHALL 更新
- **AND** 客户端 SHALL NOT 使用 TTL refetch
