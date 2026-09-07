# Board Event List / Retention 本地基线

## 1. 交付状态

`2.4a1`已交付signed event cursor、0012 retention foundation、GORM sequence window、`ListBoardEvents`与`WatchBoardEvents`本地服务。当前 runtime 的真实 `boards.Service` 已暴露 HTTP/JSON-RPC/gRPC/SDK list/watch path，并通过本地动态 SQLite runtime evidence 验证 catch-up/live handoff、cursor、event type、gap/resync 与 safe projection；隔离 PostgreSQL parity 和 `2.4a` promotion 仍未完成，因此不声明 provider/production 可用。

## 2. Cursor合同

格式为`board-event-cursor:v1:<compact-payload>:<hmac-sha256>`，payload绑定tenant/Board scope digest、last sequence、retention generation和expiry。codec支持current/previous key轮换、24小时内bounded TTL、restart decode与512-byte上限。

- tamper/cross-tenant/cross-Board：`board_cursor_invalid`
- expiry：`board_cursor_expired`
- retention generation drift：`board_resync_required`
- key/payload/cursor不进入error或日志

## 3. Repository与0012

```text
version=0012_board_event_retention_foundation
checksum=sha256:256293c4ee4731d2f910ebb2e2e73895b360fc45696582723366f5870e0bb714
table=board_event_retention
index=idx_board_event_retention
```

Board create会在同一GORM transaction中写generation 1、earliest sequence 1；replay不重复写。已有0011数据库只新增retention table/index，已有Board revision/event sequence保持不变。

event window在同一read transaction中读取Board head、retention和`board_events`。查询固定tenant/Board/sequence keyset与1000上限，不读取outbox作为事件事实；outbox-only ghost不会曝光。page内部或page尾到Board head存在sequence gap时返回`board_resync_required`且清空events；initial client可从当前retention earliest开始，旧cursor不能越过retention boundary。

## 4. Service语义

- authentication与`board.read` authority在cursor/repository前执行。
- 正常响应始终签发当前位置cursor，支持进程重启后续页。
- retention/gap被投影为`resync_required=true`、空events、空next cursor与当前Board revision；不伪造snapshot或返回partial page。
- repository raw error统一映射`board event stream unavailable`；typed cursor/context错误保留稳定语义。

## 5. 验证证据

```bash
task test:board-event-list:component
task board:schema:test
```

## 6. Watch runtime slice

`WatchBoardEvents` 在 service 层先执行 principal 与 `board.read` authority，再解码 scope-bound signed cursor；无 cursor 从 retention earliest catch-up，有 cursor 先校验 retention generation。共享 watcher 在 catch-up 前订阅 broker，避免 handoff 丢事件；同一 event sequence 的 outbox replay由 watcher 去重，sequence gap 映射为 `board_resync_required`。HTTP SSE 与 JSON-RPC SSE 使用同一 safe `EventView`，gRPC 使用同一 `BoardEvent` projection，SDK 只消费 typed event。

当前本地证据：`task test:board-event-watch:component` 覆盖 service、outbox/broker、HTTP/JSON-RPC/gRPC adapter、runtime parity 与 focused race，脱敏 evidence 为 `temp/integration-test-runs/20260801191644-753d6aae-b906-4ebf-87ac-39d4ae965a28/`；`tests/conformance/board-sdk-runtime.test.ts` 覆盖 HTTP SDK 的 catch-up/live rename，integration evidence 为 `temp/integration-test-runs/20260801191053-b3fde180-85a5-4854-91b4-658ac681fb99/`。该 slice 仍仅为 local/component/integration 证据；PostgreSQL/restart promotion、R1/R2 handoff、provider 与 production gate 保持 pending。

Evidence：`temp/integration-test-runs/20260721004124-bb23c3c8-21e3-47cf-bb95-863f03e0deba/`

- status：`passed`
- exit code：`0`
- duration：`55082 ms`
- redaction：enabled
- coverage：cursor tamper/scope/expiry/rotation/restart、sequence pages、outbox ghost、gap、retention、future cursor、tenant isolation、cancellation、authority、raw error redaction、real SQLite restart/resync、10次race、cursor fuzz。

0012 schema gate另行通过repository regression、vet、10次schema race和临时SQLite migrate/check。

## 7. Runtime transport evidence

`tests/conformance/board-sdk-runtime.test.ts` 覆盖 create/replay、`listBoards`、watch catch-up/live rename、rename 后 event list、viewport 与 tombstone；`service/internal/runtime/TestBoardMutationParityAcrossRuntimeHTTPJSONRPCAndGRPC` 覆盖 HTTP create → JSON-RPC rename → gRPC tombstone → HTTP read，`TestBoardListParityAcrossRuntimeHTTPJSONRPCAndGRPC` 覆盖 workspace/state/page token 的三面 parity，`TestBoardWatchParityAcrossRuntimeHTTPJSONRPCAndGRPC` 覆盖 HTTP SSE、JSON-RPC SSE、gRPC stream 的同一 rename event。revision companion event 的 `reasonCode` 与 `revision_committed` wire type 均经过 SDK normalizer。ListBoards 的详细 slice 与证据见 `board-contract-delivery-matrix.md` §8.2。

## 8. PostgreSQL准备

现有`TestPostgresBoardServiceTransactionGate`已加入完整10-event list、signed terminal cursor与restart断言。待DBA提供隔离DSN后执行：

```bash
WORKBENCH_TEST_POSTGRES_URL='<isolated-postgresql-dsn>' task test:board-event-list:postgres
```
