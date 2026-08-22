## ADDED Requirements

### Requirement: Workbench 图标必须使用受控语义映射
Pane Workbench MUST 提供本地 `WorkbenchIcon` 语义映射；view provider MUST NOT 注入任意 SVG、HTML、URL 或 raw Codicon class。所有 icon-only controls MUST 同时提供 accessible name 与 Tooltip。

#### Scenario: Provider 未声明图标
- **WHEN** 既有 provider 注册时没有 V3 presentation metadata
- **THEN** Workbench 根据 view role/kind 使用稳定 fallback icon，且注册继续成功

#### Scenario: 非法图标声明
- **WHEN** provider 提交未知 icon name、远端 URL 或 HTML 字段
- **THEN** presentation parser 拒绝非法字段或使用安全 fallback，且不把内容渲染进 DOM

### Requirement: Activity Rail 必须紧凑且有界
Right workspace SHALL 提供 44px Activity Rail，显示 Open/New 与已启用 provider category；Rail MUST NOT 为每个重复 resource Tab 增加一个首字母按钮。

#### Scenario: 打开多个终端
- **WHEN** 用户打开三个 terminal resources
- **THEN** Rail 只保留一个 Terminal category item，三个资源通过对应 Pane group 的 Tab strip 管理

#### Scenario: 激活 Rail 项
- **WHEN** 用户激活 Explorer、Terminal 或其他 Rail category
- **THEN** Workbench 聚焦该 kind 最近的可见 view，若不存在则通过 provider launcher 打开默认视图

### Requirement: View Picker 必须是可搜索的锚定 Quick Pick
Workbench MUST 使用一个共享 Quick Pick 打开视图，支持搜索、推荐/已打开/可用分组、图标、快捷键、region hint、键盘选择、Esc 关闭和 focus restore；桌面端 MUST 锚定触发按钮，窄屏 SHALL 投影为 Sheet。

#### Scenario: 键盘打开视图
- **WHEN** 用户打开 Quick Pick、输入过滤文本并按 ArrowDown 与 Enter
- **THEN** active option 被打开到其 preferred/selected region，Quick Pick 关闭并把焦点移到新 Tab 或视图

#### Scenario: 关闭 Quick Pick
- **WHEN** 用户按 Esc 或点击 popup 外部
- **THEN** Quick Pick 关闭、临时 query 清除、焦点恢复到原触发按钮，且 Pane canonical state 不被无关修改

### Requirement: 每个 Pane group 必须拥有完整管理工具条
每个有内容的 Pane group MUST 提供 Tab strip、split、move region、maximize/restore 与 More actions；Close Tab SHALL 位于 active/hover/focus Tab，Close Group 与 bulk actions SHALL 位于 More menu。

#### Scenario: 拆分当前 Pane
- **WHEN** 当前 group 满足最小尺寸与 split 深度限制，用户选择 Split Right/Down
- **THEN** controller 生成一个有效 split，并将目标 view/new resource 放入新 group，焦点与 ARIA announcement 指向新 group

#### Scenario: 无法拆分
- **WHEN** split 会违反 280×180px、最大深度 2 或最多 4 个可见 group
- **THEN** 对应 action disabled 并说明原因，reducer state 不改变

### Requirement: Tab 必须表达 preview、pinned、dirty 与 provider 状态
Tab MUST 显示语义 icon、title、active、preview、pinned、dirty、orphaned/compatibility 状态，并使用标准 `tablist/tab/tabpanel` pattern。

#### Scenario: Preview Tab
- **WHEN** view 为 `preview: true` 且未 pinned/dirty
- **THEN** Tab 使用可识别的 preview 样式，并允许下一次同 group preview 替换

#### Scenario: Dirty Tab 关闭
- **WHEN** 用户关闭 dirty 或 `closePolicy: confirm` 的 Tab
- **THEN** Workbench 先展示确认/owner action，未确认前 Tab 与其他 group state 保持不变

### Requirement: Bulk close 必须预检并原子提交
`Close Others`、`Close to Right` 与 `Close Group` MUST 在修改 state 前检查所有目标 close policy；存在 blocker 时 MUST NOT 部分关闭。

#### Scenario: Group 中存在不可关闭 view
- **WHEN** 用户执行 Close Group，且一个 view 的 close policy 为 deny
- **THEN** 操作整体拒绝，所有 Tab 保留，并报告阻塞 view

#### Scenario: 所有目标允许关闭
- **WHEN** bulk close 的所有 view 均 allow 或已完成 confirm
- **THEN** reducer 一次提交目标集合并产生一条可访问 announcement

### Requirement: Pane 管理必须有完整键盘与焦点路径
Workbench MUST 支持 Tab Arrow/Home/End、Delete/close、Shift+F10 context menu、Quick Pick、split/move/maximize commands、Esc restore/cancel，并在 view move/close 后确定性恢复焦点。

#### Scenario: 关闭活动 Tab 后恢复焦点
- **WHEN** 用户用键盘关闭活动 Tab
- **THEN** 焦点移动到同 group 的相邻 active Tab；若 group 为空，则移动到可用的 Open View action或邻近 group

### Requirement: Chrome 必须适配窄屏和触摸目标
Workbench SHALL 在 desktop 使用紧凑 28–32px icon controls，在 `<=600px` 或 coarse pointer 时提供至少 44px hit target；Quick Pick、menus 与 tooltips MUST 不越过可见 viewport。

#### Scenario: 390px Sheet
- **WHEN** workspace 以 390px viewport 的 Sheet 模式显示
- **THEN** Rail、Tab、group controls 与内容不覆盖 DSH sidebar，关键动作可滚动或收进 More，而不是横向溢出

### Requirement: Chrome 卸载必须完全对称
Pane bundle dispose/HMR MUST 释放 slot registrations、global/window listeners、popup portals、drag session、observer 和 style contribution；卸载后 DSH layout MUST 不保留 Workbench rail 或尺寸预留。

#### Scenario: HMR 替换 Pane bundle
- **WHEN** 旧 bundle dispose 后新 bundle attach
- **THEN** DOM 中只存在一套 Rail/Quick Pick/styles，controller owner 不重复 attach，且旧 listener 不再响应
