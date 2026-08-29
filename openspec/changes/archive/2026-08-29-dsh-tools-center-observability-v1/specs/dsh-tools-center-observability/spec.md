## ADDED Requirements

### Requirement: Tools 工作台首屏层级
系统 SHALL 在现有 `conversation.view` 的 `mcp-inspector` entry 内提供紧凑状态条、目录区和活动/详情区；MUST NOT 通过并列主壳或 dashboard card mosaic 实现。宽容器首屏 MUST 同时可见目录与会话活动，内容 MUST 从顶部开始且不得产生被拉伸的空白区。

#### Scenario: 宽容器正常目录
- **WHEN** Tools 容器宽度至少 1100px 且目录与活动均有数据
- **THEN** UI SHALL 使用约 58/42 双栏，在无需纵向滚动前显示状态条、目录首行和活动首行

#### Scenario: 中窄容器
- **WHEN** Tools 容器小于 1100px
- **THEN** UI SHALL 使用内部目录/活动/详情切换且同一时刻只保留一个主内容滚动区

### Requirement: 安全目录状态与筛选
系统 SHALL 展示目录完整性、总数、已启用、已关闭和不可用数量，并支持按名称/描述/来源、family 与 availability 筛选。目录项 SHALL 以高密度行展示 label、family、source、safe description、tool count、状态和本会话最近使用；MUST NOT 把“已启用”等同于“健康或已连接”。

#### Scenario: 点击覆盖度状态
- **WHEN** 用户激活“已关闭”覆盖度段
- **THEN** 目录 SHALL 应用 disabled filter 并保持其他统计基于完整目录

#### Scenario: 搜索无结果
- **WHEN** 当前搜索和筛选组合无匹配项
- **THEN** UI SHALL 显示上下文空态和清除筛选动作，不显示占满主工作区的通用空白页

### Requirement: 启停由 authoritative CAS 决定
工具启停 SHALL 继续通过 `toolHub.setEnabled@1` 与 generation CAS 执行。UI MUST NOT 在 owner response 前乐观翻转 enabled；关闭条目 MUST 只影响后续 tool admission，不得取消或重写已运行调用。

#### Scenario: Generation conflict
- **WHEN** `setEnabled` 返回 `generation-conflict`
- **THEN** controller SHALL 刷新目录、保留权威状态并向用户显示目录已变化的本地化提示

#### Scenario: Storage failure
- **WHEN** `setEnabled` 返回 `storage-unavailable`
- **THEN** UI SHALL 保留原 enabled 状态并显示安全失败原因，不得伪造成功

### Requirement: 统一安全会话活动
系统 SHALL 从 ConversationSnapshot 的 tool-result 与 running calls 派生 MCP 和 native tool 活动，包含 safe item/tool name、time、duration、running 和 error。系统 MUST NOT 保存或展示 arguments、result payload、raw prompt、private path 或 provider payload；Skill 身份在缺少 safe ref 时只能聚合显示。

#### Scenario: MCP 与 native 调用同时存在
- **WHEN** 会话含 `mcp__github__create_issue` 与 `read_file` 调用
- **THEN** Activity SHALL 分别关联 `mcp:github` 与 `tool:read_file`，并显示各自状态和耗时

#### Scenario: Skill 调用缺少 safe identity
- **WHEN** 调用名为 `skill` 且唯一 Skill 身份仅存在于 private arguments
- **THEN** Activity SHALL 显示聚合 Skill invocation，MUST NOT 读取 arguments 推断名称

#### Scenario: 非法工具名
- **WHEN** name 为空或 MCP 前缀无法唯一解析 server/tool
- **THEN** 派生函数 SHALL 丢弃该记录且不得猜测归属

### Requirement: 活动列表与时间线可视化
Activity SHALL 提供可读列表和调用耗时瀑布时间线，显示 running/success/error、时间和 duration；图形 MUST 有等价文字/ARIA 信息且不得成为唯一状态表达。

#### Scenario: 运行中调用
- **WHEN** tool call 尚无 result
- **THEN** 列表 SHALL 显示运行中且时间线 SHALL 显示持续区间，不显示伪造完成耗时

#### Scenario: 缺少 callTime
- **WHEN** result 存在但无法计算 duration
- **THEN** UI SHALL 显示 `—` 或本地化 unavailable，不得计算负值或猜测耗时

### Requirement: Additive Tool Hub observability contract
`toolHub.list@1` SHALL 保持 `specVersion: 1.0`、现有字段和 remote descriptor；系统 MAY additive 返回 `observedAt`、`healthAvailable`、item `reasonCode` 与 item `health` optional fields。旧客户端 MUST 能忽略新增字段，旧响应 MUST 被新客户端接受。

#### Scenario: 旧响应无 optional 字段
- **WHEN** client 收到只含原 `ToolHubCatalogV1` 字段的成功响应
- **THEN** codec SHALL 接受响应并把 health 视为未提供

#### Scenario: 新响应包含 health
- **WHEN** MCP item 含 connected/disconnected/syncing/unknown health 与 observedAt
- **THEN** client SHALL 校验并展示该状态，同时保持 enabled 与 health 为两个独立字段

### Requirement: MCP health 诚实降级
Tool Hub SHALL 仅从 optional `ctx.mcpServers.list()` safe provider 投影 MCP health；MUST NOT 下发 command、env、headers、credentials 或 transport config。provider 缺失时 UI SHALL 显示未提供连接健康，MUST NOT 显示 disconnected/offline/healthy。

#### Scenario: Provider 缺失
- **WHEN** host 无 `ctx.mcpServers.list()`
- **THEN** catalog SHALL 省略 item health 或返回 `healthAvailable=false`，UI SHALL 显示“未提供连接健康”

#### Scenario: Health 超过 freshness
- **WHEN** health observedAt 距当前时间超过 60 秒
- **THEN** UI SHALL 显示 stale 并保留最后 owner state，MUST NOT 推断新的连接状态

### Requirement: 安全错误恢复
系统 SHALL 把 endpoint、host、contract、storage、catalog 和 unknown failure 归一为稳定安全 code 与本地化 copy。主界面 MUST NOT 显示 raw transport JSON、stack、request body 或私密参数；目录失败 MUST NOT 隐藏可由 session 派生的 Activity。

#### Scenario: toolHub endpoint HTTP 404
- **WHEN** `toolHub.list` transport 报告 endpoint not found
- **THEN** UI SHALL 显示“工具目录服务未安装或版本不兼容”、安全重新检测动作和折叠 code 摘要，同时继续显示会话活动

#### Scenario: Unknown transport error
- **WHEN** transport failure 无已知 code
- **THEN** UI SHALL 显示 generic unavailable 和 `unknown`，MUST NOT 直接插入序列化 error object

### Requirement: 国际化、响应式与可访问性
所有可见文案 SHALL 从 `mcpInspector` locale namespace 读取。所有 controls MUST 键盘可达、具备可见 focus、至少通过文字和语义表达状态；<700px coarse pointer 目标 MUST 至少 44px。系统 SHALL 支持 `prefers-reduced-motion` 且不得用动画延迟内容可见性。

#### Scenario: Host locale 为中文
- **WHEN** DSH locale 为 zh
- **THEN** Tools 标题、筛选、状态、错误、活动与详情 SHALL 显示中文且布局不溢出

#### Scenario: Reduced motion
- **WHEN** 用户启用 reduced motion
- **THEN** 非必要 transition/shimmer SHALL 被关闭，状态、焦点和内容变化仍 SHALL 可见

### Requirement: 集成证据与强制人工验收
浏览器截图与 integration evidence SHALL 由 repository script 写入 `temp/integration-test-runs/<run-id>/`，至少包含 `summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json`、`artifacts/`。最终归档 MUST 要求 CLI 生成的 human acceptance receipt，其 decision 为 accept 且绑定当前 commit、受影响源码 digest 与必需 screenshot digests；Agent 或自动分数 MUST NOT 代签。

#### Scenario: 自动门禁通过但无人验收
- **WHEN** tests、typecheck、build、OpenSpec 和 screenshots 均通过但无 accept receipt
- **THEN** change SHALL 保持 awaiting human acceptance 且 MUST NOT 归档

#### Scenario: Commit 在验收后变化
- **WHEN** receipt 记录的 commit 与当前 commit 不同
- **THEN** acceptance verify SHALL 非零退出并要求重新 prepare/record

#### Scenario: 受影响源码状态变化
- **WHEN** prepare、record 或 verify 之间的受影响源码 digest 发生变化
- **THEN** acceptance record/verify SHALL 非零退出并要求重新 prepare/record

#### Scenario: 人工拒绝
- **WHEN** reviewer 记录 decision=reject
- **THEN** receipt SHALL 保存 reject 事实且 verify SHALL 非零退出，不得自动改为 accept
