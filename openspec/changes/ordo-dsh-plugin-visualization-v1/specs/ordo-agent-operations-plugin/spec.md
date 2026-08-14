## ADDED Requirements

### Requirement: Ordo SHALL remain the canonical Agent operations owner
Ordo Agent Ops 插件 SHALL 只投影 Ordo 的 run、task、attempt、session、runtime route、lease、worktree、approval、verification、evidence 和 closeout facts。Harness Control Plane、DSH、Workbench 和插件 adapter MUST NOT 创建平行 scheduler、lease ledger、task terminal state 或 synthetic completion。

#### Scenario: 客户端认为 task 已完成但 Ordo 未确认
- **WHEN** 客户端收到断流前的最后一个 progress event，但没有 terminal snapshot 或 owner receipt
- **THEN** 客户端 SHALL 显示 stale、unknown 或 reconcile_required
- **AND** SHALL NOT 将 task 标记为 succeeded 或释放 writer lease

### Requirement: Agent Ops SHALL expose a versioned safe snapshot
Ordo SHALL 提供版本化、tenant/workspace scoped 的 Agent Ops snapshot，包含安全 refs、短摘要、reason code、freshness、evidence refs 和 server-authored allowed actions。Snapshot MUST NOT 包含 raw prompt、完整 transcript、provider payload、credential、private tool arguments、absolute host path、PID 或完整思维链。

#### Scenario: Workbench loads a run graph
- **WHEN** Workbench 以已认证 tenant/workspace/principal context 请求一个 run
- **THEN** snapshot SHALL 返回 run/task/edge/attempt/session/runtime/lease/approval/verification 的安全投影和版本
- **AND** 所有 resource SHALL 绑定 exact context revision、installation 和 contract digest

### Requirement: DSH-readable owner snapshots SHALL retain exact authorization context
供 DSH Host 消费的 owner snapshot SHALL 携带完整的 tenantRef、workspaceRef、principalRef、contextRevision 和 installationRef。只有 `ready` 或 `stale` snapshot 与 Host 生命周期内固定的 server-injected expected context 完全一致时，Host 才可投影 run 或 capacity facts。context 缺失、非法或任一字段漂移 MUST 进入安全的 `contract_mismatch`，不得透传 owner facts。

#### Scenario: Owner snapshot arrives for another installation
- **WHEN** snapshot 的 tenant/workspace/principal/context revision 相同，但 installationRef 与 DSH Host 固定的 expected context 不同
- **THEN** Host SHALL 返回不含 run 或 capacity 的 `contract_mismatch`
- **AND** SHALL NOT 根据 ticket、browser 参数或旧 snapshot 推导或替换 expected context

### Requirement: Event consumers SHALL reconcile gaps against authoritative snapshots
Agent Ops event SHALL 携带 stream、单调 sequence、cursor、entity version 和 safe delta/summary。Consumer MUST 幂等忽略 duplicate；遇到 gap、expired cursor、tenant switch、membership/config revoke、runtime generation 或 contract digest 漂移时 MUST 停止增量应用并重读 authoritative snapshot。

#### Scenario: Event sequence has a gap
- **WHEN** consumer 的最后 sequence 为 41，而下一 event 为 43
- **THEN** consumer SHALL 停止应用 43 及后续 mutation projection
- **AND** SHALL 通过当前 tenant/workspace context 重读 snapshot，再建立新 cursor

### Requirement: Unknown outcomes SHALL never auto-retry
Timeout、HTTP accepted、event disconnect、client crash、cancel request 或 unknown liveness MUST NOT 被映射为 terminal success/failure。`unknown`、`partial` 和 `cancel_unknown` SHALL 进入 `reconcile_required`，并 MUST NOT 自动 execute、redispatch、release lease 或启动 replacement writer。

#### Scenario: Writer attempt times out
- **WHEN** writer attempt 超时且进程是否停止不可证明
- **THEN** Agent Ops projection SHALL 保留其 capacity 和 writer lease 占用
- **AND** 只提供 Ordo owner-authored reconcile action，不提供自动 restart

### Requirement: Actions SHALL be server-authored and owner-confirmed
Agent Ops mutation SHALL 使用通用 `harness.action.v1alpha1`，绑定 exact principal context、installation、plugin release、runtime generation、target/version、contract digest、policy、approval、idempotency 和 preview digest。Client 和 plugin MUST NOT 提交 arbitrary command、argv、env、URL、host path、generic bearer 或未注册 action type。Terminal UI state SHALL 由 Ordo/owner receipt 确认。

#### Scenario: Stale approval is reused after runtime generation changes
- **WHEN** 一个 approval 绑定 runtime generation A，但执行前 runtime 已变为 generation B
- **THEN** Ordo SHALL 在副作用前拒绝该 action 为 stale
- **AND** 客户端 SHALL 请求新 preview/approval，而不是修改旧 descriptor

### Requirement: V1 SHALL stage control actions behind durable authority
首个 delivery slice SHALL 允许 read snapshot、event subscription 和 `ordo.reconcile.request`。`ordo.run.launch`、`ordo.attempt.cancel`、`ordo.task.redispatch`、`ordo.lease.release` 以及超过稳定单 writer 边界的 admission MUST 保持禁用，直到 durable capacity reservation、canonical repository authority、runtime qualification、lease/worktree/fencing 和 crash/replay 验收完成。

#### Scenario: UI asks to launch a second writer
- **WHEN** durable reservation 或 canonical repository/fence snapshot 缺失、stale、revoked、unknown 或 mismatched
- **THEN** Agent Ops SHALL deny launch before process creation
- **AND** SHALL 返回可审计 blocker，而不是把 policy cap 余量当作 authorization

### Requirement: Capacity SHALL distinguish policy, observation, qualification and reservation
Capacity projection SHALL 分别报告 global/provider/role policy cap、active/timeout/unknown retained counts、runtime route qualification、reservation state、canonical repository writer blockers、source 和 freshness。未实现或未获得 durable reservation 时，客户端 MUST NOT 显示为可启动容量。

#### Scenario: Global cap is twenty but no durable reservation exists
- **WHEN** policy cap 为 20、observed count 为 4，但 candidate 没有 reservation
- **THEN** UI SHALL 显示 policy/observed 数值和 `not_reserved`
- **AND** SHALL NOT 显示“16 个可启动 slot”或开放 launch action

### Requirement: Domain workflows SHALL retain domain owner receipts
当 Scaena、Eikona、Anatomia 或其他领域 action 被 Ordo task 编排时，Ordo SHALL 保存 task/attempt/approval/verification lineage 和 domain owner receipt ref；它 MUST NOT 复制或成为剧本、ProductionGraph、图片、视频分析或资产 canonical state owner。

#### Scenario: Eikona generation completes inside an Ordo task
- **WHEN** Eikona owner 产生 terminal generation receipt
- **THEN** Ordo task SHALL 引用该 owner receipt 与相关 evidence ref
- **AND** Agent Ops UI SHALL 从 owner projection 读取资产状态，而不是从 Ordo task summary 合成资产成功
