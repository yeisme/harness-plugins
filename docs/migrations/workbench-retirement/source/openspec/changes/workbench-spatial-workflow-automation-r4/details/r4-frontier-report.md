# R4 FRONTIER 前沿推进报告（2026-08-27）

会话范围：`service/internal/workflows/`、`service/internal/workers/` 及相关测试。
未触碰：R4 `tasks.md`、`Taskfile.yml`、`service/cmd/workbench-worker/**`（并行代理持有）、
`service/internal/transport/**`、`service/internal/repository/**` 生产代码。

执行依据：`bun scripts/execution-dag-snapshot.ts` 当日 FRONTIER——
`R4:2.4b2`（ext=R0 worker bootstrap）、`R4:5.0b2b2d`（ext=R1 service identity/delegation）。

## 环境事实

- 沙箱内 PostgreSQL 14.23 可用（`/usr/lib/postgresql/14/bin`，loopback disposable
  recipe：`initdb -U workbench -A trust` + `pg_ctl -p 15433`）。
- 9.2a 的 container smoke 阻塞（runc `unshare: operation not permitted`）为内核级
  沙箱限制，本次未硬闯，维持既有 partial 记录。
- 1.5a（2.4b2 的 Blocked input 之一）已勾选；disposable DSN 隔离由
  `WORKBENCH_POSTGRES_TEST_TARGET=disposable` guard + per-test `CREATE SCHEMA` 承担。

## 本次新增实现（workers/bootstrap 平面）

- `service/internal/workers/bootstrap/board_publisher_engine.go`（新增）：
  `BoardPublisherEngine` 把 `boards/events.Publisher` 包装为 managed worker engine
  （`Role=RoleOutbox`，`Start/CheckReady/Drain/Stop` + `RuntimeSnapshot`）。
  drain 停止新 claim 并等待 inflight publish/ack；store/sink 失败只暴露
  safe reason code（`store_unavailable` 等），不透传底层错误；`boardPublisherEngineBuilder`
  要求 store 满足真实 `boardevents.OutboxStore` 合同且 sink 显式注入，否则构建期
  fail closed。
- `service/internal/workers/bootstrap/composite_engine.go`（新增）：
  `compositeRoleEngine` 把同 role 多 engine 聚合为一个 supervisor 槽位
  （readiness=全部 ready、drain 并发触发避免顺序 drain 期间后方 engine 继续 claim、
  stop 反向幂等、快照聚合）；`mergeRoleEngine` 在 role 冲突时复合。
- `service/internal/workers/bootstrap/runtime_inputs.go`（修改，additive）：
  `RuntimeInputConfig` 新增 `EnableBoardPublisher/BoardPublisherTuning/BoardEventSink`；
  接线块把 Board publisher 与 workflow outbox engine 在 `RoleOutbox` 上复合。
  附带修复一个潜在 nil 解引用：原 outbox/executor/reconcile 链块在无 scheduler
  前驱时 `previous` 为 nil，构建期会 panic；现统一走 `buildWithPrevious` nil-safe 调用。

## 新增测试

- `board_publisher_engine_test.go`：publish/ack/drain 生命周期、store 失败 safe
  reason 不泄漏原始错误、drain 停止新 claim 并等待 inflight、非法配置 fail-closed、
  builder 缺 sink/缺 store 合同 fail-closed、composite 生命周期/回滚/聚合、
  `LoadRuntimeInputs` 接线与复合（workflow outbox + Board publisher → 单 engine）。
- `board_publisher_postgres_test.go`（disposable PG，guard 同 scheduler matrix）：
  claim/publish/ack parity、崩溃租约过期回收（attempt 递增）、未过期租约不被抢、
  排他表锁制造的真实 DB outage → `store_unavailable` → 释放后真实恢复、
  drain 等待 inflight 且 drain 后零新 claim。写结构化 receipt
  `workbench.board_publisher_managed_pg.v1`。
- `worker_startup_readiness_pg_test.go`（disposable PG）：
  完整 `Open + RuntimeOption + runtime.Start` managed runtime 矩阵——schema 缺失
  dependency_ready=false 且零注册、迁移后恢复 ready+registered、ready 期间零 claim
  （DisabledAuthority）、schema 漂移（DROP TABLE）重新 fail closed、drain/shutdown
  后注册行 `stopped` 回执。receipt `workbench.worker_startup_readiness_pg.v1`。
- `worker_process_restart_drain_pg_test.go`（disposable PG + 真实
  `workbench-worker` binary，测试内 `go build` 新鲜构建）：schema 缺失进程 listen
  但 dependency_ready=false 零注册；迁移后 database/time/双 registry/queue role
  本地依赖全 ready，而 R1 identity/delegation provider 缺失保持 not-ready、零注册、
  零 claim（fail-closed）；两进程 SIGTERM 均 bounded drain、干净退出、
  `shutdown.requested`/`shutdown.completed` 日志齐全；重启进程重新全检。

## 验证命令与结果

- `CGO_ENABLED=0 go test ./service/internal/workers/... ./service/cmd/workbench-worker`：全 ok。
- `CGO_ENABLED=0 go test ./service/internal/workflows/... ./service/internal/boards/...`：全 ok。
- `CGO_ENABLED=1 go test -race ./service/internal/workers/bootstrap ./service/internal/workflows/outbox ./service/internal/boards/events ./service/internal/workers/engines`：全 ok。
- `CGO_ENABLED=1 go test -race ./service/internal/workers/bootstrap -run 'BoardPublisher|Composite' -count=5`：ok。
- 证据运行（`bun scripts/test-evidence/run.ts`，均 redaction.total_redactions=0）：
  - `task test:worker-startup-readiness:component`（含新 PG 矩阵，未 skip）→
    `temp/integration-test-runs/20260827103003-294f7b35-5dba-46f2-b099-81374ede8c9d/`，passed。
  - Board publisher PG matrix + 进程级 restart/drain →
    `temp/integration-test-runs/20260827103603-827c3302-1bc4-4892-b719-fb58a6e7e333/`，passed，
    structured artifact `artifacts/board-publisher-matrix.json` 五项全 true。
  - `task test:board-event-watch:component` →
    `temp/integration-test-runs/20260827103655-c6563085-2813-4034-a328-1219ed57d092/`，passed
    （duration 74s，redaction 0；刷新 2.4b2 本地 SSE/gRPC/cursor parity 半边的鲜度）。
  - `task test:worker-managed-bootstrap:component` →
    `temp/integration-test-runs/20260827104110-89812945-61b7-4052-9cb7-1cc5483ce59e/`，passed
    （6 包 ok，本地模式 PG 用例按合同 skip；含本次新增单测与接线回归）。
  - `task test:workflow-component SCENARIO=worker-restart-drain` →
    `temp/integration-test-runs/20260827104153-e8a8b518-915b-4744-9767-fd78a40f8529/`，passed。
  - 失败尝试（如实记录）：`20260827103110-943c20c5` 与 `20260827103246-f1e7c7ad` 两轮
    因 receipt 写入路径/artifact 类型不符合 runner 合同而 failed（测试本身 8-9 项断言
    全过；runner 只允许 PNG 进 artifacts/ 或经 `--collect-structured-artifact` 收集
    temp/ 下 JSON），修正后上述 `20260827103603` 通过。
  - concurrent/environment 失败（如实记录）：`20260827103810-6da95950`（
    `test:worker-managed-bootstrap:component` 首轮）双因素 failed——其一「source
    changed while the evidence command was running」（并行代理编辑触发 source-snapshot
    保护，concurrent 类）；其二 `TestPostgresSchedulerFactoryW2SystemMatrix/crash_expiry_reclaim`
    超时——该失败在本会话导出 PG env 后被引入运行面，经 HEAD 干净 worktree 复跑同样
    失败，判定为 environment/pre-existing（本沙箱 disposable PG 时序特性），非本次
    改动引入；canonical 本地模式（不导出 PG env）复跑即上述 `20260827104110` passed。
- `openspec validate --all --strict`：45 passed, 0 failed。

## 逐任务可勾选结论

### 2.4b2 将Board event publisher/watch接入managed worker与SSE/gRPC source — **不可勾选（推进）**

已完成（本地可做部分，均有上方证据）：

- [x] publisher managed lifecycle：Board publisher 现为 supervisor 管理的真实 engine
  （drain 停止新 claim + 等待 inflight，SQLite 单测 + PG 矩阵双重证据）。
- [x] readiness 聚合：engine probe 经 supervisor 进入 dependency checker；
  DB/source 失败 → ready=false（safe reason，PG outage 实测）。
- [x] PostgreSQL claim parity：claim/publish/ack、崩溃回收、租约不被抢的真实 PG 证据。
- [x] SSE/gRPC 共享同一 authorized source：既有 2.4d/1.5b parity 证据链维持
  （`test:board-event-watch:component` 本次复跑刷新）。

未满足（保持 unchecked 的诚实理由）：

- [x] `service/cmd/workbench-worker` 的 `EnableBoardPublisher` 接线——已于
  2026-08-27 第二轮落地（in-process broker sink + outbox role 约束 fail
  closed，disposable PG 矩阵 PASS）；跨进程 sink 拓扑（worker 进程与
  workbenchd 内 broker 的投递面）保持 root 决策，仍为 open。
- [x] `task test:board-event-watch:postgres`——已由 2026-08-27 Taskfile 补齐
  批次落地（Taskfile.yml:2524，指向 `TestPostgresBoardPublisherManagedEngineMatrix`，
  disposable PG 实测 passed，证据 run `20260827170733-017f8d34-…`）。
- [ ] 进程级 Board publisher crash/reclaim 证据（worker 进程重启后续传不丢 gap）
  依赖上一项接线。

### 5.0b2b2b2 将managed bootstrap接入真实worker command并执行PostgreSQL恢复验证 — **不可勾选（推进）**

- [x] schema 缺失/漂移 fail closed + 迁移恢复重新全检（in-process managed runtime，
  真实 PG，evidence `20260827103003`）。
- [x] 进程级 restart/drain：真实 binary、真实 PG、SIGTERM bounded drain、干净退出、
  重启重新全检（evidence `20260827103603`）。
- [x] identity/delegation provider 缺失 → not-ready + 零注册 + 零 claim（进程级实测）。
- [ ] registration/heartbeat/stopped 回执的进程级证据与 claim 路径：被
  5.0b2b2d（R1 provider）阻塞——真实 binary 无 typed provider 时正确地拒绝注册；
  in-process 路径（typed probe 注入）的注册+stopped 回执已由
  `TestWorkerStartupReadinessManagedRuntimePG` 覆盖。
- [ ] `SCENARIO=worker-restart-drain` 既有 target 只跑 SIGTERM 非 PG 用例；新进程级
  PG 用例（`TestWorkerManagedProcessRestartDrainDisposablePG`）需 root 将其并入
  scenario（Taskfile 归 root）。

### 5.0b2b2b2b 执行真实PostgreSQL startup/recovery/drain验证 — **不可勾选（被 5.0b2b2d1 阻塞）**

- 本地证据已就位（同上两条 evidence run），但 Acceptance 要求「两个独立进程……
  任一 dependency 失效 ready=false 且零 claim，恢复后重新全检」的完整闭环含
  registration/heartbeat，必须等真实 R1 workload identity provider（5.0b2b2d1，
  已确证为 monorepo 外真实外部依赖）。

### 5.0b2b2d / 5.0b2b2d1 接入R1 service identity与delegation authority — **不可勾选（外部依赖）**

- 终勘结论维持：R1 identity platform 不在本 monorepo；consumer 侧（5.0b2b2d0）已勾。
- 本次进程级测试反向验证了其 fail-closed 语义：provider 缺失时 worker 不注册、
  不 claim、不伪造 ready。

### 5.0b2b2e1 真实engine probes恢复矩阵 — **不可勾选（被 5.0b2b2b2b/d1 阻塞）**

- engine probe 接回 bootstrap 的机制已存在（`Open` 中 `supervisor.Probe(role)`）；
  恢复矩阵 scenario（`worker-dependency-recovery`）在 Taskfile 中无 target，
  且依赖未决，未推进。

### 9.2a container profile — 环境性阻塞（不硬闯）

- 维持既有记录：沙箱内核不允许嵌套命名空间（runc `unshare` 失败），纯 Go 构建面
  已完成，container smoke 保持 pending。

## 交接建议（root integrator）

1. `cmd/workbench-worker` 增加 Board publisher role 接线（`--enable-board-publisher`
  + sink 注入），sink 拓扑需 root 决策（跨进程 broker 或 in-process managed 模式）。
2. Taskfile 补 `test:board-event-watch:postgres`（指向
   `TestPostgresBoardPublisherManagedEngineMatrix`）与把
   `TestWorkerManagedProcessRestartDrainDisposablePG` 并入 `worker-restart-drain`
   scenario。
3. R1 provider 就绪后，收紧进程级测试断言为 registered/heartbeat/stopped 回执并
   关闭 5.0b2b2b2/b2b。

---

# R4 FRONTIER 追加：worker Board publisher 接线（2026-08-27 第二轮）

会话范围：`service/cmd/workbench-worker/`（本轮独占）+ 本报告。
未触碰：R4 `tasks.md`、`Taskfile.yml`、`service/internal/**`（上轮交付的
bootstrap 引擎面保持原样）。

## 本轮实现（cmd/workbench-worker 平面）

- `main.go`：新增 `--enable-board-publisher` flag（默认关闭，保持既有
  skeleton 行为）。开启时组合根注入 in-process `boardevents.Broker` 作为显式
  `BoardEventSink`，并写入 bounded 默认 `BoardPublisherTuning`
  （`defaultBoardPublisherTuning`：LeaseDuration=1m / RetryDelay=1s /
  IdleDelay=250ms）。sink 拓扑取最小决策：in-process managed 模式；跨进程
  投递面仍是 root 决策，本进程不伪造投递。
- role 约束 fail closed：Board publisher engine 固定 `RoleOutbox`，
  supervisor 要求 engine role 必须已选；`--enable-board-publisher` 与非
  outbox 单 role 组合在 config 校验后立即拒绝（exit 2，safe reason，不泄漏
  database URL）。outbox role 下 Board publisher 与 workflow outbox engine 经
  `EnableBoardPublisher` → `mergeRoleEngine` 复合为单个 supervisor 槽位，
  保持每 role 单 engine 合同。
- 缺 sink/缺 store 的构建期 fail-closed 仍由
  `boardPublisherEngineBuilder`（bootstrap 平面，上轮交付）承担，本轮未改。
- `printHelp` 增加 Board events 段说明。

## 新增测试（main_test.go）

- `TestRunWiresBoardPublisherIntoOutboxRole`：outbox role + flag →
  `EnableBoardPublisher=true`、sink 显式注入、tuning 为 bounded 默认。
- `TestRunLeavesBoardPublisherDisabledByDefault`：无 flag 时 sink 为 nil、
  publisher 不启用。
- `TestRunRejectsBoardPublisherWithoutOutboxRole`：scheduler role + flag →
  exit 2，safe reason，不泄漏 database URL。
- help 文本断言补 `--enable-board-publisher`。

## 验证命令与结果（本轮）

- `CGO_ENABLED=0 go test ./service/...`：全部 ok。
- `CGO_ENABLED=1 go test -race ./service/cmd/workbench-worker -count=2`：ok。
- `CGO_ENABLED=1 go test -race ./service/internal/workers/... ./service/cmd/workbench-worker ./service/internal/boards/events ./service/internal/workflows/outbox`：
  除下述 environment/pre-existing 失败外全部 ok。
- PG 矩阵（disposable PG 14，`initdb -U workbench -A trust`，port 15440，
  `WORKBENCH_TEST_POSTGRES_URL` + `WORKBENCH_POSTGRES_TEST_TARGET=disposable`）：
  `TestPostgresBoardPublisherManagedEngineMatrix`（5 子项）、
  `TestWorkerManagedProcessRestartDrainDisposablePG`（真实 binary，含本轮
  改动后重新 `go build`）、`TestWorkerStartupReadinessManagedRuntimePG` 全 PASS。
  R1 provider 缺失时的进程级 fail-closed（not-ready、零注册、零 claim、
  bounded drain）无回归。
- environment/pre-existing（如实记录，未反复重试）：
  `TestPostgresSchedulerFactoryW2SystemMatrix/crash_expiry_reclaim_and_restart`
  在本沙箱 disposable PG 上 `lease reclaim timeout`，与本轮改动无关（本轮 diff
  仅 `cmd/workbench-worker`，该用例不经此路径；上轮已在 HEAD 干净 worktree
  复现并判定为沙箱 PG 时序特性）。本轮复跑两次均同签名，停止重试。
- `openspec validate --all --strict`：45 passed, 0 failed。
- `go vet ./service/cmd/workbench-worker`：ok。

## 逐任务可勾选结论（2.4b2 增量）

- [x] `cmd/workbench-worker` 的 `EnableBoardPublisher` 接线：已完成，in-process
  broker sink 注入 + outbox role 约束 fail closed（见上方测试证据）。
- [ ] 跨进程 sink 拓扑（worker 进程与 workbenchd 内 broker 的投递面）：保持
  root 决策，本轮按最小决策落地 in-process 模式，不伪造跨进程投递。
- [x] `task test:board-event-watch:postgres`：已由 2026-08-27 Taskfile 补齐批次落地
  （Taskfile.yml:2524，指向 `TestPostgresBoardPublisherManagedEngineMatrix`，
  disposable PG 实测 passed，证据 run `20260827170733-017f8d34-…`）；
  `TestWorkerManagedProcessRestartDrainDisposablePG` 已并入 `worker-restart-drain`
  scenario（实测 run `20260827170842-c7f4be92-…`）。
- [ ] 进程级 Board publisher crash/reclaim 证据（重启后续传不丢 gap）：现有
  进程级测试只覆盖 scheduler role；Board publisher 的进程级矩阵依赖跨进程
  sink 拓扑决策，保持 open。

## 租约层 crash 窗口修复（2026-08-28 追加）

在 R4 worker 可靠性证据链排查中修复四个 workflow 租约层真实缺陷（均 pre-existing，均经 disposable PG 复现后最小修复， fence 作为租约安全权威的语义恢复）：

1. `workflow_queue.go`：claim 与 dispatch-intent 提交两个事务间的 crash 窗口使 step 永久滞留 `leased` 且扫描不可回收；扫描纳入 `reclaimableStates=[running, leased]`，回归测试 `TestWorkflowQueueRediscoversExpiredLeasedStep`。
2. `workflow_transaction.go`：`CommitWorkflowTransition` 状态匹配先于 fence 校验，旧 fence 迟到写入误报 `ErrVersionConflict`；fence 校验提前，`TestPostgresWorkflowLeaseFaultMatrix` 恢复通过。
3. `workflow_dispatch_intent.go`：`CommitDispatchIntent` 同款顺序遮蔽；fence 提前，新防护测试 `TestCommitDispatchIntentStaleFencePrecedesVersionConflict`（SQLite 永久）+ `TestPostgresCommitDispatchIntentStaleFencePrecedence`（disposable PG）。
4. `workflow_dispatch_outcome.go`：`CommitDispatchOutcome` 同款顺序遮蔽（pre-fix 即零写入，仅错误语义误导重试）；fence 提前，新防护测试 `TestCommitDispatchOutcomeStaleFenceRejectsWithoutWrites`（SQLite，断言零写入）+ `TestPostgresCommitDispatchOutcomeStaleFencePrecedence`（disposable PG）。

至此三个 lease-bound 提交入口（transition/intent/outcome）的 fence 优先语义统一：旧 fence 迟到写入一律报 `ErrFenceStale` 且零写入。

验证：四项修复后相关 PG 矩阵 `-race -count=3..10` 连跑全过，repository/workflows/workers/scheduler 回归零 FAIL。另注：`service/internal/runtime` 的 Aigora 系统测试当前因 sibling 仓 aigora 在制品（`runtime_owner_persistence_unavailable`）失败，分类 external/concurrent，与本仓改动无关。这些修复直接加固 5.0b2b2* 的 crash/reclaim 证据基础，但对应 tasks.md 勾选仍等 R1 provider 等既有外部依赖，未改动任何勾选。

---

# R4 FRONTIER 追加：Board publisher 跨进程 sink 落地（2026-08-28 第三轮）

会话范围：`service/internal/boards/events/`（新增 sink）、
`service/internal/workers/bootstrap/`（sink 模式接线）、
`service/cmd/workbench-worker/`（flag 面）、本报告追加节。
未触碰：R4 `tasks.md`（任何 checkbox）、`Taskfile.yml`、`docs/operations/**`、
`service/internal/identity|lifecycle|workitems|spatial/**`、transport 注册文件、
evidence runner、既有 broker/watcher/browser cursor 合同。

## 本轮实现（决策文档选项 A 落地）

- `service/internal/boards/events/committed_window_sink.go`（新增）：
  `CommittedWindowSink` 把 `Sink.Publish` 实现为「消费 board_events 已提交
  窗口并推进 worker 自身订阅位点」。实现前冻 结的三条不变量已写入源码
  注释：位点分离（worker 订阅位点与 browser signed cursor 是两个消费者
  位点，绝不合并——前者进程内、无签名面；跨进程投递真源是 PG outbox ack
  状态机）；恰好一次（位点只前进、重复投递幂等短路、ack 唯一性由 outbox
  原子抢占 + published 终态保证）；fail-closed（缺口/未提交/保留越界/
  resync 一律 `ErrResyncRequired`，publisher 以 `publish_unavailable` 重试，
  绝不越过缺口推进位点或冒充已投递）。连续性以保留 earliest 为基线
  （与 watcher 语义一致），支持多页扫描（MaxCatchUp 分页）。
- `service/internal/workers/bootstrap/board_publisher_engine.go`（修改）：
  `BoardPublisherTuning` 新增 `SinkMode`
  （`in-process` | `pg-outbox`，空值兼容既有 W0 调用方）；
  `boardPublisherEngineBuilder` 在 pg-outbox 模式下要求 store 同时满足
  `boardevents.WindowStore` 合同、拒绝外部注入 sink、内置
  `CommittedWindowSink`，任一缺失构建期 fail closed。既有 in-process 路径
  （显式 sink 注入）行为与错误面零回归。
- `service/cmd/workbench-worker/main.go`（修改）：新增
  `--board-publisher-mode`（默认 `in-process`，保持既有 W0 行为）与
  `--board-publisher-lease/retry/idle`（bounded 默认与显式覆盖；非法值
  exit 2 safe reason 不泄漏 database URL）。pg-outbox 模式不注入进程内
  broker——组合根不再伪造投递；help 文本同步。

## 进程级测试（决策文档第 4 节五项，全部实现）

`service/internal/workers/bootstrap/board_publisher_cross_process_pg_test.go`
（新增，disposable PG + 真实 binary 测试内 `go build`，guard 同既有矩阵）：
`TestPostgresBoardPublisherCrossProcessMatrix` 五个子测试：

1. **SIGKILL→lease 过期→接管续传 no-dup/no-gap**：确定性崩溃窗口由
   `boards` 表 ACCESS EXCLUSIVE 冻结制造（claim 的 JOIN 只触及
   outbox/events 不受影响，sink 窗口扫描首读 boards 被阻塞），victim
   停在 publishing 后 SIGKILL；断言崩溃行 attempt=1、lease 过期前不被
   抢占、接管进程 attempt+1 重投并清空 backlog；双账对账（outbox acked
   集合 == board_events committed 前缀）+ outbox probe ready。
2. **双进程并发 claim 恰好一次**：两 worker 并发消费 12 事件；采样窗口内
   每 sequence 只观测到单一 lease owner；全部行 attempt==1（无重抢/无
   重试）；双进程全程无死锁（probe 持续 ready）+ 对账。
3. **store outage 半程注入**：排他锁冻结 board_outbox → 进程 /readyz 的
   outbox role 依赖 not-ready（safe reason，断言不泄漏底层错误细节）→
   释放后自愈续传至 backlog 归零（真实 recovery）。进程级把 role probe
   折叠为 outbox safe code；store 粒度 `store_unavailable` 语义仍由既有
   engine 级 PG 矩阵持有（本轮复跑通过）。
4. **SIGTERM drain 与接管零丢失**：投递进行中 SIGTERM；断言 bounded drain
   干净退出（`shutdown.completed`）、零 publishing 残留（inflight 全部
   落账）、接管进程完成剩余 backlog 后双账对账零丢失。
5. **结构化对账 receipt**：五项共用的对账器产出
   `workbench.board_publisher_cross_process_reconcile.v1`（committed/
   acked 双账序列、exactly_once/no_gap/no_duplicate/backlog_zero 断言），
   经 `WORKBENCH_BOARD_PUBLISHER_CROSS_PROCESS_RECONCILE_DESTINATION`
   落盘，子测试 ⑤ 验证 JSON 内容，供 evidence runner
   `--collect-structured-artifact` 通道收集。

新增单元面：`committed_window_sink_test.go`（位点推进/幂等重投递/resync
fail-closed/多页扫描/保留基线 6 项）；`board_publisher_engine_test.go` 增
pg-outbox 构建期合同矩阵（拒绝外部 sink、缺窗口合同 fail closed、非法
模式 fail closed、合法组合位点推进）；`main_test.go` 增 pg-outbox 接线/
默认 in-process/未知模式拒绝 3 项。

## 验证命令与结果（本轮）

- `gofmt -l`（三个改动目录）：干净。
- `go vet`（boards/events、workers/bootstrap、cmd/workbench-worker）：干净。
- `CGO_ENABLED=0 go test ./service/internal/workers/... -count=1`：全 ok。
- `CGO_ENABLED=1 go test -race ./service/internal/workers/bootstrap/
  ./service/internal/boards/events -count=2`：全 ok。
- `CGO_ENABLED=0 go build ./service/cmd/workbench-worker`：ok。
- PG（`WORKBENCH_TEST_POSTGRES_URL=postgres://workbench@127.0.0.1:15440/
  postgres` + `WORKBENCH_POSTGRES_TEST_TARGET=disposable`）：
  `TestPostgresBoardPublisherCrossProcessMatrix` 五子测试全 PASS
  （11.4s，真实 binary）；回归面 `TestPostgresBoardPublisherManagedEngineMatrix`
  与 `TestWorkerManagedProcessRestartDrainDisposablePG` 复跑 PASS。
- 过程记录（如实）：首轮 sigkill 子测试曾用「观测到 publishing 再冻结
  outbox」方案，被 worker 速度击穿（ack 先于测试冻结落账）后 backlog 清空
  导致 30s 轮询超时；改为「启动前冻结 boards」的确定性窗口后稳定。另有一轮
  全矩阵 600s 超时为该失败路径泄漏 harness 连接所致（共享 PG 连接池耗尽），
  修正后未再复现。

## 逐任务结论与 2.4b2 勾选建议

- 本轮未改动任何 tasks.md checkbox。
- 「进程级 Board publisher crash/reclaim 证据（重启后续传不丢 gap）」的
  实现与 disposable PG 证据已按决策文档第 4 节五项闭合（见上），且以
  选项 A 冻结合同（worker sink 位点与 browser cursor 分离）实现。技术面
  支持勾选 2.4b2 该末项；是否勾选建议由主代理按证据覆盖度裁决。若要求
  evidence runner 收口（`test:board-event-watch:postgres` 指向新矩阵 +
  structured artifact 收集），Taskfile 归 root，本轮未越权改动；测试已预留
  receipt 落盘环境变量，接入 runner 只需 Taskfile 侧一行收集参数。
- 既有 open 项（5.0b2b2* 的 registration/heartbeat 收紧）仍以 R1 provider
  为外部依赖，不受本轮影响。
