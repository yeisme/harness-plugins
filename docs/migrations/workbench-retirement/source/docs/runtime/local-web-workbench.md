# 本机 React Workbench

`apps/web` 是 React 19、Vite、Dockview React `7.0.2` 和 Bun 本机 BFF 组成的生产纵切片。浏览器只访问同源 BFF；BFF 从用户级 token 文件读取凭据并代理 `workbenchd`，不会把 token 注入 HTML、JavaScript、日志或浏览器配置。

应用主产品壳现以 [Agent-first 应用 Blueprint](../product/agent-workbench-blueprint.md) 为准。本机预览默认入口是 `/agent`；不再把 Open Design Studio HTML 页当作预览 URL 或 smoke 目标。

后续 [项目连续性计划](../product/project-continuity-workbench.md) 使用同一 C/S 部署语义：浏览器访问哪个服务，就使用该服务部署处的工具和授权目录。本地启动仍使用下面的命令；受控远程形态复用本文 managed BFF 与 [Identity 运行手册](../operations/managed-identity-runbook.md)，按同一版本单独验收，不把本机通过当作远程已就绪，也不通过浏览器直连 loopback broker。

## 启动

推荐以受管后台进程组启动本机 UI 预览：

```bash
task preview:up
```

查看状态、日志、运行真实 smoke 或安全停止：

```bash
task preview:status
task preview:logs
task preview:smoke
task preview:down
```

`preview:up` 会在独立 Unix process group 中运行完整 preview，将 PID 和日志分别保存到 `temp/preview/preview.pid` 与 `temp/preview/preview.log`。`preview:down` 只停止该 PID 文件对应的进程组；PID 文件缺失或损坏时拒绝扫描或停止其他进程。该目标会在 `127.0.0.1:19787`/`127.0.0.1:19788` 构建并启动独立的 `workbenchd`，使用 `temp/preview/workbenchd.db` 隔离状态，默认连接 `http://10.10.1.101:7456`，然后在 `http://127.0.0.1:4173` 启动 Vite。

### Agent-first 预览默认值

预览的 workbenchd 默认带以下环境（可用同名变量覆盖关闭）：

- `WORKBENCH_AGENT_REFERENCE_ADAPTER_ENABLED=1`：启用确定性 in-process Pi reference adapter（turn 经真实 TaskService/registry/SSE，permission gate 需批准后运行；不调用真实 owner/provider）。
- `WORKBENCH_AGENT_PI_WORKSPACE_READ_ONLY_COHORT=local`、`WORKBENCH_AGENT_DIRECTORY_STREAM_COHORT=local`、`WORKBENCH_AGENT_PRESENTATION_SUGGESTIONS_COHORT=local`：本机 principal 进入 unified shell / 目录流 / 建议灰度。

因此 `http://127.0.0.1:4173/agent` 默认就是 unified shell：composer 可直接提交 turn；turn 先停在 `awaiting_permission`，在 `/tasks/<taskId>` 页面批准 gate（或用 curl `POST /v1alpha1/gates/<gateId>/resolve`，body `{"expectedTaskVersion": <version>, "approved": true}`）后，reference adapter 产出确定性的 6 阶段 / 8 事件流（`turn.thinking` → `tool.call.start/end:read_context` → `tool.call.start/end:search_index` → `turn.segment` → `tool.proposal.waiting_approval:episode.create` → `turn.succeeded`，阶段间为可中断的固定拟真时延），时间线与会话目录随即出现真实数据。会话目录是 agent-turn Task 的可重建投影，无需 seed。

预览健康探针要求后端同时能回答 `design/capabilities` 与 `agent/tools`（各探针 5s 超时）；只实现了旧设计面的远古 workbenchd 不会被领养为“健康”。`design/capabilities` 在本机可能因 Open Design 探测到 1–2s，1s 超时会把仍在服务的受管进程误判为不健康。若旧预览数据库报 `schema is not upgradable`，把 `temp/preview/workbenchd.db` 挪走后重启即可（预览状态可丢弃）。

需要观察构建输出或使用调试器时以前台方式启动；`task dev` 是同一目标的别名，按 `Ctrl+C` 会清理由该命令启动的 backend：

```bash
task preview
task dev
```

查看预览状态和所有 URL：

```bash
task preview:doctor
task preview:status
task preview:smoke
task preview:urls
```

`preview:doctor` 在启动前检查 Bun、Go、curl、Open Design 健康状态以及目标项目；`preview:smoke` 在启动后验证 Workbench capability、agent/tools 与 `/agent` 页。两者都不会输出 session token 或 owner 私有路径。

仅启动某一层或只构建产物：

```bash
task preview:backend
task preview:web
task preview:build
```

可覆盖默认端口、设计服务和隔离数据库：

```bash
WORKBENCH_PREVIEW_WEB_PORT=4174 \
WORKBENCH_PREVIEW_HTTP_PORT=19797 \
WORKBENCH_PREVIEW_GRPC_PORT=19798 \
WORKBENCH_OPEN_DESIGN_URL=http://10.10.1.101:7456 \
WORKBENCH_PREVIEW_DATA_PATH=temp/preview/custom.db \
task preview
```

后台模式使用相同覆盖变量，只需将最后一行改为 `task preview:up`。PID/log 路径可通过 `WORKBENCH_PREVIEW_PID_PATH` 与 `WORKBENCH_PREVIEW_LOG_PATH` 覆盖。

先启动 Workbench 控制面：

```bash
bun run build
./dist/workbenchd
```

开发模式通过 Vite 同源代理：

```bash
export WORKBENCH_HTTP_URL=http://127.0.0.1:8787
export WORKBENCH_TOKEN_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/yeisme-workbench/session.token"
bun run web:dev
```

生产本机 host：

```bash
bun run web:build
export WORKBENCH_HTTP_URL=http://127.0.0.1:8787
export WORKBENCH_TOKEN_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/yeisme-workbench/session.token"
bun run web:serve
```

开发模式的 Vite 默认监听 `0.0.0.0:4173`，因此可直接使用 VS Code Port Forwarding；可通过 `WORKBENCH_WEB_HOST` 覆盖监听地址。预览命令打印的本机访问地址仍是 `http://127.0.0.1:4173`，生产 Bun Web server 的安全绑定规则不变。

## Local 与 Managed BFF 配置门

`WORKBENCH_WEB_MODE` 默认是 `local`。local 模式只接受 `WORKBENCH_HTTP_URL` 与 `WORKBENCH_TOKEN_FILE`，如果同时出现 managed Session/Identity/Key/Audit 配置会直接拒绝，防止开发 token 被误当 production fallback。

managed runtime 已具备 production composition baseline：启动时读取私密文件、验证 Identity contract/digest、探测 PostgreSQL session/login transaction schema，并组合 login/callback/session/refresh/logout 与 read-only context proxy。任何 secret、contract、数据库或 schema prerequisite 失败都以固定脱敏错误终止启动，不降级到 local token。

managed 必需配置名：

```text
WORKBENCH_WEB_MODE=managed
WORKBENCH_HTTP_URL
WORKBENCH_PUBLIC_ORIGIN
WORKBENCH_SESSION_DATABASE_URL
WORKBENCH_IDENTITY_CONTRACT_URL
WORKBENCH_IDENTITY_SCHEMA_DIGEST
WORKBENCH_IDENTITY_SERVICE_TOKEN_FILE
WORKBENCH_SESSION_COOKIE_KEY_FILE
WORKBENCH_SESSION_CSRF_KEY_FILE
WORKBENCH_CONTEXT_ENCRYPTION_KEY_FILE
WORKBENCH_AUDIT_SINK_URL
```

可选有界时长：`WORKBENCH_SESSION_IDLE_TTL`、`WORKBENCH_SESSION_ABSOLUTE_TTL`、`WORKBENCH_CONTEXT_TTL`、`WORKBENCH_IDENTITY_CLOCK_SKEW`、`WORKBENCH_REVOKE_LAG_THRESHOLD`。支持 `ms/s/m/h/d` 后缀；默认分别为 `30m/7d/5m/30s/30s`。`WORKBENCH_PUBLIC_ORIGIN` 必须是无 path/query/fragment 的 HTTPS origin，并作为 Host 与 mutation Origin 的唯一 authority；不信任 `X-Forwarded-Host` 等转发头。Identity/Audit 必须使用固定 HTTPS URL；workbenchd backend 只允许 HTTPS 或 loopback HTTP；session store 必须是 PostgreSQL。managed 禁止 `WORKBENCH_TOKEN_FILE`。

真实 DSN、endpoint 与 key path 不进入配置 diagnostic/JSON/log/evidence。密钥文件（含 `WORKBENCH_IDENTITY_SERVICE_TOKEN_FILE`）必须是绝对路径、regular non-symlink、最多 4 KiB、至少 32 bytes，并禁止 group/other permissions；cookie、CSRF、context 三把 key 必须不同。service token 只用于 BFF 到 Identity 的 workload authorization，不得使用浏览器 cookie、Google/Lark token 或 local session token 替代。真实凭据只能保存在用户级 secret store、deployment secret mount 或 CI 环境，不得写入仓库、Taskfile、文档或 shell 持久化脚本。

managed Session cookie 固定为 `__Host-yeisme_workbench`，属性为 `Secure; HttpOnly; SameSite=Lax; Path=/` 且无 `Domain`。数据库只保存 keyed SHA-256 digest；原始 cookie 与 CSRF proof 不进入 repository、diagnostic、JSON 或 evidence。CSRF proof 由 HttpOnly cookie 原值通过独立 CSRF key HMAC 派生，因此浏览器刷新后可由同源 `GET /auth/session` 重新下发，仍不能由跨站页面读取。所有 state-changing auth route 必须同时通过 exact Host、exact Origin、`application/json`、opaque cookie、memory-only CSRF proof 与 expected session revision。

验证命令：

```bash
task identity:bff-config:test
task test:identity-bff-config:component
task identity:bff-security:test
task test:identity-bff-security:component
task identity:bff-identity-client:test
task test:identity-bff-identity-client:component
task identity:bff-managed:test
task test:identity-bff-managed:component
task identity:tenant-authority:test
task test:identity-tenant-authority:component
```

`bun run web:serve` 在 `WORKBENCH_WEB_MODE=managed` 时会进入真实 managed runtime 初始化；不会再使用 local session token，也不会把浏览器 Authorization/Cookie 转发到 workbenchd。当前已提供 login/callback/session/refresh/logout、tenant select/switch、session SSE、active server context read proxy、Team safe projection 与 Identity Task submission。普通浏览器 mutation proxy仍不开放；Identity mutation只通过固定 operation、safe `inputRef`、expected version和服务端 policy/gate进入Task控制面。真实 provider与staging gate未通过前仍不能标记 production-ready。

配置production-like环境前可先运行：

```bash
task ops:doctor ENV=integration
task config:validate ENV=integration
```

`ops:doctor`只检查工具和项目prerequisite；缺少container/supply-chain工具时返回`Partial`且`production_ready=false`。`config:validate`组合Web BFF与Go workbenchd的现有权威validator，只输出配置状态，不输出DSN、Identity/Audit endpoint值、secret file path或credential。两个命令都不测试真实依赖连通性，也不执行部署；通过不能替代staging readiness、security或release gate。

`/auth/tenant/select` 与 `/auth/tenant/switch` 已接入 Identity membership selector。服务端确认前浏览器 authority 不变化；成功后在单事务内轮换 session cookie、CSRF digest、revision、tenant/membership binding 与 authority key，并 tombstone 旧 cookie。前端 pure reducer 随后按固定顺序 abort requests、关闭 SSE、清 Query cache、删除旧 authority layout/recent，再激活新 authority。当前 Query cache 采用安全的全清策略；后续所有 query key 完成 authority prefix 后再收窄为定向删除。

C2-B4 consumer baseline 会先读取并验证 Identity contract，固定 `contractVersion` 与 `schemaDigest` seal，再调用根级建议的 `/v1/auth/transactions`、`/v1/session/exchange`、`/v1/session/refresh`。所有调用禁止 redirect/retry，响应最多 1 MiB，provider error 只投影稳定 code；authorization URL、callback receipt、service token 与 context token 均不进入安全 JSON。真实 Identity Provider 尚未交付，所以这些 target 只构成 component evidence；live contract/provider integration 不能用 fixture 替代。

有 disposable PostgreSQL 时额外执行：

```bash
WORKBENCH_TEST_POSTGRES_URL='postgres://...' task test:identity-bff-identity-client:postgres
```

完整 contract、migration、security、integration、revoke drill 与 readiness 命令见 [Managed Identity 运行手册](../operations/managed-identity-runbook.md)。

## 页面与布局

- `/agent`：Agent conversation workspace；产品默认入口（`/` 与未知 route 均重定向到此）。桌面支持 1–3 个有界 Pane dock（硬上限 4，超限显式 `limit_reached`），紧凑图标 rail 与 Pane 命令面板（`+ Pane` / rail Plugins 打开）；Overview、Orbit、Boards、Workflows、Harness、Gateway 在导航中降级为 optional（advanced route），深链保持不变。
- `/studio/:projectId` 及子页仍是历史 advanced route，本机预览不再打印或 smoke 该 HTML 入口。

## 安全诊断

- 未配置真实 owner connector 时，相关 capability 返回 `offline` 或 `needs_contract`，Task 控制面仍可用。
- candidate、prompt generation、review mutation 和 handoff export 首版返回 `needs_contract`。
- 项目、文件清单以及显式文本、HTML 和 raster 预览使用 Open Design `0.8.0` 的真实公开 HTTP API；它们不是 fixture 或 demo 数据。
- 文件正文只在用户明确打开时读取；公开 API 使用 opaque `fileRef`，正文不缓存、不持久化。HTML 在无脚本 sandbox 与限制 CSP 的 `srcDoc` 中展示；raster 只允许 PNG/JPEG/WebP/GIF/AVIF、最大 8 MiB，并通过同源无凭据 `/preview` 响应展示。SVG 和其他二进制保持 unsupported。
- Studio 通过同源 `/v1alpha1/design/projects/:id/events` 订阅 Owner 文件变化；浏览器只收到 opaque `fileRef` 和 `add/change/unlink`，不会收到 Owner 相对路径或私有绝对路径。事件会刷新文件清单、已打开文本与 raster cache key；Owner 当前没有 event cursor，因此断线恢复依赖 EventSource 重连和 snapshot refetch。
- `0.8.0` 是 Owner 应用版本，不是 prompt/candidate/review/handoff 合同版本；缺少 receipt/reconcile/idempotency 合同时六个 mutation 必须继续 fail-closed。
- BFF 丢弃浏览器提交的 `Authorization`、Cookie 和 forwarding headers，并注入服务端 token。

## 验证

```bash
bun run typecheck
bun run web:build
bun run web:test
bun run web:e2e
bun run test:contract
bun run test:integration
CGO_ENABLED=0 go test ./service/...
CGO_ENABLED=1 go test -race ./service/...
openspec validate --all --strict
task workflow:readiness
```

`task workflow:readiness` 是发布阻塞门禁：除 Final Gate 自身外存在未完成 OpenSpec task，或六个 Design Operation capability 任一不是 `available` 时返回非零。它不会因为旧粗粒度 capability 或 UI fixture 通过而放行。
