# Worker 生产依赖接线与跨项目交付计划

## 1. 目标

本计划把已经完成的 claim-disabled managed lifecycle 从“进程与状态机正确”推进到“真实生产依赖可验证、可恢复、可晋级”。它不允许使用 SQLite、静态 identity 成功桩、硬编码 registry digest 或空 queue probe 冒充生产就绪。

`5.0b2b2` 的完成条件不是 binary 能启动，而是 worker 能在真实 managed PostgreSQL、R0 contract registry、R1 service identity/delegation 和 workflow role cursor 上执行 fail-closed readiness，并留下可复核的注册、心跳、drain、shutdown evidence。

## 2. 当前事实与边界

| 能力 | 当前状态 | 生产判断 |
| --- | --- | --- |
| worker config、health、readiness、signal drain | 已实现并验证 | 可复用 |
| worker registration、heartbeat、drain、shutdown CAS | 已实现并验证 | 可复用 |
| managed lifecycle dependency refresh | 已实现并验证 | 可复用 |
| PostgreSQL GORM driver、external migration policy、`CheckReady`、DB time | 代码已存在 | 缺真实 PostgreSQL parity evidence |
| workflow schema、lease repository | SQLite component 已验证 | 缺 PostgreSQL migration、双 worker claim、fault matrix |
| operation registry | API runtime 内已有 sealed registry 与 digest | 缺 worker 可消费的 R0 canonical snapshot contract |
| typed step registry | 尚未实现 | 必须由 `5.2a` 前置最小 registry contract 提供 |
| R1 service identity/delegation | provider 与 consumer contract 未完成 | 必须 fail-closed，不得用 ref 存在性代替 authority |
| queue/outbox/reconcile cursor | schema 已有，repository/probe 未实现 | 启用对应 role 时必须 not-ready |
| Owner capability readiness | 尚未形成统一 snapshot | 单 Owner 失败只允许 capability degraded |

## 3. 生产装配图

```mermaid
flowchart LR
  CMD[workbench-worker command] --> CFG[validated managed config]
  CMD --> DB[(PostgreSQL external migration)]
  CMD --> R0[R0 canonical registry snapshot]
  CMD --> R1[R1 service identity authority]
  CMD --> ROLE[role readiness probes]
  CFG --> META[release and artifact metadata]
  DB --> CHECK[production dependency checker]
  R0 --> CHECK
  R1 --> CHECK
  ROLE --> CHECK
  CHECK --> LIFE[managed lifecycle]
  META --> REG[worker registration request]
  LIFE --> REG
  REG --> DB
  LIFE --> ADMIN[/healthz and /readyz]
  LIFE --> LOOP[heartbeat and drain loop]
  LOOP --> DB
  CHECK -. required failure .-> ZERO[ready false and zero claim]
  CHECK -. optional Owner failure .-> DEG[capability degraded]
```

## 4. Readiness 合同

### 4.1 Required components

| component | version | probe | 失败 reason |
| --- | --- | --- | --- |
| `database` | schema version | `GORMStore.CheckReady` | `database_unavailable`、`schema_incompatible` |
| `database_time` | schema version | `GORMStore.DatabaseTime` | `database_time_unavailable` |
| `operation_registry` | canonical digest | R0 snapshot digest equality | `operation_registry_unavailable`、`operation_registry_mismatch` |
| `step_registry` | canonical digest | typed step registry digest equality | `step_registry_unavailable`、`step_registry_mismatch` |
| `service_identity` | identity contract version | R1 credential source/rotation readiness | `service_identity_unavailable` |
| `delegation` | delegation contract version | owner-audience exchange readiness | `delegation_unavailable` |
| `queue` | cursor contract version | scheduler/claimer probe，按 role 启用 | `queue_unavailable` |
| `outbox` | cursor contract version | outbox publisher probe，按 role 启用 | `outbox_unavailable` |
| `reconcile` | cursor contract version | reconcile cursor probe，按 role 启用 | `reconcile_unavailable` |

所有 raw error 只映射为稳定 reason；readiness 不输出 DSN、endpoint、credential source value、private path、token、provider payload 或 SQL error。

### 4.2 Optional components

Owner capability snapshot 使用 `owner:<id>:<capability>` component。单 Owner outage、contract mismatch 或 rate-limit 只将相关 capability 标记 degraded；如果当前启用 role 的全部可执行 capability 都不可用，scheduler role 自身转 not-ready，但不降低 health。

### 4.3 状态规则

- `healthz=200` 只说明进程与 admin server 存活。
- 任一 required probe 失败：`readyz=503`、不注册新 worker 或已注册 worker 停止新 claim。
- dependency 恢复后必须重新检查 registry/identity/cursor，再允许晋级；不得只凭一次 heartbeat 恢复 ready。
- worker 已注册后 dependency 失败仍维持 registration heartbeat，使 operator 能观察 degraded 实例；claim loop 必须独立受 readiness gate 约束。
- drain 开始后 readiness 永久 false，停止新 claim，并在 bounded deadline 内写 shutdown receipt。

## 5. 原子实施切片

### 5.0b2b2a：生产依赖聚合器

- 新建纯 Go checker，输入只接受 typed probe interfaces 和 safe versions。
- 对 DB/schema/time、registry、identity、role cursor 和 optional Owner 进行 deterministic aggregation。
- nil probe、unsafe version、duplicate component 一律 fail-closed。
- 该切片不得连接网络或数据库，使用 contract tests 验证错误映射与恢复。

### 5.0b2b2b：PostgreSQL 与注册元数据装配

- command 只以 `DriverPostgres + SchemaPolicyExternalMigration` 打开数据库。
- registration metadata 必须来自批准的 release/source/artifact/step-registry/roles digest，缺失时启动失败。
- startup 先执行 DB/schema/time probe，再注册；不得 `AutoMigrate` 或 fallback SQLite。
- shutdown 关闭 heartbeat、写 receipt、关闭 DB pool，失败返回非零但不泄漏 raw error。

### 5.0b2b2c1/c2：R0 operation 与 step registry 对接

- R0 输出 canonical operation snapshot、typed step snapshot、contract version 和 digest。
- API、SDK、worker 使用同一生成来源；worker 不复制 operation 常量列表。
- expected 与 observed digest 不一致时零 claim，并在 safe diagnostics 中仅给出 contract version 与 mismatch reason。

### 5.0b2b2d：R1 identity/delegation 对接

- 由 R1 提供 service credential source、rotation readiness、owner-audience exchange 与 delegation receipt verifier。
- `service_identity_ref` 只是批准配置引用，不是 readiness 证明。
- human/automation credential 不得被 worker 当 service identity；`aud=workbench` token 不得直接转发 Owner。
- provider 未交付时保持 `service_identity_unavailable` 或 `delegation_unavailable`，不得加入 production candidate。

### 5.0b2b2e：role cursor 与真实恢复验证

- scheduler、outbox、reconcile 分别提供 bounded query 和 lag/cursor probe。
- 根据启用 roles 动态要求 probe；未启用 role 不制造全局 failure。
- 在真实 PostgreSQL 执行 schema ahead/behind、DB disconnect/reconnect、registry mismatch、identity outage/recovery、restart、SIGTERM drain、shutdown receipt 测试。

## 6. 跨项目对接合同

| 对接方 | 必须交付 | Workbench consumer gate | 不接受的替代 |
| --- | --- | --- | --- |
| R0 production foundation | migration manifest、canonical registry snapshot、release metadata schema | digest/version equality、external migration | 手写 digest、runtime AutoMigrate |
| R1 identity platform | workload credential、rotation、delegation exchange/receipt、safe readiness | audience/tenant/scope/expiry/contract checks | local bearer、仅校验 ref 非空 |
| R2 Owner adapters | capability snapshot、receipt/status/reconcile contract | capability-scoped degraded、unknown outcome reconcile | provider raw payload、自动重发 mutation |
| R5 release | approved builder、SBOM/provenance、worker artifact metadata | W1-W8 evidence 全部通过后纳入 | 空 binary、永久 claim-disabled candidate |

## 7. Taskfile 与 evidence 入口

计划入口：

```bash
task worker:production-dependencies:test
task test:workflow-component SCENARIO=worker-startup-readiness
task test:workflow-component SCENARIO=worker-restart-drain
task test:workflow-component SCENARIO=worker-dependency-recovery
WORKBENCH_TEST_POSTGRES_URL=... task test:workflow-schema:postgres:component
WORKBENCH_TEST_POSTGRES_URL=... task test:workflow-lease:postgres:component
WORKBENCH_TEST_POSTGRES_URL=... task test:workflow-lease-faults:system
```

所有 component/system/e2e 入口写入：

```text
temp/integration-test-runs/<run-id>/
```

至少包含 `summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json` 和 `artifacts/`。PostgreSQL URL、identity credential、Authorization header、delegation token、Owner payload 和 private path 必须脱敏。

## 8. Promotion 门禁

`5.0b2b2` 只有在以下条件全部满足后才能关闭：

1. `5.0b2b2a` 至 `5.0b2b2e` 全部完成并有 evidence reference。
2. `4.1b`、`4.3b2`、`4.3c` 的真实 PostgreSQL 证据通过。
3. R0 registry 和 R1 service identity/delegation 均有 provider/consumer contract digest。
4. required dependency outage 证明零 claim；optional Owner outage 证明 capability-scoped degraded。
5. restart/drain/shutdown receipt、DB pool close 和 goroutine cleanup 通过 race/fault 测试。
6. R5 仍保持 worker artifact gate，直到 W1-W8 完整通过。

当前阶段允许完成 `5.0b2b2a` 的纯合同实现；在 PostgreSQL、R0 与 R1 外部依赖未交付前，不得宣称 `5.0b2b2`、worker production readiness 或 R4 完成。
