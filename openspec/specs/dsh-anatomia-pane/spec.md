# dsh-anatomia-pane Specification

## Purpose
TBD - created by archiving change dsh-anatomia-pane-v1. Update Purpose after archive.
## Requirements
### Requirement: Anatomia Pane implementation SHALL be owned by Harness Plugins
DSH-specific Host bridge, Client view registration, action admission, bundle wiring, lifecycle, and conformance tests SHALL live in `agent/harness-plugins`. Anatomia SHALL remain the canonical owner of source, job, analysis, observation, and evidence state.

#### Scenario: Plugin integration changes
- **WHEN** the DSH Anatomia Pane requires a UI, Host, profile, or compatibility change
- **THEN** that implementation SHALL be changed and verified in Harness Plugins
- **AND** the plugin SHALL consume Anatomia owner contracts instead of copying Anatomia state or business rules

### Requirement: Anatomia Pane SHALL 投影异步 job 与 evidence
Harness Plugins Host adapter SHALL 从 Anatomia canonical source/job/timeline/shot/scene/transcript/OCR/observation 派生 snapshot。Partial 结果 MUST 显式标记，MUST NOT 显示为 complete。

#### Scenario: 分析仍在进行
- **WHEN** job 状态为 running 且仅有部分 shot
- **THEN** Pane status SHALL 为 `running` 或 `partial`
- **AND** complete badge SHALL 不出现

### Requirement: Analyze 与 inspect SHALL 为 gated owner action
Analyze、inspect evidence、revision SHALL 调用 Anatomia owner。客户端 MUST NOT 本地合成 evidence。

#### Scenario: 未授权 analyze
- **WHEN** 缺少 analyze permission
- **THEN** Pane SHALL 显示 `permission_denied`
- **AND** SHALL NOT 开始本地解码或猜测结果

### Requirement: 事件 SHALL 可恢复且禁止轮询
Snapshot 后 Host SHALL 只消费 push event。gap SHALL 进入 `reconcile_required`。证据 payload MUST 脱敏。客户端 MUST NOT 定时轮询 job status。

#### Scenario: Cursor 过期
- **WHEN** cursor 无法继续
- **THEN** Host SHALL 重读 snapshot
- **AND** 客户端 SHALL NOT 定时轮询 job status
