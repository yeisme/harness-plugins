## ADDED Requirements

### Requirement: Director operational panes SHALL render owner projections
Context、Story、Visual、Audio、Run 和 Review Pane SHALL 渲染 Creator/Drama/Ordo safe projection，而不是仅显示 capability shell。

#### Scenario: Current production is ready
- **WHEN** drama context 与 Creator runtime 都 fresh
- **THEN** Context SHALL 显示阶段、blocker 和 next action；Story/Visual/Audio SHALL 显示 owner resources；Run SHALL 显示 generation runs；Review SHALL 显示 reviews 与 approvals

#### Scenario: One owner segment is unavailable
- **WHEN** 某 owner projection 为 partial/offline/needs_contract
- **THEN** 仅依赖该 segment 的内容和动作 SHALL 降级并显示原因，其它 fresh segment SHALL 保持可读

### Requirement: Director actions SHALL use owner-authored descriptors and receipts
Story、Visual、Audio 和 Review 的 mutation MUST 使用 Creator runtime 返回的 `PaneActionDescriptorV1`，并展示 owner receipt；Director MUST NOT 构造任意 owner action。

#### Scenario: Descriptor expires before submit
- **WHEN** 用户提交时 descriptor 已过期或 target version 漂移
- **THEN** mutation SHALL 返回 reconcile_required，表单 SHALL 保留但 MUST NOT 自动重试

### Requirement: Director artifacts SHALL use the shared Pane intent path
资源 open、compare、attach_context、repair 和 handoff SHALL 通过现有 ArtifactIntentV1 admission path，浏览器不得拼接 path、URL 或 owner RPC authority。

#### Scenario: User compares a visual artifact
- **WHEN** 用户从 Visual 或 Review 选择 compare
- **THEN** Pane SHALL 以独立 artifact/version key 打开 shared preview，目标 owner SHALL 重新 admission

### Requirement: Operational panes SHALL expose complete states and recovery
每个 Pane MUST 覆盖 loading、empty、ready、partial、stale、offline、error 与 disabled，并为可恢复状态提供一个明确 refresh/reconcile action。

#### Scenario: Snapshot cursor drifts
- **WHEN** snapshot version 回退或 ref 轮换不合法
- **THEN** Pane SHALL 隐藏旧 facts、显示 reconcile 状态并等待显式 owner refresh
