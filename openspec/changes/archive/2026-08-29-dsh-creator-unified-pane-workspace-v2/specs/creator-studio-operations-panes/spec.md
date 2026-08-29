## ADDED Requirements

### Requirement: Generation and approval SHALL be independent Pane views

Creator Studio SHALL 分别注册 `creator.generation` 与 `creator.approvals`，两者可独立打开、停靠、恢复和关闭。打开 Creator Home MUST NOT 自动打开任一队列。

#### Scenario: User opens generation
- **WHEN** 用户从 Creator Home 或命令目录打开生成队列
- **THEN** Pane SHALL 只打开 generation singleton view

#### Scenario: User opens approvals
- **WHEN** 用户从 Creator Home 或命令目录打开审批队列
- **THEN** Pane SHALL 只打开 approvals singleton view

### Requirement: Operations facts SHALL remain Ordo-owned

Generation SHALL 展示 Ordo run/task/receipt 安全投影；Approvals SHALL 展示 Ordo approval descriptor/receipt，并可关联领域 review/artifact refs。Creator Studio MUST NOT 创建 run、approval ledger 或 terminal state。

#### Scenario: Ordo projection is ready
- **WHEN** Ordo snapshot 与 Creator frozen context 匹配且 fresh/ready
- **THEN** Client SHALL 展示 generationRuns 与 approvals，并只启用当前未过期 approval decision

#### Scenario: Ordo projection is unavailable
- **WHEN** Ordo service 缺失、offline、permission denied 或 contract mismatch
- **THEN** 新 Pane SHALL 显示 owner reason 且不得从 browser 或 Scaena 私有状态伪造 Ordo facts

### Requirement: Approval decisions SHALL execute once and preserve uncertainty

审批操作 SHALL 只携带当前 server-authored decisionRef。Gateway SHALL 重新读取 fresh Ordo snapshot、核对 context/descriptor/expiry，并最多调用一次 owner decide。unknown、partial、stale 与 reconcile_required MUST NOT 自动重试。

#### Scenario: Approval is accepted
- **WHEN** 当前 decision descriptor 有效且 Ordo 返回 accepted receipt
- **THEN** Pane SHALL 显示 owner receipt 并刷新只读 projection

#### Scenario: Approval settlement is uncertain
- **WHEN** Ordo decide 抛出异常或返回 unverifiable settlement
- **THEN** Gateway SHALL 返回 unknown receipt 并且 MUST NOT 再次调用 decide

### Requirement: Legacy queue surfaces SHALL remain compatible

`jobs`、`reviews`、`creator.jobs`、`creator.review` 和旧 command SHALL 在本 release 保留。新 Client SHALL 优先消费新 Ordo projection；旧 Host 下 MAY 以明确 legacy source 只读展示旧字段，但 MUST NOT 由 legacy projection 启用审批 mutation。

#### Scenario: Old persisted jobs view is restored
- **WHEN** Pane persistence 恢复 `creator.jobs`
- **THEN** Client SHALL 渲染 generation 兼容视图且不得报 unknown view

#### Scenario: Old host serves only jobs and reviews
- **WHEN** 新 Client 读取不含 operations/generationRuns/approvals 的合法旧 snapshot
- **THEN** Client SHALL 保持可用并把旧数据标记为 legacy read-only
