# dsh-ai-drama-product-evidence Specification

## Purpose
Define redacted Director product evidence and honest degradation when required host or owner capabilities are unavailable.
## Requirements
### Requirement: Director Pack 必须生成脱敏使用证据

插件 SHALL 记录 install/disabled reason、command category、open/review/evidence/handoff outcome、context recovery duration 和 settlement class。证据 MUST NOT 包含自由文本命令、剧本、Prompt、provider payload、媒体内容、credential 或 private path。

#### Scenario: 用户从 DSH 打开 Workbench

- **WHEN** handoff 被成功验证并打开
- **THEN** evidence SHALL 记录 handoff category、latency 和 result class
- **AND** SHALL 只保存 opaque evidence refs

### Requirement: 缺少 host seam 时必须诚实降级

当正式 DSH host seam、Pane registry、event stream 或 Workbench handoff capability 不可用时，插件 SHALL 显示 disabled reason 或 needs_contract。MUST NOT 用轮询、死按钮、假成功或私有 API 绕过。

#### Scenario: Event stream 不可用

- **WHEN** owner 或 host 没有发布 snapshot + event capability
- **THEN** corresponding pane SHALL 显示 needs_contract 或 offline
- **AND** SHALL 禁止 mutation
