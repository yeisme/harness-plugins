## ADDED Requirements

### Requirement: Workbench 必须以 exact owner tuple 组合空间复刻工作区

`SpatialReplicaWorkspaceProjectionV1` SHALL 使用 Anatomia evidence、Scaena ReplicaStage、optional Auctra screenplay、Workbench Task/receipt 的明确 owner、contract、resource identity、version、digest 和 freshness 组成 exact tuple。投影 MUST 标明各 segment 非原子获取，不得把多 owner 组合描述为同一事务快照。

#### Scenario: 所有 owner segment 均可验证

- **WHEN** 请求的 episode/shot 在各 owner 中均存在且 contract、scope、version、digest 可验证
- **THEN** composition service SHALL 返回 exact segment tuple、各 segment currentness 和 `composition_token`
- **AND** SHALL 标明 projection 是可重建的 non-atomic read model

#### Scenario: 两个 owner 的 shot identity 无法闭合

- **WHEN** Anatomia 与 Scaena segment 引用的 episode、shot 或 source identity 不一致
- **THEN** composition service SHALL 拒绝闭合该 join
- **AND** SHALL 返回 bounded `identity_mismatch`，不得猜测或按显示名合并

### Requirement: Workbench 不得保存第四套 canonical 空间复刻状态

Workbench SHALL NOT 持久化 owner screenplay body、storyboard graph、ReplicaStage geometry、motion canonical copy、dense evidence、artifact bytes 或跨 owner canonical join。Workbench MAY 保存既有 Task/event safe index、layout metadata 和短 TTL 可丢弃 projection cache，但这些数据 MUST 可从 owner projection 重建且不得成为 mutation authority。

#### Scenario: 用户关闭并重新打开空间复刻 Pane

- **WHEN** 浏览器 local presentation state 已被清理且用户重新打开同一 shot
- **THEN** Workbench SHALL 从 owner safe projections 重建工作区
- **AND** SHALL NOT 从本地或 Workbench 数据库恢复一份 ReplicaStage canonical copy

#### Scenario: Projection cache 与 owner current state 不一致

- **WHEN** cache 中的 segment version 已落后于 owner current version
- **THEN** Workbench SHALL 将该 segment 标为 stale 或重新获取
- **AND** SHALL NOT 以 cache 内容批准 mutation

### Requirement: 每个 owner segment 必须独立表达 readiness 与 currentness

Projection SHALL 为每个 owner segment 提供 `readiness ∈ {available,degraded,offline,needs_contract,contract_mismatch,permission_required,unavailable}`、`currentness ∈ {current,last_confirmed,stale,revoked,unknown}`、`last_confirmed_at`、contract/version/digest 和 bounded limitations。单个 owner degraded/offline/needs_contract/stale/permission_required/revoked MUST NOT 被折叠成整个 workspace 的虚假 ready，也不得遮蔽仍可验证的其他 segment。Transport `permission_denied`/`not_found` MUST 使用既有 existence-hiding safe error 语义，不得通过 projection 泄露资源是否存在。

#### Scenario: Auctra 不可用而 Anatomia 与 Scaena 可用

- **WHEN** screenplay segment 返回 `offline`，但 source evidence 与 ReplicaStage segment current
- **THEN** Workbench SHALL 继续展示可验证的 source/stage 审阅内容
- **AND** SHALL 将 Auctra Pane 标为 offline，并禁用仅依赖 screenplay 的动作

#### Scenario: Scaena stage stale

- **WHEN** Scaena segment 的 expected version 落后于 owner current version
- **THEN** Workbench SHALL 显示 stale 边界和 last-confirmed 信息
- **AND** SHALL 禁用基于旧 stage 的 edit/review/freeze descriptor

### Requirement: Owner projection 必须通过 scope 与 contract fail closed

Composition service MUST 验证 principal、project、episode/shot scope、contract name/version、schema、字段 allowlist、大小预算和 ref 形态。未知字段、不安全字段、private path、signed URL、credential、raw prompt、Provider payload、biometric template/face embedding、未授权真实身份标签或超预算 segment SHALL 导致该 segment 被拒绝并返回 redacted `contract_mismatch`。Actor/person 只能以 project-scoped pseudonymous safe ref 与批准的 bounded motion/skeleton projection进入 Workbench。

#### Scenario: Owner segment 泄露 private path

- **WHEN** connector 返回包含本地文件路径、credential 或未批准 URL 的 payload
- **THEN** composition service SHALL 拒绝该 segment
- **AND** browser projection SHALL 只收到 redacted error code 与安全 recovery hint

#### Scenario: Principal 无 episode scope

- **WHEN** authenticated principal 可以访问 workspace 但无目标 episode/shot scope
- **THEN** service SHALL 返回 existence-hiding safe error，并将可见 readiness 投影为 `permission_required` 或 unavailable
- **AND** SHALL NOT 获取或缓存对应 owner payload

#### Scenario: Owner segment 包含 biometric identity payload

- **WHEN** owner connector 返回 face embedding、biometric template、未授权真实姓名或跨项目可关联的 person identifier
- **THEN** composition service SHALL 拒绝该 segment 并返回 redacted `contract_mismatch`
- **AND** SHALL NOT 将敏感字段写入 browser、cache、log、receipt、fixture 或 test evidence

### Requirement: Browser 必须只消费一个 Workbench workspace event stream

Workbench SHALL 为空间复刻 workspace 提供一个 server-owned stream，聚合安全的 freshness、availability、Task 和 owner receipt 事件。事件 MUST 携带 Workbench workspace cursor；owner-originated 事件还 MUST 携带 owner cursor/sequence。Browser MUST NOT 为每个 Pane 或 owner 建立直接权威连接。

#### Scenario: Browser reconnect 且 cursor 可续接

- **WHEN** workspace stream 中断后使用有效 cursor 重连
- **THEN** server SHALL 从可用位置续传去重后的安全事件
- **AND** panes SHALL 共享同一 workspace stream 状态

#### Scenario: Cursor gap 无法续接

- **WHEN** server 无法从 browser 提交的 cursor 保证连续恢复
- **THEN** server SHALL 发出既有 `resync_required` control/error 与 snapshot recovery hint
- **AND** browser SHALL 重新获取 projection 后再应用后续事件，不得猜测缺失状态

### Requirement: Media 与 artifact 访问必须经过 same-origin 安全边界

Browser SHALL 只请求 Workbench same-origin BFF 暴露的授权 preview/media routes。BFF MUST 重新验证 principal/scope、限制 method/header/body/range/timeout/content type，并 MUST NOT 将 owner credential、private locator 或内部 host 暴露给 browser。数值 evidence artifact 与可视 preview MUST 保持不同的 typed ref 和用途。

#### Scenario: Browser 请求授权 source range

- **WHEN** principal 对 source media 有权限且请求合法 byte range
- **THEN** BFF SHALL 代理 bounded range 并返回安全 media headers
- **AND** SHALL NOT 返回 owner credential 或原始 private locator

#### Scenario: Preview ref 被用于数值分析

- **WHEN** client 尝试把仅供显示的 preview ref 作为 depth/camera 数值 artifact 使用
- **THEN** typed facade SHALL 拒绝该用途
- **AND** SHALL 要求具有 coordinate/unit/provenance 的 numeric artifact ref

### Requirement: composition_token 不得充当 mutation authority

`composition_token` SHALL 只用于检测 UI projection 是否变化。执行 owner action 前，server MUST 重新解析 action descriptor、principal、owner current version、scope、capability 和 idempotency key；不得仅因 composition token 匹配而放行。

#### Scenario: Token 未变但 action descriptor 已撤销

- **WHEN** browser 提交旧 descriptor 且 composition token 仍相同，但 owner capability 已 revoked
- **THEN** server SHALL 拒绝 action
- **AND** SHALL 返回 revoked/stale recovery state，不得沿用旧权限
