# Managed Identity 运行手册

## 范围与状态

本手册覆盖 Workbench 的 Identity consumer baseline：provider contract seal、PrincipalContext/JWKS、managed BFF opaque session、tenant authority、Team safe projection、Identity Task mutation、revoke consumer、service delegation，以及 identity audit/metrics/traces。

当前实现可以验证 consumer 合同与 fail-closed 行为，但不代表真实 Google/Lark Identity provider、公网 ingress 或 staging SLO 已通过。fixture、loopback canary 和 disposable PostgreSQL 证据不得标记为 production `available`。

## Local 与 Managed 边界

`local` profile 使用 loopback listener、SQLite 和用户级 local-session token：

```bash
bun run build
./dist/workbenchd -profile local
```

`managed` profile 使用 PostgreSQL、Identity PrincipalContext 与严格 managed BFF 配置。它禁止 local token fallback；数据库、contract seal、key file、audit sink 或 Identity readiness 缺失时启动失败或保持 not-ready。真实 credential 只能来自用户级 secret store、deployment secret mount 或 CI secret，不得写入仓库、Taskfile、文档、命令参数或 evidence。

先执行只读配置检查：

```bash
task ops:doctor ENV=integration
task config:validate ENV=integration
```

以上命令不会输出 DSN、endpoint、key path、cookie、service token 或 provider payload，也不会证明外部依赖可达。

## 命令矩阵

| 目标 | 命令 | 外部前置 | 证据与边界 |
| --- | --- | --- | --- |
| Identity safe contract/models | `task identity:contract:test && task identity:models:test` | 无 | unit/contract；不访问 provider |
| Loopback provider contract canary | `task test:identity-contract-canary IDENTITY_CONTRACT_URL=http://127.0.0.1:PORT/PATH` | 显式 loopback fixture/provider | integration evidence；只读 GET、拒绝 redirect/credential URL |
| Principal/JWKS validator | `task test:identity-validator:component` | 无 | component evidence；disposable TLS fixture |
| Managed session/BFF | `task test:identity-bff-managed:component` | 无 | component evidence；不构成 live login |
| Additive migration | `task test:identity-migration` | 无 | disposable SQLite + Drizzle check；不修改默认数据库 |
| Security/race/redaction | `task test:identity-security` | race toolchain | component evidence；不输出 secret |
| Consumer integration | `task test:identity-integration IDENTITY_CONTRACT_URL=http://127.0.0.1:PORT/PATH WORKBENCH_TEST_POSTGRES_URL='postgres://…/disposable_test…'` | loopback contract + disposable PostgreSQL | 单个 integration evidence run；不包含真实 social provider exchange |
| Managed Team browser journey | `task test:identity-e2e` | Chromium/Playwright | e2e evidence；route fixture，不是 live provider |
| Consumer revoke drill | `task identity:revoke-drill ENV=integration WORKBENCH_TEST_POSTGRES_URL='postgres://…/disposable_test…'` | disposable PostgreSQL | deterministic consumer drill；不是 staging revoke SLO |
| Latest evidence readiness | `task identity:readiness:report ENV=integration` | 前一步已生成 evidence | 只读检查最新 run 的 freshness/status/digest；不是 Identity 专属 promotion receipt |

`IDENTITY_CONTRACT_URL` 的 canary 当前只接受 HTTP loopback URL，且 URL 不得带 userinfo、query 或 fragment。它输出 contract version、schema digest、capability/event 数量，不输出 issuer、JWKS URL 或响应原文。

## Migration

默认安全验证使用全新临时 SQLite 数据库，不触碰 `var/workbenchd.db`：

```bash
task test:identity-migration
```

真实 managed schema 由运维人员先显式执行 migration，再只读检查：

```bash
WORKBENCH_PROFILE=managed task db:migrate DB_PROFILE=managed
WORKBENCH_PROFILE=managed task db:migrate:check DB_PROFILE=managed
```

`WORKBENCH_DATABASE_URL` 只通过环境或部署 secret 注入，不得放入命令参数。managed runtime 不执行 `AutoMigrate`，checksum/version drift 时必须 fail closed。

## Integration 与 Canary

consumer integration 要求一个明确标记为 disposable 的 PostgreSQL 数据库和一个 loopback Identity contract endpoint：

```bash
export IDENTITY_CONTRACT_URL='http://127.0.0.1:19090/v1/contract'
export WORKBENCH_TEST_POSTGRES_URL='postgres://USER:PASSWORD@HOST/workbench_identity_disposable_test?sslmode=require'
task test:identity-integration
```

命令由 evidence runner 包装，成功与失败都会写入 `temp/integration-test-runs/<run-id>/`。`command.txt`、stdout/stderr、environment 与 summary 会脱敏；不要把真实 credential 复制到 shell history、issue、文档或 evidence。

真实 provider canary 尚未交付。promotion 前仍须增加 approved HTTPS provider driver，覆盖 Google/Lark exchange、multi-tenant、unknown acceptance、key rotation、outage 与 schema digest 一致性；不得放宽现有 loopback canary 来绕过该门禁。

## Revoke Drill 与 Readiness

当前 revoke drill 验证 event dedupe、cursor transaction、session revoke、stale authority rotation、reconnect 与 PostgreSQL durability：

```bash
task identity:revoke-drill \
  ENV=integration \
  WORKBENCH_TEST_POSTGRES_URL='postgres://USER:PASSWORD@HOST/workbench_identity_disposable_test?sslmode=require'
task identity:readiness:report ENV=integration
```

readiness report 读取 evidence runner 生成的真实 metadata 和 digest。共享 evidence root 中可能存在其他任务，因此必须紧接目标 Identity gate 执行，并结合对应 `summary.json` 审核；它不是 Identity 专属 release authority。

以下 promotion 证据仍未完成：24h session refresh soak、live JWKS rotation、真实 Identity outage、staging event reconnect、revoke lag SLO、audit completeness 与 rollback。完成这些能力前，`ENV=staging` 的 deterministic consumer drill也不得被解释为 live staging drill。

## 故障复查

- contract canary 失败：检查 contract version/schema digest/capability/event/error 集合；不要打印原始响应。
- migration 失败：确认 target disposable、migration checksum 与 Drizzle schema；不要对 production 执行 destructive repair。
- session/revoke 失败：保持 managed fail-closed，不得切回 local token；检查 event cursor、membership version 与 session tombstone。
- audit exporter 失败：privileged mutation 必须在 effect 前 fail closed；revoke durable transaction 不因 telemetry exporter 失败而回滚。
- readiness blocked：检查最新 evidence 的 status、freshness 与 digest；不要手改 `summary.json` 或其他结构化证据。

## Account linking（登录方式关联，workbench-identity-account-linking-ux-v1）

Workbench 侧通过 typed 子合同 `workbench.identity.accountlinking.v0.1`（SDK
`WorkbenchIdentityAccountLinkingClient` / BFF `/v1alpha1/identity/account-linking/*`）
消费 Identity Platform account-linking capability（owner 合同 1.1.0）。

运维要点：

- **default-off**：owner capability 由 `IDENTITY_PLATFORM_ACCOUNT_LINKING_ENABLED=1`
  显式开启；未开启时 Workbench pane 只呈现只读/needs_contract 状态。回滚 =
  关闭该 flag（owner 绑定、receipt 与 audit history 不删除），Workbench 侧
  无需改动（discovery 投影自动降级）。
- **诊断链路**：pane「技术引用」显示 opaque `transactionRef`；对账走只读
  status 通道（`GetIdentityAccountLinkStatus`，按 idempotency key 或
  transaction ref），绝不能重放 finalize/unlink。
- **guard 状态语义**：`identity_conflict`（subject 已属其他用户，不合并）、
  `last_login_method`（唯一登录方式）、`reauth_required`（owner session
  权威，非本地计时）、`callback_replayed`（一次性 transaction 已消费）、
  `rate_limited`（固定窗口限流）。恢复指引见 pane 文案；Workbench 不移动
  或合并任何 owner 绑定。
- **浏览器安全边界**：浏览器只经同源 BFF；provider token/code/raw payload
  不进入浏览器状态、URL、日志或 evidence；provider callback 只携带 opaque
  `accountLinkTx`/`accountLinkReceipt` 参数并在 finalize 后清除。
- **证据**：owner 全链证据见 identity-platform
  `temp/integration-test-runs/20260830072651-94057cb8-*`（真实 kratos26 +
  disposable PostgreSQL）；consumer component/e2e 六件套见本仓
  `temp/integration-test-runs/`（login-methods 矩阵 + Playwright journey）。
- **外部门禁**：真实 Google/Lark OAuth app、staging callback、regional
  browser canary、24h soak 与 key rotation 属独立外部授权门禁，不由本地
  合同测试替代。
