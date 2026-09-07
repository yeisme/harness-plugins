## ADDED Requirements

### Requirement: Agent changes SHALL enter one adaptive candidate review flow

Workbench SHALL 将 Agent 输出规范化为 `inline_patch`、`document_candidate` 或 `atomic_change_set`。小范围 patch 在 editor 内审查，全文 candidate 使用 split compare，跨文档/结构 change-set 使用整体 review；Agent output MUST NOT 直接改变 Working Copy 或 Canon。

#### Scenario: Agent 改写一个段落
- **WHEN** candidate 只影响当前文档的有界 ranges
- **THEN** Workbench SHALL 显示 inline additions/deletions、summary、provenance 和 accept/reject
- **AND** accept SHALL 通过 Proposal Authority/TaskService 调用 Auctra。

#### Scenario: Team 返回跨文档 change-set
- **WHEN** candidate 包含多个 document/structure members
- **THEN** Workbench SHALL 显示成员、依赖和整体影响
- **AND** 除非 owner 返回新的派生 change-set，MUST NOT 在客户端执行 partial apply。

### Requirement: Candidate acceptance SHALL only update Working Copy

Candidate accept MUST 绑定 current base revision/digest、candidate ref、decision ref 和 idempotency key。成功 receipt SHALL 只推进 Working Copy；Checkpoint、ReviewItem 和 Canon MUST 保持不变。

#### Scenario: 用户接受全文候选
- **WHEN** current Working Copy 与 candidate base 一致且 owner 接受 apply
- **THEN** editor SHALL 加载或映射到新的 Working Copy revision
- **AND** UI SHALL 提示可继续编辑或显式 Checkpoint，而不是显示 Canon accepted。

### Requirement: Project-full context and Working Set SHALL be separately visible

Context rail SHALL 同时显示 project-full grant badge、显式 Working Set、retrieval preview 和 actual egress receipt。Working Set 表示 must-use context；project-full 表示 Runtime 可按需检索的最大范围。

#### Scenario: Runtime 使用 Working Set 外章节
- **WHEN** project-full 允许且 Runtime receipt 声明额外 source ranges
- **THEN** Workbench SHALL 在 turn provenance 中显示额外 refs/ranges/count 与 token/cost
- **AND** MUST NOT 展示 raw provider request、hidden prompt 或 tool private args。

### Requirement: Profile changes SHALL preserve separate role mode model and permission

Profile UI SHALL 分别选择 Role、Mode、server-authored Model Profile 与 Permission Profile，并显示 user/project/session effective diff。Session edit MUST only narrow project policy；Plan mode SHALL disable candidate apply、external write 和 Team run start。

#### Scenario: Session 尝试扩大网络权限
- **WHEN** project profile 禁止 web search而 session 选择允许
- **THEN** UI SHALL 阻止确认并显示 inherited deny
- **AND** SHALL NOT 向 Runtime 提交扩大后的 grant request。

### Requirement: Active profile switch SHALL cancel then continue

用户在 active attempt 切换 Role/Mode/Model/Permission 时，Workbench SHALL 撤销旧 grant、请求取消并保留 confirmed partial content。known-cancel 后 SHALL 用新 Profile/Grant 和 last confirmed cursor 创建 continuation；unknown 或 pending effect SHALL reconcile first。

#### Scenario: Cancel outcome unknown during model switch
- **WHEN** current attempt cancel 返回 unknown
- **THEN** UI SHALL 显示 original attempt correlation 和 Reconcile
- **AND** 新 Profile MAY 保存为 pending selection，但 MUST NOT 启动 continuation。

### Requirement: Checks SHALL distinguish deterministic and AI findings

Workbench SHALL 在 owner-confirmed patch 后展示确定性 format/reference/structure checks；AI continuity/style/claim/channel checks SHALL 仅在 Profile trigger、Checkpoint 或人工请求时运行。所有 AI finding MUST 标注 profile/model/context/provenance 且不能自动阻止 Canon，除非 Auctra owner 已定义独立 hard gate。

#### Scenario: AI continuity check reports a conflict
- **WHEN** Checkpoint 触发 continuity analysis
- **THEN** Workbench SHALL 显示 finding、source refs、confidence/limitations 和 candidate action
- **AND** SHALL NOT 自动改稿、拒绝 checkpoint 或接受 review。

### Requirement: Candidate review SHALL expose one primary decision and accessible differences

每个 candidate review surface SHALL 默认只有一个视觉 primary decision。Inline、split 和 unified diff SHALL 通过 `+/-`、文本标签、line/range metadata 与可访问名称共同表达变化，MUST NOT 只依赖红绿背景。Technical refs 与 provenance SHALL 降级显示但保持可访问。

#### Scenario: 手机审阅全文 candidate
- **WHEN** 视口不足以并排显示 current/candidate
- **THEN** Workbench SHALL 切换为单列 unified diff并固定 impact 与 decision summary
- **AND** Accept/Reject/Reconcile action identity SHALL 与桌面相同且不因响应式被隐藏。

### Requirement: Diff composition SHALL not create another owner state machine

共享 diff composite MAY 负责 inline/split/unified presentation、键盘导航和折叠，但 MUST 接收 owner-normalized immutable projections，不得计算 candidate authority、保存 Working Copy、创建 approval 或自行决定 stale/acceptability。

#### Scenario: Screenplay and Text Development reuse the same diff view
- **WHEN** 两个 surface 提供 compatible normalized diff rows
- **THEN** shared composite SHALL 只渲染差异、selection 和 declared actions
- **AND** 每个 surface SHALL 继续从各自 owner projection取得 decision、revision 和 receipt。
