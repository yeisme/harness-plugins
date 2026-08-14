## ADDED Requirements

### Requirement: Workbench SHALL provide the full Agent Ops Studio
Workbench Agent Ops Studio SHALL 提供 tenant/workspace context、run selector、runtime/capacity matrix、DAG/task table、timeline、attempt/session inspector、lease/worktree/fence map、approval/attention inbox、verification/evidence 和 closeout/reconcile UI。Workbench MUST NOT import Ordo private modules or persist canonical Agent state。

#### Scenario: Operator investigates a stalled task
- **WHEN** task 显示 attention_required 或 reconcile_required
- **THEN** Studio SHALL 让用户从 task 定位 attempt/session、runtime route、lease/worktree、最近 event 和 evidence
- **AND** 只显示 Ordo server-authored safe actions

### Requirement: DSH and Workbench SHALL use complementary information density
DSH SHALL 提供当前上下文的 compact duty panel；Workbench SHALL 提供跨 run、多视图、分析与管理工作区。两端 SHALL 共享 contract 与 fixtures，但 MUST NOT 共享 private React state、复制 domain rule 或要求相同页面结构。

#### Scenario: User moves from DSH summary to Workbench graph
- **WHEN** 用户点击 `Open in Studio`
- **THEN** Workbench SHALL 重新验证 principal、tenant、workspace、installation 和 resource access
- **AND** deep link 参数 SHALL 只作为 navigation hint，不作为 authorization

### Requirement: Visualization SHALL expose freshness and uncertainty
所有 run/task/attempt/lease/approval/verification 视图 SHALL 明确显示 `fresh|stale|offline` 和 `ready|running|attention_required|approval_required|reconcile_required|permission_denied|contract_mismatch` 等状态。状态 MUST 使用文本、图标和 accessible name，不得只靠颜色。

#### Scenario: Event stream disconnects while a task is running
- **WHEN** 客户端超过 fresh deadline 未收到新 snapshot/event
- **THEN** UI SHALL 显示 stale 或 offline 及最后观察时间
- **AND** SHALL 禁用 mutation，直到 snapshot/reconcile 恢复

### Requirement: DAG and task views SHALL remain usable at operational scale
Workbench SHALL 在至少 1,000 task nodes、10,000 近期 events 和 100 active/retained attempts 的 fixture 下维持可交互首屏。实现 SHALL 使用分层 projection、cursor/pagination、virtualization 或等效机制，并 MUST NOT 为首屏下载完整 evidence/log。

#### Scenario: Large run graph is opened
- **WHEN** run 包含 1,000 task nodes
- **THEN** Studio SHALL 提供 overview、关键路径、筛选和虚拟化 table/graph navigation
- **AND** 用户 SHALL 能在不等待全部 evidence 下载的情况下打开一个 task inspector

### Requirement: Capacity UI SHALL communicate source and authorization honestly
Capacity view SHALL 分开展示 policy cap、observed/retained counts、runtime qualification、reservation state、provider/role bucket、canonical repository writer blocker 和 freshness。UI MUST NOT 由 `policy_cap - observed` 推导可启动数量。

#### Scenario: Route is qualified but reservation is unsupported
- **WHEN** runtime qualification 有效，但 reservation state 为 `not_supported`
- **THEN** UI SHALL 显示“已验证 runtime，尚无持久 reservation”
- **AND** launch control SHALL 保持禁用

### Requirement: Approval and reconcile workflows SHALL be accessible
Approval/reconcile drawer SHALL 支持完整键盘导航、可预测焦点、accessible labels/status、screen reader announcement 和 reduced motion。关闭 dialog 后 focus SHALL 返回触发点；错误 SHALL 包含 reason code、safe explanation 和下一步。

#### Scenario: Keyboard user decides an approval
- **WHEN** 用户只用键盘打开 approval drawer
- **THEN** target、effect、owner、expiry、risk、evidence 和 decision controls SHALL 全部可达且被正确宣布
- **AND** dialog 关闭后 focus SHALL 返回原 approval row

### Requirement: Tenant switch SHALL clear presentation state before reload
切换 tenant/workspace SHALL 清除旧 context 的 subscription、cursor、cache、selection、filters with resource refs、pending preview、approval dialog 和 optimistic state，再加载新 workspace。旧 tenant 资源 MUST NOT 在过渡帧中显示。

#### Scenario: User switches from personal to enterprise tenant
- **WHEN** tenant switch 被确认
- **THEN** 两个客户端 SHALL 先 teardown 旧 context state
- **AND** 新 context 完成授权与 snapshot load 前 SHALL 显示中性 loading/empty state

### Requirement: Canvas layout SHALL not mutate Ordo dependencies
Workbench Canvas MAY 保存 Ordo node 的位置、分组、viewport、注释和 presentation preference，但 task node/edge SHALL 携带 owner ref/version/freshness，且拖动、分组或连线预览 MUST NOT 改写 Ordo DAG dependency。任何 dependency mutation 必须是独立 owner action。

#### Scenario: User drags a task node next to another task
- **WHEN** 用户只改变 Canvas layout
- **THEN** Workbench SHALL 只保存 presentation state
- **AND** Ordo task dependency、version 和 execution readiness SHALL 保持不变

### Requirement: Both clients SHALL preserve redacted evidence lineage
DSH 与 Workbench SHALL 显示 run/task/attempt/approval/receipt/verification/evidence 的 opaque refs 和 safe summaries，并允许授权后的 evidence drill-down。客户端 MUST NOT 在 DOM、日志、URL、截图 fixture 或 telemetry 中泄露 raw prompt、provider payload、private tool args、credential、absolute host path 或完整思维链。

#### Scenario: Verification evidence contains a private path upstream
- **WHEN** 上游 evidence projection 未通过 redaction policy
- **THEN** BFF/adapter SHALL 拒绝该 unsafe projection 或替换为 typed redaction error
- **AND** 客户端 SHALL 不渲染或记录原始值
