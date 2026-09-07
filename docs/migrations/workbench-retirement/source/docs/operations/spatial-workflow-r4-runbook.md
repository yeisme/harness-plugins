# Spatial 与 Durable Workflow R4 运行手册

> 覆盖 R4（`workbench-spatial-workflow-automation-r4`）9.3 的运行面：board/workflow
> 合同与集成测试入口、fault 注入矩阵、performance/soak 与预算、dead-letter 与
> reconcile 操作路径、kill switch 清单、rollback dry-run。所有命令均指向当前
> Taskfile 中真实存在的 target（`task --list` 可发现）；只读/plan/写分类遵循
> `production:guard` 合同。long-run 与 system 证据由 evidence runner
> （`bun scripts/test-evidence/run.ts`）写入 `temp/integration-test-runs/<run-id>/`
> 脱敏六件套；staging 外部门控（24h soak、真实 Owner canary）需要 operator
> 环境，本地不得伪造。

## 1. 合同（contract）入口

Board 与 Workflow 的 Proto/JSON Schema/step registry 单一真源生成与校验：

```bash
task board:contract:generate        # 生成 Board JSON Schema + Go 协议资产
task board:contract:check           # Board 合同一致性（schema-export --check + buf lint + 资产测试）
task workflow:contract:generate     # 生成 Workflow JSON Schema + Go 协议资产
task workflow:contract:check        # Workflow 合同一致性
task test:board-contract:component  # Board 合同 redacted component 证据
task test:workflow-contract:component
```

带证据的 contract 快照校验（release CLI 面向 OpenSpec authority）：

```bash
task spec:validate SPEC_CHANGE=workbench-spatial-workflow-automation-r4
task release:handoff:validate ENV=integration   # REGISTRY 默认 temp/release/handoff.json，缺文件 fail-closed
```

## 2. 集成（integration / transport parity）入口

本地四传输（HTTP REST/SSE、gRPC unary/stream、JSON-RPC 2.0、SDK facade）一致性：

```bash
task test:board-transport-parity      # Board CRUD/viewport/owner-change/event 本地 parity 证据
task test:workflow-transport-parity   # Workflow transport parity 证据（real Owner reconcile 与 PG 面分离）
task test:board-undo-transport-parity # Board undo 安全投影与再授权执行 parity
```

PostgreSQL 面（必须显式提供隔离 DSN，并声明 disposable 目标）：

```bash
WORKBENCH_TEST_POSTGRES_URL='postgres://workbench@127.0.0.1:15432/postgres?sslmode=disable' \
WORKBENCH_POSTGRES_TEST_TARGET=disposable \
  task test:board-service:postgres
WORKBENCH_TEST_POSTGRES_URL=... task test:board-event-list:postgres
WORKBENCH_TEST_POSTGRES_URL=... task test:board-event-watch:postgres   # Board publisher managed engine 矩阵
WORKBENCH_TEST_POSTGRES_URL=... task test:board-viewport:postgres
WORKBENCH_TEST_POSTGRES_URL=... task test:workflow-schema:postgres:component
WORKBENCH_TEST_POSTGRES_URL=... task test:workflow-lease:postgres:component
WORKBENCH_TEST_POSTGRES_URL=... task test:workflow-outbox:postgres:component
WORKBENCH_TEST_POSTGRES_URL=... task test:workflow-queue-projection:postgres:component
```

Disposable PostgreSQL 本地配方（仅 loopback）：`initdb -U workbench -A trust`，
`pg_ctl -o "-p 15432 -k <0700 dir> -c listen_addresses=127.0.0.1"`；任何非
loopback 或共享库使用都违反 disposable guard（`WORKBENCH_POSTGRES_TEST_TARGET=disposable`
声明 + per-test `CREATE SCHEMA` 承担隔离）。

## 3. Fault 注入矩阵入口

| 矩阵 | 入口 | 覆盖 |
| --- | --- | --- |
| workflow lease faults | `WORKBENCH_TEST_POSTGRES_URL=... task test:workflow-lease-faults:system` | 真实进程 PG 时钟偏移、heartbeat 断连、crash、DB-time 回收、重启、迟到 fence 拒绝 |
| claimer drain | `WORKBENCH_TEST_POSTGRES_URL=... task test:workflow-claimer-drain:system` | 真实进程 SIGTERM 释放 pre-dispatch lease，且只允许一个 fenced 后继 claim |
| scheduler restart/drain | `WORKBENCH_TEST_POSTGRES_URL=... task test:workflow-system SCENARIO=worker-scheduler-restart-drain` | W2 scheduler 公平性/claim/heartbeat/回收/drain/重启矩阵（结构化 artifact） |
| dispatch/reconcile | `task test:workflow-system SCENARIO=dispatch-reconcile OWNER=test` | allowlist test Owner 派发、bounded 同键重试、no-duplicate crash 矩阵 |
| worker restart/drain | `task test:worker-restart-drain:component`（PG 用例在导出 DSN 时自动并入） | SIGTERM bounded drain、bootstrap 失败不悬挂、disposable-PG 进程级重启矩阵 |
| board event/outbox | `task board:event-watch:test` + `task board:event-list:test` | leased outbox handoff、有界订阅者、gap resync、去重、重启 |
| project 面 fault | `task project:fault:test`（R3 复用） | trigger 风暴/重启去重、disable fence kill switch、outbox rollback/gap、watch 瞬断恢复 |

crash 证据纪律：每个 crash point 保留原退出码与完整六件套；unknown_outcome
只 reconcile 不重发；失败 run 不得删除（source-snapshot 保护会拒绝并发源码变更期间的运行）。

## 4. Performance / soak 入口与预算

Board viewport 10k 容量预算（`service/internal/repository/board_viewport_postgres_capacity_test.go`
是唯一权威数值源）：首页查询 warm p95 预算 **near=400ms、medium=150ms、far=150ms**，
有界分页（near 50/页、medium 500/页、far 1000/页）、EXPLAIN 拒绝 Seq Scan、无 N+1。

```bash
WORKBENCH_TEST_POSTGRES_URL=... task test:board-viewport:performance   # 10k 容量 p50/p95 证据
WORKBENCH_TEST_POSTGRES_URL=... task test:performance SCENARIO=spatial-workflow   # 9.3 统一入口（board viewport）
WORKBENCH_TEST_POSTGRES_URL=... task test:performance SCENARIO=project-capacity   # 50k WorkItem/64 字段 + 200-stream watch fanout（Project 复用）
WORKBENCH_TEST_POSTGRES_URL=... task test:performance SCENARIO=daily-operations   # 100k asset search + 50k WorkItem + 200 SSE（R3 8.4 本地半场）
task test:security                                                     # security smoke（诊断面）
```

Soak 分层（不得混淆证据层）：

- **本地合同面**（随时可跑，无 staging）：`task project:data:staging:soak:test`、
  `task test:project-data-staging-soak:component`。只验证固定 24h 策略、公共合同
  observer、redaction 与 rollback receipt 校验，不产生 24h 证据。
- **staging soak 外部门控**：真实 24h observer、action/kill-switch receipt、
  rollback receipt 与 SLO 报告需在 staging 控制环境执行（拓扑与合同见
  `docs/operations/project-data-staging-soak.md`；终态由
  `task project:data:staging:finalize` 绑定恰好八份 receipt，缺失/重复/不匹配一律 fail-closed）。
  场景化 staging soak 走 `task release:soak ENV=staging [SCENARIO=workflow|daily-operations|project-data]`
  （R4 10.4 / R3 8.4 的 soak 半场；缺 staging 输入按名报缺失，exit 5）；
  `task tenant:cutover:workflow-canary ENV=canary DRY_RUN=1` 是固定 exit 5 的公开
  provider-blocked sentinel：它不读取输入、不会校验计划，也不会产生 canary evidence。
  离线诊断计划必须以私有 `0400/0600` authority source 生成唯一新文件：
  `task release:workflow-canary:plan:generate SOURCE=<private-source> OUTPUT=<new-private-plan>`。
  `task release:workflow-canary:plan:validate SOURCE=<private-source> PLAN=<private-plan>` 在绑定仍有效时也
  固定 exit 5；其 `plan_valid=true` 不等于 execution/production authorization。真实切换只能由未来
  managed authority 独立重验并执行；
  R4 2.4c5 的 owner-contract 半场走
  `WORKBENCH_OWNER_CONTRACT_URL=<approved> task test:board-target-resolver:owner-contract`
  （真实 provider 合同 canary，缺输入按名报缺失 exit 5，fixture 不算数；
  approve 的 provider contract digest 与 Owner outage-recovery 证据另属 2.4c5）。

## 5. Dead-letter / reconcile 操作路径

数据流：reconcile engine 对未知/冲突真值与超限 attempt 产出 dead-letter
（`needs_operator` / `needs_contract`），operators 服务是唯一恢复入口。

- 只读观测（优先）：
  ```bash
  # 角色 backlog/lag/dead_letters/consecutive_failures/backoff（低基数，admin listener）
  curl -s -H "Authorization: Bearer $WORKBENCH_ADMIN_TOKEN" http://127.0.0.1:<admin-port>/metrics | grep workbench_workflow_role
  curl -s http://127.0.0.1:<port>/readyz
  ```
- 干预命令面（typed operators API；force_fail/requeue 要求强认证 TTL 内 session、
  `workflow.operator.dangerous` scope 与显式 `approval_ref`；全局 kill switch 必须 approval）：
  requeue 只允许 `attempts_exhausted` / `deadline_exceeded` / `rejected_before_send`
  且外部真值已 settled 的 dead-letter；`ExternalTruthUnknown` 或已持久化
  dispatch intent 时 requeue 被拒绝，只能 reconcile/force_fail。
- 相关验证入口：`task test:workflow-reconcile-role:component`、
  `task test:workflow-operator-controls:component`、
  `task test:workflow-run-control:component`（pause/resume/cancel 语义）。
- 禁止：dead-letter 自动重试、伪造 cancelled、绕过 authority 直接改 repository。

## 6. Kill switch / capability flag 清单

Workflow 内部分层 switch（`service/internal/workflows/operators`，scope 优先级
global > tenant > definition > capability > owner；关闭阻断 claim/dispatch、保留 reconcile）：

| Scope | 示例 ref | 效果 |
| --- | --- | --- |
| `global` | `global:workflow` | 全 workflow 停新 work（须 approval） |
| `tenant` | `tenant:<ref>` | 单租户停新 work |
| `definition` | `definition:<ref>` | 单定义停新 work |
| `capability` | `capability:<ref>` | 单 capability 停新 work |
| `owner` | `owner:<ref>` | 单 Owner 停 dispatch（reconcile 保留） |

Server capability 环境变量（`service/internal/runtime`，失败即 unavailable/只读降级，
additive schema 不回滚）：

| Flag | 能力面 | 回退效果 |
| --- | --- | --- |
| `WORKBENCH_PROJECT_WORKSPACE_ENABLED` | Project workspace | mutation 只读化（503 封套），读路径保留 |
| `WORKBENCH_PROJECT_CUSTOM_FIELDS_ENABLED` | 自定义字段 | 同上 |
| `WORKBENCH_PROJECT_CANVAS_ENABLED` | Project canvas | 同上 |
| `WORKBENCH_PROJECT_AUTOMATION_ENABLED` | Project automation | 停新 run 派发（trigger/schedule/manual fence 前检查），已提交 run reconcile 不受影响 |
| `WORKBENCH_MISSION_BRIEF_ENABLED` | Mission Brief | operation 不注册（unavailable），数据只读保留 |
| `WORKBENCH_AGENT_PROPOSAL_AUTHORITY_ENABLED` | Proposal authority | proposal authority 面回退（flag-off fallback） |
| `WORKBENCH_CLI_PANE_ENABLED` / `WORKBENCH_CLI_OPERATION_COMMANDS_ENABLED` / `WORKBENCH_CLI_AGENT_DELEGATED_READ_ENABLED` / `WORKBENCH_CLI_HOST_CANARY_ENABLED` | CLI host 面 | 对应 CLI capability 关闭 |
| `WORKBENCH_RUNTIME_CONNECTION_TEST_ENABLED` / `WORKBENCH_RUNTIME_GENERATE_ENABLED` | client runtime | 对应 runtime 面关闭 |
| `WORKBENCH_AGENT_REFERENCE_ADAPTER_ENABLED` | Agent reference adapter | adapter 关闭 |

Worker 面：`workbench-worker --enable-board-publisher` 默认关闭；启用需 `--roles outbox`
（非 outbox 组合启动即拒绝，exit 2）。Board publisher engine 在 store/sink 合同不可用时
ready=false（safe reason，如 `store_unavailable`），不透传底层错误。

紧急降级顺序：先 capability/owner scope switch（保 reconcile），再 server flag
（读路径保留），最后进程 drain/restart（`--drain-timeout` 有界）。

## 7. Rollback dry-run

```bash
# 1) 本地合同演练（只读 plan；验证 rollback receipt 契约 + runbook 与 target registry 一致）
task release:rollback:dry-run ENV=staging
# 缺 WORKBENCH_STAGING_ROLLBACK_RECEIPT（或文件不存在）时 fail-closed：
# 输出 missing staging inputs by name，exit 5，不执行任何 rollback；
# receipt 内容由 workbench-project-soak validate-rollback 严格校验，
# 拒绝 duplicated attempt ref / unknown status / unreconciled unknown_accept /
# active new mutations / nonzero P0/P1（对照 docs/operations/project-data-staging-soak.md）。

# 2) runbook 漂移检测（发布前必跑）
task runbook:validate

# 3) 单事件只读演练计划（不执行 detect/contain/recovery）
task incident:drill ENV=staging INCIDENT=INC-WORKFLOW
```

R4 rollback 不变量：不删除 run/receipt/event（additive schema 不做 down migration）；
已发送 mutation 继续由 reconcile 收敛，不自动重发；worker drain 后重启按
supported contract range 重新全检（schema 漂移 → 零 claim fail-closed）；
kill switch 关闭不删除任何持久化状态。

## 8. 证据与升级

- 全部 long-run/system 证据必须经 evidence runner（六件套 + redaction 扫描，
  credential/token/raw payload/private path/PII 为零 redaction 计数才算干净）。
- `task release:readiness ENV=...` 基于证据新鲜度/digest fail-closed，可作为升级前自检。
- staging 面动作（24h soak、真实 Owner canary、production authority）保持
  `planned`/外部批准，本地证据不得宣称已关闭。
