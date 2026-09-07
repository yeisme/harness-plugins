# Board Target Resolver Domain 基线

## 1. 交付结论

`2.4c1` 已建立typed provider registry与batch safe projection engine。该门禁只证明domain/provider边界，不声明任何真实Owner provider已晋级，也不替代 `2.4c2` projection index、`2.4c3` runtime resolver、`2.4c4` reconciler或`2.4c5` PostgreSQL/Owner promotion。

## 2. 合同边界

- 合同版本固定为`workbench.board_target_projection.v1`，单批最多1000 target。
- registration显式绑定provider id、contract digest、canonical node types、status token allowlist与tombstone reason allowlist；重复provider、重复type、unknown type、digest/version drift全部拒绝。
- registry digest由canonical registration metadata确定性生成，不包含provider实例、endpoint或credential。
- request只包含tenant、当前principal safe identity、typed target type/ref/version、合同版本与provider registry digest；不接受任意map或Owner raw payload。

## 3. 安全投影

engine按provider分组，每provider一次batch，并验证每个输入target恰好一个同组结果。provider不能为另一个provider的target注入projection；missing、duplicate、cross-group、unsafe字段统一fail-closed。

`not_authorized`与`needs_contract`必须零title/subtitle/status/thumbnail/source/freshness/reason。`available`必须返回与node binding相同的source version和`fresh`，`stale`必须显式`stale`。status与tombstone reason不仅需要安全格式，还必须在registration allowlist中。动态URL/private path因safe ref合同被拒绝。

provider raw error不会向上回显；仅该provider组降为`needs_contract`，其他provider组继续。context cancellation保持标准context错误，便于transport正确停止工作。

## 4. 验证证据

```bash
task board:target-resolver-domain:test
task test:board-target-resolver-domain:component
```

```text
temp/integration-test-runs/20260721012026-142c3102-7117-4333-a560-7008da60347d/
status=passed
duration_ms=6127
redaction.enabled=true
```

覆盖provider grouping、canonical result order、raw error isolation、denied content、missing/duplicate/cross-provider result、cross-tenant、invalid principal、unknown type、batch limit、registration drift、explicit token policy、source version mismatch、race与denied-content fuzz。

## 5. 未提升边界

- 当前canonical Board type registry仍将Owner node types标记`needs_contract`；本domain engine不提升availability。
- 尚未保存或查询normalized projection index，status filter继续fail-closed。
- 尚未接入真实Owner adapter、并发/timeout预算、reconciler、managed worker或transport。
- 未获得隔离PostgreSQL DSN和真实R3 provider contract evidence。
