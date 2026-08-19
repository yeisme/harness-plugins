## ADDED Requirements

### Requirement: Rich Media Workbench SHALL 通过官方 sidebar slot 提供
Rich Media Workbench SHALL 使用 `sidebar.footer.action` 官方 slot 注册，不得使用 DOM patch、全局 selector 劫持或私有 `ctx.betterSidebar` API。工作台 SHALL 提供媒体库、文件、终端、Git、浏览器五个 Tab 的心智模型；当前媒体库 SHALL 可渲染，其余 Tab SHALL 显示预留接入位。

#### Scenario: 在侧栏打开媒体工作台
- **WHEN** 用户点击侧栏底部“媒体工作台”触发器
- **THEN** 工作台 SHALL 展开媒体库面板
- **AND** 点击文件/终端/Git/浏览器 Tab SHALL 显示“预留接入位”，不得伪造可用功能

### Requirement: 工作台交互 SHALL 可访问且键盘可用
工作台 SHALL 使用 tablist/tab/tabpanel 语义，支持键盘切换、aria-selected/aria-label 与焦点保留。宽/窄侧栏下 SHALL 都有可用入口：窄栏显示触发器，宽栏显示完整面板。颜色不得是唯一状态信号。

#### Scenario: 键盘切换工作台 Tab
- **WHEN** 用户聚焦媒体工作台 Tablist 并使用方向键
- **THEN** 激活 Tab SHALL 更新 aria-selected
- **AND** 对应 tabpanel SHALL 显示并保持焦点可感知

### Requirement: 媒体工作台 SHALL 只消费安全媒体投影
工作台媒体库 SHALL 只接收 Host 已校验的 `MediaRefV1`，不自行构造 URL、路径或凭据。关闭工作台 SHALL 暂停/释放媒体资源，HMR/unload SHALL 对称 teardown。

#### Scenario: 媒体库显示空状态
- **WHEN** Host 尚未提供媒体投影
- **THEN** 工作台 SHALL 显示空状态
- **AND** 不得从文件系统或任意 URL 猜测媒体列表

### Requirement: DSH-better-sidebar 只作交互参考，不形成依赖
实现 SHALL 不复制 `DSH-better-sidebar` 源码、CSS、测试或构建产物，不 import 其 package，不读取其私有状态。二创只保留工作台心智模型与交互方向，并通过官方 seam 重新实现。

#### Scenario: 源码独立性检查
- **WHEN** 扫描 `@yeisme/dsh-rich-media` 的 source、manifest 与 build output
- **THEN** SHALL 不包含 `DSH-better-sidebar` package/path/source marker
- **AND** 仅在 OpenSpec/README 中作为公开交互研究来源引用
