## ADDED Requirements

### Requirement: Board MUST reference safe tenant-bound objects

Board MUST 只保存 Workbench-owned graph metadata与R3/R2 safe refs；MUST NOT 保存或修改 Owner canonical content、artifact bytes、private path、raw prompt/provider payload。

#### Scenario: 添加 Asset node
- **WHEN** 用户把当前tenant可见AssetEntry加入Board
- **THEN** Board MUST 保存tenant-bound target ref/type/version和受控display metadata
- **AND** Asset deletion/失权后node MUST 转为无敏感信息tombstone

#### Scenario: 删除 Board node
- **WHEN** 用户删除指向WorkItem或Owner resource的node
- **THEN** 只MUST 删除Board projection
- **AND** MUST NOT 删除、归档或改变target canonical object

### Requirement: Board node and edge types MUST be validated

BoardService MUST 使用版本化node type、edge relation matrix与显式display/binding字段白名单验证所有mutation；MUST NOT 接受任意metadata map。未知/不允许组合、cross-tenant ref与非法self-loop MUST 被拒绝。

首版node type MUST 仅为`asset`、`work_item`、`project`、`member`、`task`、`delivery`、`workflow_definition`、`workflow_run`、`note`。首版relation MUST 仅为`relates_to`、`depends_on`、`blocks`、`assigned_to`、`produces`、`reviews`、`handoff_to`、`uses_asset`、`derived_from`、`feeds_input`，并按canonical source/target matrix验证。Group membership MUST 使用`BoardNode.groupRef`；旧`belongs_to` MUST NOT 作为edge被静默接受。

Node/relation descriptor MUST 由同一canonical registry snapshot生成并固定contract range、projection schema ref、source/target set、binding policy与`sha256:` digest；Service、SDK、Web palette MUST NOT 复制独立allowlist。

#### Scenario: 非法 relation
- **WHEN** 用户尝试创建不在relation matrix中的edge或连接不兼容node types
- **THEN** service MUST 返回稳定validation error
- **AND** board revision与现有graph MUST 保持不变

#### Scenario: Legacy belongs_to edge is submitted
- **WHEN** 旧fixture或客户端提交`belongs_to` relation
- **THEN** service MUST fail-closed并要求迁移为typed `groupRef` command
- **AND** MUST 不创建edge、不修改group membership或board revision

#### Scenario: Registry digest differs across consumers
- **WHEN** API、SDK、worker或Web观察到node/relation registry ahead/behind或digest mismatch
- **THEN** Board mutation capability MUST 进入`needs_contract`
- **AND** 任一consumer MUST 不使用本地fallback matrix继续创建node/edge

### Requirement: Board geometry and presentation tokens MUST be bounded

Node geometry MUST 使用bounded integer canvas units：`x/y`范围`[-1_000_000, 1_000_000]`，`width/height`范围`[24, 4096]`。Style/status/label MUST 使用allowlisted token，不接受CSS、HTML、SVG、颜色字符串、class name、动态icon URL、NaN或Infinity。

#### Scenario: Node mutation contains arbitrary style
- **WHEN** request包含CSS颜色、HTML、SVG、class name或icon URL
- **THEN** service MUST 返回`board_invalid_contract`
- **AND** 错误 MUST 不回显原style内容且board revision保持不变

### Requirement: Board node availability MUST follow the shared dependency snapshot

Board合同 MAY 先包含允许的R1/R2/R3 node type，但Board palette、target resolver与mutation MUST 消费与Workflow相同的server capability snapshot；未晋级safe-ref contract的node type MUST 显示`needs_contract`并拒绝持久化target ref，浏览器静态配置或fixture MUST NOT 提升availability。

#### Scenario: Palette contains an unpromoted Daily node type
- **WHEN** Web已知道`asset`或`delivery`图标，但server capability snapshot缺少对应R3 contract range/digest/evidence
- **THEN** palette MUST 显示`needs_contract`且create-node command MUST fail-closed
- **AND** MUST 不保存fixture ref或允许Web绕过target resolver

### Requirement: Board mutations MUST be versioned and conflict-safe

Board/Node/Edge mutation MUST 使用expected revision和事务；客户端optimistic状态在冲突时 MUST 回滚并提供reload/reapply rescue。

#### Scenario: Concurrent node move
- **WHEN** 两个用户基于同一revision移动同一node
- **THEN** 第二个mutation MUST 返回version conflict及当前安全revision
- **AND** 客户端 MUST 保留意图并允许reapply，不能静默覆盖

#### Scenario: Undo remote mutation
- **WHEN** 用户undo一个已持久化mutation
- **THEN** 客户端 MUST 以source event ref、current expected Board revision和new idempotency key请求服务端可信undo executor
- **AND** executor MUST 从server-side typed outcome加载inverse、重新检查Board与inverse action权限并比较current state与原after-state
- **AND** delete inverse MUST 通过tombstone CAS、target/dependency/collision检查恢复原resource ref，不得由客户端提交before payload
- **AND** MUST NOT 仅修改本地画布伪造服务端成功

#### Scenario: Resume undo history in another session
- **WHEN** 另一客户端或刷新后的会话加载Board undo history
- **THEN** 服务 MUST 返回tenant/Board-bound、bounded、cursor-paginated typed descriptors并重新授权该query
- **AND** descriptor MUST NOT 包含raw command、before/after payload、idempotency key/digest、actor、Template values或Owner payload
- **AND** descriptor MUST 标记需要重新授权，不能充当可执行权限或current revision证明

#### Scenario: Undo conflicts with a later edit
- **WHEN** source mutation之后同一resource已被编辑、删除、恢复或产生新依赖
- **THEN** executor MUST 返回稳定version/dependency conflict且不写Board revision、event、outbox或新的outcome
- **AND** Web MUST 保留用户意图并提供reload、inspect history或显式reapply路径，不得覆盖后续事实

#### Scenario: Undo commits and reconnects
- **WHEN** executor成功提交但客户端在收到response前断线
- **THEN** 使用同一new idempotency key重试 MUST replay同一undo receipt
- **AND** Board watch/list-events MUST 以新mutation/event对账，客户端不得仅凭optimistic local inverse判定成功

### Requirement: Board viewport MUST use LOD and bounded queries

Board MUST 提供按viewport/zoom/filter/revision的bounded query与LOD/virtualization，不得要求浏览器常驻全部10k node detail或subscription。

#### Scenario: Far zoom viewport
- **WHEN** 用户在far zoom查看大Board
- **THEN** 服务 MUST 返回cluster/count/status摘要与bounded edge
- **AND** 浏览器 MUST 不请求每个node完整detail

#### Scenario: Oversized viewport query
- **WHEN** bounds/area/node/edge/filter/page复杂度超过限制
- **THEN** 服务 MUST 返回稳定limit error
- **AND** MUST 不执行无界scan或泄露内部spatial index信息

### Requirement: Board interactions MUST be accessible and responsive

pan/zoom/select/lasso/connect/group/filter/auto-layout/undo/redo MUST 有keyboard/touch可操作路径；mobile MUST 支持limited edit与完整view/rescue。

#### Scenario: Keyboard create edge
- **WHEN** keyboard-only用户选择source/target node并选择允许relation
- **THEN** Board MUST 创建与指针操作等价的typed command
- **AND** focus/live region MUST 宣布结果或冲突

### Requirement: Board asset orchestration and creative handoff MUST be contract-gated

Board MAY accept a cross-Pane asset drop only as a versioned typed payload containing exactly `assetRef` and `sourceVersion`. Before `CreateNode(targetType="asset")`, the client MUST re-read the safe Asset projection in the current tenant/workspace, verify source version/status/freshness/rights and capability, and submit current expected Board revision plus a new idempotency key. The client MUST NOT create a persisted-looking local asset node before a receipt returns.

Scaena handoff MUST consume an owner-issued typed descriptor and an approved host bridge. Board MUST NOT construct a URL, save a raw prompt/media payload/private path, or submit a generation request.

#### Scenario: Asset drag is stale, revoked, tombstoned, or needs contract
- **WHEN** a drop payload is malformed, source version changed, scope/rights no longer match, Asset is tombstoned/hidden/stale, or the Asset capability is unavailable
- **THEN** Board MUST reject the insertion without calling `CreateNode` and show a safe reason
- **AND** Board MUST NOT leave a ghost node or infer a fallback Asset contract

#### Scenario: Scaena descriptor or host bridge is absent
- **WHEN** the selected asset lacks a valid allowlisted Scaena descriptor or the host has no approved bridge
- **THEN** the Inspector MUST show `needs_contract`
- **AND** it MUST NOT display a constructed URL or generation-success state

#### Scenario: Scaena descriptor and bridge are both present
- **WHEN** a selected safe asset has a matching owner-issued descriptor and the host supplies an approved bridge
- **THEN** the Inspector MAY invoke that bridge with the typed descriptor
- **AND** it MUST NOT expose or derive an arbitrary URL

### Requirement: Board templates MUST be safe and versioned

Board template MUST 只包含允许node/edge schema、layout/style token和safe placeholder；应用template MUST 经过tenant/ref/permission/revision验证。

#### Scenario: Template 包含任意 URL 或 Owner payload
- **WHEN** template导入含动态URL、script、raw payload或private path
- **THEN** sanitizer MUST 拒绝template
- **AND** MUST 不部分创建Board graph

### Requirement: Board and workflow integration MUST remain declarative

Board MAY 展示workflow definition/run/step并生成draft input mapping，但画布连线或node创建 MUST NOT 直接dispatch Owner mutation。

#### Scenario: 连接 Asset 到 workflow node
- **WHEN** 用户创建允许的input relation
- **THEN** Board MAY 更新workflow draft mapping
- **AND** 只有服务端publish/start command通过schema/access/approval后才能创建run

### Requirement: Board events and target tombstones MUST be recoverable

Board mutation MUST 与event/outbox原子提交；watch MUST 使用source cursor支持duplicate、resume与retention gap。Target删除、tenant-wide失效或版本漂移 MUST 由tenant-aware resolver投影为安全tombstone，不读取或泄漏Owner raw content。仅对单一actor生效的授权拒绝 MUST 保持principal-scoped，不得修改共享Board revision或向tenant共享事件流发布该actor的失权事实。

#### Scenario: Board watch reconnects after duplicate delivery
- **WHEN** 客户端用旧cursor重连并收到重复event
- **THEN** 客户端 MUST 按event/source cursor去重且保持canonical board revision
- **AND** MUST 不重复apply node/edge mutation

#### Scenario: Target access is revoked
- **WHEN** Board node指向的Asset/WorkItem/Delivery不再对当前actor可见
- **THEN** resolver MUST 对该actor返回无敏感字段`not_authorized`投影并清除其客户端detail cache
- **AND** MUST 不修改共享Board revision、不发布tenant共享失权事件、不删除target或在错误/trace中泄漏其标题、路径或Owner payload

#### Scenario: Target is deleted or tenant-wide invalidated
- **WHEN** Owner通过批准的typed event确认target已删除、tenant-wide失效或canonical version漂移
- **THEN** reconciler MUST 以幂等Board mutation更新node safe projection state并原子发布无payload revision event/outbox
- **AND** MUST 不保存Owner raw content、动态URL、private path或原始event body

### Requirement: Board Pane MUST support fullscreen and safe detail preview

Board Pane MUST 支持docked、expanded、fullscreen与restore；detail/file/artifact preview MUST 使用R3 safe refs和授权projection，并保持viewport、selection、event cursor、focus与keyboard/touch操作连续。

#### Scenario: Fullscreen Board opens a file preview
- **WHEN** 用户从fullscreen Board node打开授权文件预览
- **THEN** preview MUST 在同一Pane shell或批准的detail Pane中展开，ESC/close后恢复Board viewport、selection与focus
- **AND** MUST 不接受node metadata中的动态URL、private path或raw artifact bytes

#### Scenario: Board Pane restores after refresh
- **WHEN** 浏览器刷新后恢复fullscreen或expanded layout
- **THEN** 系统 MAY 恢复安全layout/viewport ref并重新授权加载canonical Board snapshot
- **AND** MUST 不从layout storage恢复preview body、授权URL或Owner content

### Requirement: Board contracts MUST maintain transport parity and evidence

Board/Node/Edge/Viewport/Template operations MUST 在HTTP、gRPC、JSON-RPC与TypeScript SDK中保持type/revision/error/pagination/redaction一致，并通过10k node性能证据。

#### Scenario: Board conformance and performance run
- **WHEN** four-transport suite和10k node benchmark运行
- **THEN** graph/revision/conflict/viewport结果 MUST 一致并满足批准预算
- **AND** evidence MUST 包含版本、数据规模、profile、trace与redaction status
