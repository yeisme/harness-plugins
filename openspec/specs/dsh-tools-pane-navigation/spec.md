# dsh-tools-pane-navigation Specification

## Purpose
TBD - created by archiving change dsh-tools-pane-migration. Update Purpose after archive.
## Requirements
### Requirement: 工具入口归入唯一 Pane

工具 UI SHALL 注册到现有 Pane Workbench，默认 MCP 筛选与右侧单例，停止注册 conversation.view 工具 tab。

#### Scenario: 命令重复打开
- **WHEN** 用户通过 `+` 或 `/mcp` 打开工具视图，并将其移动到底部后再次调用 `/mcp`
- **THEN** 复用已有视图及区域，不创建第二个 tab

#### Scenario: Pane 服务不可用或晚到
- **WHEN** host 尚未提供 paneWorkbench
- **THEN** 不注册旧会话入口，命令报告不可用；服务到达后注册 Pane

### Requirement: 会话隔离与安全目录

Pane SHALL 读取 host 当前会话快照与工具目录，保持 generation-CAS 启停及安全调用摘要，不执行工具或存储私有参数。

#### Scenario: 切换会话
- **WHEN** 当前会话改变
- **THEN** 旧选择、活动与订阅被清理，新内容仅显示新会话

#### Scenario: 关闭时异步目录仍未返回
- **WHEN** Pane 关闭且目录 probe 尚未完成
- **THEN** 后到结果不得启动目录读取，重新打开以新 controller 读取

#### Scenario: 目录缺失
- **WHEN** host 不提供工具目录
- **THEN** 显示安全不可用状态，同时保留当前会话可读取的调用活动

### Requirement: 设置插件页退役

官方设置插件 UI SHALL 不再注册插件导航、标签页与卡片副作用，继续保留包加载兼容性、公开类型及 host 插件能力。

#### Scenario: 已有 profile 加载
- **WHEN** 已有 profile 加载 ui-settings-plugins
- **THEN** 加载成功且不出现插件设置分区，不要求 settings、remote 或 connection 服务

### Requirement: 按容器宽度布局

工具内容 SHALL 在 720px 及以下单列分段显示，360px 保持搜索、筛选、启停可访问，宽容器支持两列且不横向溢出。

#### Scenario: 键盘与窄 Pane
- **WHEN** 用户在 360px 或 560px 容器用键盘访问工具内容
- **THEN** 控件保持可聚焦，目录、活动和详情可切换，主内容无横向溢出

