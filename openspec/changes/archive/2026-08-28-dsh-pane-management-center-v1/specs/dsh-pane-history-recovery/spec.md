## ADDED Requirements

### Requirement: 安全优先批量关闭 SHALL 与既有原子关闭并存
Workbench SHALL 新增 `bulk_close_safe` 意图，在一次 reducer commit 中关闭 clean、allow 且可恢复的目标，并返回 closed 与 protected 分类。Dirty、running、terminal、confirm 和 deny 目标 SHALL 保留；deny MUST NOT 被强制关闭。既有 `bulk_close` MUST 继续保持任一阻塞项导致整批拒绝的语义。

#### Scenario: 未固定 Tab 中包含终端和普通文件
- **WHEN** 用户执行安全优先关闭未固定 Tab
- **THEN** 普通可恢复文件被关闭并写入同一历史批次，终端留在原位并进入受保护清单，旧原子 bulk close 行为不变

### Requirement: 关闭操作 SHALL 写入有界历史批次
每次单个或批量关闭 SHALL 记录关闭批次，包含安全 view identity、原 region/group/index、active/pinned 状态、关闭时间和可选 provider restore descriptor。每个 scope SHALL 最多保留 50 条且不超过 30 天，超限时从最旧未固定历史开始淘汰。

#### Scenario: 历史达到上限
- **WHEN** 当前 workspace 已有 50 条历史且关闭一个新 Tab
- **THEN** 新批次被保存，最旧未固定历史被淘汰，固定历史和当前 workspace layout 不受影响

### Requirement: 关闭后 SHALL 支持即时和延迟恢复
关闭成功后 SHALL 显示 10 秒撤销条；撤销或 Ctrl/Cmd+Shift+T SHALL 恢复最近批次的 Tab 顺序、原 group、active 与 pinned 状态。原 group 不存在时 SHALL 走现有 smart placement，并明确说明位置发生变化。

#### Scenario: 撤销批量关闭
- **WHEN** 用户关闭 12 个安全 Tab 后在 10 秒内点击撤销
- **THEN** 12 个 Tab 按原顺序和分组恢复，原活动 Tab 获得焦点，不重复创建已重新打开的 singleton

### Requirement: 固定、分组与历史 SHALL 使用安全 scope
管理配置 SHALL 优先使用 Host 提供的 opaque workspaceRef；缺失时 SHALL 使用当前 sessionRef 并在 UI 标明“会话范围”。首次从 session scope 升级到 workspace scope 时 SHALL 仅以当前 session bucket 初始化新 workspace bucket并保留旧数据，MUST NOT 使用绝对路径或把其他会话静默合并。

#### Scenario: Host 后续提供 workspaceRef
- **WHEN** 当前会话已有固定 Tab 和历史且安全 workspaceRef 首次可用
- **THEN** 新 workspace bucket 以当前会话数据初始化，旧 session bucket 保留，其他会话数据不被合并

### Requirement: Provider 恢复状态 SHALL 有界且安全
Provider MAY 提交不超过 16KiB 的 Json UI state 和 opaque rendition ref，用于恢复滚动、筛选、选择、折叠和资源版本。Workbench MUST 拒绝绝对路径、可执行 URL、credential/raw prompt/provider payload/private argument 字段，MUST NOT 保存正文、终端输出、DOM 或完整对话。

#### Scenario: Provider 尝试保存终端输出
- **WHEN** restore state 包含 `terminalOutput`、绝对路径或 data URL
- **THEN** 状态被拒绝且不写入历史，Tab 仍可按基础 view identity 关闭和恢复

### Requirement: 失效恢复 SHALL 展示安全缓存或说明 Pane
资源删除、版本变化、owner offline 或 provider 卸载时，Workbench SHALL 在 provider 可解析 opaque rendition 时显示最后安全 rendition 与状态横幅；否则显示说明 Pane。UI SHALL 提供适用的重连、刷新、重新安装、另存或关闭动作，MUST NOT 把 stale/orphaned 状态伪装为 ready。

#### Scenario: 文件已删除但存在安全 rendition
- **WHEN** 用户从历史恢复已删除文件且 owner 能解析缓存 rendition
- **THEN** Pane 展示缓存内容和“文件已删除”横幅，保留版本信息与可用恢复动作
