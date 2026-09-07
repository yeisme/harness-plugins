# BoardStore Transaction / Idempotency / Event-Outbox 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `2.2a` 已完成 Board mutation 的 GORM transaction foundation：

- 新增 transport-neutral `BoardStore` port、typed `ReplayRequest` / `CommitCommand` / `GraphChanges` / `EventRecord` / `CommitResult`；
- port 只表达 domain 已决定的 Board/Node/Group/Edge writes，不接受 generic map、JSON patch、transport DTO 或 feature handler；
- 新增 workspace-scoped `board_mutations` ledger，`board.create` retry 不需要调用方预先知道 `board_ref`；
- 原始 idempotency key 不落库，ledger 与 revision 只保存 `sha256` digest；
- 新增 `board_events`、`board_outbox` 与 `boards.event_sequence`；
- 每个 commit 至少包含 resource lifecycle event与 `board.revision_committed`，source sequence连续；
- create/CAS Board、typed graph writes、revision、mutation ledger、safe events 与 outbox 在同一 GORM transaction 提交；
- 相同 idempotency digest + request digest 返回 replay；相同 digest + 不同 request digest 返回 conflict；`2.2b` 增加显式 preflight replay port，同时保留 transaction内竞态保护；
- stale expected revision 不覆盖 winner，不产生 mutation/event/outbox；
- event/outbox 后段唯一冲突会回滚此前 Board CAS 与 graph writes；
- SQLite transaction lock/deadlock只在未提交 transaction 内做最多 5 次有界重试，业务 revision/idempotency conflict不重试；
- create board ref collision稳定归一为 revision conflict；
- catalog/transport/task状态机不进入 repository。

实现资产：

```text
service/internal/boards/ports.go
service/internal/boards/ports_test.go
service/internal/repository/board_store.go
service/internal/repository/board_store_test.go
service/internal/repository/board_models.go
service/internal/repository/board_schema_test.go
service/internal/repository/gorm.go
service/internal/repository/gorm_test.go
Taskfile.yml
```

## 2. Schema 版本

`2.2a` 交付时 additive schema（现为历史 transaction foundation；current schema已由 `2.2d1` 推进至0007）：

```text
version=0006_board_transaction_foundation
checksum=sha256:9223bcf8fb21180f8af64d616f0ffa22177351fe9cb6f875de595da811b0d556
```

新增：

```text
boards.event_sequence
board_mutations
board_events
board_outbox
```

关键唯一/claim 索引：

```text
idx_board_mutation_idempotency
  tenant_ref + workspace_ref + operation_type + idempotency_digest

idx_board_event_sequence
  tenant_ref + board_ref + sequence

idx_board_outbox_event
  event_ref

idx_board_outbox_claim
  tenant_ref + status + available_at_db
```

三张 transaction table 不含 `idempotency_key`、payload、content、metadata、credential、private path 或 artifact blob。

## 3. Commit 不变量

`CommitCommand.Validate()` 在 repository 前固定：

- tenant/workspace/board refs、operation、digest、audit refs和时间合法；
- create 必须 `active` + revision 1；update 必须 `expected + 1`；
- tombstone 必须有 typed reason code 与 tombstoned time；
- Board final event sequence 与 event 数量/起始 sequence一致；
- lifecycle + revision event 均存在，resource revision等于 committed Board revision；
- primary event resource与 mutation ledger resource一致；
- node/group/edge 只属于当前 Board，revision等于 committed revision；
- 同一 resource不能在一个 command中同时 upsert与 tombstone；
- template capability不作为未实现占位暴露，后续 `2.2d` 使用独立 typed transaction port。

Repository transaction 顺序：

```text
replay/conflict lookup
  -> create or expected-revision CAS
  -> typed graph writes/tombstones
  -> board revision
  -> safe events + one-to-one outbox
  -> mutation digest ledger
  -> committed receipt
```

任一步失败，transaction 全部回滚。

## 4. 验证与证据

```bash
task board:store-contract:test
task test:board-store-contract:component
CGO_ENABLED=0 go test ./service/internal/boards/... ./service/internal/repository ./service/cmd/workbench-migrate -count=1
CGO_ENABLED=1 go test -race ./service/internal/repository -run 'CommitBoard|BoardTransactionSchema' -count=10
```

额外稳定性检查：

- concurrent revision CAS 普通模式重复 30 次；
- concurrent revision CAS race 模式重复 10 次；
- 每轮只有一个 writer成功，另一个稳定 revision conflict；
- winner 后只有 2 条 mutation ledger、4 条 event、4 条 outbox（含 create）；loser 无幽灵记录；
- 当时临时数据库实际执行 `workbench-migrate` 与 `check`，输出 `0006` matching checksum；当前 CLI由 `2.2d1` 输出0007；
- Go unit、full repository regression、vet、race 与 `git diff --check` 通过。

Component evidence：

```text
temp/integration-test-runs/20260720212815-784131ce-ea70-4dad-b43b-167029c025da/
status=passed
exit_code=0
redaction=enabled
```

## 5. PostgreSQL 与未完成边界

- 配置 `WORKBENCH_TEST_POSTGRES_URL` 时，现有 PostgreSQL integration gate会检查 mutation/event/outbox tables 与 idempotency/event/outbox indexes；本轮未配置 live PostgreSQL，不声明 PostgreSQL production evidence。
- `2.2a` 只交付 transaction port/repository，不声明 BoardService authority或18个 API mutation已实现。
- `2.2b` 仍需实现 create/rename/tombstone service lifecycle。
- `2.2c` 仍需实现完整 Node/Group/Edge domain mutation与typed inverse orchestration。
- `2.2d` 仍需实现 template lifecycle、atomic apply 与重新授权 undo/redo。
- outbox publisher、retention/gap/watch 与 target tombstone resolver仍属于 `2.4`。
