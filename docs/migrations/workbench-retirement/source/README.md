# Yeisme Workbench

Ordo 托管工作新增 [消费规划](openspec/changes/workbench-ordo-managed-work-v1/design.md)，在既有 `/agent` 主壳内组合工作概览、Agent 依赖与候选审阅。独立 Ordo 网页由独立客户端拥有，Workbench 不复制执行状态；当前仅完成规格和 tasks，未宣称真实接通。

Yeisme Workbench 是面向个人高频工作的通用 Agent 工作台。当前确定的推进方向是：以项目与成果为中心，打开项目就能找到已有成果、关键决定和下一步，并在明确授权范围内让 Agent 持续推进。主客户端是桌面 Web；同一套 C/S 产品部署在哪里，就使用哪里的工具、文件和执行环境。

该方向由 [项目连续性产品设计](docs/product/project-continuity-workbench.md)、[桌面 UI](docs/ui/project-continuity-workbench.md)、[接口合同](docs/interfaces/project-continuity-workbench.md) 和 [实施 tasks](openspec/changes/workbench-project-continuity-desktop-v1/tasks.md) 承接，当前为规格完整、实施待完成。真实 Agent、Pinax 续接、成果 owner 与本地/远程部署仍须分别验收，不能把规划目标当成当前可用状态。

组织、工作区、项目、成员和快速切换继续复用既有平台设计。后续多租户架构保持**共享控制面 + 租户 Workbench 实例**：控制面负责身份、成员关系、实例编排、路由、策略、用量和审计；这些托管能力不作为个人首版的新前置，也不会因当前切片而删除。

当前仓库先交付本机单实例的远程 Task 控制面，为后续托管控制面和多实例数据面建立统一合同。它通过 `Operation` registry 为 `HTTP REST/SSE`、`gRPC unary/stream`、`JSON-RPC 2.0` 三个 wire transport 提供同一套 Task 语义，并通过 TypeScript SDK facade 暴露类型安全调用；它不保存 Scaena、Auctra、Eikona 等 owner 的 canonical domain state。

## Agent 视觉交互控制台方向

Workbench 的产品目标是把 Yeisme 的 Agent 和专业能力组合成一个可发现、可观察、可审阅、可控制的视觉工作台。这里的“一个项目/一个控制台”指统一 shell、导航、布局、上下文、审批和运行反馈，不是把所有子项目代码合并进 Workbench，也不是砍掉各 owner 已有能力。

应用主壳、页面/Pane 归属、对象模型、前后端组合和“何时才算可用”的完整设计见 [Agent-first 应用 Blueprint](docs/product/agent-workbench-blueprint.md)；视觉实现见 [Agent-first Pane UI Spec](docs/ui/agent-first-workbench.md)，接口权威见 [Agent-first Workspace 前后端合同](docs/interfaces/agent-pi-workspace.md)。

专业能力采用 `split-owner`：Workbench 拥有视觉组合与安全交互，领域项目拥有 canonical state、规则、provider、权限、预算、证据和回执。一个能力若不应由 Workbench 持有，必须在首次提出时立即指出正确 owner；只要用户仍需要该能力，就应通过 typed projection、typed action、owner receipt 或深链保留在统一体验中，而不是等 Spec 完成后再删除。

### Anatomia workspace

Anatomia 是首批明确的专业工作区方向之一，计划在同一控制台中组合：

- source/project 导航、授权与媒体概览；
- analysis 配置、启动/恢复/取消、预算与进度；
- shot/scene 时间线、transcript、关键帧、观察与证据图；
- direct video understanding、范围 inspect 和 source compare；
- storyboard/revision 的审阅、修订、对比、冻结与 fork；
- clip/frame/prompt/subject asset 查看，以及 Scaena、Eikona、Sonora、外部媒体库（用户自选，例如 Jellyfin/Immich） handoff；
- evaluation、diagnostics、learning proposal、审批与 rollback。

这些能力属于保留清单，不因统一控制台而删除。当前 README 描述的是已确认的产品组合方向，不表示 Anatomia workspace 已全部交付；每个可写动作仍需版本化合同、权限/预算 gate、幂等、owner receipt、对账和对应 OpenSpec 验证。

## 平台方向

- **Linear 式租户体验**：一个全局用户可以加入多个租户，在个人空间与团队空间之间切换；每个租户拥有独立成员、角色、项目、策略和使用边界。
- **控制面统一治理**：Identity Platform 是 `User/Tenant/Membership` 真相源；Workbench 只消费经过验证的 principal context，并维护租户到实例的安全映射。
- **多实例隔离数据**：每个租户绑定一个活动 Workbench 实例；实例内的 Task metadata、事件索引、缓存和安全引用不会被其他租户直接查询。
- **owner 状态仍归 owner**：Workbench 负责组合、调度、审查和交付，不复制领域对象、凭据、私有路径、原始 prompt 或 artifact blob。
- **专业能力完整保留**：统一工作区优先合并入口、上下文和交互，不以产品简化为由删除用户明确需要的 owner 能力。
- **渐进式托管**：先稳定本机单实例合同，再增加 provisioning、instance registry、tenant routing、配额、升级和灾备；当前版本不宣称已提供云端多租户。

完整产品定位、租户体验、控制面/数据面职责和演进阶段见 [Workbench 通用平台与多租户设计](docs/product/workbench-platform.md)。

## 快速开始

```bash
bun run build
./dist/workbenchd
```

启动 React Workbench：

```bash
task preview:doctor
task preview:up
```

查看或严格验证当前生产基础 Spec：

```bash
task spec:status
task spec:validate
```

也可以显式选择其他 change：

```bash
task spec:validate SPEC_CHANGE=workbench-agent-pi-workspace-v1
```

浏览器打开 `http://127.0.0.1:4173/agent`。运行 `task preview:status` 查看状态、`task preview:smoke` 验证后端与 Agent 页、`task preview:logs` 跟踪日志、`task preview:down` 安全停止受管进程组。需要前台开发时使用 `task preview`；生产本机 host 使用 `bun run web:build` 和 `bun run web:serve`。完整说明见 [本机 React Workbench](docs/runtime/local-web-workbench.md)。

服务默认只监听 `127.0.0.1:8787`（HTTP/JSON-RPC）和 `127.0.0.1:8788`（gRPC）。在另一个终端读取本机 session token 后可检查 catalog：

```bash
TOKEN_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/yeisme-workbench/session.token"
TOKEN="$(cat "$TOKEN_FILE")"
curl --fail --silent --show-error \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8787/v1alpha1/operations
```

`GET /healthz` 只表示进程存活；`GET /readyz` 会检查 lifecycle、数据库连接、schema version/checksum 与 Operation registry，managed profile 还检查 Identity JWKS freshness。任一必需组件不可用或 shutdown 开始时返回 `503` 和脱敏组件状态。managed BFF 已具备 opaque session、tenant authority rotation、revoke consumer、Team projection、Identity Task mutation 与脱敏 observability 基线；真实 Identity provider、staging SLO 与公网 ingress 仍是 promotion 门禁。

R0 已提供两种数据库 profile：默认 `local` 使用 pure-Go SQLite + 私有 local-session token；`managed` 使用 PostgreSQL + GORM，并要求 Identity 签发的短期 `aud=workbench` PrincipalContext，不允许 token-file fallback。`workbench-migrate up|check` 独立执行 additive migration 并校验版本/checksum；managed runtime 启动时不修改 schema，数据库或 JWKS 不可用时保持 `ready=false`。R1 consumer 侧现已覆盖 BFF opaque cookie/session、CSRF、tenant select/switch、membership freshness/revoke、service delegation、Identity Task policy 与 audit/metrics/traces；这些能力仍限制在已验证 consumer baseline，不能替代真实 provider integration、staging revoke/soak 或公网多租户验收。详情见 [Managed Identity 运行手册](docs/operations/managed-identity-runbook.md)。

R0 同时提供 `workbench-backup` 与 `workbench-restore-verify`：SQLite 使用一致性 snapshot；PostgreSQL 使用固定 `pg_dump/pg_restore`，DSN 不进入进程参数。每个 backup 伴随 CLI 生成的 schema/checksum manifest，restore verification 只允许 disposable target 并写脱敏 integration evidence。完整命令和安全限制见 [Backup 与 restore verification](docs/runtime/local-control-plane.md#backup-与-restore-verification)。

`workbenchd` 现在使用脱敏 JSON lifecycle/call logs、低基数 HTTP/gRPC 调用指标和有界异步 OTLP/HTTP tracing；stdout 不再输出 token file 或启动诊断。配置与当前验证边界见 [Structured observability](docs/runtime/local-control-plane.md#structured-observability)。

## 当前就绪度

- 已支持：synthetic Operation 的 loopback remote invocation；SDK、REST+SSE、gRPC、JSON-RPC 的共享 Task 语义；React/Dockview 本机工作区。
- 已支持（Workbench consumer baseline）：typed `WorkbenchClient.gateway` 与 `workbench.gateway.v1alpha1` Gateway projection、四个只读/状态页面和三条 allowlisted Task operation；浏览器不持有 Gateway credential 或 arbitrary proxy 参数。Gateway owner 已于 2026-08-12 通过本地 loopback owner-consumer canary，并返回安全 receipt；该证据不代表 remote/staging/production readiness。详见 [Gateway Console consumer contract](docs/interfaces/gateway-console.md)。
- 已支持：Open Design `0.8.0` 真实项目摘要、文件清单、显式文本/HTML/raster 安全预览；文件可展开，Preview Pane 可最大化并恢复，SVG 与超限图片 fail-closed。
- 受合同门禁：prompt save、candidate generate/cancel、review decide、handoff prepare/export 已注册为标准 Operation，但 Owner 尚未发布 receipt/reconcile/idempotency 的版本化领域合同，因此保持 `needs_contract`，不会伪造成功。
- 未就绪：真实 Scaena、Auctra、Eikona mutation。没有 owner 批准的合同与回执/对账能力时，adapter 必须 fail-closed，不会伪造 mutation 成功。
- 已支持（consumer baseline）：managed workbenchd 的同源 HTTPS JWKS、短期 PrincipalContext、统一 Principal 投影；managed BFF 的 opaque session、login/refresh/logout、tenant authority rotation、revoke consumer、Team UI、Identity Task policy、service delegation 与脱敏审计/指标/trace。
- 仍待 promotion：真实 Google/Lark Identity provider integration、live contract digest、staging revoke/soak/rollback 证据，以及 instance registry、租户路由、实例 provisioning 与配额。
- 当前不提供：LAN、public remote、cloud multi-tenant hosting 或浏览器直连 owner。

实现不会复用已移除的 Workbench 源码或证据。接口、运行时和验证说明见 `docs/README.md`；当前前端产品入口由 `workbench-agent-pi-workspace-v1` 承接，R0–R5 change 只保留各自仍未完成的基础设施、身份、Owner、Pane/Workflow 和发布能力，不再共同定义并列主壳。`openspec status` 的 artifact complete 不等于 capability delivery complete，后者仍需 capability-scoped handoff、selector/status 与直接 evidence gate。

当前 canonical release change 映射：R0 `workbench-production-foundation-r0`、R1 `workbench-identity-tenant-access-r1-gates`、R2 `workbench-owner-backend-integrations`、R3 `workbench-daily-operations-r3-gates`、R4 `workbench-spatial-workflow-automation-r4`、R5 `workbench-production-ga-r5`（R1/R3 的已交付部分分别随 `workbench-identity-tenant-access-r1`、`workbench-desktop-daily-operations-r3` 于 2026-08-16 归档，gates change 承接剩余验证门禁与 closeout 任务）。
