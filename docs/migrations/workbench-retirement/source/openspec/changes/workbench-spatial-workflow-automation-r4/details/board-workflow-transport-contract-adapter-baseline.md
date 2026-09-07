# Board / Workflow Four-Transport Contract Adapter 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.5a` 已完成 Board 与 Workflow 的 transport-neutral operation descriptor 和未绑定服务 fail-closed 基线：

- 从生成后的 Proto service descriptor 构造 canonical resource catalog，不手抄 request/response message shape；
- 初始注册 Board 32 个 RPC 与 Workflow 17 个 RPC；`2.2d3` additive新增`RevertTemplateApplication`后，当前为 Board 33 + Workflow 17，共50个descriptor；
- 固定 query、mutation、watch、idempotency、page token、event page 与 event watch 语义；
- 每个 descriptor 固定 SDK、HTTP、gRPC、JSON-RPC 四种 projection；
- request/response 使用 `protojson` + `dynamicpb` 严格规范化，unknown field 与 payload drift 在进入 shared service 前失败；
- streaming response 逐事件执行同一 Proto response validation；
- catalog 的 slice 与 map 对外返回防御性副本，调用方不能篡改 canonical descriptor；
- shared `Service.Invoke` / `Service.Watch` interface 不依赖 `core.Task`，transport 不拥有 Board/Workflow 状态机；
- 未绑定 service 时四 projection 都稳定返回不可重试的 `board_unavailable` 或 `workflow_unavailable`；
- HTTP、gRPC、JSON-RPC 与 SDK error projection 共享稳定 code 映射；
- TypeScript SDK 导出与 Go catalog 对等的50个resource descriptors，并从Proto文件验证method parity；
- SDK 保留 `board_unavailable` 与 `workflow_unavailable`，不再将其降级为 `internal`。

实现资产：

```text
service/internal/registry/resource.go
service/internal/registry/resource_test.go
service/internal/transport/contract/adapter.go
service/internal/transport/contract/adapter_test.go
service/test/conformance/resource_contract_test.go
packages/task-sdk/src/resource-contract.ts
packages/task-sdk/src/models.ts
packages/task-sdk/src/json-rpc.ts
packages/task-sdk/src/index.ts
packages/task-sdk/test/resource-contract.test.ts
packages/task-sdk/test/json-rpc.test.ts
Taskfile.yml
```

## 2. Descriptor 与 Shared Service 边界

`ResourceDescriptor` 只描述服务、namespace、method、Proto request/response、gRPC full method、operation kind、cursor、streaming、idempotency、stable errors 与 transport projections。它不注册 `core.Task` handler，也不保存 feature state。

四种 adapter 共用同一调用顺序：

```text
transport projection
  -> resolve canonical descriptor
  -> strict Proto JSON request normalization
  -> shared Service.Invoke / Service.Watch
  -> strict Proto JSON response normalization
  -> stable transport error projection
```

mutation 分类由 Proto request 的 `idempotency_key` 字段与 canonical classification 交叉验证；server-streaming 方法必须是 `watch`，不能通过 unary adapter 调用。Board/Workflow 资源方法不会进入旧 `registry.Operation` 的 Task execution state machine。

## 3. Fail-Closed 与错误映射

未绑定 service 不使用 fake repository、fixture 或本地 terminal mutation。四 projection 对 Board 返回：

```text
stable_code=board_unavailable
http_status=503
grpc_code=Unavailable
jsonrpc_code=-32013
retryable=false
```

Workflow 对应返回 `workflow_unavailable`，其余 transport code 相同。unknown method、非法 request、响应 contract mismatch 分别稳定映射为 `not_found`、`invalid_argument`、`contract_mismatch`。

## 4. 验证与证据

```bash
task resource:transport-contract:test
task test:resource-transport-contract:component
CGO_ENABLED=0 go test ./service/internal/registry ./service/internal/transport/... ./service/test/conformance -count=1
bun run test:contract
bun run typecheck
```

本轮结果：

- Go registry、全部既有 transport package 与 conformance 通过；
- SDK contract suite：78 tests、289 expectations 通过；
- TypeScript root 与 Web typecheck 通过；
- `git diff --check` 通过。

Component evidence：

```text
temp/integration-test-runs/20260720205751-a899eb49-fa16-4960-9b87-46d96b4dac5a/
status=passed
exit_code=0
redaction=enabled

temp/integration-test-runs/20260720230154-c112b92d-fa5f-42c3-9438-1fa7ab5b272a/
status=passed
exit_code=0
redaction=enabled
```

## 5. 边界与新增 local slice

### 5.1 Board aggregate mutation 的 local runtime slice（2026-08-01）

在不改变 `1.5b` 总体状态的前提下，已将 Board aggregate 的最小 mutation slice 绑定到真实 runtime service/repository：

- HTTP：`POST /v1alpha1/boards`、`/{boardRef}/rename`、`/{boardRef}/tombstone`；
- JSON-RPC：`CreateBoard`、`RenameBoard`、`TombstoneBoard`；
- gRPC：同名三个 RPC，使用同一 `boards.Service` 与 `GORMStore`；
- SDK live path：HTTP create/replay/tombstone、JSON-RPC rename/get/events/viewport；
- mutation response 共用 Board projection 与 `contractVersion/boardRevision/eventRef/replay` receipt。

运行时证据：

```text
temp/integration-test-runs/20260801181513-6f87c817-e1d3-4cdf-9599-346d1328ad32/
  bun test tests/conformance/board-sdk-runtime.test.ts
  status=passed, redaction=0

temp/integration-test-runs/20260801181532-3b8e4786-5032-4f57-8119-b2b37dd669c3/
  CGO_ENABLED=0 go test ./service/internal/runtime -run TestBoardMutationParityAcrossRuntimeHTTPJSONRPCAndGRPC -count=1 -p 1
  status=passed, redaction=0
```

该 slice 还修正了公开事件合同的两个漂移：revision companion event 使用非空 `reasonCode`，`board.revision_committed` 映射为 wire type `revision_committed`。证据只证明本地 runtime/SQLite 与三种 transport 的状态、版本和 receipt 一致，不提升为 PostgreSQL、Owner/provider 或 production readiness。

- 本基线不声明 Board 或 Workflow production service 已绑定到运行时 server；该工作属于 `1.5b`。
- `1.5b` 仍未完成：Board 的 managed List/Node/Group/Edge/Template/Watch，Workflow 的 validate/reconcile/events（local pause/resume/cancel 已有子集绑定），以及 PostgreSQL/restart parity 尚未全部闭环。
- Board 的 PostgreSQL promotion/restart 与 transaction/outbox fault evidence 仍未完成；本地 GORM、cursor 与 spatial query 不等同于该 gate。
- Board 的完整 graph/template/watch/query surface 与跨 transport parity 仍未完成；本 slice 不扩展 authority 或 canonical Owner state。
- Workflow scheduler、lease worker、Owner dispatch/reconcile 与 operator intervention runtime 仍需后续绑定。
- fake service、SQLite component 或 SDK route 存在都不能作为 `1.5b` production availability 证据。

### 5.2 CreateTemplateDraft transport slice（2026-08-02）

`CreateTemplateDraft` 现在沿同一 `boards.Service` 接入三个已存在的独立入口：

- HTTP：`POST /v1alpha1/board-templates`；
- JSON-RPC：`workbench.board.v1alpha1.CreateTemplateDraft`；
- gRPC：`WorkbenchBoardService.CreateTemplateDraft`。

HTTP/JSON-RPC 使用严格 typed `TemplateDraftInput`，gRPC 使用显式 Proto→domain 转换；未知字段、nil 子项、非法枚举与缺失几何/边界均在进入 domain service 前 fail-closed。三面共用 `boardcommon.ProjectTemplate` 的安全 projection，不返回内部时间戳、repository envelope、credential、raw idempotency key 或 Owner payload。SDK 现有 `createTemplateDraft` facade 已经消费同一 `{template}` response shape，本轮以 Board client contract suite 做回归。

Evidence：

```text
task test:board-template-create-transport:component
temp/integration-test-runs/20260802160139-2ba0c55a-77b7-4057-ad2e-fc757d882e15/
status=passed
duration_ms=5608
redaction.total_redactions=0
```

该 slice 仍是 local/component proof；Template list/capability、真实 PostgreSQL/restart、managed worker、R1/R2、Owner/provider 与 browser/production gate 均保持 open，不将 transport binding误报为 `1.5b` 或 production availability。

### 5.3 Template lifecycle transport slice（2026-08-02）

`PublishTemplate` 与 `DeprecateTemplate` 现在沿同一 `boards.Service` 接入三个独立入口：

- HTTP：`POST /v1alpha1/board-templates/{templateRef}/publish` 与 `/deprecate`；
- JSON-RPC：`workbench.board.v1alpha1.PublishTemplate` 与 `DeprecateTemplate`；
- gRPC：`WorkbenchBoardService.PublishTemplate` 与 `DeprecateTemplate`。

HTTP 路径解析只接受单个 URL-safe template ref，JSON-RPC 使用 strict typed mutation input，gRPC 拒绝 nil/非正 expected version；三面共用 canonical service 的 permission、registry digest、expected-version、idempotency 与 transition state machine，并只返回 `boardcommon.ProjectTemplate`/`BoardTemplate` 安全投影。未绑定 service 的 HTTP/gRPC 请求保持 unavailable，不降级为 transport-specific mutation。

Evidence：

```text
task test:board-template-lifecycle-transport:component
temp/integration-test-runs/20260802161258-38a1e900-31fe-42b5-a241-9f878ad3504a/
status=passed
duration_ms=5723
redaction.total_redactions=0
```

该 slice 仍是 local/component proof；Template list/capability、真实 PostgreSQL/restart、managed worker、R1/R2、Owner/provider 与 browser/production gate 均保持 open，不关闭 `1.5b`。

### 5.4 Template read transport slice（2026-08-02）

`GetTemplate` 现在沿同一 `boards.Service` 接入三个独立入口：

- HTTP：`GET /v1alpha1/board-templates/{templateRef}?version=...`；
- JSON-RPC：`workbench.board.v1alpha1.GetTemplate`；
- gRPC：`WorkbenchBoardService.GetTemplate`。

service 统一校验 tenant/read authority、template ref、可选版本与 `domain.ValidateTemplateIntegrity`，transport 只消费 `boardcommon.ProjectTemplate`/`BoardTemplate` 安全投影。HTTP 路径拒绝多段或控制字符 ref，gRPC 拒绝负版本，未绑定 service 的 HTTP/gRPC 请求保持 unavailable。

Evidence：

```text
task test:board-template-read-transport:component
temp/integration-test-runs/20260802162422-ba076b4f-ef28-47b8-a174-e8173f4eded2/
status=passed
duration_ms=11547
redaction.total_redactions=0
```

该 slice 仍是 local/component proof；Template list/capability、真实 PostgreSQL/restart、managed worker、R1/R2、Owner/provider 与 browser/production gate 均保持 open，不关闭 `1.5b`。

### 5.5 Template application transport slice（2026-08-02）

`ApplyTemplate` 与 `RevertTemplateApplication` 现在沿同一 `boards.Service` 接入四种 transport：

- HTTP：`POST /v1alpha1/boards/{boardRef}/templates/apply` 与 `/template-applications/revert`；
- JSON-RPC：`workbench.board.v1alpha1.ApplyTemplate` 与 `RevertTemplateApplication`；
- gRPC：`WorkbenchBoardService.ApplyTemplate` 与 `RevertTemplateApplication`；
- typed SDK：沿用既有 Board client methods 与 response validators。

Apply 请求只接受严格 typed placeholder values，先进入 canonical target resolver，再由 service 执行 template expansion、expected-board-revision、permission、idempotency 与 durable application outcome；revert 只接受 service 返回的 application event ref，并复用 canonical version guard。transport 不持有 graph mutation 状态机，只投影 `NodeView`/`GroupView`/`EdgeView` 与 mutation receipt；未绑定 service 的 HTTP/gRPC 请求保持 unavailable，nil Proto value fail-closed。

Evidence：

```text
task test:board-template-application-transport:component
temp/integration-test-runs/20260802163908-4877b6dd-093d-4693-a34b-b56fe541b456/
status=passed
duration_ms=33878
redaction.total_redactions=0
```

该 slice 只证明本地 SQLite/component transport binding；Template list/capability、真实 PostgreSQL/restart、managed worker、R1/R2、Owner/provider 与 browser/production gate 均保持 open，不关闭 `1.5b`。
