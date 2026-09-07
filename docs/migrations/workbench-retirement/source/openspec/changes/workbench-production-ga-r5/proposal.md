# Workbench Production GA R5 提案

## Why

R0-R4 即使功能和测试全部实现，也不能自动证明系统适合真实生产：缺少可复现制品、环境晋级、供应链证明、真实 PostgreSQL/备份恢复、SLO/error budget、容量、故障演练、kill switch、回滚、runbook 和持续审计时，发布仍可能造成数据丢失、权限越界或无法恢复。R5 只负责建立并执行这些生产证明，不以新增功能掩盖前序缺口。

## What Changes

- 建立可复现、non-root、最小化的 Web/API/worker container 与 immutable version/build metadata、SBOM、provenance、dependency/license/security scan。
- 建立 local/integration/staging/canary/production 配置与 secret 边界、managed PostgreSQL、migration job/check、worker topology、health/readiness、resource limits 和 deployment manifests。
- 建立 evidence-driven release manifest：汇总 R0-R4 requirement、contract/policy/schema/definition digest、test run、security/performance/a11y review、backup/restore、rollback、known risk 和 approver；由 CLI/服务生成，不由 Agent 手写。
- 建立 integration → staging → canary → production promotion 状态机、capability 独立 flag/kill switch、progressive rollout、pause/abort/rollback 和 incompatible version prevention。
- 建立 SLI/SLO/error budget、dashboard/alerts/on-call/runbook、24h staging soak、7 天 canary、capacity/load、Owner/Identity/DB/worker outage 与 incident drill。
- 建立 PostgreSQL backup/retention/restore-to-disposable verification、RPO/RTO、migration expand/contract/rollback、data export/retention/tombstone 与 disaster recovery evidence。
- 建立 R0-R5 与 Identity/Owner Provider 的交接 DAG、Provider Ready/Consumer Done 门禁和失败回退 owner，禁止消费方用 fixture/local bridge填补上游合同。
- 建立 production Taskfile 目标合同与首个租户分阶段 cutover：Identity bootstrap、Provider connect、shadow projection、read canary、limited write、Daily loop、Workflow canary和七日观察。
- 建立最终 security/privacy/data-loss/a11y/performance/reliability review和 P0/P1=0 No-Go门禁。
- 不在 R5 新增 Pane、领域 service、Owner connector、workflow step type、身份能力或业务流程；任何功能缺口必须退回 R0-R4 owning change。
- R5 不自动执行真实 production deploy、DNS、credential、外部消息或数据修改；这些动作仍需 root/user明确决策 gate。

## Capabilities

### New Capabilities

- `workbench-production-release-operations`: 定义制品/供应链、配置/部署、release manifest、promotion/canary、SLO/error budget、backup/restore/DR、security/review、incident/rollback与GA closeout合同。

### Modified Capabilities

- 无；R5 只验证和运营 R0-R4 已交付 capability，不修改其业务 requirement。

## Impact

- Build/release：`Dockerfile`、`.dockerignore`、CI/release workflows、Taskfile、version/build metadata、SBOM/provenance scripts。
- Deployment：`deploy/**`、Web/API/worker manifests、migration job、config/secret references、resource/security policies、dashboards/alerts/runbooks。
- Operations：backup/restore/DR、release readiness/canary/rollback CLI、evidence manifest generator、incident/audit/support diagnostics。
- Tests：container/system/load/soak/fault/security/a11y/performance/restore/rollback evidence；不允许 fixture/local happy path 替代 managed production-like环境。
- Governance：每个 capability 独立 promotion/kill switch；umbrella 只有 R0-R5 与 provider/consumer changes/evidence全通过后才可归档。
