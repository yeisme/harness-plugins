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

### Requirement: Host SHALL load Team snapshot before events
Harness Host SHALL 在每个 tenant/workspace/principal/runtime generation 下先向 Ordo owner adapter加载 authoritative snapshot，再订阅与 snapshot stream/cursor 匹配的 events。Client MUST 不在 snapshot 前应用 delta。

#### Scenario: Hub opens after HMR
- **WHEN** client generation 更换或插件 HMR reload
- **THEN** Host SHALL dispose旧 subscription/cache/pending actions，绑定新 context并从新 snapshot开始

### Requirement: Host SHALL enforce cursor and context continuity
Host SHALL 检查 stream ref、next seq、context revision、installation/plugin digest、policy revision 与 runtime generation。duplicate event MAY 忽略；gap、expired cursor、context drift 或 schema mismatch SHALL 停止 delta、禁用 mutation并重新 snapshot。

#### Scenario: Event arrives for another workspace
- **WHEN** subscription 收到 workspace/context 不匹配的 event
- **THEN** Host MUST 丢弃 event、不得转发浏览器，并 SHALL 触发 typed context-drift/reload path

### Requirement: Host SHALL proxy actions without exposing credentials
Browser action SHALL 发送 safe action input 给 Host；Host SHALL 重新检查 context、surface control、permission、preview/approval、target revision、idempotency 与 installation policy，再调用 Ordo adapter。broker credential、CLI environment 与 raw owner payload MUST 不进入 browser。

#### Scenario: Browser replays an expired preview
- **WHEN** Client 提交 expired preview ref
- **THEN** Host/Ordo SHALL fail closed并返回 re-preview action，Client MUST 不自动重试 effect

### Requirement: Host SHALL close every Team collaboration lifecycle
plugin unload、view dispose、tenant/workspace/principal switch、runtime generation change、HMR 和 network/disconnect SHALL 清理 event streams、timers、backoff、pending requests、callbacks 与 safe caches。replacement generation MUST 从 snapshot开始。

#### Scenario: Workspace identity changes
- **WHEN** DSH Host 切换 workspace
- **THEN** 旧 Delivery selection、cursor、Room draft refs、pending dialogs 与 cached actions MUST 清除，任何晚到 result MUST 被 generation fence 丢弃
