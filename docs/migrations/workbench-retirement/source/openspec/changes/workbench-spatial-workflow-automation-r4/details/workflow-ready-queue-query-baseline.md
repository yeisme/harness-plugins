# Workflow ready queue query baseline

## 结论

R4 `5.1c` 已实现 GORM-owned bounded candidate query，并在 disposable PostgreSQL 14 验证 skewed tenant、公平窗口、DB-time eligibility、active/expired lease、cancel/timeout recovery 与批准索引计划。Repository 只返回 typed scheduling facts，不产生 scheduler decision，不创建 attempt/lease，也不修改 step state。

## 合同与边界

- `QueueScanLimit <= 1024`、`TenantWindowLimit <= 64`、`PerTenantScanLimit <= 64`；零值、越界值及 tenant window 大于 global scan 均 fail closed。
- `QueueCandidate` 只包含 tenant/run/step/definition/registry/version/priority/time、capability 与 bounded expired lease summary。
- DTO 不包含 payload、credential、endpoint、private path、artifact body 或完整 lease row。
- `CandidateFromRepository` 位于 scheduler package，保持 `scheduler -> workflow repository contract` 单向依赖；repository 不导入 scheduler policy 或 decision。

## GORM 查询结构

单次非空 scan 固定为 7 个 statement，数量不随 tenant 增长：

1. 读取 database time；
2. 查询最多 `TenantWindowLimit` 个 eligible tenant；
3. GORM generics association preload 通过 `LimitPerRecord` 生成 window SQL，一次加载所有 tenant 的 bounded candidate rows；
4. bounded run facts；
5. bounded composite definition-version facts；
6. bounded composite step-definition facts；
7. bounded unreleased expired lease summaries。

candidate preload 的 effective per-tenant limit 同时受 global scan fair share 约束，因此数据库返回 candidate rows 不超过 `QueueScanLimit`。应用代码不手写 `SELECT`、`ROW_NUMBER()` 或 raw query；window SQL 由 GORM `v1.31.2` 生成，所有 caller/data values 通过 bind 参数进入条件。

## Eligibility 与顺序

- 普通路径要求 `step=ready`；crash recovery路径允许拥有 unreleased expired lease 的 `step=running`。两者都要求 `ready_at_db IS NOT NULL`、ready time 不晚于 DB now、not-before 已到期。
- run 必须为 `running`，definition version 必须为 `published` 或 `deprecated`，run/definition checksum 与跨表 tenant 必须一致。
- active unreleased lease 排除；unreleased expired lease 使对应 running step成为 reclaim candidate，并只映射 lease ref、worker ref、fence epoch、lease version 与 expiry。
- stable order 为 tenant、priority、ready time、run ref、step-run ref；跨 tenant policy fairness 继续由 `5.1d` 负责。
- 任一关联缺失、跨 tenant/checksum drift 或 DTO validation failure 返回 `workflow_queue: unavailable`，不得静默跳过后 claim。

## 验证与容量

- `task workflow:queue:test`：contract、adapter、skew、statement count、5 轮 race 与 benchmark 全部通过。
- `BenchmarkWorkflowQueueCandidates1024`（SQLite/GORM 本地基线，10 次）：约 `102.8 ms/op`、`11.0 MB/op`、`249k allocs/op`；该值是回归基线，不代表 PostgreSQL SLO。
- PostgreSQL integration 覆盖 empty queue、hot tenant、其他 tenant 窗口、future not-before、active/expired lease、paused run、missing ready epoch、stable replay、零 mutation、cancel、table-lock timeout、恢复与 pool `InUse=0`。
- PostgreSQL `ANALYZE` 后的 measured plan 命中 `idx_workflow_ready_queue`；未使用 `enable_seqscan=off`。

## Evidence

- 成功六件套：`temp/integration-test-runs/20260728094220-d5f170f2-5d4d-4f88-8cf5-d17f78d26e1e/`。
- 保留的首次失败证据：`temp/integration-test-runs/20260728094057-85bcbbbf-7863-4330-9466-44d9c7d086c9/`，证明 plan receipt 相对路径错误保留原 exit code，修复后重跑通过。
- 成功 evidence 包含机器可读 `artifacts/workflow-queue-plan-receipt.json`，绑定 `0018` version/checksum、PostgreSQL engine、批准 index 与三项 hard limit。
- command path 已脱敏但保留真实 `go test` 命令；DSN、credential、row refs、SQL 参数与 provider payload 未进入 evidence。
