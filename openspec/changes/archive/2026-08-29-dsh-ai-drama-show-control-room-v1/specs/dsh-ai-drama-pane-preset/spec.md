## ADDED Requirements

### Requirement: Director Pack SHALL provide an additive show-control preset
Pack SHALL 保留 `director` preset，并新增 `show-control` preset；Tier 0 默认有序打开 Show Board、Review Inbox、Run、Delivery，Asset Wall 按需打开。

#### Scenario: Apply show-control at Tier 0
- **WHEN** 用户从 Creator Home 或 `/drama show` 应用 preset
- **THEN** 唯一 region SHALL 打开不超过四个默认 tab，active 为 Show Board，MUST NOT 伪造 split geometry

#### Scenario: Existing director preset is applied
- **WHEN** 旧 consumer 调用原 `director` preset
- **THEN** Context、Review、Run 的原顺序与 secondary Pane 行为 MUST 保持不变
