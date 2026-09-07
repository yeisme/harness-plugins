# Board Mutation Outcome / Inverse Ledger 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `2.2d1` 已完成 Node、Group、Edge mutation 的 typed before/after outcome持久化与 restart exact replay：

- 新增三张 tenant-bound normalized outcome表；每张表只保存对应资源的 safe typed fields，不保存 JSON command、raw idempotency key、Owner payload或任意 metadata；
- create保存 after，update保存 before + after，delete保存 before；after revision必须等于 committed Board revision，before revision必须早于 committed revision；
- operation type、resource type、before/after shape与 create/update/tombstone write mode在 `CommitCommand.Validate` 中一一匹配；
- mutation ledger插入、typed outcome、graph row、Board CAS、revision、event与outbox在同一 transaction；outcome唯一冲突会回滚此前全部写入；
- 每个 outcome计算 `sha256` digest，读取时重新计算；缺行或字段篡改返回稳定 `board mutation outcome is corrupt`，不能 fallback到 current row；
- replay返回原 mutation提交时的 Node/Group/Edge after state、原 committed revision/event与 typed inverse；后续 update/delete不改变历史 replay；
- delete replay返回原 resource safe ref、receipt与从 before state恢复的 create inverse；
- inverse由 operation + typed before/after state重建，不反序列化 opaque command blob；
- 新 Service实例对同一数据库执行 create/update/delete replay，证明结果不依赖进程内对象。

实现资产：

```text
service/internal/boards/ports.go
service/internal/boards/graph_service.go
service/internal/repository/board_outcome_models.go
service/internal/repository/board_outcome_store.go
service/internal/repository/board_store.go
service/internal/repository/board_graph_service_test.go
service/internal/repository/board_schema_test.go
service/internal/repository/gorm.go
Taskfile.yml
```

## 2. Schema 0007

```text
version=0007_board_mutation_outcome_foundation
checksum=sha256:3e8e53350f94a782ffc7d8cfe3fe3acfa48abad3000ba992bc5f5d1adf5651da
```

新增表：

```text
board_node_mutation_outcomes
board_group_mutation_outcomes
board_edge_mutation_outcomes
```

每张表均包含：

```text
tenant_ref
mutation_id
board_ref
resource_ref
operation_type
outcome_digest
before_present + typed before_* columns
after_present + typed after_* columns
```

`mutation_id` 一对一唯一，resource索引按 tenant + Board + resource组织。0006→0007 migration为 additive；验证保留已有 Board row与0006历史 migration record。

## 3. Exact replay / inverse 矩阵

| Mutation | Replay result | Rebuilt inverse |
|---|---|---|
| create node/group/edge | immutable after state | typed delete |
| update geometry/display/group/edge label | immutable after state | typed update with before fields |
| move node group | immutable after state | move to before group |
| delete node/group/edge | safe ref + original receipt | typed create with before state |

Replay仍先经过 authentication与authority；outcome ledger不授予权限，也不能作为 privileged rollback。真正执行 inverse仍必须在 `2.2d3` 重新经过 target/capability、expected revision、idempotency与最新authority。

## 4. 验证与证据

```bash
task board:mutation-outcome:test
task test:board-mutation-outcome:component
CGO_ENABLED=0 go test ./service/... -count=1
```

覆盖：

- node/group/edge create/update/delete在later mutation与tombstone后的restart exact replay；
- 11种 inverse expected revision与关键 before field恢复；
- typed outcome字段篡改 fail-closed；
- outcome insert唯一冲突导致全 transaction rollback；
- malformed operation/outcome/write mode拒绝；
- 0006→0007 additive migration与fresh schema/index/safe-column检查；
- race detector重复10次、full service regression、vet、CLI migrate/check与 `git diff --check`。

最终 component evidence：

```text
temp/integration-test-runs/20260720221735-bad9861e-65b9-4b85-b4ca-df17e74efe53/
status=passed
exit_code=0
duration_ms=26213
redaction=enabled
```

## 5. 未完成边界

- Template draft/publish/deprecate lifecycle属于 `2.2d2`。
- atomic template apply与重新授权 undo/redo执行属于 `2.2d3`。
- live PostgreSQL、restart connection pool/fault、secret scan与最终并发矩阵属于 `2.2e`；当前没有 live PostgreSQL evidence。
- Board transport runtime仍未绑定，远程调用继续稳定 unavailable，不能宣称 API上线。
