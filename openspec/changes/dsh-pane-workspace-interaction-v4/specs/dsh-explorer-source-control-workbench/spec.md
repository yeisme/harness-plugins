## ADDED Requirements

### Requirement: Explorer 与 Source Control SHALL 是分离但可组合的 Pane providers
Workbench SHALL 将 Explorer 注册为文件导航 provider，将 Source Control 注册为 repository/worktree 与 Git workflow provider。两者 SHALL 通过 opaque file/repository/worktree refs、typed open intent 和 safe decorations 组合，MUST NOT 共享第二份文件系统或 Git canonical store。

#### Scenario: 从 Explorer 打开变更 diff
- **WHEN** 用户在带 Git decoration 的文件行执行 Open Changes
- **THEN** Explorer SHALL 提交 typed diff open intent，并在 content group 打开或聚焦 Source Control diff view
- **AND** Explorer SHALL NOT 自行读取 Git diff 或执行 Git command

### Requirement: File tree SHALL 只消费 owner-issued hierarchy projection
File tree SHALL 使用 `FileTreeProjectionCapabilityV1` 或等价 additive capability 获取 root、children、breadcrumb、version、capabilities 和 freshness。Node identity MUST 是 owner-scoped opaque ref，Pane state、DOM attribute、URL 和 persistence MUST NOT 使用绝对路径作为 authority。

#### Scenario: 展开目录
- **WHEN** 用户展开一个声明 `hasChildren=true` 的目录 node
- **THEN** Explorer SHALL 通过 owner `listChildren` 请求该 ref 的下一层并保留现有 rows
- **AND** 请求和结果 MUST NOT 向浏览器暴露 host absolute path

#### Scenario: Owner 返回不安全 node
- **WHEN** tree projection 包含绝对路径、`file://` URL、credential 或任意 HTML
- **THEN** parser SHALL 拒绝该 node 并将当前 branch 标记为 `contract_mismatch`
- **AND** 其他安全 branches SHALL 保持可浏览

### Requirement: Explorer tree SHALL 支持惰性加载、虚拟化和稳定滚动
Explorer SHALL 只加载展开节点的 children，并对大树使用窗口化 rows。异步 children、watch event、filter 或 Git decoration 更新 MUST NOT 无条件重置 expanded refs、selection、focus、scroll anchor 或 sibling order。

#### Scenario: 10,000 个已知 entries 的 workspace
- **WHEN** 用户快速滚动并展开多个目录
- **THEN** DOM SHALL 只保留 bounded visible/overscan rows，active/focused node 仍可被辅助技术感知
- **AND** loading row 完成后滚动锚点 SHALL 保持稳定

### Requirement: Explorer tree SHALL 提供完整键盘与触摸交互
Tree SHALL 使用 tree/treeitem 语义并支持 ArrowUp/Down、ArrowLeft/Right、Home、End、PageUp/PageDown、Enter、Space、Shift+F10 和 typeahead/filter。Selection 与 keyboard focus MUST 可区分；coarse pointer row target MUST 不低于 44px。

#### Scenario: 键盘展开并打开文件
- **WHEN** focus 位于目录且用户按 ArrowRight，再移动到文件并按 Enter
- **THEN** 目录 SHALL 展开，文件 SHALL 按 provider policy 打开或固定
- **AND** focus SHALL 保留在对应 tree row 或明确移动到新 Tab

### Requirement: File open SHALL 遵循 preview、pin 和 dirty 生命周期
单击文件 SHALL select 并打开可替换 preview；双击、Enter、编辑、Pin 或 dirty state SHALL 将资源固定。同 owner/ref/version 再次打开 SHALL 优先激活现有 Tab，除非请求显式 duplicate。

#### Scenario: 连续预览两个文件
- **WHEN** 用户单击文件 A 后单击文件 B，且 A 仍是 clean preview
- **THEN** B SHALL 在同一 content group 替换 A preview
- **AND** pinned 或 dirty Tabs SHALL 保持不变

#### Scenario: 外部修改 dirty 文件
- **WHEN** File watch projection 报告 owner version 已变化，而对应 Tab 基于旧版本 dirty
- **THEN** Explorer 和 Tab SHALL 标记 conflict/stale，并提供 Compare、Reload、Save As 或 Keep Local owner actions
- **AND** 系统 MUST NOT 自动覆盖新 owner version或丢弃本地 buffer

### Requirement: Git decoration SHALL 保持独立 freshness 和 owner 边界
Explorer MAY 显示 conflict、staged、modified、untracked、ignored 或 renamed decoration，但 decoration SHALL 来自 Git projection，并携带独立 repository/worktree ref、revision 和 freshness。Decoration stale MUST NOT 使 File tree 被误标为空或 offline。

#### Scenario: Git projection 暂时断线
- **WHEN** File tree ready 但 Git decoration stream offline
- **THEN** Explorer SHALL 继续显示文件树并将 decoration 标为 stale/unavailable
- **AND** Git mutation actions SHALL 禁用且说明原因

### Requirement: Source Control SHALL 使用固定且可扫描的信息架构
Source Control SHALL 按 Repository/Worktree selector、branch/upstream summary、commit composer、Merge Changes、Staged Changes、Changes、Untracked 的顺序展示。空分组 SHALL 隐藏；clean workspace SHALL 显示最近 commit、branch 状态和明确的 Refresh/History action。

#### Scenario: 同时存在 conflict、staged 和 untracked 文件
- **WHEN** Git status projection 返回三类变化
- **THEN** Source Control SHALL 分组显示数量、状态和可用 actions，并将 Merge Changes 放在最前
- **AND** 不同类别 MUST NOT 仅依赖颜色区分

### Requirement: Diff SHALL 使用 bounded file/hunk window
Diff view SHALL 通过 `GitDiffWindowCapabilityV1` 或等价 capability 获取 file/hunk window、cursor、loaded/total、base/target revision 和 allowed actions。大 diff MUST 分页或虚拟化；客户端 MUST NOT 将完整仓库 diff 无界写入 React state 或 persistence。

#### Scenario: 打开大型 diff
- **WHEN** 一个文件包含超过 owner 首屏预算的 hunks
- **THEN** Diff SHALL 显示当前 loaded/total 范围并提供 Load More、Next/Previous Change
- **AND** 未加载范围的 stage/discard action SHALL 禁用或由 owner 精确解析

### Requirement: Stage、unstage、discard 和 commit SHALL 是 typed owner actions
Git mutation SHALL 使用 file/hunk ref、repository/worktree ref、expected revision、preview digest、idempotency key 和 owner receipt。浏览器 MUST NOT 发送任意 argv、shell 字符串、patch command 或未经 owner 解析的路径。

#### Scenario: Stage 单个 hunk
- **WHEN** 用户在 diff 中 Stage Hunk
- **THEN** client SHALL 提交精确 hunk ref 和 expected revision，并等待 owner receipt 与新 projection
- **AND** revision 漂移时 owner SHALL 拒绝旧 intent 并要求 reconcile

#### Scenario: Commit 响应前断线
- **WHEN** commit request 已 accepted 但响应或 projection 中断
- **THEN** Source Control SHALL 显示 unknown/reconcile_required 并按 idempotency/receipt 查询结果
- **AND** MUST NOT 自动再次执行 commit

### Requirement: Branch、worktree 与 remote actions SHALL 独立 capability-gated
Branch create/switch/delete、worktree create/remove、fetch/pull/push SHALL 只在匹配 additive capability 存在且 owner 返回 allowed action 时显示。Delete、pull、push 和 destructive worktree action SHALL 经过 preview、risk、approval 和 receipt；remote target、upstream 和 refspec MUST 明确可见。

#### Scenario: Remote capability 不存在
- **WHEN** status projection 显示 ahead/behind，但 `GitRemoteActionsCapabilityV1` 不可用
- **THEN** Source Control SHALL 显示只读 remote state 和 capability unavailable 原因
- **AND** SHALL NOT 渲染可点击但无效的 Pull/Push controls

#### Scenario: 删除被 Ordo lease 占用的 worktree
- **WHEN** Git owner 或 Ordo projection 表明目标 worktree 存在有效 writer lease
- **THEN** remove action SHALL 被阻塞并提供 Ordo deep-link/恢复建议
- **AND** Git Pane MUST NOT 释放 lease 或强制删除 worktree

### Requirement: Conflict 与 partial state SHALL 提供恢复路径
Source Control SHALL 区分 conflict、partial status、stale、offline、permission_denied、contract_mismatch、unknown 和 reconcile_required。未知或不完整状态 MUST fail closed；每种非 ready 状态 SHALL 保留安全旧数据并提供一个明确恢复 action。

#### Scenario: Status cursor gap
- **WHEN** client 检测到 Git status event sequence gap 且 owner 无法 replay
- **THEN** Source Control SHALL 暂停 mutation、标记 `reconcile_required` 并请求 snapshot
- **AND** snapshot 对齐前 MUST NOT 将旧 Changes 列表显示为 fresh

### Requirement: Explorer 与 Source Control copy SHALL 使用 Pane locale namespace
固定 labels、menus、empty/error copy、ARIA names、counts、risk text 和 live announcements SHALL 使用 `paneWorkbench` locale keys。Owner resource names、branch names 和 commit messages SHALL 按数据原文安全显示。

#### Scenario: 运行时切换为中文
- **WHEN** DSH active locale 从 English 切换为 Chinese
- **THEN** Explorer、Source Control、Diff actions 和 announcements SHALL 原位更新语言
- **AND** expanded refs、selection、active Tab、Git revision 和 pending receipt SHALL 保持不变
