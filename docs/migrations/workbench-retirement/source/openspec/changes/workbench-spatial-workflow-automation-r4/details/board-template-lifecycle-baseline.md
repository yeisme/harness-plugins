# Board Template Lifecycle 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `2.2d2` 已完成 Template draft / publish / deprecate 的服务端生命周期与 GORM 持久化：

- `CreateTemplateDraft` 先执行 canonical registry、relation matrix、placeholder、group、geometry、style/label token 与 collection limit 校验；unsafe draft 在 authority/store 前失败且零写入；
- 服务端对 normalized typed draft 按 placeholder/node/group/edge ref 排序并计算 canonical `sha256` checksum；客户端不提交、不控制 checksum；
- 每个 Template content version 只插入一次；publish/deprecate 只以 tenant + template + current version + expected state + checksum + registry digest CAS 更新 lifecycle header，不修改 version 或 child rows；
- 状态机固定为 `draft -> published -> deprecated`，不允许跳转、复活、重复 publish 或 stale expected version；
- 独立 `TemplateStore` port 不污染 Board graph transaction port，并保持 authentication/authority/idempotency/service/domain/repository 分层；
- `board_template_mutations` 只保存 idempotency digest、request digest、safe refs/version/audit/time，不保存 raw key、request body、template blob或Owner payload；
- `board_template_mutation_outcomes` 保存历史 lifecycle header 的 typed outcome与 digest；replay结合 immutable version children恢复原始 create/publish/deprecate结果；
- publish replay在后续 deprecate之后仍返回原 published state，restart replay不依赖进程内对象；缺失/篡改 outcome或content checksum fail-closed；
- header CAS、mutation ledger与typed outcome处于同一 transaction；child insert失败、CAS loser或ledger冲突不会留下partial Template。

实现资产：

```text
service/internal/boards/domain/template_lifecycle.go
service/internal/boards/domain/template_lifecycle_test.go
service/internal/boards/template_service.go
service/internal/boards/template_service_test.go
service/internal/boards/ports.go
service/internal/repository/board_template_store.go
service/internal/repository/board_template_service_test.go
service/internal/repository/board_models.go
service/internal/repository/board_schema_test.go
service/internal/repository/gorm.go
Taskfile.yml
```

## 2. Schema 0008

```text
version=0008_board_template_lifecycle_foundation
checksum=sha256:a2cf68829cdd67203ef940e5761debd5c02bfba0cfa25d2c0970a7877c02a618
```

新增：

```text
board_template_mutations
board_template_mutation_outcomes
board_templates.published_at_db
board_templates.deprecated_at_db
```

`board_template_versions` 与 placeholder/node/group/edge child rows是 immutable content truth；`board_templates` 是当前 lifecycle pointer/header；typed outcome是历史 replay truth。`0007 -> 0008` migration为 additive，测试保留已有 Template row和 `0007` migration history。

## 3. Lifecycle / replay 不变量

| 操作 | 前置状态 | content version | current header | replay truth |
|---|---|---:|---|---|
| create draft | 无 | 插入 version 1 + children | draft | typed draft outcome |
| publish | draft + exact version/checksum/registry | 不修改 | published | typed published outcome |
| deprecate | published + exact version/checksum/registry | 不修改 | deprecated | typed deprecated outcome |

幂等唯一边界为 tenant + operation + idempotency digest。相同 request返回 exact replay；不同 request、workspace或template ref返回稳定 conflict，不能因查询scope不同退化为数据库唯一错误。

## 4. 验证与证据

```bash
task board:template-lifecycle:test
task test:board-template-lifecycle:component
CGO_ENABLED=0 go test ./service/... -count=1
```

覆盖：

- domain lifecycle、canonical checksum、registry drift与stale state/version；
- service authority先于replay/read/write，unsafe input零side effect；
- create/publish/deprecate、same-request replay、different-request conflict；
- publish在deprecate后的exact replay；
- immutable version row与normalized children；
- process restart replay、child/outcome tamper fail-closed；
- child insert failure全事务rollback；
- concurrent publish恰好一个winner；
- fresh schema、`0007 -> 0008` additive migration、vet、10次race与CLI migrate/check。

最终 component evidence：

```text
temp/integration-test-runs/20260720223238-2e3172ce-736f-478d-b2e1-ce5d5991d93c/
status=passed
exit_code=0
duration_ms=10512
redaction=enabled
```

## 5. 未完成边界

- 本任务不实现 `ApplyTemplate`；placeholder binding、批量 graph展开、atomic Board revision/event与apply outcome归入 `2.2d3`。
- typed inverse只是重新提交所需的数据，不授予 rollback权限；undo/redo必须重新执行authority、target resolver、expected Board revision与idempotency。
- transport runtime尚未绑定真实 Board service，远程 Template方法继续fail-closed unavailable。
- 当前没有live PostgreSQL证据；SQLite component/race不能替代 `2.2e` PostgreSQL门禁。
