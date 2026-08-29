## ADDED Requirements

### Requirement: Drama Review Inbox SHALL be a bounded selection-agent-review consumer
Drama Review Inbox SHALL 复用既有 selection anchor、annotation batch、agent proposal 与 receipt 合同；它 MUST NOT 扩展 selection owner 状态机或直接执行 agent edit。

#### Scenario: Submit a multi-artifact review batch
- **WHEN** 用户从 Review Inbox 选择多个有效 anchors 并提交
- **THEN** selection owner SHALL 创建 bounded batch，Drama SHALL 只展示 returned marker/proposal/receipt projection

### Requirement: Selection anchor protocol SHALL add bounded media anchors
Selection owner SHALL additive 支持 `media-frame`、`media-time-point` 与 `media-time-region`，并继续要求 artifact ref/version、quote digest、freshness 与 bounded media coordinate；既有五类 anchor 语义 MUST 不变。

#### Scenario: Media region exceeds owner bounds
- **WHEN** time region 反向、超过 24 小时上限或 frame 超过协议上限
- **THEN** selection owner SHALL fail-closed，且该 anchor MUST NOT 进入 annotation batch
