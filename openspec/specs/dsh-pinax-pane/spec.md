# dsh-pinax-pane Specification

## Purpose
TBD - created by archiving change dsh-pinax-pane-v1. Update Purpose after archive.
## Requirements
### Requirement: Pinax Pane implementation SHALL be owned by Harness Plugins
DSH-specific Host bridge, Client view registration, action admission, bundle wiring, lifecycle, and conformance tests SHALL live in `agent/harness-plugins`. Pinax SHALL remain the canonical owner of vault, note, index, graph, history, and sync state.

#### Scenario: Plugin integration changes
- **WHEN** the DSH Pinax Pane requires a UI, Host, profile, or compatibility change
- **THEN** that implementation SHALL be changed and verified in Harness Plugins
- **AND** the plugin SHALL consume Pinax owner contracts instead of copying Pinax state or business rules

### Requirement: Pinax Pane SHALL 只投影 vault 与索引
Harness Plugins Host adapter SHALL 从 Pinax vault/index/CLI 派生 note list、backlink、graph 摘要与 history。Pane MUST NOT 成为第二 vault 或手写结构化 metadata。

#### Scenario: 打开 inbox
- **WHEN** 用户打开授权 vault 的 Pinax Pane
- **THEN** Host SHALL 下发 opaque note ref、title、tag 摘要、freshness
- **AND** payload MUST NOT 含绝对路径或凭据

### Requirement: 结构化 mutation SHALL 走 Pinax CLI 或 service
Capture、import、edit metadata、sync SHALL 调用 Pinax owner 命令。Agent MUST NOT 直接组装 JSON/YAML 作为 canonical 变更。

#### Scenario: 拒绝手写 metadata
- **WHEN** 客户端提交未经过 Pinax parser 的 metadata blob
- **THEN** Host SHALL fail closed
- **AND** vault 记录 SHALL 保持不变

### Requirement: 事件 SHALL 禁止轮询
首次 snapshot 之后 Host SHALL 只消费 push 或 owner change 事件。无 stream 时 Pane SHALL 显示 `offline`。客户端 MUST NOT 使用定时 refetch 假装实时。

#### Scenario: 无 realtime daemon
- **WHEN** sync daemon 或 event SDK 不可用
- **THEN** Pane SHALL 显示 `offline` 或 `contract_mismatch`
- **AND** SHALL NOT 用定时 refetch 假装实时
