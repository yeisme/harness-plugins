## ADDED Requirements

### Requirement: 生成表单草稿恢复
DSH SHALL 将生成表单草稿保存在独立的版本化 Host storage-domain，并按 tenant/workspace/project 与草稿 ID 隔离；草稿不是画布文档、领域正文或批准账本。

#### Scenario: 未完成输入恢复
- **WHEN** 用户关闭后恢复尚未填写完整的提示词引用、版本、尺寸、种子或变量
- **THEN** 原样恢复有界编辑文本，包括暂时无效输入；不自动创建准备、不自动批准或执行

#### Scenario: 未确认操作恢复
- **WHEN** 草稿保存了准备、批准或撤销未确认的观察
- **THEN** 保留未确认标记与已有安全引用，向 owner 对账后才更新显示；本地草稿不保存执行许可、凭据或 provider payload

### Requirement: 原操作对账不得重新提交
生成台 SHALL 使用原幂等键经共享Host对账入口查询唯一owner，不发送当前草稿参数。该入口 SHALL 校验当前上下文和回执归属；旧adapter未实现或查询失败时保持unknown。

#### Scenario: 查询被拒绝
- **WHEN** 原生成结果unknown且owner拒绝当前对账请求
- **THEN** 原生成仍为unknown，不能推断failed或重新提交生成

#### Scenario: 编辑后查询原操作
- **WHEN** 用户修改下一份草稿后点击核对原操作
- **THEN** 请求只携带原操作身份与当前授权上下文，不包含修改后的输入值

#### Scenario: 缺少原操作身份
- **WHEN** 界面无法恢复原幂等键
- **THEN** 明确报告无法定位原操作，不创建新键重试，不宣称恢复完成

### Requirement: Studio consumes Eikona as the only generation owner
The plugin SHALL read projects, assets and action descriptors only through the published Eikona contracts and SHALL NOT create a second provider runtime, asset ledger or version authority.

#### Scenario: Owner contract is unavailable
- **WHEN** the Eikona capability is absent or the contract mismatches
- **THEN** the studio reports an explicit unavailable reason and renders no fake assets or actions

### Requirement: Action discovery is server-authored
Generation, edit and batch actions SHALL be discovered through owner-issued descriptors covering input types, permissions, cost state and expected revision; the client SHALL NOT self-grant capability or fabricate cost.

#### Scenario: Mask editing is unsupported
- **WHEN** the owner contract does not expose a mask edit model
- **THEN** the entry stays disabled with an explicit reason and an owner follow-up task instead of a client-side image fallback

### Requirement: Candidates keep owner identity
Candidate reads and comparisons SHALL use explicitly authorized content or media ranges and SHALL keep owner, ref, version and freshness; list order SHALL NOT imply the latest adoption.

#### Scenario: A newer candidate exists
- **WHEN** the owner returns additional candidates after a comparison is opened
- **THEN** the comparison preserves the frozen set and offers an explicit refresh instead of silently swapping the adopted target

### Requirement: Adoption and writeback are separate owner actions
Candidate acceptance, file writeback and handoff SHALL each obtain an owner receipt with version and target scope; unknown outcomes SHALL require reconciliation of the original operation.

#### Scenario: Write outcome is unknown
- **WHEN** a writeback has no confirmed owner receipt
- **THEN** the studio preserves the candidate, reports unknown and does not replay the mutation or claim saved

### Requirement: Cancellation follows owner confirmation
Cancel SHALL request owner confirmation before displaying cancelled; generation continues to be observed through the existing subscription until the owner confirms.

#### Scenario: Cancel is requested while generating
- **WHEN** the user requests cancel during generation
- **THEN** the UI shows cancelling until the owner confirms and never marks the artifact cancelled locally

### Requirement: Real generation evidence is independent
Fixture and protocol checks SHALL NOT satisfy the real usability task; real loop evidence SHALL record fixture/real marking and owner capability.

#### Scenario: Only adapter fixtures passed
- **WHEN** adapter tests pass without a real Eikona generation loop
- **THEN** the real usability task remains incomplete

### Requirement: Default image model and supported controls
The studio SHALL default to openai/gpt-5.4-image-2 and expose only model-supported generation/edit controls; required unsupported actions SHALL retain disabled reasons and owner tasks.

#### Scenario: 模型或输入变更
- **WHEN** a user changes the model or reference after preview
- **THEN** the old preview is invalidated and confirmation requires a new owner preview

### Requirement: Versioned mask and partial batch editing
Reference regions and masks SHALL bind to source version and dimensions; a partial batch SHALL preserve successful candidates and never retry unknown members.

#### Scenario: 参考版本变化
- **WHEN** the reference image changes while a mask is being edited
- **THEN** the old mask remains recoverable and cannot be silently applied to the new image

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

### Requirement: Explicit candidate selection before adoption
The Host SHALL support an additive optional candidate selection operation carrying only a canonical artifact reference and fixed content digest. Selection SHALL be scoped to the complete current context and verified against the owner review projection. It SHALL NOT submit a review decision, grant media access or authorize execution. Existing injected-selection adapters SHALL remain compatible.

#### Scenario: 选择请求交错
- **WHEN** two selections overlap in one context and the earlier owner response arrives last
- **THEN** only the latest request may become selected and the earlier response cannot restore a previous candidate

#### Scenario: 失权与上下文隔离
- **WHEN** a requested selection cannot be verified or belongs to another session, project or authorization revision
- **THEN** it cannot authorize adoption in the current context; an unverified latest selection clears the prior selection for that context

#### Scenario: 有界临时选择
- **WHEN** the Host selection cache reaches its bound or its adapter is replaced
- **THEN** it may discard safe UI selections without changing owner decisions or cancelling operations, and discarded selections require explicit selection again

### Requirement: 撤销核对后继续编辑
DSH SHALL 仅在当前绑定的 owner 批准已确认撤销且用户明确选择继续时保存 approval_reconciled 草稿观察；该增量checkpoint保留批准/准备/digest/观察时间及可用的原执行引用，不代表取消原任务或恢复执行许可。

#### Scenario: 保存后解锁
- **WHEN** 用户选择保存撤销核对结果并继续编辑
- **THEN** 仅草稿保存确认后解锁；保存未知继续锁定，不再次批准或生成，旧消费者不识别新checkpoint时拒绝而不将其解释为editing

### Requirement: 图像生成独立执行准入
Host SHALL 以增量可选generationExecutionApproved控制生成提交，缺省拒绝；准备与预算批准权限不得替代执行权限。请求固定项目、批准与输入版本，复用原幂等键；响应未知不得自动重试。

#### Scenario: 执行权限缺失或迟到变化
- **WHEN** 执行权限缺失，或请求发送后受信连接/执行权限改变
- **THEN** 前者不发HTTP，后者不确认结果并保留原操作对账需求；不扩大旧准备和采用权限
