# Board Projection Index / Status Filter 本地基线

## 1. 交付结论

`2.4c2` 已交付 `0014_board_projection_index_foundation`、node-scoped non-content projection index、完整性watermark、target reverse lookup与status keyset filter。该基线证明本地SQLite/GORM语义，不声明真实Owner provider、reconciler、PostgreSQL或10k性能已晋级。

```text
version=0014_board_projection_index_foundation
checksum=sha256:f90682da01f94908463092fe99516a1abf2b56ce5b541367591e7c24d76ded76
```

## 2. Non-content 数据边界

`board_node_projection_index` 仅保存：tenant/Board/node ref、target type/ref/version、binding digest、projection state、allowlisted status/freshness token、source version、safe tombstone reason和DB time。结构审计明确拒绝title、subtitle、thumbnail、URL、path、payload/json/blob、principal、membership、permission或allowed decision列。

`not_authorized`是principal-scoped响应状态，`IndexRecord.Validate`禁止将其写入共享index。`available`必须source version等于node binding且freshness=`fresh`；`stale`必须显式source version与`stale`；tombstone不得携带status/source/freshness内容。

## 3. 完整性 watermark

`board_projection_index_heads` 绑定：

```text
tenant_ref
board_ref
indexed_board_revision
type_registry_digest
provider_registry_digest
updated_at_db
```

`ReplaceBoardProjectionIndex` 在一个GORM transaction内重新读取当前active Board与全部active nodes，要求每个node恰好一个当前binding record；partial、duplicate、binding drift、revision/digest drift均在删除旧index和推进head前失败。全部rows写入成功后才upsert head，时间来自数据库时钟。

任意Board mutation在canonical commit transaction中先失效head；node create/restore/update/tombstone同时删除对应index row。重放mutation不会重复失效新状态，事务失败也不会留下partial head。

## 4. Status query

status filter只在head revision、type registry digest与provider registry digest全部匹配时启用。校验发生在cursor decode之前，因此registry drift稳定返回`board_needs_contract`，不会误报通用cursor invalid。

候选查询使用projection node-ref bounded subquery和既有`x/y/node_ref` keyset，不使用offset。选中page后执行一次bounded projection row读取并重新校验binding digest；缺row或损坏binding会丢弃partial并返回`board_needs_contract`。`NodePage.StatusByNodeRef`进入LOD candidate，far summary可消费同一可信status token。

命名索引：

- `idx_board_projection_status`：tenant + Board + projection state + status token + node ref。
- `idx_board_projection_target`：tenant + target type/ref + Board + node ref。

SQLite `EXPLAIN QUERY PLAN`验证status lookup使用`idx_board_projection_status`；target reverse lookup按Board/node稳定排序并有上限。

## 5. 验证与证据

```bash
task board:projection-index:test
task test:board-projection-index:component
CGO_ENABLED=0 go test ./service/... -count=1
```

```text
temp/integration-test-runs/20260721014204-52289827-c28f-4a47-9be5-6a819bb1721d/
status=passed
duration_ms=68032
redaction.enabled=true
```

覆盖：domain index validation、0013→0014 additive migration、forbidden-column audit、complete batch、binding/revision/digest drift、status两页keyset、restart、query digest binding、cursor前head gate、named SQLite plan、target reverse lookup、corrupt row fail-closed、Board/node mutation原子失效、race、vet与全量service regression。

## 6. 未提升边界

- 真实Owner title/subtitle/thumbnail safe ref仍必须由`2.4c3`当前principal resolver获取；index不能作为内容cache。
- Owner typed change event、source idempotency与Board revision/outbox reconciler仍属于`2.4c4`。
- PostgreSQL additive migration、named EXPLAIN、10k status p50/p95和真实Owner contract evidence仍属于`2.4c5`/`2.3e`。
- `2.4c` production promotion保持未完成，remote Board runtime继续fail-closed。
