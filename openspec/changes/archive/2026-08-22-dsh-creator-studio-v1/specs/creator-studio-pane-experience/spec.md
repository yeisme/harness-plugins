## ADDED Requirements

### Requirement: Creator Studio SHALL register through the existing Pane runtime

Client SHALL 作为一个 Pane runtime plugin 注册 Creator views、commands 和 artifact intent handler，并使用现有 right/bottom region、focus、retention、dirty guard 与 dock 语义。Client MUST NOT 创建第二 sidebar、shell overlay、iframe bridge 或 browser domain store。

#### Scenario: Pane V2 is available
- **WHEN** `paneWorkbench` 提供 plugin/view/command/intent surface
- **THEN** Creator Studio SHALL 原子注册其视图、命令和 intent handler，并在卸载时精确反注册

#### Scenario: Pane V2 is unavailable
- **WHEN** Creator Studio 客户端无法探测 Pane Workbench 或所需 region seam
- **THEN** Client SHALL 只显示带原因的禁用“创作”入口，并且 MUST NOT 创建替代 overlay 或侧栏

### Requirement: The workspace SHALL be task-first while preserving owner identity

Creator Studio SHALL 提供 text、image、audio、video/short-drama、context、analysis、review 和 operations 任务入口，并展示 Eikona、Scaena、Sonora、Auctra、Pinax、Anatomia 的状态、transport、freshness、资源和动作。Scaena 生产面 SHALL 展示 prepare、text、visual、shots、review、export 六阶段脉冲。

#### Scenario: User opens Creator Studio
- **WHEN** 用户点击 conversation header 或 sidebar footer 中的“创作”入口
- **THEN** Client SHALL 打开 Creator home 与 bottom jobs Pane，并显示快速创作、六 owner 状态和当前生产阶段

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
