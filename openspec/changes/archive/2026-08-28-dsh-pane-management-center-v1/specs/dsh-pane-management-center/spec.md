## ADDED Requirements

### Requirement: Pane Chrome SHALL 使用单行连接式 Tab 层级
普通 dock、sheet 与 overlay 的 Pane Chrome SHALL 由活动/可见 Tab 与右侧 group actions 组成一行；桌面 Tab 高度 SHALL 为 36px，active Tab SHALL 使用 8px 连接式软圆角并与内容面连续。Coarse pointer 下交互目标 MUST 不低于 44px。Chrome SHALL NOT 再渲染独立活动标题行，Pane 内容也 MUST NOT 因 chrome 重复显示同名大标题。

#### Scenario: Git Pane 正常停靠
- **WHEN** Git 是活动 Tab 且 Pane 以桌面 dock 呈现
- **THEN** 用户看到单行 Git Tab、打开 Pane、管理 Tab、更多、最大化和收起操作，内容区不再重复 Git 大标题

### Requirement: Pane 中心 SHALL 提供打开与管理两个明确入口
Chrome SHALL 提供 `＋` 打开入口和“列表＋当前数量”管理入口；两者 MUST 打开同一 Pane 管理中心但使用不同初始 mode。Pane 中心 SHALL 为居中 dialog，宽度目标 640px、最大高度 70vh，并在窄屏适配可用宽度。

#### Scenario: 用户点击列表数量按钮
- **WHEN** 当前 workspace 打开 50 个 Tab 且用户点击管理入口
- **THEN** Pane 中心以 manage mode 打开，显示已打开数量、筛选、多选与批量操作，不需要横向滚动 Tab strip

### Requirement: Pane 中心 SHALL 支持系统与用户分组
空查询时 SHALL 按收藏、最近和任务领域展示 picker-visible provider；系统领域 MUST 复用 `presentation.group/task/owner/order/keywords`，缺失时使用稳定 fallback。用户 SHALL 可创建、重命名、排序、固定自定义分组并把同一 Pane launcher 引用到多个分组；该操作 MUST NOT 复制 provider 或 view canonical state。

#### Scenario: 新插件热插拔
- **WHEN** provider 注册带 `presentation.group: 'creator'` 的新 Pane
- **THEN** Pane 中心立即把它放入创作分组，自定义分组引用和已打开 Tab 不被重建

### Requirement: Pane 管理模式 SHALL 支持按需多选
默认 open mode SHALL 保持单选快速打开；manage mode SHALL 提供复选框和批量固定、关闭、移动及加入分组操作。Enter SHALL 使用 provider 首选区域或当前兼容 group；Shift+Enter SHALL 打开目标选择，列出合法 Right、Bottom、现有 group 与 split 目标，并对 Tier 不支持的目标显示禁用原因。

#### Scenario: Tier 0 使用 Shift+Enter
- **WHEN** 用户在 Tier 0 对一个 Pane 按 Shift+Enter
- **THEN** 当前唯一 region 可选，split/dock 目标可见但禁用并解释需要 workspace seam

### Requirement: Pane 中心 SHALL 通过共享 keymap 提供快捷键
Ctrl/Cmd+P SHALL 打开 Pane 中心；Ctrl/Cmd+W SHALL 关闭活动 Tab；Ctrl/Cmd+Shift+W SHALL 发起关闭未固定 Tab；Ctrl/Cmd+Shift+T SHALL 恢复最近关闭批次。快捷键 MUST 经共享 keymap 注册、可改键并显示冲突，MUST NOT 新增裸 document/window keydown listener。

#### Scenario: 快捷键冲突
- **WHEN** Host 已占用 Ctrl/Cmd+P 且 keymap 拒绝 Pane 绑定
- **THEN** Pane 中心按钮仍可用，快捷键提示显示冲突原因且不会双触发

### Requirement: Tab strip SHALL 在高密度下保持关键 Tab 可达
Tab strip SHALL 优先显示 active、pinned、dirty、running 和 attention Tab；其余 Tab 进入管理入口。长标题 SHALL 省略并保留完整 accessible name，页面 MUST NOT 显示遮挡 group actions 的原生横向滚动条。超过 50 个候选的管理列表 SHALL 使用有界窗口渲染。

#### Scenario: 50 个混合状态 Tab
- **WHEN** 390px Sheet 中存在 50 个中英文长标题 Tab
- **THEN** active 与高风险 Tab、管理入口和关闭动作保持可达，页面无横向溢出，隐藏 Tab 可通过搜索和键盘打开
