# Spatial Board Deterministic Domain Rules 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.3` 已实现纯 Go Board deterministic domain 层：

- active/tombstoned Board 与 expected revision guard；
- revision overflow、stale revision 与 terminal tombstone fail-closed；
- registry-backed node type 与 relation validation；
- tenant-bound target binding、availability、target ref/version 与 group membership validation；
- canonical relation source/target matrix validation，不复制本地 matrix；
- self-loop、cross-board endpoint、legacy relation、非法 binding 与 unsafe token 拒绝；
- `relates_to` endpoint 字典序 canonicalization；
- bounded integer geometry、bounds、plain-text label 与 allowlisted style/label token；
- node geometry/display/group mutation 与 committed revision；
- group delete 的 non-empty membership guard；
- Board tombstone terminal transition；
- typed inverse commands，inverse 的 expected revision 固定为原 mutation committed revision；
- template placeholder/node/edge/group 的全量 sanitizer；
- template registry digest、limits、duplicate/dangling endpoint/group、matrix 与 binding policy validation；
- sanitizer 任一失败返回零值，不返回部分 graph。

实现资产：

```text
service/internal/boards/domain/model.go
service/internal/boards/domain/validation.go
service/internal/boards/domain/mutation.go
service/internal/boards/domain/template.go
service/internal/boards/domain/validation_test.go
service/internal/boards/domain/mutation_test.go
service/internal/boards/domain/template_test.go
service/internal/boards/domain/conformance_test.go
Taskfile.yml
```

## 2. Domain 边界

- Domain 只接收已认证 service context 提供的 tenant-bound `TargetBinding`，不读取 Owner 数据库、路径或 payload。
- Node availability 由外部 capability/target resolver 输入；`Available=false` 返回 `board_needs_contract`，浏览器 fixture 不能晋级。
- Relation compatibility 只调用 canonical registry snapshot 的 `Allows` 与 descriptor policy，不维护第二套 allowlist。
- Domain 不提交事务、不写 repository、不发布 event/outbox；这些原子性由后续 application service/repository task 实现。
- Inverse command 仍需重新经过 authority、target、revision 与 idempotency gate；它不是本地 canvas rollback 成功证明。
- Tombstone 不提供隐式复活 inverse；后续恢复必须是明确、版本化的新合同。

## 3. Stable Error 映射

当前 domain 使用以下安全 code：

```text
board_invalid_contract
board_invalid_ref
board_type_unsupported
board_relation_unsupported
board_relation_combination_invalid
board_version_conflict
board_limit_exceeded
board_needs_contract
board_template_invalid
board_tombstoned
```

错误不包含 style、label、target ref 内容、registry payload、SQL 或 provider diagnostic。

## 4. 验证与证据

```bash
task board:domain:test
task test:board-domain:component
CGO_ENABLED=0 go test ./service/internal/boards/domain -count=1
CGO_ENABLED=1 go test -race ./service/internal/boards/domain -count=20
```

Component evidence：

```text
temp/integration-test-runs/20260720204409-2697f7aa-ef6c-45a6-94d5-934f0fd3a085/
status=passed
exit_code=0
redaction=enabled
```

Fuzz gate 覆盖：

- randomized relation/source/target/ref 不能绕过 registry matrix；
- randomized geometry/target ref 不能绕过 bounds 与 safe-ref；
- `relates_to` 成功结果始终 canonicalized；
- legacy `belongs_to` 始终 fail-closed。

本轮观测到的 fuzz executions 超过 280k，另通过 pure-Go unit/vet 与 20 次 race repeat。

## 5. 未完成边界

- `1.5` 及后续 task 尚需实现 capability resolver 与 target tombstone projection。
- `2.x` 尚需实现 PostgreSQL/GORM graph repository、事务、outbox、cursor 与 spatial query。
- `3.x` 尚需实现 BoardService authority/idempotency/cost/application orchestration。
- `4.x` 尚需实现 HTTP/gRPC/JSON-RPC/SSE parity。
- `6.x` 尚需让 Web palette、canvas 与 undo rescue 消费真实 service/snapshot。
