## MODIFIED Requirements

### Requirement: The workspace SHALL be task-first while preserving owner identity

Creator Studio SHALL 提供 home、text、image、audio、video/short-drama、context、assets、analysis、generation 和 approvals 任务入口，并展示 Eikona、Scaena、Sonora、Auctra、Pinax、Anatomia 与 Ordo 的安全状态、transport、freshness、资源和动作。Scaena 生产面 SHALL 展示 prepare、text、visual、shots、review、export 六阶段脉冲。

#### Scenario: User opens Creator Studio
- **WHEN** 用户点击唯一 sidebar “创作”入口或执行 `/creator`
- **THEN** Client SHALL 只打开或聚焦 Creator Home，并显示分组 Pane 目录、六 owner 状态和当前生产阶段

#### Scenario: User opens a functional Pane
- **WHEN** 用户从 Home、Pane 管理中心或显式命令选择文字、视觉、音频、完整做剧、资料、资产、分析、生成或审批
- **THEN** Client SHALL 只按需打开所选 singleton Pane

#### Scenario: Owner has no resources
- **WHEN** 某 owner snapshot 为 ready 但资源为空，或 owner 为 offline
- **THEN** 对应工作区 SHALL 显示明确空态或安全状态说明，而不是伪造生成结果

## ADDED Requirements

### Requirement: Legacy Creator views SHALL remain registered during migration

Client SHALL 保留 `creator.jobs` 与 `creator.review` view kind 及旧 commands 一个发布周期，并将它们分别委托给 generation 与 approvals 兼容组件。卸载 SHALL 精确反注册新旧全部贡献。

#### Scenario: Old view kind is opened
- **WHEN** 旧 deep link、命令或 persistence 打开 creator.jobs 或 creator.review
- **THEN** Client SHALL 显示对应新语义的兼容视图并标记 legacy source

#### Scenario: Plugin is disposed
- **WHEN** Creator Studio 卸载或 HMR replacement
- **THEN** 新旧 View、Command、intent、timer 和 subscription SHALL 全部移除
