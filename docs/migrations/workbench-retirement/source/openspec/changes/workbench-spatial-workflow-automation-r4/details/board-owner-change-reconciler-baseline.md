# Board Owner Change Reconciler 本地基线

## 1. 交付结论

`2.4c4` 已交付provider-neutral Owner change reconciler：approved typed Owner event先经resolver registry规范化，再由GORM transaction执行tenant-scoped source idempotency、target reverse lookup、Board CAS revision、payload-free event、pending outbox与projection watermark/index失效。该基线证明本地SQLite/GORM、worker restart/drain与race语义，不声明真实Owner endpoint或PostgreSQL已完成production promotion。

```text
version=0019_board_owner_change_reconcile
checksum=sha256:c0e1a43dbf6f514e7258f5aabc4996caa2fb180e81ff17b507c53b0fa0d99b22
```

## 2. Typed event 与安全边界

Owner event必须匹配当前resolver contract version、provider registry digest、provider contract digest、target type、allowlisted status/tombstone token与projection state约束。入口只接受raw `SourceEventRef`，规范化后立即清空原值，仅向repository传递`SourceEventDigest`与canonical `RequestDigest`；repository再次验证normalized contract，不保存raw webhook body、provider payload、principal decision或Owner content。

事件输出固定为：

```text
event_type=board.target_projection_changed
resource_type=board
change_kind=owner_change
payload=<absent>
```

event/outbox ref由tenant、source digest与Board ref共同派生，避免相同provider source identity跨租户碰撞。共享Board事件只描述Board projection需要重建，不携带title、subtitle、thumbnail、path、URL或raw Owner object。

## 3. 原子 reconcile

单个GORM transaction执行：

```text
source replay/conflict check
  -> latest target sequence check
  -> discover active matching nodes
  -> stable Board order
  -> lock active Board + revision CAS
  -> lock active matching nodes
  -> Board revision record
  -> payload-free Board event
  -> pending Board outbox
  -> delete affected projection rows/head
  -> source-to-Board application record
  -> canonical source event record
```

任一步失败均回滚Board revision、event、outbox、source record、application mapping与watermark失效。重复source event返回原Board/event映射，不重复推进revision；同source digest但request drift返回显式conflict。较小或相同source sequence在新source identity下记录为`out_of_order`，不得覆盖较新Owner version/state。

target tombstone、version drift与status refresh使用同一链路。tombstone只失效Board projection并发布安全revision event，不删除Board node，更不删除Owner object。处理时重新查询并锁定当前active binding；已删除或已重绑node不匹配旧target，因此不会复活旧projection。

## 4. Worker 生命周期

bounded `ChangeWorker`每轮最多处理256个typed queue item。数据库提交后、queue ack前崩溃时，restart会以相同source identity重新投递，repository replay返回既有结果，避免第二次Board mutation。取消或drain context在claim前及逐项处理间fail-closed；非法queue ref、list/ack失败均返回稳定worker unavailable，不伪造处理成功。

## 5. 验收矩阵

- duplicate：同source event只产生一次Board revision/event/outbox。
- out-of-order：旧sequence不覆盖新Owner状态。
- rebind/delete：旧target事件不命中当前binding，不复活projection。
- tombstone：tenant内所有匹配Board推进revision，但Owner object与Board node保持存在。
- crash/rollback：event唯一键故障时全部transaction side effect回滚。
- restart：commit后ack失败的重投递复用source digest。
- drain：取消context停止worker，不继续处理queue。
- race：并发重复事件只有一个canonical winner，另一调用读取duplicate结果。
- tenant isolation：相同source digest与Board ref跨tenant派生不同event/outbox ref。

## 6. 验证与证据

```bash
task board:target-reconciler:test
task test:board-target-reconciler:component
```

```text
temp/integration-test-runs/20260801202835-9b303d6a-488d-473a-94ec-a29455f27ada/
status=passed
duration_ms=203374
redaction.enabled=true
redaction.total_redactions=0
```

门禁覆盖resolver/repository focused tests、migration/schema checks、`go vet`与10轮race；另以20轮 owner-change focused test和3轮 race 复核同源重复、sequence、lock-order与CAS contention。组件证据包含`summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json`、digest与redaction receipt，并保留原始退出码。

最新复核（2026-08-02）再次运行完整 `task test:board-target-reconciler:component`，覆盖当前 owner-change lock-order regression、CAS contention、digest drift、migration/schema、resolver/repository focused、`go vet` 与 10 轮 race；证据为 `temp/integration-test-runs/20260801235536-bafb00e1-ff4c-460e-bfae-7a62e2a0db62/`，`status=passed`、`exit_code=0`、`redaction.total_redactions=0`。该结果确认本地实现保持 Board→node 锁序和 PostgreSQL `40P01/40001` 有界重试分支，但仍不替代真实 PostgreSQL DSN 验证。

最新窄范围复核（2026-08-02）：再次执行 `task test:board-target-reconciler:component`，证据为 `temp/integration-test-runs/20260802011439-882b3361-6385-4d42-9310-487082ce6204/`，`status=passed`、`exit_code=0`、`duration_ms=202285`、`redaction.total_redactions=0`。当前脏工作区中的 owner-change 实现仍通过 focused、migration/schema、vet 与 10 轮 race；真实 PostgreSQL、跨进程 restart 与 managed publisher 仍保持独立未完成门槛。

最新并发去重压力复核（2026-08-02）：对同源重复、request-digest drift 与锁后 canonical sequence 重查执行 `CGO_ENABLED=0 ... -count=200` 和 `CGO_ENABLED=1 go test -race ... -count=20`，两者均通过；随后用 evidence runner 以 50/10 轮生成脱敏 component evidence：`temp/integration-test-runs/20260802030924-484f8e01-5356-4297-b687-c52904a02484/`，`status=passed`、`exit_code=0`、`duration_ms=104913`、`redaction.total_redactions=0`。该压力证据强化本地并发稳定性，但不替代真实 PostgreSQL lock/deadlock/restart gate。

最新跨Board并发去重回归（2026-08-02）：新增两个匹配Board同时竞争同一source event的回归场景，验证跨Board canonical winner只产生一次source ledger提交、两条Board revision/event/outbox与一个duplicate结果；同一 focused suite 以 `CGO_ENABLED=0 -count=200` 与 `CGO_ENABLED=1 -race -count=20` 重复通过。证据分别为 `temp/integration-test-runs/20260802041352-a68662b6-3f08-4762-a836-b71a2966e1a4/` 与 `temp/integration-test-runs/20260802041647-c4f358dd-d61c-4537-bb7f-7d11eea098da/`，均 `status=passed`、`exit_code=0`、`redaction.total_redactions=0`。该结果只加强SQLite/本地并发与锁序回归覆盖，仍不替代真实PostgreSQL跨进程锁、deadlock/restart与managed publisher gate。

最新完整门禁复核（2026-08-02 07:12）：`task test:board-target-reconciler:component` 证据为 `temp/integration-test-runs/20260802071242-e4cf8862-1c22-4d15-8bef-cce1106516b3/`，`status=passed`、`exit_code=0`、`duration_ms=234649`、`redaction.total_redactions=0`。本次复核仍覆盖 owner-change focused、migration/schema、`go vet` 与 10 轮 race；真实 PostgreSQL lock/deadlock/serialization、跨进程 restart、managed publisher 与 production promotion 保持未完成。

当前脏工作区并发去重复核（2026-08-02 10:19）：`task test:board-target-reconciler:component` 证据为 `temp/integration-test-runs/20260802101919-ace3a89f-50b7-4fe2-8c0e-9f844256e0d6/`，`status=passed`、`duration_ms=226818`、`redaction.total_redactions=0`。该门禁确认同源重复与跨Board canonical winner 在 focused、migration/schema、vet、10 轮 race 下保持稳定；仍不替代真实 PostgreSQL lock/deadlock/serialization、跨进程 restart、managed publisher 或 production promotion。

Fallback recheck after owner hardening（2026-08-02 10:40–10:44）：`task test:board-target-reconciler:component` 重新通过，证据为 `temp/integration-test-runs/20260802104019-d1d3fe1c-810b-4dd7-a402-3e13dd2e5928/`，`status=passed`、`duration_ms=228312`、`redaction.total_redactions=0`；同轮 `task test:workflow-runtime-parity:component` 证据为 `temp/integration-test-runs/20260802104019-7938d75e-9ba2-427f-a263-6f93746044e3/`，`status=passed`、`duration_ms=62442`、`redaction.total_redactions=0`。两条 evidence 只支持当前本地 SQLite/GORM 与 Workflow 四传输 parity，不替代真实 PostgreSQL、managed restart/publisher、Owner provider、R1/R2 或 production/browser gate。

## 7. 未提升边界

- 真实Asset/WorkItem/Delivery Owner endpoint、approved production contract digest、认证与outage/recovery证据仍属于`2.4c5`。
- PostgreSQL transaction/lock语义（包括`40P01/40001`重试）与隔离DSN验证、reconciler process restart、10k status EXPLAIN与性能预算仍属于`2.4c5`。
- `2.4c` production promotion保持未完成，直到`2.4c5`真实Owner与PostgreSQL证据通过。

Fresh current-checkout recheck（2026-08-02 15:12–15:16）：`task test:board-target-reconciler:component` 通过，证据为 `temp/integration-test-runs/20260802151247-bbdf13ba-adaf-40a2-97d4-a22b6c65b92b/`，`status=passed`、`duration_ms=228607`、`redaction.total_redactions=0`；再次覆盖 focused owner-change、migration/schema、resolver/repository、`go vet` 与 10 轮 race。该结果确认当前脏 worktree 的本地并发去重稳定性仍成立，但不替代真实 PostgreSQL lock/deadlock/serialization、跨进程 restart、managed publisher 或 production promotion。
