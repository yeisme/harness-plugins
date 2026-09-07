# Board Graph CRUD / Typed Inverse 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `2.2c` 已完成 Node、Group、Edge 的 11 个 typed mutation command：

```text
CreateNode
UpdateNodeGeometry
UpdateNodeDisplay
MoveNodeGroup
DeleteNode
CreateGroup
UpdateGroup
DeleteGroup
CreateEdge
UpdateEdgeLabel
DeleteEdge
```

主要交付：

- 所有命令复用 principal → authority → digest replay → tenant-bound Board snapshot → domain → GORM transaction管线；
- create node只接收 `TargetResolver` 返回的 tenant/type/ref/version/availability safe binding，不读取 Owner payload；
- resolver未知错误归一为 `board target resolver unavailable`，不回传 Owner原始错误；context与已知 Board domain error保留；
- node type、target binding、geometry、group membership、style/label token、edge endpoint与relation matrix由 canonical Board registry/domain验证；
- `relates_to` 等需 canonical endpoint的 relation在 commit前规范化；
- delete node在存在 active incident edge时拒绝，delete group在存在 active member node时拒绝；
- delete只 tombstone Board-owned projection，不删除或修改 canonical target；
- 11 个命令均返回 typed inverse，inverse expected revision固定为原 mutation committed Board revision；
- create/update/tombstone在 repository command中分离，删除 generic upsert语义；create ref collision不覆盖已有资源并归一为 revision conflict；
- graph row、Board CAS、revision、mutation ledger、resource event、Board revision event与outbox保持同一 transaction；
- graph preflight replay按 tenant + Board + operation + idempotency digest约束，transaction内仍二次检查；
- concurrent graph writer针对同一 expected revision恰好一个成功，loser无 graph/revision/event/outbox幽灵记录。

实现资产：

```text
service/internal/boards/graph_service.go
service/internal/boards/service.go
service/internal/boards/ports.go
service/internal/boards/domain/model.go
service/internal/boards/domain/graph_mutation.go
service/internal/repository/board_graph_store.go
service/internal/repository/board_store.go
service/internal/repository/board_graph_service_test.go
service/internal/repository/board_graph_store_test.go
service/internal/repository/board_store_test.go
service/internal/boards/node_read_service.go
service/internal/boards/node_read_service_test.go
service/internal/runtime/board_target_resolver.go
service/internal/runtime/board_runtime_test.go
service/internal/transport/boardcommon/node.go
service/internal/transport/boardcommon/node_test.go
service/internal/transport/boardgrpc/server.go
service/internal/transport/boardhttp/handler.go
service/internal/transport/jsonrpc/board.go
packages/task-sdk/src/board-models.ts
packages/task-sdk/test/board-models.test.ts
tests/conformance/board-sdk-runtime.test.ts
Taskfile.yml
```

## 2. Typed inverse 矩阵

| Forward | Typed inverse |
|---|---|
| CreateNode | DeleteNodeCommand |
| UpdateNodeGeometry | UpdateNodeGeometryCommand(previous geometry) |
| UpdateNodeDisplay | UpdateNodeDisplayCommand(previous tokens) |
| MoveNodeGroup | MoveNodeGroupCommand(previous group) |
| DeleteNode | CreateNodeCommand(previous safe node) |
| CreateGroup | DeleteGroupCommand |
| UpdateGroup | UpdateGroupCommand(previous draft) |
| DeleteGroup | CreateGroupCommand(previous safe group) |
| CreateEdge | DeleteEdgeCommand |
| UpdateEdgeLabel | UpdateEdgeLabelCommand(previous label token) |
| DeleteEdge | CreateEdgeCommand(previous safe edge) |

当前成功调用返回 in-memory typed inverse；inverse持久化、restart后精确重放与重新授权提交明确属于新增 `2.2d1`，不能把本轮结果解释为 privileged rollback已经上线。

## 3. Repository 不变量

Graph write command只允许：

```text
CreateNodes / UpdateNodes / TombstoneNodeRefs
CreateGroups / UpdateGroups / TombstoneGroupRefs
CreateEdges / UpdateEdges / TombstoneEdgeRefs
```

固定约束：

- 同一 ref不能在同一 command中出现在多个 write mode；
- 所有资源属于 committed Board，resource revision等于 committed Board revision；
- update/tombstone只匹配 active + tenant + Board + ref；零行更新返回 not found并回滚 Board CAS；
- create使用唯一约束，不执行 conflict update；碰撞后 Board revision保持不变；
- query port只返回 active tenant-bound资源；group member与incident edge列表确定性排序；
- repository不实现 relation、target、permission或undo state machine。

## 4. 验证与证据

```bash
task board:service-graph:test
task test:board-service-graph:component
CGO_ENABLED=0 go test ./service/... -count=1
```

验证覆盖：

- 真实 GORM SQLite连续执行完整 11-command用户流；
- group与node guard失败后 Board revision保持不变；
- graph replay/conflict、ref collision、cross-tenant active query；
- canonical relation endpoint normalization与非法 matrix；
- inverse type与 expected revision矩阵；
- graph双写者 CAS + race detector重复 10 次；
- full `service/...` regression、vet与 `git diff --check`。

最终 component evidence：

```text
temp/integration-test-runs/20260720220235-80d2e202-803f-4291-8114-2026df47f3c5/
status=passed
exit_code=0
redaction=enabled
```

## 5. 当前 Node CRUD runtime slice

Node query/mutation 的本地 runtime 绑定已完成：HTTP、独立 JSON-RPC、gRPC 与 typed SDK 命中同一 `boards.Service`，repository 只返回 active tenant/Board-bound rows，projection 缺少 Owner contract 时显式为 `needs_contract`。`ProfileLocal` 的 synthetic resolver 只用于 opaque target ref 的本地状态机验证；managed profile 仍不绑定 resolver，因此不会被误报为 Owner/provider 可用。

component evidence：

```text
temp/integration-test-runs/20260801220020-a151dda5-3100-40a3-8f02-92bffefb424c/
status=passed
redaction.total_redactions=0
```

补充 integration evidence：

```text
temp/integration-test-runs/20260801222427-68f6fb3c-41c7-4780-ad83-e2009fa0da57/
status=passed
redaction.total_redactions=0
```

这不关闭 `1.5b`：managed publisher、隔离 PostgreSQL、restart/recovery、R1/R2 delegation/provider、browser 与 production gates 仍保持 pending；原有 11-command domain slice 也仍与 transport/runtime slice 分开计证。

## 5.1 当前 Group/Edge CRUD runtime slice

Group/Edge query 已通过 canonical service 与 active tenant/Board-bound keyset repository 接入；四种 transport 与 typed SDK 共享安全 `GroupView`/`EdgeView` projection、分页 cursor、error 与 revision 语义。runtime parity 覆盖跨 transport 创建 group/node/edge、更新 group/edge、Get/List、删除 edge、ungroup 与删除 group；local profile 只用于 bounded synthetic target resolver，managed profile 仍 fail-closed。

component evidence：

```text
temp/integration-test-runs/20260801224741-2e1a4d70-a94b-4f55-9ac9-2fdb7a3883fd/
status=passed
redaction.total_redactions=0
```

补充 integration evidence：

```text
temp/integration-test-runs/20260801225604-13445cce-6e18-42b6-a446-b97c24db887d/
status=passed
redaction.total_redactions=0
```

这仍不关闭 `1.5b` 或生产门：真实 PostgreSQL/restart、managed Owner target、R1 Identity delegation、R2 Eikona/provider、browser 与 production gates 尚未获得证据。

### 5.2 当前 graph repository/SDK 回归复核（2026-08-02 06:57）

本轮新增的节点/组/边 keyset list 与 Board revision guard 已通过同一 local runtime/service/repository 与 typed SDK 入口复核：`task test:board-node-crud:component` 证据为 `temp/integration-test-runs/20260802065728-29163365-ed7e-4aab-80c2-b963d0e52461/`，`status=passed`、`duration_ms=41420`、`redaction.total_redactions=0`；`task test:board-group-edge-crud:component` 证据为 `temp/integration-test-runs/20260802065728-b5ad2a92-1e3c-4e6c-a2f5-8ff9e8c4496f/`，`status=passed`、`duration_ms=41805`、`redaction.total_redactions=0`。这只刷新 local/component graph CRUD parity，不替代 managed target resolver、PostgreSQL/restart、Owner provider、R1/R2 或 production/browser gate。

## 6. 后续生产门

- `2.2d1`：新增 typed mutation outcome/before-after state持久化，支持 restart后 exact replay、inverse恢复与安全重提交；不得保存 generic JSON command/payload。
- `2.2d2`：实现 Template draft/publish/deprecate immutable lifecycle与checksum CAS。
- `2.2d3`：实现 placeholder resolve、atomic template apply、重新授权 undo/redo。
- `2.2e`：执行 live PostgreSQL、restart replay、连接池、secret scan与完整并发/fault gate。
- managed transport runtime 尚未绑定可用的 Owner target resolver/publisher；当前 managed 远程 API继续 fail-closed unavailable。只有 `ProfileLocal` 使用 bounded synthetic resolver，不构成 provider 或 production 证明。
