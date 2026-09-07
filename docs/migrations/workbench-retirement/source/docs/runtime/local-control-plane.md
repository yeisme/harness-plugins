# Workbench 本机运行、认证与证据

## 启动与本机 session

先构建并启动默认 loopback runtime：

```bash
bun run build
./dist/workbenchd
```

默认 HTTP/JSON-RPC 为 `127.0.0.1:8787`，gRPC 为 `127.0.0.1:8788`。可显式指定私有数据与 token 文件：

```bash
WORKBENCH_DIR="$HOME/.config/yeisme-workbench"
./dist/workbenchd \
  -http-address 127.0.0.1:8787 \
  -grpc-address 127.0.0.1:8788 \
  -data-path "$WORKBENCH_DIR/workbenchd.db" \
  -token-file "$WORKBENCH_DIR/session.token"
```

runtime 拒绝非 loopback IP 监听；`localhost` 不是可配置 bind host。启动时创建或复用 local-session bearer token。发现 token 时只在 shell 变量中读取，不要输出、提交或记录其内容：

```bash
TOKEN_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/yeisme-workbench/session.token"
test -f "$TOKEN_FILE" && test ! -L "$TOKEN_FILE"
TOKEN="$(cat "$TOKEN_FILE")"
```

## Health 与 readiness

`/healthz` 是 liveness，只证明进程仍在运行：

```bash
curl --fail --silent --show-error http://127.0.0.1:8787/healthz
```

`/readyz` 是接流量门禁。local profile 聚合 lifecycle、GORM 数据库与 Operation registry 三项检查；managed profile 额外检查 Identity JWKS 是否已成功加载且未超过 bounded cache freshness。数据库 ping 失败、schema migration version/checksum 不匹配、Task/Gate/Attempt/Event/Artifact/Receipt 任一必需表缺失、registry 未 seal/digest 缺失、Identity key 不可用，或 runtime 已进入 shutdown drain 时返回 HTTP `503`；响应只包含 `not_ready` 与各组件的 `ok/unavailable`，不会包含 DSN、credential、issuer/JWKS URL、内部错误或私有路径：

```bash
curl --fail --silent --show-error http://127.0.0.1:8787/readyz
```

R0 后续会把 required worker 状态加入 readiness，并为负载均衡传播增加完整 drain window。可选 Owner 离线不会让整个 Workbench not-ready，只会降低对应 capability。

## 数据库 profile

默认 `local` profile 使用 pure-Go SQLite，并继续支持 `CGO_ENABLED=0`：

```bash
./dist/workbenchd -profile local
```

Workbench 实例标识默认是 `local`。需要稳定 deep link 或多实例部署时，通过 user config 的 `instance_id`、环境变量 `WORKBENCH_INSTANCE_ID` 或 `workbenchd --instance-id` 设置同一个有界 opaque ID。`GET /v1alpha1/design/instance`、对应 JSON-RPC 与 gRPC 方法返回该运行时权威值；Eikona `/i/:instanceId/p/:projectId/*` 路由必须先匹配它，错配时只显示显式切换，不加载资源或动作。

`managed` profile 使用 PostgreSQL + GORM，并且不再接受 local-session token 文件。数据库 URL 只从 `WORKBENCH_DATABASE_URL` 读取，不提供会把 credential 暴露到 process arguments 的 `--database-url` flag。workbenchd 还要求固定的 Identity issuer、同源 JWKS、`aud=workbench`、approved asymmetric algorithm 与最多 10 分钟 PrincipalContext TTL。优先通过环境变量配置内部 endpoint，先显式迁移并只读检查，再启动 runtime：

```bash
export WORKBENCH_PROFILE=managed
export WORKBENCH_DATABASE_URL='postgres://USER:PASSWORD@HOST:5432/DATABASE?sslmode=verify-full&sslrootcert=/absolute/path/to/managed-ca.crt'
export WORKBENCH_IDENTITY_ISSUER='https://identity.example.internal'
export WORKBENCH_IDENTITY_JWKS_URL='https://identity.example.internal/.well-known/jwks.json'
export WORKBENCH_IDENTITY_AUDIENCE='workbench'
export WORKBENCH_IDENTITY_ALGORITHMS='EdDSA'
task db:migrate ENV=staging DRY_RUN=1
task db:migrate:check ENV=staging
./dist/workbenchd -profile managed
```

`db:migrate ENV=... DRY_RUN=1` 只生成 catalog plan；managed `up` 在 signed target、plan、approval 与 operation authority consumer 落地前保持 hard-block。`db:migrate:check` 只读验证当前版本、checksum 和必需表。集成 SQLite 必须显式使用 `task db:migrate:local` 和 `task db:migrate:check:local`，不会由 staging ENV 回退。managed runtime 本身不会执行 `AutoMigrate`，因此未迁移、版本缺失或 checksum 漂移时 `/readyz` 保持 `503`。

没有 signed managed read target 时，managed `db:migrate:check`/`status` 也会在连接前阻断；不要把 compose target 字符串、restore confirmation 或旧 registry 当作数据库写入/读取授权。

managed runtime 仍强制 HTTP/gRPC 使用 loopback listener，但认证已切换为 Identity 签发的短期 PrincipalContext；它不会创建或读取 token 文件，也没有 local fallback。验证器固定检查签名算法、`kid`、issuer、audience、时间窗口、TTL、subject/session/tenant/membership/version、actor、scope、可选 `amr` 与 token id。JWKS 只允许 issuer 同源 HTTPS，拒绝 redirect、非 JSON、超过 1 MiB、重复 key id、错误 key type/algorithm；未知 `kid` 最多强制刷新一次。内部幂等 caller namespace 使用 issuer/subject/tenant/membership/version/actor 的 SHA-256 安全摘要，不复用权限 scope，也不暴露原始身份 ref。

workbenchd consumer 与 managed BFF 现已形成 R1 consumer baseline：opaque cookie/session exchange、CSRF、tenant selection/switch、membership freshness/revoke event、Identity operation policy、service delegation、audit/metrics/traces 与 Team UI 均有 component/e2e 证据。真实 Identity provider owner/live discovery、Google/Lark exchange、staging revoke/soak/rollback 和公网 ingress 仍未完成；这些门禁通过前 capability 必须保持 `needs_contract`/`integration_ready` 以下，不能标记 production `available`。数据库 URL、Identity 配置缺失或不兼容时服务 fail-fast；JWKS 运行时不可用时 identity readiness 为 false，错误不会回显 URL、credential 或原始 token。

验证当前 consumer slice：

```bash
task identity:validator:test
task test:identity-validator:component
task test:identity-security
```

后两个命令会把脱敏 component evidence 写入 `temp/integration-test-runs/<run-id>/`。这些测试使用 disposable TLS JWKS 和签名 fixture，只证明 consumer 逻辑，不替代真实 provider integration。完整 managed identity 命令矩阵见 [Managed Identity 运行手册](../operations/managed-identity-runbook.md)。

真实 PostgreSQL repository integration 使用显式 disposable 测试数据库：

```bash
WORKBENCH_TEST_POSTGRES_URL='postgres://USER:PASSWORD@127.0.0.1:5432/TEST_DATABASE?sslmode=disable' \
WORKBENCH_TEST_POSTGRES_ATTESTATION=/absolute/path/to/provisioner-target.json \
task test:postgres
```

该目标在任何连接前要求当前 UID 所有的 `0600` provisioner attestation，绑定规范化 loopback DSN、数据库身份、sentinel effect/nonce/expiry 与 `tls_required=false`；缺失、半配或不匹配均 fail closed。该目标通过 evidence runner 执行，不把数据库 URL 写入命令参数。不得指向普通用户或 production 数据库。

## Backup 与 restore verification

Backup 命令会创建私有 artifact 和由 CLI 生成的 JSON manifest。Manifest 只记录 profile、format、UTC 时间、schema version/checksum、artifact basename/size/SHA-256 与工具类型，不记录源数据库路径、DSN、credential 或 provider payload。输出文件及其父目录必须为当前用户所有，目录权限 `0700`、文件权限 `0600`，且命令不会覆盖已有文件。

Local SQLite 使用参数绑定的 `VACUUM INTO` 生成一致性 snapshot：

```bash
BACKUP_PATH="temp/backups/workbench-$(date -u +%Y%m%dT%H%M%SZ).db"
task db:backup:local DB_DATA_PATH=var/workbenchd.db BACKUP_PATH="$BACKUP_PATH"
task db:restore:verify BACKUP_PATH="$BACKUP_PATH"
```

Restore verification 会先校验 manifest contract、schema version/checksum、artifact basename/size/SHA-256，再复制到自动创建的 disposable private directory，打开恢复数据库并执行 readiness/schema 检查。自动化测试还会从 SQLite backup 读取已持久化的 Task 记录，确认关键业务数据随 snapshot 保持。该目标通过 evidence runner 运行，成功和失败都写入 `temp/integration-test-runs/<run-id>/`；backup、manifest 与 output 等私有路径参数会在 `command.txt` 和 `summary.json` 中脱敏。

Managed PostgreSQL 使用固定的 `pg_dump --format=custom` 与 `pg_restore`。DSN 被拆为最小 PG* 子进程环境（含 `PGSSLROOTCERT`），不进入 CLI/process arguments，并清除父进程的其它 PG* 值。managed backup 和 restore 在 signed provider authority consumer 落地前 hard-block；不再接受 restore confirmation 字符串作为授权。

```bash
export WORKBENCH_PROFILE=managed
export WORKBENCH_DATABASE_URL='postgres://USER:PASSWORD@HOST:5432/WORKBENCH?sslmode=verify-full&sslrootcert=/absolute/path/to/managed-ca.crt'
BACKUP_PATH="temp/backups/workbench-$(date -u +%Y%m%dT%H%M%SZ).dump"
task db:backup ENV=staging BACKUP_PATH="$BACKUP_PATH"
```

未来受 authority consumer 驱动的 `pg_restore` 会对独立 disposable target 执行 `--clean --if-exists`；该 URL 绝不能指向普通用户、共享 staging 主库或 production 数据库。当前 restore verification 证明 artifact 完整、SQLite 关键业务记录可读取且可恢复到 current schema；真实 PostgreSQL restore、跨版本 migration、更完整的业务行级 invariant、PITR、retention/encryption provider metadata 与 RPO/RTO drill 仍属于后续 R0/R5 门禁。

Worker database URLs are supplied only through `WORKBENCH_DATABASE_URL` or a
private `WORKBENCH_DATABASE_URL_FILE`; `--database-url` is rejected before
flag parsing and never appears in process arguments.

HTTP/JSON-RPC 验证 `Authorization: Bearer $TOKEN`、可信 loopback `Host` 和同源 loopback `Origin`；gRPC 使用相同 bearer token 的 metadata。token 文件与 SQLite 文件必须是当前用户拥有的普通文件、权限 `0600`；父目录必须是非 symlink、当前用户拥有且权限 `0700`。这是单机 local-session，不是 LAN、cloud 或多租户认证。

## REST、SSE 与 JSON-RPC 调用

列出 catalog：

```bash
curl --fail --silent --show-error \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8787/v1alpha1/operations
```

提交可验证的 synthetic Task。服务会验证 `input` 并自己计算 digest；示例不发送 `requestDigest`：

```bash
curl --fail --silent --show-error \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: example-echo-001' \
  --data '{"workspaceId":"local-workspace","projectId":"local-project","projectMode":"generic","callerScope":"local-session","operationType":"workbench.synthetic.echo","idempotencyKey":"example-echo-001","expectedOwnerVersion":"","input":{"message":"hello"}}' \
  http://127.0.0.1:8787/v1alpha1/tasks
```

通过独立 JSON-RPC 2.0 请求相同 catalog：

```bash
curl --fail --silent --show-error \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":"catalog-1","method":"ListOperations","params":{}}' \
  http://127.0.0.1:8787/rpc
```

取得提交结果中的 `task.id` 后，可恢复 SSE event cursor：

```bash
curl --no-buffer --silent --show-error \
  -H "Authorization: Bearer $TOKEN" \
  'http://127.0.0.1:8787/v1alpha1/tasks/TASK_ID/events/watch?after_sequence=0'
```

`TASK_ID` 是响应数据，不是固定值。不要把真实 task、receipt 或 token 复制到文档、日志或证据以外的位置。

## SDK、gRPC 与自动化验证

Taskfile 默认指向 `workbench-production-foundation-r0`，也可通过 `SPEC_CHANGE` 选择其他 change。当前 Agent-first 前端主方案使用 `workbench-agent-pi-workspace-v1`：

```bash
task spec:status
task spec:validate
task spec:validate SPEC_CHANGE=workbench-agent-pi-workspace-v1
```

常用分层验证入口：

```bash
task test:unit
task test:contract
task test:integration
task test:security
task test:observability
task test:observability:component
task test:observability:collector
```

## Structured observability

`workbenchd` 默认把 JSON structured logs 写入 stderr，stdout 不再输出启动 banner、token file 或其他诊断文本。HTTP、JSON-RPC 与 gRPC 调用共享 `request_id`、`trace_id`、`call_id`、transport、稳定 operation、status、status code 与 duration；日志不记录原始 URL、query、request/response body、Authorization、cookie、DSN、provider payload 或私有路径。

HTTP 指标只使用 transport、稳定路由族和 status class；gRPC 指标只使用 transport、受控 method 和 canonical status code。Task/resource/user/tenant/path/error text 不进入 label，避免高基数和敏感数据泄漏。经过当前 profile 认证后，可读取版本化 diagnostics：

```bash
curl --fail --silent --show-error \
  -H "Authorization: Bearer $TOKEN" \
  http://127.0.0.1:8787/v1alpha1/diagnostics/metrics
```

响应合同为 `workbench.observability.v1`，只包含 call、lifecycle/database/registry readiness、Task status transition、DB query status/duration 与连接池 gauge，并设置 `Cache-Control: no-store`。Task transition 只按固定状态计数，不包含 operation、Task、workspace、project、tenant 或 user label；只有数据库 mutation 成功后才计数，幂等 replay 不重复。GORM observer 不读取 SQL，只按 `ok/not_found/error` 聚合耗时。未认证请求返回 `401`。正式 OTLP metrics exporter 和独立 admin listener 仍属于 R0 后续工作。

如需发送 OTLP/HTTP traces，优先通过环境变量配置无 credential endpoint：

```bash
export WORKBENCH_OTEL_EXPORTER_OTLP_ENDPOINT='http://127.0.0.1:4318/v1/traces'
task preview
```

也可使用 `workbenchd -otel-endpoint ...`，但 endpoint 不得包含 userinfo/credential。Span 使用有界异步队列和 export timeout；collector 不可用不会阻塞业务请求，内部 exporter error 只写脱敏 structured event。`task test:observability:component` 会启动真实 `workbenchd`、检查 health/readiness、metrics 认证、提交 synthetic Task、发送 SIGTERM，并证明 stdout 为空且 stderr lifecycle/call records 全部为脱敏 JSON。GORM 默认 SQL logger 已关闭，避免正常 `record not found` 把 SQL 与业务值写到 stdout；DB 观测必须走受控 metrics/structured events。`task test:observability:collector` 会向 disposable OTLP/HTTP receiver 真实发送非空 protobuf span payload，并验证 receiver `503` 时 request 不阻塞、flush/shutdown 有界。staging collector 长时 outage/retry、跨进程 propagation 和 staging collector 证据尚未完成，因此不能把 tracing 标记为 production verified。

TypeScript SDK 的 contract 与 transport parity：

```bash
bun run typecheck
bun run test:contract
```

Go gRPC transport（含 loopback auth 与 `bufconn` parity）验证：

```bash
CGO_ENABLED=0 go test ./service/internal/transport/grpc/...
CGO_ENABLED=0 go test ./service/test/conformance
```

集成与 e2e 命令会在 `temp/integration-test-runs/<run-id>/` 写入脱敏的 `summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json` 和 `artifacts/`：

```bash
bun run test:integration
bun run test:e2e
```

已有通过的证据包括 `temp/integration-test-runs/20260717175613-2354b0ca-fea6-4d5c-8a6a-65949b6d8c00/summary.json`（integration）和 `temp/integration-test-runs/20260717175613-6079f0d8-c783-48e8-94a4-7dc2d92f536d/summary.json`（e2e）。它们只证明当前 synthetic/local-session 控制面；不构成真实 owner mutation 证据。

## BYOK / Local CLI connection test canary

Workbench 已将固定 `workbench.runtime.aigora.connection_test` 接入现有 Operation registry、TaskService admission、四 transport projection、TypeScript SDK 和 Connections 页面。该 operation 默认关闭；它只绑定 `aigora/aigora.text/connection_test`，浏览器不能提交 owner、adapter、host、provider、model、credential、process 或 approval 字段。

先准备Aigora owner。Aigora配置必须只含一个可用于first-support的canonical text profile，并通过shared credential ref引用credentialctl；当前`owner_binding.v0.1`无法安全选择多个profile，因此多个profile会在解析secret前fail closed：

```bash
printf '%s' "$OPENAI_API_KEY" | credentialctl set openai/personal-default \
  --consumers aigora --capabilities text --json
aigora runtime owner-token rotate --agent
aigora runtime owner serve --listen 127.0.0.1:28181 --agent
```

另一个终端显式启动共享broker，并只注册固定Workbench facade与Aigora owner：

```bash
RUNTIME_STATE="${XDG_CONFIG_HOME:-$HOME/.config}/yeisme/client-runtime"
client-runtime token rotate \
  --facade yeisme.workbench \
  --state-dir "$RUNTIME_STATE" \
  --instance-revision local-v0.1 \
  --ttl 1h \
  --agent
client-runtime serve \
  --listen 127.0.0.1:8765 \
  --facades yeisme.workbench \
  --state-dir "$RUNTIME_STATE" \
  --instance-revision local-v0.1 \
  --aigora-owner-url http://127.0.0.1:28181 \
  --aigora-owner-available \
  --enable-aigora-adapter \
  --aigora-security-evidence-ready \
  --agent
```

最后显式启用Workbench connection-test：

```bash
WORKBENCH_RUNTIME_CONNECTION_TEST_ENABLED=1 ./dist/workbenchd
```

也可以使用等价的显式参数：

```bash
./dist/workbenchd --client-runtime-connection-test-enabled
```

按钮只有在以下条件同时成立时才出现在 `/connections`：

- Workbench registry 已注册固定 connection-test operation；
- shared runtime descriptor 与当前 adapter readiness 均明确广告 `connection_test`；
- readiness 返回安全的当前 broker `revision`。

点击按钮只会创建普通 Workbench Task。用户仍需在 Task 页面依次批准 permission 与 cost gate；最终 dispatch 前 handler 会从 GORM gate store 重新确认同 task gate 已批准、具有 resolution timestamp 且未超过五分钟，并据此派生 broker approval scope。caller 提交的 approval 字段会被 exact schema 拒绝。credential 始终由 Aigora owning adapter 解析，Workbench 和浏览器不会读取或保存密钥。

关闭 canary 并恢复只读 runtime 的命令：

```bash
WORKBENCH_RUNTIME_CONNECTION_TEST_ENABLED=0 ./dist/workbenchd
```

关闭后 operation 不进入新 registry catalog，Connections 页面不会显示测试按钮；已有 terminal task/receipt 仍可读取，系统不会自动重放未知结果。当前真实system证据`20260720130339-385a7ae7-8e13-4cd2-91df-937a2ece2725`已覆盖Workbench Task/gate→broker→Aigora owner CLI→credentialctl→provider probe，并通过脱敏扫描；它只支持connection-test first-support，不会自动提升generate。

## BYOK / Local CLI generate canary

Generate同样默认关闭。输入必须先由Aigora CLI写入本机加密protected-input store；Workbench、browser和broker只接收返回的safe reference。Aigora配置必须同时启用持久SQLite/PostgreSQL、`protected_input.dir`与本机key-encryption credential ref。不要把prompt或API key放在命令参数中：

```bash
aigora operator-input put \
  --file request.json \
  --tenant runtime.aigora.aigora.text.byok \
  --workspace runtime.aigora.aigora.text.byok \
  --expires-in 5m \
  --json
```

把返回的`vault:sha256:...`前加`input:`，作为Workbench typed generate API的`inputRef`。显式启用 Web generate canary 后，将这个完整的`input:vault:sha256:<digest>`粘贴到`Aigora protected input reference`字段。Workbench 只在组件内存中保留该安全引用；普通`input:`占位值、raw prompt、credential、provider host或model不会进入Task提交。

显式启动完整Aigora owner；没有持久数据库、protected-input store、owner token、唯一canonical profile或credentialctl readiness时命令会在监听前fail closed：

```bash
aigora runtime owner serve \
  --listen 127.0.0.1:28181 \
  --enable-generate \
  --runtime-revision local-v0.1 \
  --runner-interval 100ms \
  --agent
```

Broker通过同一fixed Aigora binding启动，可显式设置有界owner reconcile间隔：

```bash
client-runtime serve \
  --listen 127.0.0.1:8765 \
  --facades yeisme.workbench \
  --state-dir "$RUNTIME_STATE" \
  --instance-revision local-v0.1 \
  --aigora-owner-url http://127.0.0.1:28181 \
  --aigora-owner-available \
  --enable-aigora-adapter \
  --aigora-security-evidence-ready \
  --owner-reconcile-interval 1s \
  --agent
```

最后只在Workbench service显式开启generate：

```bash
WORKBENCH_RUNTIME_GENERATE_ENABLED=1 ./dist/workbenchd
```

Task仍必须依次通过permission与cost gate。成功路径投影accepted/running/terminal cursor，usage/cost ref由Aigora签发；queued cancel通过Aigora canonical transaction完成且不调用provider。关闭`WORKBENCH_RUNTIME_GENERATE_ENABLED`会从service registry移除generate，不影响connection-test开关，也不重放已有Task。

真实system证据`20260720135956-51a634bd-953c-4af7-b1d2-831955ab532d`已覆盖Workbench Task→broker events→Aigora Operator worker→credentialctl scoped grant→provider terminal，以及queued cancel/provider零新增调用。该证据不解除credentialctl/broker tagged release、独立安全复核和Web promotion门禁，因此generate仍保持默认关闭与隐藏。

### Generate promotion 状态

截至 2026-07-22，Workbench 侧的固定 registration、admission、event cursor/restart、SDK lifecycle 与隐藏 Web canary 已完成聚焦验证，但这不等于 generate 已发布。当前仍有三个外部门禁：

1. `backend-server/client-runtime` 必须提供可验证的 tagged Go/TypeScript consumer dependency，不能继续以本地 `replace`、`file:` 或 private `0.1.0-dev` package 作为发布证据。
2. Aigora 与 credentialctl 必须提供稳定、可追踪的 owner release/tag 和生产执行证据；dirty owner 工作树或 tag 之后的未发布提交不能作为 promotion 输入。
3. 必须完成独立安全评审，覆盖 approval replay、revision/credential drift、event 多订阅者、cancel/restart、unknown no-redispatch、SSRF/DNS/redirect/private-IP、敏感输出与资源上限。

这些门禁未全部满足时，不要在默认启动脚本、部署配置或 Web build 中设置以下变量：

```bash
WORKBENCH_RUNTIME_GENERATE_ENABLED=1
VITE_WORKBENCH_RUNTIME_GENERATE_CANARY_ENABLED=true
```

保持变量未设置即可让 service catalog 与 Web action继续 fail closed。connection-test first-support 仍由独立的`WORKBENCH_RUNTIME_CONNECTION_TEST_ENABLED`控制，不会隐式启用 generate。

## Owner adapter 边界

Scaena、Auctra 与 Eikona adapter 只能调用批准的公开 API 或批准的结构化 local bridge。它们不得读取 owner 私有数据库或目录、解析 human CLI output、拼接 shell 命令、处理 credential，或将 owner payload 保存到 Workbench。

当前 runtime 注册 unavailable owner client。owner 合同、版本/digest、receipt lookup、取消确认或状态对账不可用、失配或不可达时，调用保持 fail-closed，返回可诊断 unavailable/gate，而不是假装 mutation 成功。真实 owner mutation readiness 必须由 owner 的独立合同和验证证据确认。
