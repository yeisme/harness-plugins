# dsh-web-team-task-agent-graph Specification

(merged from archived change 2026-08-31-dsh-web-ordo-team-hub-v1)

## Purpose

定义 Ordo Teams Web 工作区的 Task-Agent graph、任务队列、响应式布局、聚合层级与 owner-fact 边界，使大规模 Delivery 关系可视化而不在客户端重建调度事实。

## Requirements

### Requirement: Web workspace SHALL be graph-first and task-operable
Ordo Teams Delivery view SHALL 同时提供 Task Queue、zoomable Task-Agent graph 与 `Inspector|Room|Activity` context region。Graph SHALL 是关系主视图，Task Queue SHALL 是主要 action/scan surface；二者 MUST 共享 stable selection 和 owner action availability。

#### Scenario: User selects a blocked task from the queue
- **WHEN** 用户在 Task Queue 选择 blocked task
- **THEN** graph SHALL 聚焦对应 task、assignee 与 dependencies，Inspector SHALL 显示 owner reason/actions，选择本身 MUST 不产生 mutation

### Requirement: Graph SHALL use Task-Agent partitions
task nodes 与 stable role-slot nodes SHALL 分属两个视觉 partitions；assignment/handoff SHALL 跨 partition；task dependency MAY 在 task layer 中以 secondary edge 表示。runtime/session/attempt SHALL 作为 role binding detail，而不是额外 canonical agent identity。

#### Scenario: Role slot changes runtime binding
- **WHEN** Delivery event 将 reviewer slot 绑定到新的 runtime attempt
- **THEN** role node identity/position MAY 保持，detail/badge SHALL 更新 binding，client MUST 不创建新 Team member truth

### Requirement: Desktop and tablet layouts SHALL degrade predictably
在 `1024px+` viewport，workspace SHALL 提供约 `280px` Task Queue、flex graph 与约 `320px` context 三栏；在 `768–1023px`，Task Queue/graph SHALL 保持主区，context SHALL 使用 drawer。小于 `768px` SHALL 提供可读 semantic list、当前状态和 unsupported-editing guidance，不承诺 mobile graph editing。

#### Scenario: Viewport changes from desktop to tablet
- **WHEN** viewport 从 1280px 缩到 800px
- **THEN** context SHALL 转为 drawer，selection、graph viewport、Room draft 与 pending read-only detail MUST 保留；任何 pending mutation preview SHALL 按 context revision 重新验证

### Requirement: Large graphs SHALL use clustering and LOD
completed tasks、idle role slots 与非当前 dependency neighborhood MAY 按 owner grouping/status 聚合；active、blocked、critical-path、current selection 与直接邻接 nodes MUST 保持展开或一键可达。cluster count/label SHALL 来自 safe facts，不得隐藏 blockers。

#### Scenario: Delivery contains a large completed history
- **WHEN** graph 超出当前 LOD threshold
- **THEN** completed nodes MAY 聚合，Task Queue/semantic list SHALL 仍提供全部 refs/filter，active/blocked/critical nodes MUST 独立展示

### Requirement: Graph SHALL not compute scheduler facts
Client graph layout MAY 计算坐标和 cluster，但 MUST 不计算 runnable、acceptance、control、capacity、writer conflict 或 criticality；这些事实 SHALL 由 Host safe projection 提供。

#### Scenario: Edge appears visually reachable
- **WHEN** graph layout 显示 predecessor 与 successor 之间无可见 blocker，但 owner 返回 `verification_required`
- **THEN** successor MUST 保持 blocked，UI MUST 显示 owner reason 而不是根据图形位置启用 action

### Requirement: Graph motion SHALL remain bounded
pan/zoom/selection/cluster transitions SHALL 遵守 reduced-motion，MUST 不以持续动画表示 running 或 handoff。状态变化 SHALL 在 semantic list/labels 中同样可见。

#### Scenario: Reduced motion is enabled
- **WHEN** browser `prefers-reduced-motion` 为 reduce
- **THEN** graph SHALL 禁用非必要 tween/pulse，selection/focus/status MUST 仍清晰可辨
