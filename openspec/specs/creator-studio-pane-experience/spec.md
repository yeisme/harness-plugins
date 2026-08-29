# creator-studio-pane-experience Specification

## Purpose
TBD - created by archiving change dsh-creator-studio-v1. Update Purpose after archive.
## Requirements
### Requirement: Creator Studio SHALL register through the existing Pane runtime

Client SHALL 作为一个 Pane runtime plugin 注册 Creator views、commands 和 artifact intent handler，并使用现有 right/bottom region、focus、retention、dirty guard 与 dock 语义。Client MUST NOT 创建第二 sidebar、shell overlay、iframe bridge 或 browser domain store。

#### Scenario: Pane V2 is available
- **WHEN** `paneWorkbench` 提供 plugin/view/command/intent surface
- **THEN** Creator Studio SHALL 原子注册其视图、命令和 intent handler，并在卸载时精确反注册

#### Scenario: Pane V2 is unavailable
- **WHEN** Creator Studio 客户端无法探测 Pane Workbench 或所需 region seam
- **THEN** Client SHALL 只显示带原因的禁用“创作”入口，并且 MUST NOT 创建替代 overlay 或侧栏

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

### Requirement: Creator views SHALL visualize bounded creative resources

资源卡 SHALL 支持有界文本 before/after 窗口、进度、badge、指标、波形和版本化 artifact 操作。媒体 Pane SHALL 复用 Rich Media preview，并通过 Host resolver 获取短期 URL。

#### Scenario: User opens an image, audio, or video artifact
- **WHEN** artifact 声明 open/preview capability 且用户触发 open intent
- **THEN** Pane SHALL 打开共享 Creator media view，并且 URL SHALL 仅由当前 Host resolver 按 artifact ref 获取

### Requirement: Creator Studio SHALL be responsive and accessible

桌面宽度 SHALL 使用主工作区与动作 composer 组合；紧凑宽度 SHALL 降级为单列并禁用中高风险 mutation。交互控件 SHALL 使用语义 button/input/label、可见 focus、状态文本和 reduced-motion 适配。

#### Scenario: Compact viewport renders a high-risk action
- **WHEN** viewport 进入 compact mode 且 descriptor risk 为 medium 或 high
- **THEN** 提交按钮 SHALL 禁用并提示用户在桌面或平板完成操作

#### Scenario: Reduced motion is requested
- **WHEN** 用户系统启用 prefers-reduced-motion
- **THEN** 生产阶段和状态动画 SHALL 停止或降级为静态表达

### Requirement: Client lifecycle SHALL reset projections on runtime boundary changes

Controller SHALL 使用单飞 snapshot read，并在 connection reset、session 切换或 runtime generation 变化时清理旧 snapshot/receipt 状态。卸载 SHALL 清除轮询、订阅、Pane 注册与本地 store。

#### Scenario: Session changes while Creator Studio is open
- **WHEN** active session id 改变
- **THEN** Client SHALL 丢弃旧 session 的 Creator snapshot 并读取新绑定，旧资源和 receipt MUST NOT 继续显示

### Requirement: Legacy Creator views SHALL remain registered during migration

Client SHALL 保留 `creator.jobs` 与 `creator.review` view kind 及旧 commands 一个发布周期，并将它们分别委托给 generation 与 approvals 兼容组件。卸载 SHALL 精确反注册新旧全部贡献。

#### Scenario: Old view kind is opened
- **WHEN** 旧 deep link、命令或 persistence 打开 creator.jobs 或 creator.review
- **THEN** Client SHALL 显示对应新语义的兼容视图并标记 legacy source

#### Scenario: Plugin is disposed
- **WHEN** Creator Studio 卸载或 HMR replacement
- **THEN** 新旧 View、Command、intent、timer 和 subscription SHALL 全部移除

