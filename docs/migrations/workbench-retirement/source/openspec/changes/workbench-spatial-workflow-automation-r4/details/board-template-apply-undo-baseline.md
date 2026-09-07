# Board Template Apply / Reauthorized Undo 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `2.2d3a-d` 已完成 Template deterministic expansion、atomic apply、可信 application revert 与 redo基线：

- Template placeholder消费合同补齐 node/group 的 target/workflow-definition/label/style binding位置；所有声明placeholder必须被typed consumer引用，missing/extra/duplicate/type mismatch均fail-closed；
- `ApplyTemplate`只接受published exact version，重新检查tenant/workspace、canonical registry digest、required/default values、target resolver、group membership、relation matrix、limits与generated ref collision；
- placeholder values按ref canonical排序，输入顺序不影响request digest或domain plan；server分配group/node/edge refs，客户端不能提交checksum或revision；
- 全部group/node/edge使用同一个next Board revision；graph rows、Board CAS、resource events、revision event、outbox、mutation ledger与application outcome在一个GORM transaction提交；
- application outcome使用parent + node/group/edge normalized typed rows保存原始created state，不保存values JSON、raw idempotency key或Owner payload；later edit/delete后restart replay仍返回original apply结果与typed inverse；
- `RevertTemplateApplication`以可信`application_event_ref + template_ref`加载server outcome，不接受客户端提供任意批量refs；仅当所有applied resources仍与original outcome完全一致时才原子tombstone；
- revert每次重新执行Board与Template authority、latest expected Board revision和新idempotency gate；资源已编辑/删除、权限撤销或并发loser均拒绝且不写ghost revision/event/outbox；
- tombstone顺序固定edge -> node -> group；任一失败回滚此前tombstone和Board CAS；
- redo不是恢复旧行，而是以latest expected revision和新idempotency key重新调用`ApplyTemplate`，重新解析target并生成新refs。

实现资产：

```text
service/internal/boards/domain/template_apply.go
service/internal/boards/domain/template_apply_test.go
service/internal/boards/domain/template_revert.go
service/internal/boards/domain/template_revert_test.go
service/internal/boards/template_apply_service.go
service/internal/boards/template_revert_service.go
service/internal/repository/board_template_store.go
service/internal/repository/board_outcome_models.go
service/internal/repository/board_outcome_store.go
service/internal/repository/board_template_apply_service_test.go
api/proto/workbench/board/v1alpha1/board.proto
packages/task-sdk/src/board-models.ts
packages/task-sdk/src/board-client.ts
packages/task-sdk/src/http.ts
Taskfile.yml
```

## 2. Schema 0009 / 0010

```text
historical_version=0009_board_template_binding_foundation
historical_checksum=sha256:96bb6b785ab8a968329e95d098fb2c3dd5541460ad27feccd5d6c5a867703a1f
template_application_version=0010_board_template_application_outcome_foundation
template_application_checksum=sha256:4c37aaee50ec296c6cde93587b7a31b81db3a59d29e13e3999ad4eba97d712a6
viewport_index_version=0011_board_viewport_query_indexes
viewport_index_checksum=sha256:c12fca86074b3ad017c95458e4f9d642fed6248db6976105279d03a7ae87171c
current_version=0012_board_event_retention_foundation
current_checksum=sha256:256293c4ee4731d2f910ebb2e2e73895b360fc45696582723366f5870e0bb714
```

`0009` 为 template node/group增加nullable placeholder binding columns；新Go字段使用`json:",omitempty"`，空值时保持`0008` canonical checksum字节完全不变。`0010`新增：

```text
board_template_application_outcomes
board_template_application_node_outcomes
board_template_application_group_outcomes
board_template_application_edge_outcomes
```

迁移全部additive；`0008 -> 0009`保留已有template child，`0009 -> 0010`保留已有Board与migration history。

## 3. Additive API 演进

受影响稳定surface与兼容分类：

| Surface | 变化 | 分类 |
|---|---|---|
| Proto | Template node/group新增optional binding fields | additive |
| Proto | 新增`RevertTemplateApplication` RPC/request/response | additive |
| Proto | 新增`TEMPLATE_APPLICATION_REVERTED` enum value | additive |
| TypeScript SDK | 新增optional model fields、method与HTTP route | additive |
| Resource catalog | Board 32→33、总descriptor 49→50 | additive |
| Database | nullable columns与新normalized tables | additive |

OpenSpec gate为`workbench-spatial-workflow-automation-r4`。无字段删除/重命名/重解释，因此不需要deprecation window。Rollback可运行不注册新RPC的旧binary：历史migration rows保留、旧schema所需表仍存在、nullable columns/新表不会破坏旧read；rollback期间新RPC返回unknown/unavailable，已写apply outcome保留且不删除。

## 4. 验证与证据

```bash
task board:template-apply-domain:test
task board:service-template-apply:test
task board:service-template-undo:test
task test:board-service-template-undo:component
task test:resource-transport-contract:component
CGO_ENABLED=0 go test ./service/... -count=1
openspec validate workbench-spatial-workflow-automation-r4 --strict
git diff --check
```

覆盖：

- binding/default/type/unused/extra/duplicate/determinism/legacy checksum；
- published/draft/deprecated、registry drift、stale target、collision；
- atomic graph/event/outbox/outcome rollback；
- apply later-edit/restart exact replay与tamper fail-closed；
- apply/revert concurrent single winner与10次race；
- unchanged-resource guard、authority revoke、edge-first rollback、revert replay；
- redo重新target resolve并生成新refs；
- Proto/JSON Schema/SDK/HTTP/gRPC/JSON-RPC descriptor parity为50 methods；
- full service regression、vet、typecheck、CLI migrate/check与OpenSpec strict validation。

Component evidence：

```text
temp/integration-test-runs/20260720230003-592c2861-aa33-4f60-baa8-24133e81ca48/
status=passed
exit_code=0
duration_ms=31452
redaction=enabled

temp/integration-test-runs/20260720230154-c112b92d-fa5f-42c3-9438-1fa7ab5b272a/
status=passed
exit_code=0
duration_ms=11079
redaction=enabled
```

失败后修复记录：第一次50-method transport component仍固定49，证据保存在`temp/integration-test-runs/20260720230131-0f3b7c19-d311-4cf4-ad6e-cf7424061223/`；修复SDK descriptor count后重新运行通过，未删除或放宽contract assertion。

## 5. 未完成边界

- Board shared service尚未绑定到workbenchd HTTP/gRPC/JSON-RPC runtime；新RPC当前仍按`1.5b`要求fail-closed unavailable。
- 当前SDK可在成功mutation后持有typed inverse，Template apply可用receipt event执行可信revert；跨客户端/跨会话的undo-history query与safe inverse descriptor仍需独立`2.2d3e`，不能宣称UI持久undo历史已完成。
- live PostgreSQL、connection loss/restart、secret scan与最终multi-writer矩阵属于`2.2e`；当前没有live PostgreSQL evidence。
