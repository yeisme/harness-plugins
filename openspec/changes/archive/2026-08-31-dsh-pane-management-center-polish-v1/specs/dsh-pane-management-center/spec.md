## ADDED Requirements

### Requirement: Pane 中心 SHALL 使用分层且按需揭示的搜索布局
Pane 中心 SHALL 按标题、open/manage mode、搜索框、来源快捷筛选、结果区的顺序建立视觉与 DOM 层级。高级筛选 SHALL 默认折叠，并以可访问按钮显示已启用筛选数量；展开时每个筛选 SHALL 有可见 label 与统一重置动作。Open mode 的分组创建 SHALL 按需展开，manage mode 的批量操作栏 SHALL 仅在存在选择时显示。

#### Scenario: 首次打开 Pane 中心
- **WHEN** 用户以 open mode 打开且没有 query、筛选或选择
- **THEN** 搜索框和来源快捷筛选先于结果出现，高级筛选、分组输入与批量操作栏均不占用首屏空间

#### Scenario: 用户启用两个高级筛选
- **WHEN** 用户选择一个 group 和 pinned-only
- **THEN** 筛选按钮显示数量 2，折叠后两个条件继续生效，点击重置后数量归零且结果恢复

### Requirement: 结果行 SHALL 同时支持直接打开、详情和显式打开位置
结果行主按钮 SHALL 保持单击/Enter 直接打开；已有详情按钮 SHALL 继续展开描述与元数据；pane launcher SHALL 另有带可访问名称的 chevron target 按钮打开合法位置列表。Shift+Enter SHALL 保持同一 target 行为。

#### Scenario: 鼠标选择打开位置
- **WHEN** 用户点击某个可用窗格行尾的打开位置按钮
- **THEN** Pane 中心保持打开并展示与 Shift+Enter 相同的 target picker，详情面板状态与主行直接打开语义不被替换

### Requirement: Pane 中心 SHALL 在窄屏使用全屏工作台形态
600px 以下 Pane 中心 SHALL 占满可用 viewport，使用固定顶部 controls、单一结果滚动区与 safe-area footer；SHALL NOT 保留造成双层滚动的居中小弹窗。Coarse pointer 下所有主要按钮和结果行交互目标 MUST 不低于 44px。

#### Scenario: 390px 视口打开高级筛选
- **WHEN** 用户在 390px 视口打开 Pane 中心并展开筛选
- **THEN** dialog 使用全屏布局，筛选为单列，关闭、搜索、来源和结果仍可达且页面无横向溢出

### Requirement: Pane 中心语义图标词表 SHALL 向后兼容扩展
Workbench semantic icon vocabulary SHALL additive 支持 `filter`、`message`、`chevron-right`、`chevron-down`。现有图标名、runtime guard 与 provider presentation 输入 SHALL 保持有效；UI SHALL 只传 icon name，不接受 raw SVG markup 或 CSS payload。

#### Scenario: 旧 provider 使用 file 图标
- **WHEN** 旧 provider 继续注册 `icon: 'file'`
- **THEN** registry 行为与 glyph 不变，同时管理中心可安全使用新增的筛选、对话与 chevron 图标
