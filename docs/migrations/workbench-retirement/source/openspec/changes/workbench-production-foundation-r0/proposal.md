# Workbench Production Foundation R0 提案

## Why

Workbench 当前可以本地构建、启动后端与 Vite 预览，也已有 Task 四 transport conformance 和 evidence runner。但它还不能作为后续完整资产、团队和任务平台的生产底座：`Taskfile.yml` 仍硬编码旧 Open Design change，`/healthz` 与 `/readyz` 返回同一静态结果，没有 managed deployment profile、指标/追踪、生产 migration、backup/restore 或 capability release gate。

如果直接实现 Asset、Team、WorkItem、Spatial Board 和 Studio handoff，后续每个域都会重复补配置、部署、迁移、审计与测试基础，并且 fixture 成功可能被误当生产 readiness。R0 必须先建立共享基础，但不得夹带用户功能。

## What Changes

- 冻结 Asset、Team、WorkItem、Layout、Board、Search、Audit 与 Studio Handoff 的 v1alpha1 envelope、错误、pagination、version、idempotency、event 和 receipt 基础语义。
- 扩展 Operation registry，使新增 contract 可自动投影 SDK、HTTP、gRPC 与 JSON-RPC；R0 只提供合同与空/不可用 capability，不实现业务 handler。
- 建立 `local` pure-Go SQLite 与 `managed` PostgreSQL 两种 GORM profile，统一 repository interface、连接池、transaction、migration 和 config validation。
- 建立 reproducible container、非 root runtime、graceful shutdown、真实 `/healthz` 与 `/readyz`。
- 建立 structured logs、metrics、OTel trace/correlation、redaction、SLO signal 与 safe diagnostics。
- 参数化 Taskfile，统一 spec、build、preview、分层测试、migration、backup/restore verify 和只读 release readiness 命令。
- 建立 expand/backfill/shadow/cutover/contract migration framework、backup/restore contract 与 integration evidence 门禁。

## Capabilities

### New Capabilities

- `workbench-production-foundation`：定义 Workbench 可重复构建、配置、持久化、迁移、观测、验证与环境晋级的共享基础。

### Modified Capabilities

- `workbench-contract-federation`：注册后续平台 service envelope 与四 transport parity，但 capability 保持 unavailable/needs_contract，直到对应 Release 实现。
- `workbench-task-control-plane`：增加 managed persistence、真实 readiness、correlation 和 production diagnostics，不改变 Task 状态机。

## Impact

- 后端：`service/internal/config`、repository/migrations、runtime、registry、observability 与新 operation commands。
- SDK/合同：`proto/**`、`schemas/**`、`packages/task-sdk/**`、conformance tests。
- 工程入口：`Taskfile.yml`、`package.json`、evidence scripts、Dockerfile/deploy docs。
- 兼容性：现有 local SQLite、Task API、Open Design projection 与 preview 继续可用；所有合同 additive。

## Non-Goals

- 不实现 Desktop v3、Pane UI、Asset Catalog、Team、WorkItem、Spatial Board 或 Studio launch UI。
- 不将 fixture、MSW、Open Design 页面或 CLI local bridge 晋级为生产 capability。
- 不部署 production、不创建云资源、不处理真实 credential 或真实用户数据。
- 不引入 Kafka、Redis、Elasticsearch、Kubernetes operator 或独立 workflow engine。
- 不重写现有 TaskService 状态机或 transport architecture。

## Acceptance Criteria

1. local SQLite 继续 `CGO_ENABLED=0` 构建，managed PostgreSQL 可在 disposable environment 运行。
2. fresh install、upgrade、migration failure、resume、rollback boundary 和 restore verification 有自动化证据。
3. `/healthz` 与 `/readyz` 语义分离，DB/migration/registry 故障能阻止 readiness。
4. metrics/logs/traces/diagnostics 不包含 secret、token、raw payload、正文或私有路径。
5. Taskfile 不再硬编码旧 change，用户可运行统一 spec/test/preview/readiness 命令。
6. 四 transport parity 保持，新增业务 capability 在未实现时明确 `needs_contract` 或 `unavailable`。
7. strict OpenSpec、typecheck、unit/contract/integration/security、container smoke 和 migration tests 通过。
