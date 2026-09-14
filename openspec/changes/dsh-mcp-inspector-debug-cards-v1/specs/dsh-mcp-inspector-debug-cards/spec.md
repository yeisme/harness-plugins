# dsh-mcp-inspector-debug-cards

## ADDED Requirements

### Requirement: 失败解码卡映射冻结分类法
inspector pane SHALL 提供失败解码卡，把会话内观察到的 MCP 失败信号（ConversationSnapshot 派生的 `errorCode`/`errorName`、`toolHub` client error code、目录派生的空工具信号）映射到根仓冻结的消费者可见分类法 `unauthenticated | permission_denied_or_unknown_action | approval_required | budget_exceeded | rate_limited | upstream_unavailable | protocol_error`，且每个码 SHALL 渲染 `{title, likely causes, next actions}`。

#### Scenario: 401 信号被解码
- **WHEN** 会话中某 `mcp__` 调用失败，错误信号呈 401/unauthorized/token invalid 语义
- **THEN** 失败解码卡 SHALL 渲染 `unauthenticated` 码卡，含该码的 title、likely causes 与 next actions

#### Scenario: 空工具信号被解码为合并码
- **WHEN** 目录中某 MCP server 连接健康但 `tools/list` 结果为空
- **THEN** 失败解码卡 SHALL 将其归入 `permission_denied_or_unknown_action`，与 403/forbidden 信号同一呈现

#### Scenario: JSON-RPC 协议错被解码
- **WHEN** 调用错误信号为 `-32601`（method/tool not found、wrong path）或其余 `-32700…-32603` 协议码
- **THEN** 失败解码卡 SHALL 渲染 `protocol_error` 码卡
- **AND** SHALL NOT 借此区分"动作不存在"与"策略拒绝"

#### Scenario: 网关分类法码字面量透传
- **WHEN** 错误信号本身携带冻结分类法码字面量（如 `approval_required`、`budget_exceeded`、`upstream_unavailable`）
- **THEN** 失败解码卡 SHALL 原样映射到同名码，不改写、不细化

### Requirement: 合并码单一状态不可拆分
`permission_denied_or_unknown_action` SHALL 渲染为单一合并状态：策略拒绝、能力错名与空暴露三类解释 MUST NOT 在呈现上可区分，next actions SHALL 在全部解释下成立（capability 搜索拼写核对、申请授权、预算内重试），且该约束 SHALL 由合同测试钉死。

#### Scenario: 三类信号呈现完全一致
- **WHEN** 解码输入分别为 403/forbidden 信号、server 健康但空 tools 信号、unknown-action 信号
- **THEN** 三者的呈现输出（taxonomy code、title、likely causes、next actions）SHALL 完全一致
- **AND** 解码结果上 SHALL NOT 存在任何可反推触发条件的字段（cause/hit-reason 等）

#### Scenario: 实现试图拆分合并态
- **WHEN** 后续实现为合并码引入区分性字段或分叉文案
- **THEN** 合同测试 SHALL 红灯（存在性预言机是根仓冻结治理决策，DSH 侧不得拆分）

### Requirement: 无法归类的信号呈显式 undecoded 态
无法安全映射到冻结分类法的信号（无 error 字段、未知形状、超界被安全门丢弃、丢失 401/403 区分度的归一错误）SHALL 渲染显式 `undecoded` 状态，显示有界原始信号并明确"未归类"；解码函数 MUST fail-closed，MUST NOT 为未知信号猜测任何分类法码。

#### Scenario: 未知错误码
- **WHEN** 调用失败携带映射表外的 `errorCode`
- **THEN** 失败解码卡 SHALL 渲染 undecoded 状态，显示该有界原始码
- **AND** SHALL NOT 显示任何冻结分类法码字样

#### Scenario: 丢失区分度的宿主归一错误
- **WHEN** `toolHub` client error 仅携带 `accessDenied` 而无结构化 401/403 原因
- **THEN** 失败解码卡 SHALL 将其渲染为 undecoded，不猜 `unauthenticated` 也不猜合并码

### Requirement: rate/budget 失败的 bounded retry_after_seconds 呈现
`rate_limited` 与 `budget_exceeded` 失败携带 `retry_after_seconds` 时，失败解码卡 SHALL 以有界方式渲染（有限值 `0–3600` 秒显示精确秒数、超上限只给定性提示），字段缺失时 MUST NOT 造数或显示任何时间承诺；卡片 MUST NOT 据此倒计时、自动重试或调度任何调用。

#### Scenario: 携带有界重试时间
- **WHEN** `rate_limited` 失败携带 `retry_after_seconds: 30`
- **THEN** 卡片 SHALL 显示精确的 30 秒提示
- **AND** SHALL NOT 启动倒计时或自动重试

#### Scenario: 未携带重试时间
- **WHEN** `budget_exceeded` 失败未携带 `retry_after_seconds`
- **THEN** 卡片 SHALL NOT 显示任何时间性承诺

### Requirement: 能力地图卡消费 gateway_connect_doc.v1
Gateway 连接文档可用时，inspector pane 的能力地图卡 SHALL 经 host 只读投影消费 `gateway_connect_doc.v1`（compact faces + `doc_digest` digest_sha256_16）作为唯一真源，取代手写快速卡；卡片 SHALL 显示 digest 与其新鲜度，digest 漂移时 SHALL 显示 mismatch 横幅。

#### Scenario: 连接文档可用
- **WHEN** host `connectDoc()` 投影返回 faces 与 `docDigest`
- **THEN** 能力地图卡 SHALL 渲染 faces 及其公开名，并显示 `docDigest` 与 observedAt 新鲜度
- **AND** SHALL NOT 内嵌任何手写快速卡内容

#### Scenario: digest 漂移
- **WHEN** 一次读取得到的 `docDigest` 与当前渲染 faces 所背书的 digest 不一致
- **THEN** 卡片 SHALL 显示 mismatch 横幅，明示已渲染 digest 与当前 digest
- **AND** 已渲染数据 SHALL 以显式 stale 标注保留，不冒充新鲜

### Requirement: 恰好一次显式 re-discovery，永不自动
re-discovery SHALL 是 host 提供的 server-authored 动作，执行恰好一次 `tools/list`，且仅由用户显式动作（mismatch 横幅或卡片动作）触发；系统 MUST NOT 在 mount、timer、digest 漂移检测或目录刷新时自动调用。

#### Scenario: 漂移不自动重发现
- **WHEN** 卡片检测到 digest 漂移
- **THEN** 系统 SHALL 仅显示 mismatch 横幅与可用的 re-discovery 动作
- **AND** SHALL NOT 发起任何 `tools/list`

#### Scenario: 用户显式触发恰好一次
- **WHEN** 用户点击 re-discovery 动作
- **THEN** host SHALL 执行恰好一次 `tools/list`，完成后重取 connect doc digest
- **AND** in-flight 期间该动作 SHALL 禁用，digest 一致后才撤除横幅

### Requirement: 无浏览器直连 Gateway
能力地图卡与失败解码卡的数据 SHALL 仅经 host `toolHub` Remote 安全投影获取；浏览器侧 MUST NOT 直连 Gateway（不携带 gateway base URL/token/cookie，不新增任意 fetch 面）。

#### Scenario: 浏览器侧取数
- **WHEN** 能力地图卡需要连接文档数据
- **THEN** 数据 SHALL 只来自 host 投影 wire
- **AND** client 源中 SHALL 不存在 gateway 直连常量或 fetch 路径（静态守卫测试钉住）

### Requirement: 诚实降级且无静默陈旧数据
连接文档不可用时（旧宿主无投影方法、Gateway `gateway_connect_doc.v1` 未落地、transport error），能力地图卡 SHALL 渲染禁用态并给出可读原因；卡片 MUST NOT 静默回退到手写快速卡或把陈旧 connect doc 当新鲜数据渲染——陈旧数据只能以显式 stale/mismatch 标注存在。

#### Scenario: 投影缺失
- **WHEN** host 未提供 `connectDoc` 投影（旧宿主）或投影返回 `connect-doc-unavailable`
- **THEN** 能力地图卡 SHALL 呈禁用态并显示原因
- **AND** SHALL NOT 渲染任何兜底能力数据

#### Scenario: transport 错误
- **WHEN** 投影读取发生 transport error
- **THEN** 卡片 SHALL 显示 error 态与重探动作
- **AND** SHALL NOT 把内存中旧 connect doc 以新鲜状态呈现

### Requirement: additive-only 扩展既有 pane
两张卡 SHALL 以 additive 方式落进既有 ui-mcp-inspector pane（pane kind `mcp-inspector`/`tools-manager` 与 `conversation.view` tab）：系统 MUST NOT 新增 tab、bundle 或 pane kind；既有 `toolHub` wire `list`/`setEnabled` 合同 SHALL 保持不变；本 change MUST NOT 阻塞 `dsh-mcp-inspector-v1` 的归档。

#### Scenario: 交付形态零新增
- **WHEN** 两卡随 `@yeisme/dsh-mcp-inspector` bundle 交付
- **THEN** cordis.patch.yml insert 行 SHALL 不变，仅在需要时 additive 导出
- **AND** 既有 pane 注册、tab 结构与 `list`/`setEnabled` 行为 SHALL 不变

#### Scenario: 卸载与旁路
- **WHEN** bundle 被移除或插件上下文销毁
- **THEN** 两卡与新增 locale SHALL 随既有 pane 卸载一并移除，不残留
- **AND** `openspec/changes/dsh-mcp-inspector-v1/` 的任务文件与门禁 SHALL 零改动
