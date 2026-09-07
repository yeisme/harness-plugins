# Workflow scheduler factory 与 PostgreSQL W2 基线

## 结论

R4 `5.2b1d` 已完成 scheduler-only production factory、真实 role probe、bounded startup scan，以及 disposable PostgreSQL 上的独立进程 W2 系统矩阵。`5.2b1a-d` 因此全部完成，R5 可以引用该交付作为 D1b1c1 scheduler/claimer 基线；但 production claim authority 仍默认关闭，mutation step 仍不可 claim，本结论不构成生产发布授权。

## Production factory

- `RuntimeInputConfig.EnableSchedulerEngine` 只在唯一 selected role 为 `scheduler` 时挂载 builder；未选择 scheduler、混合 role 或 store contract 不完整均在 engine 构造阶段 fail closed。
- factory 使用 canonical step snapshot、validated worker contract range、GORM queue/lease repository、bounded capacity、随机 opaque lease/attempt ref、scheduler scan engine、handle queue、per-lease heartbeat owner 与 drain coordinator 组装一个 `RoleEngine`。
- 默认 builder 固定使用 `DisabledAuthority`，因此生产启动即使 queue 中存在 eligible candidate 也保持零 claim；允许 authority 的 builder 仅供同 package 系统测试使用，没有 CLI/env 开关。
- supervisor probe 直接委托真实 scheduler engine freshness/latency/backlog/claim 状态，不使用 static ready probe。首次 DB scan 暂时失败时 role 保持 not-ready并可恢复；首次 scan context 超时时启动失败并回滚，不进入 running。

## 生命周期修正

- lease handle 不再继承单次 scan context。claim RPC 完成后，handle 由 `RoleEngine`、heartbeat owner 与 drain coordinator 共同拥有，startup/scan context 结束不会误取消有效 lease。
- `MaxClaimsPerBatch` 限制成功 claim 数，不限制候选检查数；denied/unsupported candidate 不会饿死同批后续 eligible candidate。
- `LoopProcessor` 以 handle queue 可用槽位限制成功 claim，避免 blocked enqueue，同时仍允许跨过 denied/contended candidate。
- scheduler 初始 scan 使用 caller timeout；timeout 后 engine 进入 stopped，probe 返回 not-running，普通 repository outage 则保留 bounded backoff 与后续 recovery。

## Restart 与重新发现

- pre-dispatch `drain`/`claim_abandoned` release 在同一 GORM transaction 中写 lease release history，并将对应 `running` step CAS 为 `ready`、version 加一、`ready_at_db=database_now`、清除 not-before；restart scheduler 可立即重新发现。
- ready queue 除普通 `ready` row 外，还可读取拥有 unreleased expired lease 的 `running` row，并映射 bounded expired summary；atomic claim 在同一 transaction 写 `expired_reclaim` history和递增 fence epoch。
- active unreleased lease 继续从 queue 排除，release/reclaim 都保留 attempt 与 lease history；旧 heartbeat、旧 fence 和旧 terminal transition 仍被拒绝。

## W2 PostgreSQL system matrix

系统测试 `TestPostgresSchedulerFactoryW2SystemMatrix` 使用真实 PostgreSQL schema、生产 GORM repository、production scheduler factory 和独立 OS test processes，覆盖：

1. migration 前真实 queue probe not-ready，migration 后自动恢复；
2. 两进程通过文件 barrier 同时启动，对同一 eligible step 恰好一个 lease/attempt winner，loser零残留 row；
3. heartbeat 推进 lease version，两个 worker wall clock 分别偏移 `+24h/-24h`，claim/expiry/reclaim仍仅依据 DB time；
4. unsupported side-effect mutation 与 eligible read 同批时 mutation 零 claim，read 不被 starvation；
5. 四 tenant、两 worker、每进程 global capacity 1 时形成两个不同 worker/tenant owner，剩余 ready work 不突破 backpressure；
6. worker 被 OS kill 后，第二独立进程在 DB-time expiry 后 reclaim，fence epoch 增加且旧 lease写 `expired_reclaim`；
7. SIGTERM drain 写 `release_reason=drain`并返回 ready，第二独立进程无需等待 expiry即可 restart claim。

系统 receipt 只记录布尔结论与低基数计数，不记录 DSN、candidate/ref 列表、payload、credential或 raw SQL参数。

## 验证与证据

- Component：`task test:workflow-component SCENARIO=worker-scheduler-claimer`
- System：`task test:workflow-system SCENARIO=worker-scheduler-restart-drain WORKBENCH_TEST_POSTGRES_URL=...`
- Component evidence：`temp/integration-test-runs/20260728111842-b172df75-e703-4989-be03-29c05fa0ad16/`
- System evidence：`temp/integration-test-runs/20260728111906-df136961-dfa8-498e-89dc-ea7b6fda74ba/`
- System artifact：`artifacts/workflow-scheduler-w2-matrix.json`
- 两套 evidence 均为 `status=passed`、`exit_code=0`、redaction enabled、`total_redactions=0`；system 运行包含三轮普通 PostgreSQL矩阵和一轮 race detector矩阵。

## 后续边界

- `5.2b2` 才负责 typed executor worker pool与 fence-bound completion handoff；scheduler/claimer 不执行 descriptor、不提交 terminal state。
- `5.2b0b` 才负责四类 production engine factory 的完整组合；当前 scheduler-only selection 已真实接入，混合 roles仍 fail closed。
- mutation claim authority、dispatch intent repository与 unknown/reconcile durable store 继续由后续任务开启；不得通过新增 env flag绕过默认 `DisabledAuthority`。
