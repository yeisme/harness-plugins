## ADDED Requirements

### Requirement: Versioned contribution 与封闭 view kinds

`DshPluginSurfaceContributionV1` SHALL 声明稳定 id、contract version、surfaces、commands、views、actions、health 和 dispose；view kind 仅允许 `status|list|table|detail|timeline|diff`，projection 只允许有界 scalar、opaque ref、safe summary、revision/freshness 和 evidence ref。

#### Scenario: 插件声明任意 renderer

- **WHEN** contribution 包含 HTML、DOM/React component、ANSI、draw callback 或未知 view kind
- **THEN** codec/probe SHALL 拒绝该 contribution 并返回稳定 reason code，宿主 MUST 不执行或渲染该 payload

### Requirement: Typed action 回到 canonical owner

action SHALL 声明 `id`、`owner`、`effect`、`risk`、`preview_policy`、`action_ref` 与 `expected_revision`。mutation/external_write/danger MUST 经 owner preview 与 receipt；客户端 MUST 不执行 action label、fix 或 hint 中的 shell command string。

#### Scenario: Stale revision action

- **WHEN** owner 以 revision mismatch 拒绝 action
- **THEN** contribution SHALL 投影 stale 与重新 preview 动作，MUST 不重放旧 action ref

### Requirement: Safe projection 隐私边界

插件 surface MUST 不包含 cookie、token、Authorization、raw prompt、provider payload、private argv、absolute private path、hidden system prompt 或 full reasoning；发现敏感字段 SHALL fail closed 并记录脱敏 violation。

#### Scenario: Projection 含 token 字段

- **WHEN** fixture 或运行时 projection 包含 token/credential 值
- **THEN** safe-projection audit SHALL 红灯或禁用 contribution，输出 MUST 不回显原值
