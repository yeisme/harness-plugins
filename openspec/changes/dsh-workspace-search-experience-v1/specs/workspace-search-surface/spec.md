## ADDED Requirements

### Requirement: 同轮交付分组视觉与宿主一致性
搜索 SHALL 采用宿主主题、语义图标和紧凑结果行，固定搜索／筛选／提示区域，仅结果区滚动。

#### Scenario: 标准桌面搜索
- **WHEN** 用户打开搜索浮层
- **THEN** 输入、分类、项目条件、分组标题、结果说明和状态具有不同视觉层级
- **AND** “关闭”不独占列表底部大行，兼容入口不占据默认首屏

#### Scenario: 主题与窄容器
- **WHEN** 切换深浅／系统主题或容器为 360、560、960px 和 200% 缩放
- **THEN** 搜索、关闭和选中结果可见，长标题截断而非造成横向页面溢出
- **AND** 样式不影响相邻对话 Pane，减少动效设置被遵守

### Requirement: 可访问选择与动作菜单
搜索 SHALL 提供完整键盘路径、读屏名称、明确焦点和不依赖 hover 的触控动作。

#### Scenario: 键盘打开与关闭
- **WHEN** 用户用上下键选择结果、Enter 打开或 Escape 关闭
- **THEN** 动作针对当前 stableKey，关闭浮层后焦点回到触发入口
- **AND** IME 和普通光标编辑不被快捷键破坏

#### Scenario: 筛选、动作菜单和非模态 Pane
- **WHEN** 用户通过键盘或触控打开筛选／动作菜单，或固定为搜索 Pane
- **THEN** 子菜单按层级关闭，焦点返回正确 owner，非模态 Pane 不困住 Tab
- **AND** listbox option 不嵌套另一个独立可聚焦动作按钮

### Requirement: 可区分的等待与空态
搜索 SHALL 区分无匹配、筛选隐藏、未查询、加载中、partial、stale、error、disabled 和 unknown。

#### Scenario: 过滤后为空
- **WHEN** 有效筛选导致无结果
- **THEN** 提供清除条件入口，不声称整个历史库没有记录

#### Scenario: 结果不可用
- **WHEN** 插件或宿主能力缺失
- **THEN** 显示原因和存在时的恢复路径，不显示假成功或无响应按钮
