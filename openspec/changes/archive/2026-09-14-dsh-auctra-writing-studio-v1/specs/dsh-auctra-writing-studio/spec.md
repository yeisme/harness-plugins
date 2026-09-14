## ADDED Requirements

### Requirement: Studio consumes Auctra as the only text owner
The plugin SHALL read text projects, structures and bodies only through the published Auctra contracts and SHALL NOT create a second body store, version state machine or canon authority.

#### Scenario: Owner contract is unavailable
- **WHEN** the Auctra capability is absent or the contract mismatches
- **THEN** the studio reports an explicit unavailable reason without fake text data

### Requirement: Body reads are explicitly authorized
Body reads SHALL use explicitly authorized ranges with content separated from control-plane summaries; unauthorized text types SHALL show the reason instead of a body area.

#### Scenario: Text type read is not authorized
- **WHEN** the owner does not authorize body reads for a text type
- **THEN** the body area stays hidden with an explanation and no partial body is displayed

### Requirement: Agent edits flow through owner candidates
Agent modifications of owner-held bodies SHALL go through the owner candidate channel with a change summary and undo; accepted versions SHALL NOT be modified in place.

#### Scenario: Agent proposes a body change
- **WHEN** an agent modifies authorized text
- **THEN** the change appears as an owner candidate with summary and undo, and the accepted version is untouched until adoption

### Requirement: Version conflicts preserve user input
On version conflict the studio SHALL preserve the edit input and candidate and SHALL offer reread, comparison or save-as-draft; it SHALL NOT overwrite the newer version.

#### Scenario: A newer version lands during editing
- **WHEN** the owner advances the version while an edit is pending
- **THEN** the conflict is surfaced with comparison and the newer version is never silently overwritten

### Requirement: Save state follows owner receipts
Save SHALL be reflected only after the owner receipt confirms; HTTP success or pending UI state SHALL NOT mark the text saved, and checkpoint, review, canon and delivery remain separate actions.

#### Scenario: Write outcome is unknown
- **WHEN** a save has no confirmed owner receipt
- **THEN** the studio preserves the candidate, reports unknown and does not claim saved

### Requirement: Real writing evidence is independent
Fixture checks SHALL NOT satisfy the real usability task; real loop evidence SHALL record fixture/real marking.

#### Scenario: Only adapter fixtures passed
- **WHEN** adapter tests pass without a real Auctra writing loop
- **THEN** the real usability task remains incomplete

### Requirement: Three text modes and explicit version lifecycle
The studio SHALL support novel chapters, screenplay scenes and general text units; Working Copy save, candidate adoption, Checkpoint, Review and Canon SHALL remain separate actions.

#### Scenario: 采用候选
- **WHEN** a candidate is successfully applied to the Working Copy
- **THEN** no Checkpoint, Review submission or Canon acceptance is performed automatically

### Requirement: Lossless editing and atomic changes
Editing SHALL preserve Unicode, IME and source text; combined structure/body changes SHALL follow the owner atomic change-set and version contract.

#### Scenario: 联合变更冲突
- **WHEN** one member of an atomic structure/body change-set conflicts
- **THEN** the UI retains drafts and does not report a partial owner commit

### Requirement: Independent direct operation and scope binding
The professional Pane SHALL be usable without canvas, other professional Panes or cross-domain orchestration; object bindings SHALL preserve owner/ref/version/project and separate the target session.

#### Scenario: 双栏迟到响应
- **WHEN** a response arrives after switching project or session
- **THEN** it cannot overwrite the newly selected project, draft or artifact version

### Requirement: Required capability gaps remain owned tasks
Required capability gaps SHALL have a named owner, missing operation, deliverable, affected consumer task and linked owner OpenSpec task; fixture-only proof SHALL NOT close real usability tasks.

#### Scenario: 只有协议通过
- **WHEN** a required capability has passed fixture tests but not a real owner journey
- **THEN** the required capability remains unverified with an actionable task instead of being silently removed
### Requirement: 有界候选历史分页

DSH SHALL 通过新增可选 `readCandidatePage@1` 消费 owner 候选历史，不将完整历史塞进快照。请求 SHALL 使用 `creator.candidate-query.v1alpha1`，包含固定版本 ArtifactRef、1–100 的 limit 和可选 opaque cursor；返回 SHALL 使用 `creator.candidate-page.v1alpha1`，仅携带有界候选元数据、原引用及可选下一页游标，正文继续走显式授权读取。

#### Scenario: 换页保持领域状态不变
- **WHEN** 用户加载候选历史下一页
- **THEN** Host SHALL 查询 owner，校验当前选择、项目/会话/授权上下文、adapter generation 及返回引用版本，且不创建运行、候选、正式版本或费用执行

#### Scenario: 分页失败可恢复
- **WHEN** 游标失效、连接失败或请求期间切换上下文
- **THEN** Host SHALL 返回有界错误状态，客户端 SHALL 保留同一上下文已显示页并提供显式刷新入口，不自动重试；其他上下文的迟到页 SHALL 丢弃

#### Scenario: 旧消费者与旧 adapter
- **WHEN** 消费者未调用分页 Remote 或 adapter 未实现可选分页方法
- **THEN** 原快照、正文读取及动作合同 SHALL 保持不变，分页 SHALL 返回 unavailable，不解释旧 Workbench 标识

### Requirement: 显式声明的有界正文保存通道
文本台 SHALL 保留普通动作值的原有限制；只有当前动作描述明确绑定 textarea 字段及 UTF-8 字节上限时，才可使用独立 textBody。正文 SHALL 为合法 UTF-8 且最多 2 MiB。Host SHALL 在调用 owner 前拒绝重复正文、未声明的正文通道和超过描述限额的输入。保存 SHALL 保持原请求身份、当前 base 校验和 owner 回执语义；对账请求及持久化操作身份 SHALL 不含正文。

#### Scenario: 大文档完整保存
- **WHEN** 当前可写的 Auctra 正文超过普通参数的 16,384 字符上限，但不超过已声明的 2 MiB UTF-8 上限
- **THEN** 文本台通过同一 owner 保存动作提交完整正文，并从 owner 确认结果版本
- **AND** 超过上限一个字节时 SHALL 在 owner mutation 前拒绝，且保留编辑输入

#### Scenario: 大文档未知保存保持原身份
- **WHEN** 已提交的大文档保存响应丢失
- **THEN** 显式对账使用原请求键，不重发 textBody 或再次调用 apply
