# Spatial Board 合同与 Relation Matrix 交付基线

## 1. 合同边界

首版冻结：

```text
board contract: workbench.board.v1alpha1
type registry: workbench.board_type_registry.v1
event contract: workbench.board_event.v1alpha1
```

Board只拥有图组织、视觉几何、group membership、模板、viewport、ACL引用、revision、event与tombstone。Target标题、状态、缩略信息来自当前actor授权的safe projection；Board不保存Owner canonical content、artifact bytes、raw prompt/provider payload、credential、private path或动态URL。

Full Canvas早期词汇作为设计来源，不作为运行时兼容合同。R4仅接受本文件冻结的type/relation id；旧fixture中的`belongs_to`必须迁移为`groupRef`，不得静默解释为edge。

## 2. 资源模型

| Resource | 必需字段 | 关键不变量 |
| --- | --- | --- |
| `Board` | contractVersion、tenant/workspace/board ref、name、revision、state、typeRegistryDigest、created/updated audit refs | tenant-bound；revision单调；delete为tombstone |
| `BoardNode` | board/node ref、targetType、targetRef、targetVersion、geometry、groupRef、styleToken、revision | target不嵌入projection body；geometry为bounded integer；group可空 |
| `BoardNodeProjection` | node ref、projectionState、title、subtitle、statusToken、thumbnailRef、sourceVersion、freshness | query-only；按当前authority生成；不得持久化为canonical node |
| `BoardEdge` | board/edge ref、relationType、sourceNodeRef、targetNodeRef、labelToken、workflowBindingRef、revision | endpoint必须存在且不同；组合必须在matrix中；binding仅特定relation可用 |
| `BoardGroup` | board/group ref、label、styleToken、collapsed、revision | membership由node.groupRef表示；不使用`belongs_to` edge |
| `BoardViewport` | board revision、bounds、zoomBucket、LOD、filters、cursor、pageSize | bounds/area/filter/page均bounded；cursor绑定query digest |
| `BoardCluster` | cluster ref、bounds、count、type/status summaries、sample node refs | far LOD only；不包含完整node projection |
| `BoardTemplate` | template ref/version/state、type registry digest、typed nodes/edges/groups、placeholder specs | immutable published version；apply全有或全无 |
| `BoardEvent` | event contract、source cursor、event ref/type、resource ref/revision、safe summary、observedAt | 至少一次；body不携带完整projection |
| `BoardCapabilitySnapshot` | dependency digest、node/relation availability、reason code、checkedAt、evidence refs | 与Workflow dependency snapshot同源；Web不可提升availability |

所有mutation request由server actor context确定tenant/principal；request不得接受`principalRef`、credential、Owner endpoint或任意metadata map。

## 3. Node Type Registry

| type | authority owner | R4默认availability | projection要求 |
| --- | --- | --- | --- |
| `asset` | R3 Asset Catalog / R2 Owner projection | `needs_contract`直到`0.1e` | safe title/kind/status/thumbnail ref/version |
| `work_item` | R3 WorkItemService | `needs_contract`直到`0.1e` | safe title/status/priority/assignee refs/version |
| `project` | R2 discovery + R3 catalog | `needs_contract`直到`0.1c/0.1e` | safe name/status/owner id/version |
| `member` | R1 Identity projection | `needs_contract`直到`0.1b` | display name/avatar ref/role token/membership version；无email授权键 |
| `task` | TaskService/R3 Daily | `needs_contract`直到`0.1e` | task state/gate/reconcile safe summary/version |
| `delivery` | R3 DeliveryService | `needs_contract`直到`0.1e` | manifest safe ref/child status/version |
| `workflow_definition` | R4 WorkflowService | R4 `5.3`后可用 | definition name/version/state/checksum |
| `workflow_run` | R4 WorkflowService | R4 `5.3`后可用 | run state/version/wait reason/safe progress |
| `note` | Workbench BoardService | R4 `2.2`后可用 | bounded plain-text label/summary；无HTML/URL/attachment body |

Node type descriptor必须包含type id、contract range、required dependency ids、projection schema ref、allowed relation source/target sets、default style token与availability。Snapshot按canonical type顺序计算`sha256:` digest。

### 3.1 Full Canvas词汇迁移

| 早期词汇 | R4 canonical表示 | 迁移规则 |
| --- | --- | --- |
| `AssetRef` | node.targetType=`asset` | target ref/version必须重新按R3 capability验证 |
| `WorkItemRef` | node.targetType=`work_item` | 缺R3 safe-ref contract时保留导入报告但不创建node |
| `ProjectRef` | node.targetType=`project` | 同时要求R2/R3 dependency snapshot可用 |
| `MemberRef` | node.targetType=`member` | 只接受R1 membership safe ref，不使用email |
| `Group` node | `BoardGroup` + node.groupRef | group不再是target node；group geometry/label迁移为group resource |
| `belongs_to` edge | node.groupRef mutation | edge本身不导入；冲突membership进入migration report |

迁移必须由版本化CLI/application service执行，输出bounded migration report与source/target digest；不得在runtime read时静默兼容旧shape。

## 4. Relation Matrix

Board relation只表达组织/观察意图，不自动修改WorkItem dependency、Owner graph、Task assignment或Workflow执行状态。

| relation | allowed source | allowed target | 特殊字段/规则 |
| --- | --- | --- | --- |
| `relates_to` | 任一node type | 任一node type | 禁止self-loop；无方向性展示，持久化时按node ref字典序规范source/target |
| `depends_on` | work_item、task、workflow_definition、workflow_run | asset、work_item、task、delivery、workflow_definition、workflow_run | 仅Board组织关系；不创建领域dependency |
| `blocks` | work_item、task、workflow_run | work_item、task、workflow_run、delivery | 仅展示；不能推进/阻塞canonical state |
| `assigned_to` | project、work_item、task、delivery、workflow_definition、workflow_run | member | 不执行Identity/WorkItem assignment command |
| `produces` | project、task、workflow_definition、workflow_run | asset、delivery | 不伪造lineage或delivery success |
| `reviews` | member、work_item、task、workflow_definition、workflow_run | asset、work_item、delivery | 不创建approval decision |
| `handoff_to` | asset、work_item、task、delivery、workflow_run | member、project、work_item、task、workflow_definition | 不自动emit delivery |
| `uses_asset` | project、work_item、task、workflow_definition、workflow_run | asset | 兼容Full Canvas id；仍为Board-only relation |
| `derived_from` | asset、delivery | asset、delivery | 不覆盖Owner canonical lineage |
| `feeds_input` | asset、work_item、project、task、delivery、note | workflow_definition | 可携带server-issued `workflowBindingRef`；只更新draft mapping，不publish/start |

首版不支持：

- `belongs_to` edge：group membership使用`BoardNode.groupRef`。
- arbitrary relation string、用户脚本条件、edge URL、raw metadata、跨Board endpoint。
- 对专用relation的未列source/target组合做隐式放宽；只有`relates_to`显式允许任意非self-loop node组合。

Relation descriptor snapshot固定relation id、source/target bitsets、directed flag、binding policy、label token policy和contract range；server与SDK从同一snapshot验证，Web只用于早期提示。

## 5. Geometry、样式与显示字段

- `x/y`范围`[-1_000_000, 1_000_000]` canvas units；`width/height`范围`[24, 4096]`；全部为integer，禁止NaN/Infinity与transport float drift。
- bounds面积、overscan和query complexity由server计算；客户端不得提供“unlimited”。
- `styleToken`、`statusToken`、`labelToken`来自allowlist，长度`1..64`；禁止CSS、颜色字符串、HTML、SVG、class name或任意icon URL。
- Board/name/group label/node label override为trimmed UTF-8 plain text，分别限制200/120/200 rune；错误不得回显原文本。
- thumbnail/file preview只使用R3 safe opaque ref，经same-origin BFF重新授权；Node不存授权URL。

## 6. Viewport、LOD与分页

LOD枚举：

```text
far, medium, near
```

| LOD | 返回内容 | 禁止 |
| --- | --- | --- |
| `far` | clusters、count/type/status summary、bounded sample refs | 完整node projection、每node subscription |
| `medium` | visible node geometry、title/status摘要、bounded edges | detail body、artifact bytes、全Board edges |
| `near` | visible node safe projection、interaction handles、bounded first-order edges | Owner raw content、无限关系扩展 |

默认/上限：page size 200/1000；node mutation batch 128；edge mutation batch 256；filter clauses 32；sort keys 4；cursor 512 bytes；event catch-up 1000。具体性能预算在`2.3/10.3`以PostgreSQL query plan与10k benchmark冻结，但不得放宽为无界请求。

Viewport cursor必须绑定tenant/workspace/board、board revision、bounds、zoom bucket、LOD、filter/query digest与expiry；任一变化返回stable cursor mismatch/resync，不沿用旧cursor泄漏其他区域数据。

## 7. Template合同

Template state：`draft`、`published`、`deprecated`。Published version不可变；编辑派生新version。

Placeholder只允许：

- `target_ref`：由server按声明node type与当前tenant/authority验证。
- `plain_label`：bounded plain text。
- `style_token`：allowlisted token。
- `workflow_definition_ref`：必须指向当前workspace可见draft/published definition，并遵守`feeds_input`规则。

Apply template在单事务中验证全部placeholder、node/relation matrix、group membership、limits、expected board revision和capability snapshot；任一失败零部分创建。Template不得携带Owner payload、dynamic URL、private path、credential、script或任意JSON map。

## 8. Command、Query与Event Surface

Commands：

```text
board.create
board.rename
board.tombstone
node.create
node.update_geometry
node.update_display
node.move_group
node.delete
group.create
group.update
group.delete
edge.create
edge.update_label
edge.delete
template.create_draft
template.publish
template.deprecate
template.apply
```

已持久化undo/redo重新发送上述typed inverse command和最新expected revision；不存在generic JSON patch、`command.reverse`或客户端直接回写revision。

Queries：

```text
board.get/list
board.viewport
node.get/list
edge.get/list
group.get/list
template.get/list
event.list/watch
capability.get
```

Events至少包含board/node/edge/group/template lifecycle与`board.revision_committed`。Event safe summary只包含resource type/ref/revision、change kind、actor/audit safe ref与reason code，不携带title、projection body、geometry batch或target content。

### 8.1 Proto/transport service surface

`WorkbenchBoardService`首版方法：

```text
CreateBoard, RenameBoard, TombstoneBoard, GetBoard, ListBoards
CreateNode, UpdateNodeGeometry, UpdateNodeDisplay, MoveNodeGroup, DeleteNode
CreateGroup, UpdateGroup, DeleteGroup
CreateEdge, UpdateEdgeLabel, DeleteEdge
QueryViewport, GetNode, ListNodes, GetEdge, ListEdges, GetGroup, ListGroups
CreateTemplateDraft, PublishTemplate, DeprecateTemplate, ApplyTemplate
GetTemplate, ListTemplates, ListBoardEvents, WatchBoardEvents
GetBoardCapabilities
```

每个mutation必须携带standard transport idempotency metadata与`expectedBoardRevision`；HTTP使用批准header，gRPC/JSON-RPC/SDK映射到同一规范字段。Server只持久化idempotency digest，不在event/error返回原key。每个operation使用typed request/response，不使用共享generic mutation body；response至少返回resource safe ref、committed board revision、event ref与replay标记。

`WatchBoardEvents`为server stream/SSE语义；独立JSON-RPC使用注册的event watch/cursor方法，不把MCP作为必需接口。Retention gap返回`board_resync_required`与当前safe revision，不发送伪造snapshot event。

### 8.2 当前 Board ListBoards runtime slice

`ListBoards` 已沿 canonical `boards.Service` → 可选 `BoardListStore` → GORM keyset query 接通。请求绑定 tenant、workspace、state、page token 与 bounded page size；分页 token 只使用当前 scope 内已存在的 Board safe ref，跨 workspace/state 的 cursor fail-closed 为 `invalid_argument`。HTTP `GET /v1alpha1/boards`、独立 JSON-RPC `ListBoards`、gRPC `ListBoards` 与 SDK facade 共享同一 `BoardPage` projection。

本地证据：

- `temp/integration-test-runs/20260801184726-b1056891-662d-4c10-bb16-ef423dc79a1e/`：`task test:board-list:component` 汇总 service、repository、HTTP、JSON-RPC、gRPC 与 runtime list parity，passed，redaction 0。
- `temp/integration-test-runs/20260801183922-af26ffb8-ae13-40e0-bb2d-c2b221524546/`：动态 SQLite runtime HTTP/JSON-RPC/gRPC list parity，passed，redaction 0。
- `temp/integration-test-runs/20260801183922-221c974f-76b1-4eab-923f-057ae8e660bf/`：真实本地进程 SDK `listBoards` live path，passed，redaction 0。

该 slice 仍属于 local/component/integration evidence；`1.5b` 要求的隔离 PostgreSQL parity、watch、完整 Board/Workflow promotion 与 provider/production gate 仍未完成。

### 8.3 当前 Board Node CRUD runtime slice

Node 图结构的本地纵向 slice 已沿 canonical `boards.Service` → 可选 `BoardNodeListStore` → GORM active-node keyset query 接通。Create/UpdateGeometry/UpdateDisplay/MoveGroup/Delete 复用同一 mutation service；Get/List 复用同一 Board contract、tenant、revision 与 fail-closed projection 规则。`ProfileLocal` 只注入 bounded synthetic target resolver，使本地测试可以验证完整状态机；managed profile 不注入该 resolver，仍保持 `board_target_unavailable`，不读取 Owner DB、网络或 credential。

HTTP、独立 JSON-RPC、gRPC 与 typed SDK 共享安全 `NodeView`/`NodePageView` projection；未接入 Owner projection 时返回 `needs_contract`，不伪造标题、状态、版本或 freshness。List 使用 Board/tenant 绑定的 keyset cursor，跨 scope 或非法 shape fail-closed。

本地证据：

- `temp/integration-test-runs/20260801220020-a151dda5-3100-40a3-8f02-92bffefb424c/`：`task test:board-node-crud:component`，service/repository/common projection、HTTP/JSON-RPC/gRPC、local runtime parity、race/vet、build 与 SDK live assertion 均 passed，`redaction.total_redactions=0`。
- `temp/integration-test-runs/20260801222427-68f6fb3c-41c7-4780-ad83-e2009fa0da57/`：`bun run test:integration` 的纯 Go conformance + runtime integration gate，包含 Node CRUD runtime test，passed，`redaction.total_redactions=0`。

该 slice 只证明 local/component runtime parity；不等同于 managed service、隔离 PostgreSQL、restart/recovery、R1/R2 handoff、provider 或 production/browser closeout。`ReconcileRun` 仍因现有请求合同缺少 external truth/evidence 而保持 contract-blocked。

### 8.4 当前 Board Group/Edge CRUD runtime slice

Group/Edge 的 canonical read/list 已沿 `boards.Service` → active tenant/Board-bound GORM keyset query 接通；Group/Edge mutation 与 Node/Board revision、idempotency、typed inverse 和安全 projection 复用既有 authority。HTTP、独立 JSON-RPC、gRPC 与 typed SDK 覆盖 Create/Update/Delete/Get/List；runtime parity 测试交叉验证 group、node、edge、ungroup 与删除顺序，避免 transport-specific state 或 orphaned graph。

本地证据：

- `temp/integration-test-runs/20260801224741-2e1a4d70-a94b-4f55-9ac9-2fdb7a3883fd/`：`task test:board-group-edge-crud:component`，service/repository/common projection、HTTP/JSON-RPC/gRPC、runtime parity、focused race/vet、build 与 SDK live assertion 均 passed，`redaction.total_redactions=0`。
- `temp/integration-test-runs/20260801225604-13445cce-6e18-42b6-a446-b97c24db887d/`：`bun run test:integration` 的纯 Go conformance + runtime integration gate，passed，`redaction.total_redactions=0`。

该 slice 仍是 local/component evidence；managed Owner resolver/publisher、隔离 PostgreSQL、restart/recovery、R1 Identity delegation、R2 Eikona canary、browser 与 production gate 继续保持 pending，不构成 provider 或 production 证明。

### 8.5 当前 Board QueryViewport runtime slice

`QueryViewport` 已由同一 `boards.Service` 通过 HTTP、独立 JSON-RPC、gRPC 与
typed SDK 暴露；runtime parity 断言相同的 board revision、LOD、节点/投影/边/组/cluster
数组与 cursor 结果，并保留 near LOD 缺少 resolver 时的 fail-closed 语义。

本地证据：

- `temp/integration-test-runs/20260801234255-e7852353-4651-4936-b919-17110194595d/`：`task test:board-viewport-runtime:component`，pure-Go、vet、race、workbenchd build 与 typed SDK live assertion 均 passed，`redaction.total_redactions=0`。

该 slice 仍属于 local/component runtime evidence；`2.3e` 的隔离 PostgreSQL、EXPLAIN/p50/p95、managed resolver、restart/recovery、R1/R2、provider 与 production/browser gates 继续保持 open。

### 8.6 当前 Board lifecycle mutation runtime slice

Board Create、Rename、Tombstone 与 Read 已沿同一 `boards.Service` 通过 HTTP、独立
JSON-RPC、gRPC 与 typed SDK 接通；parity 断言 committed revision、receipt/replay、
tombstone terminal state 与跨 transport read-after-write 一致。

本地证据：

- `temp/integration-test-runs/20260801234631-ce58c7ed-ffa8-4266-ae89-d7a0d7ee97ee/`：`task test:board-lifecycle-runtime:component`，runtime pure-Go、vet、race、workbenchd build 与 typed SDK live assertion 均 passed，`redaction.total_redactions=0`。

该 slice 仍属于 local/component runtime evidence；隔离 PostgreSQL、跨进程 restart/recovery、managed Owner resolver、R1/R2、provider 与 production/browser gates 继续保持 open。

## 9. Stable Errors

```text
board_invalid_contract
board_invalid_ref
board_type_unsupported
board_relation_unsupported
board_relation_combination_invalid
board_version_conflict
board_limit_exceeded
board_cursor_invalid
board_cursor_expired
board_resync_required
board_target_unavailable
board_needs_contract
board_not_authorized
board_template_invalid
board_tombstoned
```

Error detail只允许reason code、resource safe ref、expected/observed revision、required/observed contract range/digest和evidence refs；禁止SQL、query plan、filter body、title、target payload、URL/path与raw provider error。

## 10. 原子合同交付

| Slice | 产物 | 验证重点 |
| --- | --- | --- |
| `1.1a` | vocabulary、resource/field limits、node/relation matrix、operation/error/event list | 旧id映射、组合完整性、needs_contract、无任意字段 |
| `1.1b` | Proto、生成JSON Schema、Go assets | additive field numbering、safe refs、bounded arrays、forbidden field scan |
| `1.1c` | TypeScript models/client/normalizer | unknown field/enum fail-closed、cursor、expected revision、no raw maps |
| `1.1d` | canonical type/relation snapshot CLI与cross-language contract gate | deterministic digest、round-trip/tamper、Proto/Schema/SDK parity |

验证入口规划：

```bash
task board:contract:generate
task board:contract:check
task board:sdk:test
task board:type-registry:test
task test:board-contract:component
```

`1.1d`完成前，BoardService、Web palette和migration不得复制node/relation allowlist；任何consumer mismatch都必须保持`needs_contract`。
