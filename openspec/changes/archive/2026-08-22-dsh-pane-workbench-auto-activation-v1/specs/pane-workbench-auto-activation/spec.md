## ADDED Requirements

### Requirement: Pane Workbench SHALL be dormant by default and auto-activate on demand

Pane Workbench SHALL 默认处于 dormant/collapsed 状态，不渲染完整工作台。当用户点击 `Show Pane Workbench`、外部插件调用 `ctx.paneWorkbench.openView(...)` 或用户触发 `file.tree` 入口时，workbench SHALL 自动加载并启用；启用后完整 chrome 与已注册视图 SHALL 可交互。

#### Scenario: 安装后未使用

- **WHEN** 用户安装 bundle 并打开 DSH，但没有点击任何 workbench 入口
- **THEN** Pane Workbench SHALL 不展开完整 overlay
- **AND** 用户 SHALL 仍能看到轻量的 `Show Pane Workbench` 入口（或按配置隐藏）

#### Scenario: 外部插件调用 openView

- **WHEN** 任一已加载插件调用 `ctx.paneWorkbench.openView({ kind: 'file.tree', ... })`
- **THEN** workbench SHALL 自动变为可见
- **AND** 目标 view SHALL 在完整 chrome 挂载后立即打开，不得丢失请求

### Requirement: File tree SHALL load on demand from a Host projection

文件树 SHALL 在 workbench 打开或用户进入 Files/Documents 时按需调用 Host 目录投影（V1 使用 `ctx.workspaces.listDirectory`），并把结果安全映射为 `FileEntryV1`。浏览器侧 MUST NOT 持有或展示 raw absolute path。

#### Scenario: 打开文件树时加载目录

- **WHEN** 用户打开 workbench 并进入 Files Tab 或 `file.tree` view
- **THEN** 系统 SHALL 发起一次 `listDirectory` 请求
- **AND** 目录项 SHALL 以 `FileEntryV1` 的 `kind: 'directory'` 渲染为可展开树

#### Scenario: 目录加载失败

- **WHEN** `listDirectory` 返回错误
- **THEN** 文件树 SHALL 显示错误状态与重试入口
- **AND** 系统 MUST NOT 把 Host 错误路径或原始异常文本写入 UI 状态

#### Scenario: 无文件条目

- **WHEN** Host 投影返回空目录
- **THEN** 文件树 SHALL 显示明确的空状态
- **AND** 工作台其余 Tab 与布局 SHALL 保持可用
