## ADDED Requirements

### Requirement: Asset Catalog MUST store only safe projections

Asset Catalog MUST 只保存 R2 Owner safe projection 与 Workbench-owned organization metadata；MUST NOT 保存 artifact bytes、private path、raw prompt/provider payload 或完整 canonical content。

#### Scenario: Owner asset ingestion
- **WHEN** connector 提供兼容 Asset projection event
- **THEN** Workbench MUST 以 tenant/owner/resource/version/cursor 幂等 upsert AssetEntry
- **AND** MUST 保存 source freshness、rights/lineage/review summary 与 allowed actions

#### Scenario: Asset revoked or deleted
- **WHEN** principal 失权或 Owner 返回 deleted/tombstone
- **THEN** Workbench MUST 清除 preview/search cache并保留无敏感信息 tombstone
- **AND** Collection/WorkItem link MUST 不泄露旧 title/content/path

#### Scenario: Projection cursor gap
- **WHEN** Owner event cursor 超出 retention、出现不可证明 gap 或 projector generation 损坏
- **THEN** projector MUST 停止该 source incremental apply，并通过 snapshot fence + tail 执行可恢复 rebuild
- **AND** rebuild 失败 MUST 保留旧安全 generation并标 stale，MUST NOT 保存 raw Owner payload、先清空线上索引或猜测缺失事件

### Requirement: Collection and SavedView MUST remain Workbench-owned metadata

用户 MUST 能创建 Collection 和 SavedView 来组织 tenant-bound AssetEntry；这些对象 MUST 不修改 Owner canonical state 或跨 tenant 引用资源。

#### Scenario: Collection 添加其他 tenant asset
- **WHEN** mutation 尝试把其他 tenant opaque ref 加入 Collection
- **THEN** 服务 MUST 返回 `permission_denied` 或安全不存在
- **AND** MUST 不创建 dangling/cross-tenant relation

### Requirement: Search MUST be server-side, typed, and access-trimmed

Search MUST 使用 typed query、bounded complexity、cursor pagination 和服务端 tenant/object access trim；浏览器 MUST NOT 下载全量数据做生产筛选。

#### Scenario: 100k AssetEntries 搜索
- **WHEN** workspace 有 100k AssetEntries 且用户提交允许的 text/facet/sort query
- **THEN** 服务 MUST 返回 bounded page、opaque cursor、safe highlight 与 source freshness
- **AND** p95 latency/response size MUST 满足批准预算

#### Scenario: Query 超过复杂度
- **WHEN** token/facet/page/timeout 或组合复杂度超过限制
- **THEN** 服务 MUST 返回 `query_too_complex` 或稳定 limit error
- **AND** MUST 不执行无界扫描或在错误中回显内部 query plan

#### Scenario: Search cursor 跨 generation 重放
- **WHEN** opaque cursor 的 tenant/query/sort/index generation digest 与当前请求不一致
- **THEN** Search MUST 返回 `invalid_cursor` 或 typed resync error
- **AND** MUST NOT 把旧 generation position 应用于新索引或返回跨 tenant 结果

### Requirement: WorkItem MUST use a centralized versioned state machine

WorkItem status、assignment、dependency、acceptance、due date 和 links MUST 由集中 service 验证并使用 expected version；transport/UI/repository MUST NOT 直接修改 status。

#### Scenario: 完成 WorkItem
- **WHEN** 用户从 `in_review` 转为 `done`
- **THEN** service MUST 验证 acceptance checks 或批准 override
- **AND** MUST 写入 version、audit 与 evidence refs

#### Scenario: Task 成功
- **WHEN** linked Task 进入 succeeded
- **THEN** WorkItem MAY 更新 evidence/link projection
- **AND** MUST NOT 自动转为 `done`

#### Scenario: Dependency cycle
- **WHEN** 新 dependency 会形成自环或 cycle
- **THEN** service MUST 返回 `dependency_cycle`
- **AND** 现有 dependency graph/version MUST 保持不变

#### Scenario: 分配给 automation actor
- **WHEN** WorkItem assignment 指向 automation actor，但 R1 actor/delegation 或 R4 workflow actor 合同未晋级
- **THEN** service MUST 返回 `needs_contract` 或 `permission_denied`
- **AND** MUST NOT 把普通 user/team ref 伪装为 automation actor

### Requirement: WorkItem conflicts MUST preserve user input

WorkItem mutation MUST 返回当前安全版本和稳定 conflict metadata；客户端 MUST 提供 reload/merge/reapply rescue，不能静默覆盖或丢弃输入。

#### Scenario: Concurrent edit conflict
- **WHEN** 两个用户基于同一 WorkItem version 修改 assignment/acceptance
- **THEN** 第二个 mutation MUST 返回 `version_conflict`
- **AND** 表单 MUST 保留用户输入并显示当前安全差异

### Requirement: Action Inbox MUST index real action-required sources

Inbox MUST 聚合 Task Gate、unknown_accept、failed/partial Task、WorkItem blocker/review、stale Owner projection、permission/session rescue 与 Delivery blocker 的 safe source refs；MUST NOT 成为 source 状态真源。

#### Scenario: Unknown accept item
- **WHEN** Owner mutation 进入 `unknown_accept`
- **THEN** Inbox MUST 创建/更新 reconcile action item并展示原 receipt/idempotency safe ref
- **AND** resolve action MUST 调用 source reconcile，不能重新提交 mutation

#### Scenario: Source 已被其他用户解决
- **WHEN** InboxItem source version/event 表明 action 已完成
- **THEN** projection MUST 幂等转 resolved
- **AND** 当前用户操作 MUST 返回已解决状态而非重复执行 source command

### Requirement: Approval Queue MUST preserve source authority

Approval Queue MUST 统一展示 Task Gate、Identity command approval 和 Owner review safe projection，但 approve/reject/request-changes MUST 调用 source typed command 并等待 receipt/event 确认。

#### Scenario: Approval version stale
- **WHEN** source gate/review version 已变化
- **THEN** approval mutation MUST 返回 version conflict/stale
- **AND** UI MUST 刷新 source，不得本地标记 approved

### Requirement: Activity MUST preserve source-local ordering

Activity timeline MUST 合并 Workbench Task events 与 Owner/Identity projection events，同时保留 source、cursor/sequence、occurred/observed time；MUST NOT 声称跨 source 全局 exactly-once 顺序。

#### Scenario: SSE reconnect
- **WHEN** browser 或 projection worker断线后恢复
- **THEN** 每个 source MUST 使用自己的最后确认 cursor/sequence 恢复
- **AND** duplicate/out-of-order event MUST 幂等处理并保留 source attribution

### Requirement: Delivery Index MUST reflect Owner readiness and receipts

Delivery Index MUST 只索引 Owner delivery/handoff/export readiness、blockers、version、rights、receipt/grant 与 audit summary；真实 delivery/export/handoff MUST 通过 Owner/Task 执行。

#### Scenario: Delivery blockers resolved
- **WHEN** linked WorkItem acceptance、review、rights 和 Owner readiness 均满足
- **THEN** Delivery projection MUST 显示 allowed action与当前 source version
- **AND** 执行 delivery MUST 创建 Task/Owner receipt，而不是浏览器直接调用 Owner

#### Scenario: Partial delivery 包含 unknown child
- **WHEN** parent delivery 的部分 child succeeded、部分 failed、部分结果为 unknown
- **THEN** Delivery MUST 保存每个 child receipt/status 并保持 parent `partial` 或 `unknown`
- **AND** 只允许重试明确 failed/not-dispatched child；unknown child MUST 先 receipt/status/reconcile，不能重复导出

### Requirement: Daily operations loop MUST be traceable end to end

系统 MUST 支持 Inbox → Asset/WorkItem → Task/Gate/Approval → Delivery → Inbox resolution 的完整闭环，并为每一步保留 correlation、version、receipt/event 与 audit refs。

#### Scenario: Successful daily loop
- **WHEN** 用户在真实 test tenant/project 处理 blocker、更新 WorkItem、批准 Gate 并完成 Delivery
- **THEN** 每个状态变化 MUST 来自对应 service/Owner receipt
- **AND** 最终 Inbox resolution MUST 可追溯到 Asset/WorkItem/Task/Approval/Delivery evidence

#### Scenario: Owner offline during loop
- **WHEN** Owner 在 Task 或 Delivery 阶段离线
- **THEN** 其他 Workbench Pane MUST 保持可用，相关 projection MUST 标 `stale/degraded`
- **AND** mutation MUST fail/reconcile，不得伪造完成或自动重放 unknown outcome

### Requirement: Daily operations MUST enforce R1 identity and R2 owner contracts

所有 query、cache、cursor、mutation 和 Pane state MUST 绑定 R1 tenant/principal/membership version；Owner data/action MUST 只来自 R2 approved contract/capability。

#### Scenario: Membership revoked while editing
- **WHEN** 用户编辑 WorkItem 或查看 Asset 时 membership/session 被撤销
- **THEN** 新请求 MUST fail-closed并清除 tenant-bound cache/draft/subscription
- **AND** 已发送 mutation MUST 按 receipt/reconcile 处理，不得继续使用旧 allowed action

#### Scenario: Owner contract not promoted
- **WHEN** 某 Owner 只有 fixture 或 local bridge，没有 provider/consumer/canary evidence
- **THEN** 对应 Asset/Delivery/action MUST 显示 `needs_contract`
- **AND** MUST NOT 作为 daily loop production success 证据

### Requirement: Daily operations contracts MUST keep transport parity

Asset、Collection、SavedView、Search、WorkItem、Inbox、Approval、Activity、Delivery operations MUST 在 HTTP、gRPC、JSON-RPC 与 TypeScript SDK 中保持同一 pagination、version、error、receipt 与 redaction 语义。

#### Scenario: Four-transport daily loop conformance
- **WHEN** conformance suite通过四 transport 执行同一 create/query/update/approve/reconcile flow
- **THEN** safe response、state/version、errors、receipt/events MUST 一致
- **AND** 任一 transport MUST NOT 绕过 registry、authorization 或 source authority

### Requirement: Daily operations MUST meet capacity and evidence gates

R3 MUST 以 production-like 数据验证 100k AssetEntries、50k WorkItems、20 Pane restore 与 200 SSE sessions，并为 integration/system/e2e/performance 写脱敏 evidence。

#### Scenario: Production-like performance run
- **WHEN** performance suite运行批准数据规模和并发
- **THEN** latency/memory/response size/reconnect MUST 满足冻结预算或阻止 promotion
- **AND** evidence MUST 包含 command、versions、profile、summary、artifacts 与 redaction status
