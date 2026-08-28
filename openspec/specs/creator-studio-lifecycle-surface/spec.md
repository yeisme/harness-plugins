# creator-studio-lifecycle-surface Specification

## Purpose
TBD - created by archiving change dsh-web-surface-unification-v1. Update Purpose after archive.
## Requirements
### Requirement: Creator Studio SHALL present one lifecycle grouping across existing panes
Creator Studio SHALL 保留多 Pane tab 模型，并把现有 view/command 按 Start、Create、Produce、Review、Library 排序。Start SHALL 包含 home；Create SHALL 包含 text/visual/audio；Produce SHALL 包含 production/generation 与 jobs 兼容别名；Review SHALL 包含 approvals/analysis 与 review 兼容别名；Library SHALL 包含 context/assets/media。

#### Scenario: User navigates the Creator lifecycle
- **WHEN** 用户从 Home、Context Bar、Pane 管理中心或命令目录选择生命周期任务
- **THEN** Client SHALL 按现有 view kind 打开独立 Pane，并保持 singleton/retention/region 合同

#### Scenario: Legacy jobs or review is restored
- **WHEN** 旧 persistence 打开 creator.jobs 或 creator.review
- **THEN** Client SHALL 分别显示 generation 或 approvals 的新视觉兼容视图并保留 legacy 标记

### Requirement: Creator Home SHALL prioritize the next task rather than card grids
Creator Home SHALL 按“下一动作、Production 状态、待审队列”顺序展示。Owner 状态 SHALL 从六卡片矩阵移入 Context Bar 的可访问状态 panel；所有 owner identity、transport、freshness 与 reason SHALL 保留。

#### Scenario: Home has active production and approvals
- **WHEN** snapshot 同时包含当前 Production 与待审决策
- **THEN** 用户 SHALL 先看到推荐下一动作，再看到 Production 阶段，最后看到有界待审列表

#### Scenario: An owner is unavailable
- **WHEN** owner 为 offline、unknown 或 contract mismatch
- **THEN** Context Bar 状态入口 SHALL 显示非仅颜色的摘要，并允许键盘用户查看完整 owner 状态列表

### Requirement: Creator task panes SHALL use shared workspace composition
每个 Creator task Pane SHALL 使用 SurfaceContextBar、资源主体与 Owner action composer。wide 容器 MAY 使用双栏；standard/compact SHALL 使用单栏。只有媒体、版本化产物或真实可点击任务入口 MAY 使用 card；普通 Owner、run、approval、状态和文本条目 SHALL 使用 row/list。

#### Scenario: A wide task pane renders resources and an action
- **WHEN** workspace 容器宽度超过 720px 且 owner 发布 action descriptor
- **THEN** 资源主体与 composer SHALL 双栏呈现，composer MAY sticky 但不得覆盖内容

#### Scenario: A compact task pane renders the same action
- **WHEN** workspace 容器宽度不超过 420px
- **THEN** 资源与 composer SHALL 单栏呈现，且 action admission MUST 与宽屏一致

### Requirement: Creator visual language SHALL remain DSH-native and localized
Creator surface SHALL 使用统一 accent 与语义状态色，MUST NOT 为文字、图像、音频、做剧任务使用紫/蓝/绿/橙装饰色。所有新增或迁移文案 SHALL 进入 zh/en/pseudo locale；Client MUST NOT 留下 inline English fallback。

#### Scenario: Quick task entries render
- **WHEN** Home 展示 text、visual、audio 或 drama 入口
- **THEN** 入口 SHALL 通过标题、图标和选择状态区分，不得依赖随机领域颜色

#### Scenario: Pseudo locale is active
- **WHEN** 用户或测试启用 pseudo locale
- **THEN** 生命周期导航、Context Bar、状态与 recovery action SHALL 使用 pseudo 文案且不得溢出或裁切主要操作

### Requirement: Layout responsiveness SHALL not replace existing risk policy
Creator task layout SHALL 使用 container query；既有 compact/mobile risk gate MAY 继续使用其当前设备/viewport 规则，且 MUST NOT 被 container width 隐式替换或放宽。

#### Scenario: A narrow pane is displayed on desktop
- **WHEN** pane 很窄但既有 risk policy 判定为 desktop
- **THEN** UI SHALL 使用 compact 单栏，同时 mutation enabled 状态 SHALL 继续取既有 risk policy 结果

