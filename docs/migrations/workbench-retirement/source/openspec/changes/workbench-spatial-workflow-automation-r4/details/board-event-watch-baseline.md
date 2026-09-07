# Board Event Watch 本地基线

## 1. 交付结论

`2.4b1` 已完成 Board outbox publisher、bounded live broker 与 catch-up/live handoff 的本地生产语义。该基线证明 SQLite/GORM 下的事务事件来源、租约回收、至少一次投递、重复去重、gap resync、慢消费者隔离、重启和 drain 行为；它不替代 `2.4b2` 的 PostgreSQL、managed worker、SSE/gRPC 与进程恢复门禁。

## 2. Schema 与 claim fencing

当前 schema：

```text
version=0013_board_outbox_lease_foundation
checksum=sha256:17fd887010872aa8f8b829e3d0ba65958dfaf99540285b708c357b812b903195
```

`board_outbox` 仅增加 `lease_owner_ref`、`lease_token_digest`、`lease_expires_at_db` 与 `last_error_code`，并新增 `idx_board_outbox_lease_expiry`，避免旧 `idx_board_outbox_claim` 在 additive upgrade 时无法原位变形。原始 lease token 和下游原始错误均不持久化。claim 只选择可用 pending 行或已过期 publishing 行，并通过状态、可用时间与 lease expiry 的 CAS fencing 保证并发单赢家；ack/retry 必须匹配 lease token digest，过期 worker 的 stale ack 会返回 `board outbox claim lost`。

claim 查询通过 `board_events` 内连接校验 tenant、Board、event ref 与 sequence，因此孤立 outbox 不会成为 ghost event。发布发生在 ack 之前；若进程在 publish 后、ack 前崩溃，lease 到期后会重复投递，符合 at-least-once，而不是伪造 exactly-once。

## 3. Publisher 生命周期

- sink 失败只写 `publish_unavailable`，按 attempt 使用有上限的指数退避。
- claim/ack/retry store 故障使 publisher readiness 降为 `store_unavailable`，不暴露原始数据库错误。
- `Drain` 原子关闭新 claim、将 readiness 置为 false，并等待 inflight 操作；轮询等待可被 drain 立即中断。
- publisher 只发布已提交 `board_events` 对应的 typed `Envelope`，broker 不读取 outbox 作为 canonical event fact。

## 4. Catch-up/live handoff

watcher 先订阅 broker，再执行 sequence keyset catch-up。catch-up 期间进入 broker 的相同 sequence 在切换 live 后被去重；后续 sequence 跳跃会关闭 stream 并返回 `resync_required`，不会拼接不可信 partial stream。

broker 按 tenant/Board scope 隔离订阅，subscriber 数和每订阅 buffer 都有固定上限。publisher 对 subscriber 使用 non-blocking send；buffer 满时只断开慢消费者并返回 `board event consumer too slow`，不会阻塞其他 Board 或 publisher。

## 5. 验证与证据

可复现命令：

```bash
task board:event-watch:test
task test:board-event-watch:component
```

组件证据（历史本地 broker/runtime 基线）：

```text
temp/integration-test-runs/20260721010811-3a18bf79-56ee-41da-910b-296fcca8ac2e/
status=passed
duration_ms=70126
redaction.enabled=true
```

覆盖项包括：并发 claim 单赢家、expired lease reclaim、stale ack、safe retry reason、ghost event、publish 后 ack 失败重投、指数退避、publisher drain、慢消费者断开、subscribe-before-catch-up、handoff duplicate、live gap resync、真实 GORM publisher→broker→watcher 链路及 SQLite restart。

最新 local runtime parity 复核（2026-08-02）：`task test:board-event-watch:component` 额外构建 `workbenchd` 并运行 `tests/conformance/board-sdk-runtime.test.ts` 的 typed SDK catch-up/live event projection，同时覆盖 HTTP、JSON-RPC、gRPC runtime watch、outbox/broker/watcher/publisher 与 race/vet；证据为 `temp/integration-test-runs/20260802000915-1f95af45-219c-456e-8587-58cce9a8cfb4/`，`status=passed`、`exit_code=0`、`redaction.total_redactions=0`。这证明同一 local durable runtime 的四面 event projection parity，不替代 managed worker、真实 PostgreSQL、跨进程 restart 或 production/browser gate。

Aggregate local Board parity（2026-08-02）：`task test:board-transport-parity` 汇总 owner-change、CRUD/list、viewport、event list/watch、四 transport、typed SDK、race/vet/fuzz/build；证据为 `temp/integration-test-runs/20260802002810-e81e1adb-f595-4f96-ba1f-6029b85beedd/`，`status=passed`、`redaction.total_redactions=0`。该 aggregate 仍是 component/local gate，不替代 PostgreSQL、managed worker、跨进程 restart 或 production promotion。

最新 Aggregate local Board parity（2026-08-02）：同一 `task test:board-transport-parity` 在 Undo/registry slice 更新后重新执行，owner-change、CRUD/list、viewport、event list/watch、HTTP、JSON-RPC、gRPC、typed SDK、race/vet/fuzz/build 均通过；证据为 `temp/integration-test-runs/20260802022806-af73d110-377a-4391-9e38-1e54e6d6ab03/`，`status=passed`、`redaction.total_redactions=0`。该结果仍只证明 local/component aggregate，不替代 PostgreSQL、managed worker、跨进程 restart 或 production promotion。

最新 Aggregate local Board parity（2026-08-02）：再次执行 `task test:board-transport-parity`，证据为 `temp/integration-test-runs/20260802031320-590a5c12-8886-4b86-acd4-a56bb5da190b/`，`status=passed`、`exit_code=0`、`duration_ms=517029`、`redaction.total_redactions=0`。该结果确认当前 dirty checkout 的 Board owner-change、CRUD/list、viewport、event list/watch、HTTP、JSON-RPC、gRPC、typed SDK、race/vet/fuzz/build 聚合仍通过；不提升 PostgreSQL、managed worker、跨进程 restart 或 production promotion。

最新 Board event-watch component 复核（2026-08-02）：`task test:board-event-watch:component` 通过本地 outbox claim/publish/ack/retry、broker catch-up/live handoff、gap/backpressure/drain、runtime watch 与 race/vet/build，证据为 `temp/integration-test-runs/20260802033037-db13b907-ad17-407d-a4cc-0a94a7e0c2a8/`，`status=passed`、`exit_code=0`、`duration_ms=25638`、`redaction.total_redactions=0`。该结果仍不替代 2.4b2 的 managed worker/PostgreSQL/跨进程 restart，也不关闭 2.4d production gate。

当前 dirty runtime/SDK 编辑后的 Aggregate local Board parity（2026-08-02 08:48）：`task test:board-transport-parity` 再次通过，证据为 `temp/integration-test-runs/20260802084859-caf9815f-00f6-4256-9dd3-dca926f6bc2a/`，`status=passed`、`duration_ms=534649`、`redaction.total_redactions=0`。该结果只确认当前本地 Board 四传输与 typed SDK aggregate freshness，不替代 PostgreSQL、managed worker、跨进程 restart 或 production promotion。

当前 dirty 编辑后的最新 Aggregate local Board parity（2026-08-02 09:45）：`task test:board-transport-parity` 再次通过，证据为 `temp/integration-test-runs/20260802093637-1b10d997-15a2-4b8f-8d47-ba058e1b8a34/`，`status=passed`、`exit_code=0`、`duration_ms=531365`、`redaction.total_redactions=0`。该结果只确认当前本地 Board owner-change、CRUD/list、viewport、event list/watch、HTTP、JSON-RPC、gRPC、typed SDK、race/vet/fuzz/build 聚合，不替代 PostgreSQL、managed worker、跨进程 restart 或 production promotion。

## 6. 未提升边界

- 未获得可创建/删除隔离数据库或 schema 的 PostgreSQL DSN，因此不声明 PostgreSQL claim/reclaim parity。
- 未接入 production worker command、registration/readiness aggregation 或进程级 shutdown receipt。
- 当前已绑定并验证本地 HTTP/SSE、JSON-RPC、gRPC 与 typed SDK event projection；managed worker、真实 PostgreSQL claim/reclaim、跨进程 restart、生产 readiness 与 browser/production promotion 仍属于 `2.4b2`/`2.4d`。
- remote Board runtime 继续 fail-closed；本地 broker 不能作为 production candidate 的替代品。
