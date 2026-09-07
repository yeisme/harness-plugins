# Board Target Resolver Runtime 本地基线

## 1. 交付结论

`2.4c3` 已将typed provider engine接入Board viewport runtime：medium只消费0014 non-content index，near按当前principal调用live safe provider，far/medium在production provider registry配置存在时强制revision/registry watermark。该门禁证明通用runtime与本地typed provider合同，不声明任何外部Owner endpoint已完成production promotion。

## 2. Provider 运行预算

默认预算：

```text
max_concurrency=4
provider_timeout=800ms
total_timeout=2s
hard_max_concurrency=16
hard_max_provider_timeout=5s
hard_max_total_timeout=10s
```

engine按provider分组，每provider单次batch，使用bounded semaphore并保持最终node-ref确定性排序。单provider raw error或内部timeout只将该provider组降为`needs_contract`；同组provider可对单target返回typed `needs_contract`，其他target继续available。调用方context取消保持标准context错误，不伪装成Owner状态。

registration contract/version/digest/type/token drift在启动时fail-closed；registry digest跨engine重建稳定。provider返回missing、duplicate、cross-provider target、unsafe字段、未注册status/reason或伪造current source version时，整组合同拒绝，不把raw error或payload写入结果。

## 3. Current-principal 与 cache policy

- near每次请求把当前tenant/principal safe identity传给provider，不复用历史actor授权结果。
- actor deny返回`not_authorized`且title/subtitle/status/thumbnail/source/freshness/reason全部为空；不写0014 index、不修改Board revision、不发布tenant共享事件。
- medium从`board_node_projection_index`返回无title/subtitle/thumbnail的state/status/freshness/source safe projection；live provider不会被调用。
- far只使用可信status summary；若provider registry已配置但head缺失或revision/digest drift，返回`board_needs_contract`，不能降级成“空status”。
- near内容永远来自live provider；0014 index不能恢复缓存title，也不能绕过当前principal authority。

## 4. 组件链路

真实本地组件测试覆盖：

```text
BoardService authority
  -> GORM Board/revision
  -> 0014 watermark/index
  -> medium non-content projection (provider calls=0)
  -> near current-principal provider (provider calls=1)
  -> actor denied zero-content projection
```

status cursor/query digest绑定type/provider registry digest，且head校验在cursor decode前执行。修复了一个全量回归发现的问题：status filter缺少registry digest时必须`needs_contract`，不能返回空结果伪装为无匹配。

## 5. 验证与证据

```bash
task board:target-resolver:test
task test:board-target-resolver:component
CGO_ENABLED=0 go test ./service/... -count=1
```

```text
temp/integration-test-runs/20260721015302-044c5056-8293-4c23-908c-ecd3248e2c58/
status=passed
duration_ms=29545
redaction.enabled=true
```

覆盖：provider grouping、bounded concurrency、provider timeout、typed single-target degradation、registry restart digest、current principal、cross-tenant、not-authorized redaction、medium non-content cache、near live content、status fail-closed、race、vet与全量service regression。

## 6. 未提升边界

- 当前provider实现仍是typed local contract double；真实Asset/WorkItem/Delivery等Owner endpoint、认证、contract digest与故障证据属于`2.4c5`。
- tenant-wide target deletion/version drift的source event idempotency、Board CAS、event/outbox和worker lifecycle属于`2.4c4`。
- PostgreSQL、10k status EXPLAIN/p50/p95、managed worker和four-transport parity仍未完成。
