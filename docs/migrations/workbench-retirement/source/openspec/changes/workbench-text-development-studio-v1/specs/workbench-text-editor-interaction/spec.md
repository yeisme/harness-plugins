## ADDED Requirements

### Requirement: Editor SHALL preserve owner source text

Workbench SHALL 使用 CodeMirror 6 呈现 Auctra 的 Markdown、plain text 或 Fountain 正文，格式化效果仅通过 commands/decorations/diagnostics 实现。Browser MUST NOT 将 HTML、ProseMirror JSON 或其它隐藏 document model 写回 owner。

#### Scenario: 用户编辑 Fountain 文本
- **WHEN** 用户修改 scene heading、character 或 dialogue 行
- **THEN** patch SHALL 对原始 Fountain 字符串应用并保持未修改部分逐字节稳定
- **AND** decoration/preview MUST NOT 改写 source。

### Requirement: Autosave SHALL use versioned incremental patches

Editor SHALL 在最后输入 750ms 后发送 patch，并在 blur、document switch 和受控 unload 前 flush。每个 patch MUST 绑定 Working Copy ref、revision、digest、UTF-16 ranges、idempotency key 和 server-issued action scope；只有 owner receipt 才能进入 `saved`。

#### Scenario: Autosave 成功
- **WHEN** 用户停止输入且 Auctra 接受当前 patch
- **THEN** Workbench SHALL 更新 revision/digest 和 saved indicator
- **AND** SHALL 从 pending queue 删除且只删除已 receipt 的 patch。

#### Scenario: Autosave stale
- **WHEN** Auctra 返回 revision/digest conflict
- **THEN** Workbench SHALL 停止后续 mutation、保留本地 buffer并打开 compare/recovery
- **AND** MUST NOT 用全量 body 覆盖较新 owner state。

### Requirement: Selection anchors SHALL be exact and revision-bound

选区 SHALL 投影为含 Working Copy/unit refs、revision、content digest、UTF-16 start/end 与 selected digest 的 typed anchor。默认动作 SHALL 为 Ask、Rewrite、Polish、Add to context；Profile MAY 从 server manifest 增加最多四个 Lens actions。

#### Scenario: 选区在 Agent 返回前已改变
- **WHEN** Working Copy revision 或 selected digest 不再匹配 anchor
- **THEN** candidate SHALL 标记 stale 并禁用直接 accept
- **AND** UI SHALL 提供 refresh/rebase 或重新选择，而不是猜测新位置。

### Requirement: Human structure edits SHALL use typed owner intents

Outline、Timeline、Entity、Foreshadowing、Scene/Beat、Claim/Source 的拖拽或表单编辑 SHALL 只生成 descriptor 声明的 intent，并绑定 expected revision/idempotency。Owner receipt 前 UI MAY 显示 pending ghost，但 MUST NOT 更新 canonical projection。

#### Scenario: 用户移动章节
- **WHEN** 用户把章节拖到新的 parent/ordinal
- **THEN** Workbench SHALL 提交 `outline.move` typed intent 并显示 pending state
- **AND** 只有 Auctra receipt 成功后才更新 owner-backed order。

### Requirement: Checkpoint SHALL remain explicit

Workbench SHALL 提供显式 Create Checkpoint action，并显示 checkpoint ref、source revision、digest 和 time。Autosave、candidate accept、structure edit 和 posture switch MUST NOT 自动创建 Checkpoint。

#### Scenario: 用户接受 Agent hunk
- **WHEN** Auctra 成功应用 candidate 到 Working Copy
- **THEN** UI SHALL 显示新的 unsaved-to-checkpoint state
- **AND** SHALL NOT 显示已经创建 checkpoint 或 review item。

### Requirement: Large projects SHALL use bounded rendering

Workbench SHALL 在 100 万中文字、约 500 章和数千实体 fixture 中只挂载 active document、visible editor viewport、current compare 与虚拟化结构列表。MUST NOT 在每次输入时读取/序列化全书或重绘全量 graph。

#### Scenario: 用户在大型小说中连续输入
- **WHEN** active chapter 发生多次 local transactions
- **THEN** autosave SHALL 仅提交累积 patch range
- **AND** inactive chapters 和非可见 entity rows SHALL 不重新 mount。

### Requirement: Editor readability SHALL remain separate from application chrome

Workbench chrome SHALL 继续使用统一 UI typography；Document body SHALL 使用 format-aware readable measure。Markdown/plain text SHALL 默认至少 16px 且约 72–88ch，Fountain SHALL 使用现有 mono token。用户正文 MUST NOT 被包进装饰性 card、Hero 或独立品牌 surface。

#### Scenario: 打开长篇中文章节
- **WHEN** Document Dock 有足够宽度
- **THEN** 正文 SHALL 在可读 measure 内居中或对齐，并保留 Outline/Review 的独立区域身份
- **AND** 行宽、字号和 gutter MUST NOT 随 Context deck 开关产生不可控跳动。

### Requirement: Save announcements SHALL be calm and accessible

UI SHALL 区分 `unsaved|saving|saved|conflict|offline|recovery_required`，只有 owner receipt MAY 产生 `saved`。视觉层 SHALL 避免每个 autosave 的 success toast，screen reader announcement SHALL 对连续 patch 节流并保留 conflict/offline/recovery 的即时 alert。

#### Scenario: 用户连续输入并收到多个 autosave receipt
- **WHEN** 多个 patch 在短时间内依次确认
- **THEN** UI SHALL 更新到最新 owner revision而不重复弹 toast或逐次抢占 live region
- **AND** conflict/offline 若出现 SHALL 立即取代 saved 状态并给出一个真实恢复动作。
