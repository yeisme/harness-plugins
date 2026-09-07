## ADDED Requirements

### Requirement: 空间复刻 Pane types 必须 additive 注册

Workbench SHALL 在现有 versioned Pane registry 中 additive 注册 `agent.spatial-replica.v1`、`agent.spatial-replica-inspector.v1`、`agent.auctra-screenplay.v1`、`agent.scaena-storyboard.v1` 和 `agent.owner-receipts.v1`。每个 Pane MUST 具有独立 contract/version、availability、permission、loading/error boundary 和 focus-return metadata。

#### Scenario: Server capability 发布 Replica Pane

- **WHEN** principal、route 与 server capability 允许 `agent.spatial-replica.v1`
- **THEN** existing Pane factory SHALL 创建该 Pane
- **AND** existing shell/layout/composer/session state SHALL 保持不变

#### Scenario: 未知 Pane version

- **WHEN** saved layout 或 deep link 请求 client 不支持的 Pane version
- **THEN** registry SHALL fail closed 并显示 unsupported pane state
- **AND** SHALL NOT 降级到不兼容 renderer

### Requirement: 所有 Pane 必须复用唯一 shell、registry、composer 与 stream

Spatial replica Pane family MUST 复用 `/agent` shell、single composer、session store、layout reducer、Task client、ProposalAuthority 和 workspace event stream。实现 MUST NOT 新建并列 Replica Studio route、第二 composer、第二 registry、Pane 私有 owner client 或独立 event authority。

#### Scenario: 用户进入 Spatial Focus

- **WHEN** main Replica Pane 请求 contextual Spatial Focus layout
- **THEN** conversation、composer、session identity 和 workspace stream SHALL 继续由现有 shell 持有
- **AND** mode switch SHALL NOT 创建新的 canonical session

### Requirement: Auctra screenplay Pane 必须只展示批准的 safe projection

`agent.auctra-screenplay.v1` SHALL 展示 Auctra 已发布 safe metadata/text projection、canonical version/currentness、scene/beat/line refs、review state、allowed actions 和 approved deep links。若 owner contract 只允许 metadata，Pane MUST NOT 通过私有页面、filesystem 或未批准 endpoint 获取正文。

#### Scenario: Auctra safe text contract 可用

- **WHEN** Auctra 返回当前 screenplay projection 与允许显示的 scene/beat/line text
- **THEN** Pane SHALL 渲染 owner-authored hierarchy/text 和 version
- **AND** Workbench local selection/grouping SHALL NOT 改写 screenplay structure

#### Scenario: 仅 metadata contract 可用

- **WHEN** Auctra 未授权 screenplay body
- **THEN** Pane SHALL 显示 metadata、currentness 和 approved owner deep link
- **AND** SHALL NOT 抓取或 iframe 私有 Auctra 页面

### Requirement: Scaena Pane 必须独立表达 storyboard 与 ReplicaStage 状态

`agent.scaena-storyboard.v1` SHALL 显示 Scaena storyboard、SceneGEO、ReplicaStage、motion/review/freeze 的安全 refs、versions、quality/currentness、mode 和 allowed actions。它 MUST 区分 `reference_evidence` 与 `screenplay_driven`，不得在 Auctra unavailable 时静默改变 mode。

#### Scenario: reference_evidence stage 可用

- **WHEN** stage 仅绑定 Anatomia evidence 且 Scaena 声明 mode 为 `reference_evidence`
- **THEN** Pane SHALL 显示明确 mode、evidence refs 和 stage status
- **AND** SHALL NOT 要求或伪造 screenplay binding

#### Scenario: screenplay_driven 的 Auctra binding stale

- **WHEN** Scaena stage current 但绑定的 Auctra version stale
- **THEN** Pane SHALL 显示 screenplay binding stale/limited
- **AND** SHALL 禁用依赖 current screenplay 的 review/freeze action，不得切为 reference mode

### Requirement: Owner receipt Pane 必须保留来源与序列语义

`agent.owner-receipts.v1` SHALL 组合 Workbench Task events 与 owner receipts，但 MUST 为每条事件保留 source owner、Task/receipt ref、owner sequence/cursor、workspace cursor、event time、observed time、status 和 currentness。UI MUST NOT 声称跨 owner global exactly-once 或统一 transaction order。

#### Scenario: 两个 owner receipt 时间交错

- **WHEN** Anatomia 与 Scaena receipt 的 observed order 不同于各自 owner sequence
- **THEN** timeline SHALL 分别展示 source sequence 和 Workbench observed order
- **AND** SHALL NOT 合成不存在的全局事务顺序

#### Scenario: Receipt stream gap

- **WHEN** owner cursor gap 被检测到
- **THEN** Pane SHALL 标记 gap/reconcile required
- **AND** affected action terminal state SHALL 保持 unknown，直到 snapshot/receipt reconcile

### Requirement: Pane 不可用时必须保持 truthful availability

每个 Pane SHALL 独立支持 `loading`、`empty`、`needs_contract`、`partial`、`stale`、`offline`、`permission_required`、`revoked`、`error` 和 `unsupported_version`。一个 Pane 不可用 MUST NOT 让其他 Pane 伪装成 owner fallback，也不得用 mock content 冒充 current data。

#### Scenario: Scaena owner offline

- **WHEN** Scaena projection 无法获取但 Anatomia evidence current
- **THEN** Scaena Pane SHALL 显示 offline 与 last-confirmed 信息
- **AND** Replica Pane SHALL 继续 source/evidence 审阅但禁用 stage-dependent actions

### Requirement: Pane 数量上限不得静默替换用户上下文

Pane family SHALL 使用现有 preferred 1–3、hard 4 visible Pane limit。当达到硬上限时，打开额外 owner Pane MUST 返回 `limit_reached` 并提供关闭/替换选择；Workbench MUST NOT 自动关闭 conversation、active draft 或其他 Pane。

#### Scenario: 四个 Pane 已可见

- **WHEN** 用户尝试打开第五个 owner Pane
- **THEN** Workbench SHALL 显示 limit state 与现有 Pane 列表
- **AND** 只有用户明确选择后才可关闭或替换 Pane

### Requirement: Owner deep link 必须经过批准且不得嵌入私有页面

Pane MAY 显示 owner 提供的 approved deep link descriptor。Workbench MUST 验证 scheme/host/path template/scope，并使用安全新窗口或现有导航策略；MUST NOT iframe、代理整页或加载 owner private UI 成为 Pane 实现。

#### Scenario: Owner 返回未批准 host

- **WHEN** deep link descriptor 指向 allowlist 之外的 host 或包含 credential query
- **THEN** Workbench SHALL 拒绝该 link 并记录 redacted contract mismatch
- **AND** SHALL NOT 将 URL 发送给 browser
