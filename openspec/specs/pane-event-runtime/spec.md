# pane-event-runtime Specification

## Purpose
TBD - created by archiving change dsh-pane-plugin-platform-v1. Update Purpose after archive.
## Requirements
### Requirement: Event runtime SHALL 从 snapshot 建立权威状态
每个 stream/context/generation 首次进入 ready 前 SHALL 消费 schema-valid snapshot。后续 upsert/remove/append/invalidate/action_receipt/reset event SHALL 基于 cursor、sequence、entity version 与 context revision fold。Client MUST NOT 使用 timer polling 填补缺失 snapshot 或 event。

#### Scenario: 新 generation 尚未收到 snapshot
- **WHEN** Registry 已切换 generation 但只收到 incremental upsert
- **THEN** runtime SHALL 保持 `reconcile_required`
- **AND** mutation controls SHALL 保持禁用直至新 snapshot 到达

### Requirement: Duplicate 与 gap SHALL 确定性处理
相同或更旧 sequence SHALL 返回相同 state reference；sequence gap、entity version rollback、context revision mismatch 或 unknown required schema SHALL 保留最后安全 projection并进入 `reconcile_required`。Runtime MUST NOT 猜测缺失 mutation 或自动重试 owner action。

#### Scenario: Sequence 从 8 跳到 11
- **WHEN** runtime 收到 sequence 11 而最后已应用 sequence 为 8
- **THEN** runtime SHALL 标记 gap reason 与 expected/received sequence
- **AND** SHALL 请求显式 snapshot/reconcile 而非继续应用 event

### Requirement: Projection SHALL 有界并支持背压
entity、append timeline、receipt 与 summary 长度 SHALL 有显式上限。可覆盖 entity update MAY 合并，不可覆盖 receipt/approval/failure timeline SHALL 保序；超出安全预算 SHALL 截断安全摘要或进入 reconcile，不得无界增长内存。

#### Scenario: 高频任务更新同一 entity
- **WHEN** owner 在一个 UI frame 内推送同 entity 的多个 version update
- **THEN** adapter MAY 合并中间可覆盖 update并保留最高连续 version
- **AND** action receipt SHALL 不得被合并丢失

### Requirement: Action 结果 SHALL 只由 receipt 和 projection 确认
Client 提交 intent 后 SHALL 只以 owner-authored receipt 与后续 projection 收敛结果。timeout、offline、unknown 或 view close MUST NOT 推导 success；重复恢复 SHALL 使用 idempotency key 和 receipt ref。

#### Scenario: 提交后断线
- **WHEN** action request 已发送但响应前连接中断
- **THEN** runtime SHALL 显示 `unknown` 或 `reconcile_required`
- **AND** SHALL NOT 自动重新提交可能有副作用的 action

