# Workbench Task 控制平面接口

## 范围与架构

`WorkbenchTaskService` 是 v1alpha1 本机控制面：`Operation registry` 是唯一的 operation 合同源，`TaskService` 是 Task 生命周期的唯一权威，SDK、REST+SSE、gRPC 和独立 JSON-RPC 2.0 只做 transport 编解码。所有已 seal 的 Operation 都必须同时具有 handler、输入 schema 和四种 projection；缺项时注册失败。

```text
WorkbenchTaskClient / REST+SSE / gRPC / JSON-RPC
                         -> TaskService
                         -> sealed Operation registry
                         -> owner adapter 或 synthetic handler
                         -> GORM + private SQLite metadata store
```

Workbench 仅保存 Task metadata、Attempt、Event index、`safe_ref` 与 transport receipt。它不保存 owner payload、credential、private path、artifact blob 或 owner canonical state。

## Operation 与 Task 生命周期

`Operation` 描述 `type`、`mode`、`mutation`、gates、project modes、`schemaRef` 和 `registryDigest`。当前 catalog 包含：

- 可验证的 synthetic：`workbench.synthetic.echo`、`workbench.synthetic.gated_echo`。
- 不可用占位：`workbench.owner.unavailable`。
- 已注册但未获 owner runtime 合同的 Scaena、Auctra、Eikona operation；提交会返回安全的 unavailable 结果，不会改变 owner 状态。

`Task` 的非终态为 `awaiting_permission`、`awaiting_cost_confirmation`、`queued`、`running`、`retry_wait`、`cancel_requested`、`unknown_accept`；终态为 `succeeded`、`partial`、`failed`、`cancelled`。`Gate` 使用 `permission` 或 `cost_confirmation`，状态为 `pending`、`approved`、`denied`、`expired`。`Attempt` 使用 `dispatch`、`cancel`、`retry`、`reconcile`，并记录 `started`、`succeeded`、`failed` 或 `unknown`。

取消先进入 `cancel_requested`；在 owner/attempt 确认前不会显示为 `cancelled`。`unknown_accept` 不会自动重试；只有显式 `ReconcileUnknownAccept` 才能按观察到的状态写入 reconciliation receipt。`RetryTask` 创建关联的新 Task，且使用新的 idempotency key。

## Catalog、schema 与幂等

- 以 `GET /v1alpha1/operations` 或 `ListOperations` 获取 sealed catalog 和 `registryDigest`；以 `GetOperation` 获取单个 Operation。
- 每个 `schemaRef` 是 canonical JSON Schema 的 `sha256:` 引用；服务先按 schema 验证 input，再 canonicalize JSON，并**由服务器计算** request digest。客户端提供的 `requestDigest` 不参与判定。
- catalog digest、operation 的 canonical schema 和 `schemaRef` 由同一 registry 生成；调用方应将 catalog/schema 视为同一版本的配对合同，而不是维护独立 schema 副本。
- mutation 的幂等范围是已验证 principal 的 `(caller_scope, workspace_id, project_id, operation_type, idempotency_key)`。同一范围且 server-computed digest 相同返回原 Task 与 receipt（`replayed: true`）；digest 不同返回 `idempotency_conflict`。
- owner mutation 还要求 `expectedOwnerVersion`；Task 控制操作使用 `expectedTaskVersion` 防止并发覆盖。

## 方法矩阵

所有 RPC method 名称是 `WorkbenchTaskService` 的 gRPC 方法，也是 JSON-RPC 的 `method` 字符串。SDK 使用对应的 camelCase façade；REST 都要求 `Authorization: Bearer <local-session-token>`。`WatchTaskEvents` 在 REST 为 SSE，在 gRPC 为 server stream。

| SDK | gRPC / JSON-RPC method | REST 路由 |
| --- | --- | --- |
| `listOperations` | `ListOperations` | `GET /v1alpha1/operations` |
| `getOperation` | `GetOperation` | `GET /v1alpha1/operations/{operation_type}` |
| `submitTask` | `SubmitTask` | `POST /v1alpha1/tasks` |
| `getTask` | `GetTask` | `GET /v1alpha1/tasks/{task_id}` |
| `listTasks` | `ListTasks` | `GET /v1alpha1/tasks?workspace_id=&project_id=&page_token=&page_size=` |
| `cancelTask` | `CancelTask` | `POST /v1alpha1/tasks/{task_id}/cancel` |
| `retryTask` | `RetryTask` | `POST /v1alpha1/tasks/{task_id}/retry` |
| `reconcileUnknownAccept` | `ReconcileUnknownAccept` | `POST /v1alpha1/tasks/{task_id}/reconcile` |
| `getGate` | `GetGate` | `GET /v1alpha1/gates/{gate_id}` |
| `listGates` | `ListGates` | `GET /v1alpha1/gates?task_id=` |
| `resolveGate` | `ResolveGate` | `POST /v1alpha1/gates/{gate_id}/resolve` |
| `getAttempt` | `GetAttempt` | `GET /v1alpha1/attempts/{attempt_id}` |
| `listAttempts` | `ListAttempts` | `GET /v1alpha1/attempts?task_id=` |
| `listEvents` | `ListEvents` | `GET /v1alpha1/tasks/{task_id}/events?after_sequence=&page_size=` |
| `watchEvents` | `WatchTaskEvents` | `GET /v1alpha1/tasks/{task_id}/events/watch?after_sequence=` (SSE) |
| `getArtifact` | `GetArtifact` | `GET /v1alpha1/artifacts/{artifact_id}` |
| `listArtifacts` | `ListArtifacts` | `GET /v1alpha1/artifacts?task_id=` |
| `getReceipt` | `GetReceipt` | `GET /v1alpha1/receipts/{receipt_id}` |
| `listReceipts` | `ListReceipts` | `GET /v1alpha1/receipts?task_id=` |

JSON-RPC 2.0 unary calls发送到 `POST /rpc`，body 形如 `{"jsonrpc":"2.0","id":"catalog-1","method":"ListOperations","params":{}}`；事件流使用 `POST /rpc/stream` 与 `WatchTaskEvents`。gRPC service 为 `workbench.task.v1alpha1.WorkbenchTaskService`，定义在 `api/proto/workbench/task/v1alpha1/task.proto`。

## 稳定错误与兼容性

稳定业务错误代码仅包括 `idempotency_conflict` 和 `task_version_conflict`，分别表示同一幂等范围复用了不同 input，或 `expectedTaskVersion` 过期。REST 将它们映射为 `409 Conflict`；SDK 公开 `WorkbenchTaskError` 的 code/status/requestId；gRPC 使用冲突对应的 status code；JSON-RPC 保留同一 code 于 error data。

输入 schema 不匹配、缺必填字段或非法 JSON 为 invalid argument；未知资源为 not found；无效 local session 为 unauthorized；不可信 host/origin 为 forbidden；POST 的非 JSON content type 为 unsupported media type；取消和 deadline 为 timeout/cancelled。调用方不得依据英文 message 判断状态，应依据稳定 code、HTTP/gRPC/JSON-RPC 状态及返回的当前 Task。
