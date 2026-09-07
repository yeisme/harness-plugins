# Workbench 生产命令可用性与执行门禁

## 1. 目的

本文件冻结 Demo 到 Production 计划中所有直接命令的可用性语义，防止 OpenSpec、runbook 或工作包引用尚不存在的 Taskfile target，却在交接时被误认为“可以执行”。

命令存在只证明入口可发现，不证明底层 provider、权限、环境、证据或生产 authority 已就绪。命令不存在、只实现诊断语义或依赖未批准 provider 时，release readiness 必须返回明确 blocker 与 owning task，不能跳过、手工替代或伪造成功。

## 2. 状态模型

| 状态 | 含义 | 允许进入工作包 | 允许作为 production evidence |
| --- | --- | --- | --- |
| `available` | target、CLI、参数、负向测试和预期退出语义均存在 | 是 | 仅当本次运行环境与 authority 同时满足 |
| `diagnostic_only` | target 可运行，但合同明确禁止授予 production authority | 仅允许计划、审计或 No-Go 计算 | 否 |
| `planned` | OpenSpec 已冻结合同，但 `task --list-all` 尚不可发现 | 否 | 否 |
| `provider_blocked` | consumer target 存在，但真实 provider、trust、receipt 或环境缺失 | 仅允许 fail-closed 验证 | 否 |
| `deprecated` | 仅用于旧资产只读迁移或诊断 | 否 | 否 |

未知 target 或状态必须按 `planned`/blocked 处理，不能默认 `available`。

## 3. 当前审计快照

以下状态来自当前工作树的 `task --list-all`，只描述入口存在性；任何代码、Taskfile 或文档变化后必须重建，不能长期依赖本表作为机器权威。

### 3.1 已存在入口

| 命令族 | 当前状态 | 当前边界 |
| --- | --- | --- |
| `release:requirements:*` | `available` | 仅 requirement/evidence index 与直接证据重验 |
| `release:handoff:*` | `available` | 未签齐 provider/consumer/environment 时预期 blocked |
| `release:manifest:generate/validate` | `available` | stable v3 authority 未完成前不得 promotion |
| `release:readiness` | `diagnostic_only` | 只计算 No-Go/blocker，不执行 deploy |
| `release:promotion:init/dry-run/validate` | `diagnostic_only` | 当前不得推进真实 stage |
| `release:audit:*` | `diagnostic_only` | `production_authorized=false` |
| `release:slo:validate` | `provider_blocked` | 需要 managed telemetry/query/trust authority |
| `db:backup`、`db:migrate*`、`db:restore:verify*` | `provider_blocked` | 本地基础存在，managed PostgreSQL/PITR/DR authority 未完成 |
| `workflow:*` domain/schema/lease/readiness | `available` 或 `diagnostic_only` | 尚不能替代真实 scheduler/executor/outbox/reconcile system gate |

### 3.2 尚不存在入口

| 命令族 | 当前状态 | Owning task |
| --- | --- | --- |
| `deploy:validate/preflight/smoke`、`deployment:plan/apply/lookup/receipt:validate` | `planned` | R5 `3.4c`、`3.4d2b2b5b4`、`8.3a-8.3d` |
| `release:soak`、`release:canary*`、`release:rollback:dry-run` | `planned` | R5 `3.4d3-3.4d4` |
| `release:decision:validate`、`release:post-deploy` | `planned` | R5 `3.4d5`、`8.1-8.4` |
| `test:workflow-system`、`test:workflow-e2e` | `planned` | R4 `10.2-10.3`、R5 `6.3d1b1c6` |
| `tenant:cutover:*` | `planned` | R5 `7.0a-7.3c` |
| `disaster-recovery:drill` | `planned` | R5 `4.5` |
| `observability:validate` | `planned` | R5 `5.0-5.4` |
| `incident:drill` | `available`（read-only plan） | R5 `3.4e`；真实 staging 响应执行仍由 `5.5` 关闭 |

`runbook:validate` 已实现为 `available` 的 documentation validation target。它重验P0/P1事件owner、detect/contain/recovery target与当前registry gate；其中引用的planned/provider-blocked动作仍保持原状态，不因runbook校验通过而晋级。

`incident:drill` 已实现为 `available` 的 read-only drill plan target。它只生成单个事件的detect/contain/recover顺序与当前authority blocker，限制在integration/staging，不执行任何响应动作；因此target存在不表示paging、incident authority、关闭receipt或production-like staging drill已完成。

## 4. CLI-authored target registry

`3.4e0` 已实现 CLI-authored target registry，而不是让 Markdown 表格成为状态数据库。实现基线见`production-target-registry-baseline.md`。每条记录包含：

- `target`
- `owner_task`
- `status`
- `authority_level`
- `required_inputs`
- `expected_exit`
- `evidence_layer`
- `provider_dependencies`
- `consumer_dependencies`
- `rollback_or_failure_action`
- `source_digest`

registry 生成器必须读取 Taskfile/CLI help 与批准的 OpenSpec target contract，输出稳定排序和 source digest。它不得执行生产写入，也不得因 target 名称存在就写 `available`。

## 5. 工作包 entry/exit 规则

1. 工作包引用的每条直接命令必须在 registry 中存在。
2. `planned` 命令使工作包保持 `blocked`，并返回 owning task。
3. `diagnostic_only` 命令只允许证明 No-Go、计划或 schema/contract 正确，不能证明环境、provider 或 production ready。
4. `provider_blocked` 命令必须以合同规定的非零 domain exit 结束，并保留脱敏 evidence；零退出属于缺陷。
5. 长时、integration、system、e2e、fault、restore、soak 和 canary 命令必须通过 evidence runner 写六件套。
6. docs/Taskfile/CLI help/registry 任一 digest 漂移时，受影响工作包退回 `blocked` 并重验。

## 6. 验证矩阵

| 场景 | 期望 |
| --- | --- |
| 文档引用不存在 target | validator 非零退出并给出 owning task |
| target 存在但只有 diagnostic authority | 不允许被 manifest/promotion/deployment 当 production evidence |
| target 参数或 help 漂移 | registry digest 变化，旧 candidate 失效 |
| provider 不可用 | consumer target fail closed，不回落 fixture/local bridge |
| production target 未显式批准 | 只允许 dry-run/plan，禁止 apply |
| evidence runner 缺失或输出不完整 | 命令不可晋级 `available` |

直接验证入口：

```bash
task --list-all
task taskfile:production-contract:test
task production-targets:validate
openspec validate workbench-production-ga-r5 --strict
```

`task production-targets:validate` 当前已实现。因为真实Taskfile仍缺deploy、workflow system/e2e、soak、canary、rollback、DR和post-deploy等入口，且managed provider authority尚未完成，该命令当前预期以domain exit `5`返回`production_targets_blocked`；这表示validator工作正常，不能改为零退出掩盖生产缺口。
