# dsh-session-tools-views Specification

## Purpose
TBD - created by archiving change dsh-session-tools-workspace-v2. Update Purpose after archive.
## Requirements
### Requirement: 会话工具视图隔离
系统 SHALL 为每个会话提供 mcp-inspector 工具 Tab，以显式 sessionId 绑定数据，默认展示调用活动。固定旁栏 SHALL 复用相同内容与该会话展示状态，不读取全局 current 作为绑定来源。

#### Scenario: A 与 B 并排
- **WHEN** A 和 B 均打开工具 Tab，用户切换或操作 B
- **THEN** A 的活动、目录、选择和状态 SHALL 不被 B 替换，A/B 筛选相互隔离

#### Scenario: 同会话 Tab 与旁栏
- **WHEN** 用户将 A 的工具固定到旁栏并在 Tab 选择调用
- **THEN** 旁栏 SHALL 同步同一调用选择；关闭任一视图不得释放另一视图仍需的数据源

### Requirement: 区分会话能力与全局管理
系统 SHALL 用 session-addressed authoritative 查询展示本会话可用能力；toolHub 全局配置 SHALL 有独立管理入口，不混作会话级启停。

#### Scenario: 全局安装但会话无权限
- **WHEN** 某工具已安装但不属于 A 的 scope
- **THEN** 系统 SHALL NOT 把它显示为 A 可调用；缺少 Skills/MCP 投影时 SHALL 明示部分覆盖

#### Scenario: 全局启停冲突
- **WHEN** 全局 setEnabled 返回 generation-conflict 或 storage-unavailable
- **THEN** UI SHALL 保留 owner 权威状态并显示原因；不得乐观翻转或取消既有运行中调用

### Requirement: 可恢复的目录状态
目录 SHALL 区分加载、真实空、部分、不可用和错误；重探测 MUST 在首次 remote 解析失败后仍可用，MUST NOT 依赖已有 controller 才能恢复。

#### Scenario: 服务晚到
- **WHEN** 初次挂载缺少 remote，之后服务就绪且用户重新检测
- **THEN** 系统 SHALL 重新绑定并查询真实目录，成功后清除旧错误且不重复注册

#### Scenario: 目录不可用但会话有活动
- **WHEN** 目录失败且会话已有调用记录
- **THEN** 活动 SHALL 继续可查看；目录 SHALL NOT 显示绿色完整或把失败当作0项成功

#### Scenario: 切换中的迟到结果
- **WHEN** A 查询未完成而视图已切到 B，之后 A 返回
- **THEN** A 的结果 SHALL NOT 覆盖 B，卸载后不得重新挂载旧连接

### Requirement: 紧凑活动与安全详情
会话 Tools SHALL 默认提供活动列表、失败/运行中筛选及时间线；详情 SHALL 随选择展开，不占用常驻一级 Tab。记录窗口边界 MUST 明示，错误摘要 MUST 来自 owner 安全投影。

#### Scenario: 失败定位
- **WHEN** 用户选择失败调用并点击定位原消息
- **THEN** 系统 SHALL 展示脱敏错误信息，打开正确会话的 Chat 并按 opaque ref 聚焦原记录；不可定位时给出原因

#### Scenario: 最近200条
- **WHEN** 会话调用数超过当前200条窗口
- **THEN** UI SHALL 标明显示范围与已知总数，不把窗口伪装成完整历史

#### Scenario: 无安全错误摘要
- **WHEN** 错误内容仅存在于 private arguments 或原始结果中
- **THEN** UI SHALL 显示摘要不可用，不读取或传输原始敏感内容，不提供直接重试
