# Board Publisher 跨进程 sink 拓扑决策建议（R4 2.4b2 root 决策输入）

- 状态：决策建议（供 root integrator 裁决；本文不含实现）。
- 日期：2026-08-28。
- 依据：`details/r4-frontier-report.md`（含 2026-08-27 两轮追加节）、
  `service/internal/workers/bootstrap/board_publisher_engine*.go`、
  `service/cmd/workbench-worker/main.go`（`--enable-board-publisher`）、
  `service/internal/boards/events/`（outbox/live/cursor）、
  `service/internal/repository/board_outbox_store.go`。
- 当前落地态：in-process broker sink。`workbenchd` 与（flag 开启时的）`workbench-worker`
  各自构建 `boardevents.NewBroker` 并作为 `BoardEventSink` 注入 publisher；
  worker 进程 publish 到自身 broker 后，事件只在本进程有订阅者，不触达
  workbenchd 内的 browser watch 面。跨进程投递面因此仍未闭合。

## 1. 现状事实（决策输入）

1. **PG board outbox 已是完备的投递真源**：`board_outbox` 表（0006 建表、
   0013 增加 lease 列与 `idx_board_outbox_lease_expiry`）以
   `pending → publishing → acked/pending(重试)` 状态机承载投递；
   `GORMStore.ClaimBoardOutbox` 用条件 UPDATE 实现租约原子抢占
   （pending 或 lease 过期的 publishing 行均可被重新 claim，attempt 递增），
   `AckBoardOutbox`/`RetryBoardOutbox`（带 backoff 与 safe reason）闭环。
2. **事件真源同库**：`board_events`（committed sequence、signed cursor
   `board-event-cursor:v1`、retention generation）与 outbox 行经
   `event_ref/tenant_ref/board_ref/sequence` join；`Watcher.Watch` 先按
   `ListBoardEventWindow` 追历史（严格 `last+1` 连续性，gap →
   `board_resync_required`），再切 broker 订阅增量。
3. **publisher 引擎已有双重证据**：SQLite 单测 + disposable PG 矩阵
   （`TestPostgresBoardPublisherManagedEngineMatrix`：claim/publish/ack parity、
   崩溃租约过期回收 attempt 递增、未过期租约不被抢、排他表锁真实 outage →
   `store_unavailable` → 恢复、drain 等待 inflight 后零新 claim）。
4. **worker 接线 fail-closed**：`--enable-board-publisher` 固定 `RoleOutbox`，
   非 outbox 单 role 组合 exit 2；缺 store/sink 合同构建期拒绝；sink 为
   in-process `boardevents.Broker`。
5. **进程级 crash/reclaim 的缺环**：现有进程级测试（scheduler restart/drain）
   不含 Board publisher 进程；且 in-process broker sink 模式下「worker 崩溃后
   事件是否丢 gap」没有独立于 store 的可观测真源——投递结果只存在于本进程内存。

## 2. 选项 A（推荐）：既有 PG board outbox 作为跨进程 sink，worker 以 cursor 订阅

### 语义

`workbench-worker --enable-board-publisher` 继续从 PG `board_outbox` claim
并以**显式 PG 订阅 sink**（或等价 store-cursor 订阅面）投递；`workbenchd`
内既有 `Watcher` 保持「先 store 历史窗、后 broker 增量」的双段模型，broker
只服务 workbenchd 本进程的 browser SSE/gRPC 面。跨进程边界的安全真源永远是
PG（outbox ack 位点 + board_events committed sequence），而非任一进程内存。

### 论据（推荐）

- **零新权威**：R4 纪律是「Workbench 不创建第二套执行状态机」。outbox 已是
  合同化的单一投递真源（状态机、lease、fence、retention、cursor 全部已有
  PG 证据）；选项 B 会引入第二个 broker 权威，必须另建 offset/ack/重放/
  retention 合同，正是 AGENTS.md 禁止的 canonical state 复制。
- **崩溃语义免费获得**：worker crash 时已 claim 未 ack 的行在 lease 过期后被
  自动 reclaim（attempt 递增，已有 PG 证据）；browser 面因 watcher 以 store
  sequence 为基线、broker 只做增量，重启后 cursor 对不上即 `resync_required`
  → 客户端以 catch-up 窗口重建。「续传不丢 gap」由 PG 真源保证，不依赖任何
  进程内存。这正是 2.4b2 最后一项证据需要的性质。
- **运维面收敛**：无新部署组件、无新凭证面、无新网络路径；disposable PG
  测试栈（`WORKBENCH_TEST_POSTGRES_URL` + `WORKBENCH_POSTGRES_TEST_TARGET=disposable`
  guard）直接复用为证据环境；admin metrics 的
  `workbench.workflow.role.{backlog,lag_ms,dead_letters,published,retried}`
  已覆盖 outbox role 观测。
- **删除现有误投递面**：当前 worker 进程内 broker sink 的唯一效果是把事件
  发布到无人订阅的内存队列（worker 进程无 browser watch 面）。改为 PG 订阅
  sink 后，worker 进程的 publish/ack 才第一次有跨进程可观测的落点。
- **性能足够**：Board 事件扇出面是 workbenchd 内 broker（1024 订阅上限、
  64 buffer）+ 10k 节点 viewport 独立投影；跨进程链路只需 worker→PG→
  workbenchd watcher 的轮询/通知延迟，不承担 200-stream fanout（那是
  Project watch 面的预算，另有容量门）。

### 代价与风险（诚实列出）

- 需要一个**显式 PG 订阅 sink 实现**（worker 侧）：最小形态是「以
  `ListBoardEventWindow`-等价的 committed-sequence 扫描作为 ack 位点推进器」，
  即把现在的 `Sink.Publish` 合同实现为「写 board_events 已提交窗口的订阅
  位点」，语义等价于把 workbenchd 的 watch 双段模型拆到两进程。这里有一个
  必须在实现前冻结的合同点：**worker sink 的 ack 位点与 browser cursor 是
  两个消费者位点，不得合并成一个游标**（一个有 TTL+HMAC 面向不可信浏览器，
  一个是进程内位点）；实现建议是 worker sink 只消费 outbox→board_events 的
  已提交窗口并推进自身位点，workbenchd watcher 维持现状。
- 轮询延迟（worker `IdleDelay` 250ms 默认）叠加 watcher catch-up，端到端
  watch 延迟从进程内微秒级变为百毫秒级；对 Board 协作面可接受，但应写进
  2.4d 的延迟预期而非留白。

### 迁移路径（root 裁决后）

1. **合同冻结**：在 2.4b2 范围内明确「worker BoardEventSink=PG committed
   window 订阅位点」合同与 safe reason 码（复用 `store_unavailable` 语义），
   不新增进程外协议。
2. **实现**：`service/internal/workers/bootstrap/runtime_inputs.go` 接线块
   将 `BoardEventSink` 从 in-process broker 换为 PG 订阅 sink（managed profile
   强制、local profile 维持 in-process broker 不变）；`cmd/workbench-worker`
   flag 帮助文本同步。
3. **证据**：见第 4 节测试清单；全部经 `test:board-event-watch:postgres`
   的 disposable-PG target 收口。
4. **不做的事**：不引入外部 broker（选项 B）、不删除 workbenchd 内 broker
   （它仍是 browser 面扇出器）、不改 browser cursor 合同（TTL/HMAC 不变）。

## 3. 选项 B（不推荐）：独立事件 broker；选项 C（不推荐为终态）：维持 in-process W0-only

- **选项 B（NATS/Redis 等独立 broker）**：为跨进程投递引入第二个持久化权威
  （offset/ack/重放/retention 全套合同），与 outbox 真源形成双写一致性义务；
  违反「不复制 canonical state」纪律；新增部署组件/凭证/网络面；现有全部
  lease/fence/outbox 证据不能复用。只有当 Board 事件需要跨**服务**扇出
  （多消费服务、跨栈订阅、>千级持续扇出）时才值得，R4 范围内无此需求。
- **选项 C（维持 in-process W0-only）**：即现状。worker 侧 publisher 没有可
  观测落点，2.4b2 的「接入 managed worker 与 watch 面」永远缺跨进程半边，
  进程级 crash/reclaim 证据无法定义（崩溃时无外部真源可对账）。只适合作为
  R4 降级为 local-only 演示的兜底，不适合作为 2.4b2 的关闭路径。
- **结论**：推荐选项 A。它是唯一同时满足「单一权威、崩溃语义可证、运维面
  不扩张、既有证据直接复用」的路径。

## 4. 关闭 2.4b2 最后一项所需的具体测试

「进程级 Board publisher crash/reclaim 证据（重启后续传不丢 gap）」须由以下
用例闭合（全部 disposable PG、evidence runner 六件套、redaction 0）：

1. **进程级 crash→lease reclaim→续传不丢**（核心缺口）：
   `workbench-worker`（真实 binary，`--roles outbox --enable-board-publisher`，
   PG 订阅 sink）claim 一批 outbox 事件后 `SIGKILL`；等 lease 过期；重启第二个
   worker 进程。断言：(a) 被杀进程已 claim 未 ack 的行被以 attempt+1 重投；
   (b) 已 ack 的事件恰好投递一次（no duplicate / no gap，以 outbox 位点 +
   committed sequence 双账对账）；(c) 重启后 backlog 归零、ready=true。
2. **双进程并发 claim 恰好一次**：两个 worker 进程同时对同一 outbox 栈
   claim/publish/ack；断言每事件全局恰一次投递（唯一位点推进）且无死锁
   （对照 `TestPostgresOwnerChangeAndCommitBoardDoNotDeadlock` 的锁序纪律）。
3. **store outage 半程注入**：publish 循环中用排他表锁冻结 outbox 表 →
   worker ready=false 且 reason=`store_unavailable`（不透传底层错误）→
   释放后自愈并完成续传（现有 PG 矩阵用例的进程级升级版）。
4. **SIGTERM drain 与接管**：drain 期间停止新 claim、等待 inflight publish/ack
   完成；接管进程零事件丢失（对账同 1）；对照既有
   `TestWorkerManagedProcessRestartDrainDisposablePG` 的 shutdown 回执纪律。
5. **对账断言器**：以上用例共用一个对账器——读 `board_outbox` 全量状态与
   订阅位点，断言「acked 集合 == 位点前缀集合」且无序外事件；结果写结构化
   receipt（如 `workbench.board_publisher_cross_process_reconcile.v1`），
   纳入 `test:board-event-watch:postgres` 的
   `--collect-structured-artifact` 通道。

前置依赖（root 侧输入）：第 2 节迁移路径第 1 步的 sink 合同冻结；
R1 workload identity provider（5.0b2b2d）就绪后，同批进程级测试可一并收紧
registered/heartbeat/stopped 回执断言（与 frontier report 交接建议一致）。

## 5. 与既有文档的关系

- `details/r4-frontier-report.md` 末节「跨进程投递面是 root 决策」的展开与
  建议；两处勾选结论以该报告为准，本文不改动任何 tasks.md 状态。
- `details/workbench-worker-production-process-contract.md`、
  `details/workbench-worker-w0-implementation-baseline.md`：worker 进程合同
  与 in-process 最小决策的原始出处。
