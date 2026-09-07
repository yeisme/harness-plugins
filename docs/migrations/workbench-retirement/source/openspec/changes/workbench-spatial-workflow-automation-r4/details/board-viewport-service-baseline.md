# Board Viewport Query Service 本地组件基线

## 1. 交付状态

`2.3d1`已完成Board viewport local service装配。当前 `QueryViewport` 已通过真实 runtime service 暴露 HTTP/JSON-RPC/gRPC，并由 SDK JSON-RPC live path 与 runtime parity test 覆盖；这仍是本地 SQLite/动态 listener 证据。`2.3d2`真实PostgreSQL promotion和`2.3d`汇总gate完成前，不声明 provider/production 能力可用。

## 2. 请求链

```text
Principal authentication
  -> board.read authority
  -> configured viewport capability gate
  -> tenant-bound Board + revision read
  -> query normalization + signed cursor decode
  -> bounded node candidates
  -> medium/near visible edge + group expansion
  -> optional single typed safe projection batch
  -> Board revision/state re-read
  -> signed next cursor
  -> low-cardinality observation
```

未授权请求在Board、cursor和candidate repository访问前终止。Query authority只授予Board读取，不替代target authority；resolver显式接收当前principal、tenant和safe target refs，并可返回无内容的`not_authorized` projection。

## 3. 一致性与失败语义

- request revision与当前Board不一致返回`board_resync_required`，不执行candidate query。
- candidate、edge、group和projection完成后再次读取Board；revision/state漂移时丢弃全部局部结果和cursor，返回`board_resync_required`。
- cursor只在repository确认存在下一页时签发；同key重建service/codec后可跨进程重启续页。
- far不加载edge/group，也不要求projection resolver；medium不调用resolver；near缺resolver返回`board_needs_contract`。
- repository未知错误统一映射为`board viewport unavailable`；context cancellation/deadline和typed query error保留稳定语义，不拼接DB或Owner原始错误。
- observer只记录LOD、safe status、duration和资源数量，不记录tenant/Board/node/cursor/ref或payload。

## 4. 组件证据

```bash
task test:board-viewport:component
```

Evidence：`temp/integration-test-runs/20260721002610-06c77c56-2f38-4a89-bc89-486250ae39d6/`

- status：`passed`
- exit code：`0`
- duration：`27128 ms`
- redaction：enabled
- coverage：authority zero-access、signed continuation、restart、not-authorized projection、single batch、revision drift/no partial、raw repository error redaction、far capability、real SQLite/GORM node/edge/group continuation、status fail-closed、10次race、完整Board package regression。

独立 runtime parity evidence：`task test:board-viewport-runtime:component` 及
`temp/integration-test-runs/20260801234255-e7852353-4651-4936-b919-17110194595d/`。
该 gate 覆盖同一 local runtime service 的 HTTP、JSON-RPC、gRPC 与 typed SDK
viewport projection，`status=passed`、`redaction.total_redactions=0`；仍不替代
`WORKBENCH_TEST_POSTGRES_URL` 下的 PostgreSQL/performance promotion。

## 5. PostgreSQL准备

`TestPostgresBoardViewportRepositoryGate`现同时覆盖repository和完整service两页continuation、safe projection、named EXPLAIN与pool release。执行命令：

```bash
WORKBENCH_TEST_POSTGRES_URL='<isolated-postgresql-dsn>' task test:board-viewport-service:postgres
```

当前DB角色无database/schema创建权限，因此只有runner readiness，没有live evidence；此限制记录在`details/board-viewport-repository-baseline.md`。
