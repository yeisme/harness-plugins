## ADDED Requirements

### Requirement: Directory events preserve user position
目录变化 SHALL 通过 owner 事件更新；cursor gap SHALL 标记 stale 并权威重读，不擅自恢复 mutation。
#### Scenario: Rename while browsing
- **WHEN** 当前目录内文件被外部重命名
- **THEN** 树更新名称且保留可恢复的展开、选择与滚动位置
#### Scenario: Event gap
- **WHEN** 客户端发现事件序列缺口
- **THEN** 显示 stale，完成 owner reconcile 后再呈现可操作状态

### Requirement: File reopening respects authority and dirty buffers
文件 Pane 跨刷新恢复 SHALL 重新解析 opaque ref、权限与版本，不持久化明文文件内容或秘密。
#### Scenario: Missing file after reload
- **WHEN** 保存的引用已经不存在或无权访问
- **THEN** 保留 Pane 占位与明确原因，不打开其他文件替代
#### Scenario: External update conflicts with unsaved editing
- **WHEN** owner 版本改变而本地存在未保存编辑
- **THEN** 保留缓冲并请求明确冲突决策，不自动覆盖

### Requirement: Context actions and layout templates reuse owners
上下文菜单和布局模板 SHALL 复用既有 owner 动作、预检和 preset 存储，不另建 mutation 或布局状态源。
#### Scenario: Keyboard file action
- **WHEN** 用户按 Shift+F10 打开目录行菜单
- **THEN** 菜单聚焦当前行的合法操作，取消后返回当前行
#### Scenario: Restore a layout template
- **WHEN** 用户切换布局或项目模板
- **THEN** 已有 pane 不重复创建，会话绑定与未保存状态保持独立
