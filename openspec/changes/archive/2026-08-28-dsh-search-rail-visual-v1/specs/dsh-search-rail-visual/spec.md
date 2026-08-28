## ADDED Requirements

### Requirement: 搜索管理弹窗 SHALL 采用统一布局与搜索框规范
窗格中心弹窗 SHALL 以 `720px`（视口不足时收缩并保边距）宽、`78%` 视口高上限与 `18px` 圆角呈现，内部依次为模式切换、主搜索框、类型筛选、高级筛选、搜索结果与底部操作区。主搜索框 SHALL 为 `48px` 高、`12px` 圆角、图标与输入间距 `10px`：默认态使用次级背景；聚焦态切换品牌色边框、增加低透明度外发光并使背景加深。占位文案 SHALL 为「搜索窗格、标签页、标题或历史记录」及其英文对应，不再罗列分组维度。

#### Scenario: 聚焦搜索框
- **WHEN** 用户聚焦主搜索框
- **THEN** 边框切换为品牌色、出现低透明度外发光、背景较默认态加深
- **AND** 失焦后回到次级背景默认态

#### Scenario: 占位文案
- **WHEN** 搜索框为空
- **THEN** 占位与可访问名称均为「搜索窗格、标签页、标题或历史记录」zh/en 对应文案

### Requirement: 模式切换与筛选区 SHALL 使用低噪声分段与网格
「打开窗格 / 管理标签页」SHALL 渲染为 `32px` 高分段控制器：外层统一底板、当前项浮起表面，MUST NOT 使用大面积蓝色填充。第一层类型筛选 SHALL 为可换行筛选标签（窗格中心、可用窗格、已打开的标签页、关闭历史、包含对话内容）。高级筛选 SHALL 使用四列等宽网格（分组/位置/提供方/类型/状态/固定/工作区），窄于 `760px` 时降为两列。

#### Scenario: 桌面端高级筛选同行
- **WHEN** 弹窗可用宽度 ≥760px
- **THEN** 高级筛选项以四列网格排布于同一区域

#### Scenario: 窄窗口两列
- **WHEN** 弹窗可用宽度 <760px
- **THEN** 高级筛选网格降为两列且不产生横向滚动

### Requirement: 搜索结果行 SHALL 层级清晰且键盘选中态可辨
结果行 SHALL 约 `48px` 高：左类型图标、中名称与分类说明（标题一级视觉、分类信息降一级）、右侧收藏/详情/打开动作。Hover SHALL 使用轻微背景与细边框而非整行强色。当前键盘选中行 SHALL 明显可辨但 MUST NOT 以整行蓝色高亮呈现。

#### Scenario: 键盘导航选中
- **WHEN** 焦点经 ArrowUp/ArrowDown 落在某行
- **THEN** 该行呈现可见焦点环与轻背景，焦点不出弹窗且不整行蓝

### Requirement: 右侧工作区活动栏 SHALL 遵循统一按钮规范
右栏按钮 SHALL 为 `34×34px` 热区、`10px` 圆角、`8px` 垂直间距、图标视觉尺寸 `18px` 左右（17–19px）。状态四态：默认次级文字无底色、Hover 轻表面填充、Active 品牌色弱填充（12–18% 透明度）+ 细边框（MUST NOT 使用过粗侧边蓝条）、Pressed 缩放至 `96%`；focus MUST 可见。右栏 SHALL 带靠内容区方向细分隔线；字体缩放按钮 SHALL 归入底部独立区并在其顶部加分隔线。

#### Scenario: Active 项呈现
- **WHEN** 某栏按钮对应视图为活动 Tab
- **THEN** 该按钮为品牌色弱填充+细边框，无粗侧边蓝条

#### Scenario: 字体缩放独立区
- **WHEN** 右栏渲染字体缩放按钮
- **THEN** 它们位于栏底独立区且与上方按钮间有分隔线

### Requirement: 官方折叠侧栏 SHALL 仅经公共锚点作用域覆盖
对官方 DSH 折叠态侧栏的视觉统一 SHALL 仅在我们发布的公共 launcher data 属性（subagent monitor sidebar、creator studio launcher）存在时经 `:has()` 生效：`36×36px` 热区、`10px` 圆角、同套状态四态、Logo 行独立视觉不套用普通按钮选中样式、底部业务入口与系统设置间分隔线。MUST NOT 依赖官方 build hash class 名；展开态侧栏与官方几何 MUST NOT 被修改；`--vk-*` 变量缺失时 SHALL 回退到安全 rgba 值。

#### Scenario: 折叠态按钮统一
- **WHEN** 官方侧栏处于折叠态且我们的 footer launcher 存在
- **THEN** 折叠态图标按钮为 36×36/10px 圆角并具备 hover/active/pressed 状态与分隔线

#### Scenario: 无我们 launcher 时不作用
- **WHEN** 页面不含我们的公共 launcher 锚点
- **THEN** 覆盖选择器不命中，官方侧栏保持原样

### Requirement: 视觉 token 与动效 SHALL 统一来源于主题变量
控件尺寸 token（小 `34px`、中 `36px`、搜索框 `48px`）、圆角（控件 `10px`、弹窗 `18px`）、间距 `8px`、分隔线 `1px` 低对比、动效 `120–160ms`、Active 填充与 Focus 外环的品牌色 `12–18%`/`12–16%` 透明度 SHALL 全部经 `--vk-*` 主题变量或带安全回退的 color-mix 实现；MUST NOT 引入脱离主题的硬编码品牌色。

#### Scenario: 主题变量缺失回退
- **WHEN** 宿主未提供部分 `--vk-*` 变量
- **THEN** 相关声明回退到内置 rgba 值，不出现无底色或裸样式

### Requirement: 响应式与几何不变 SHALL 保持
视口 <600px 时弹窗距屏幕边缘至少 `8px`、隐藏非必要范围提示、底部操作区允许换行；左右工作区栏宽与 region 几何 MUST NOT 因视觉统一改变；任何断点 MUST NOT 引入横向滚动条。既有搜索、标签管理、窗格打开与侧栏导航交互逻辑 MUST 保持不变。

#### Scenario: 窄屏弹窗
- **WHEN** 视口宽度 <600px
- **THEN** 弹窗宽为视口减两侧至少 8px 边距、范围提示隐藏、底部操作区可换行且无横向滚动

#### Scenario: 工作区几何不变
- **WHEN** 应用本 change 的全部样式
- **THEN** 左右侧栏宽度、region 布局与拖拽/吸附行为与变更前一致
