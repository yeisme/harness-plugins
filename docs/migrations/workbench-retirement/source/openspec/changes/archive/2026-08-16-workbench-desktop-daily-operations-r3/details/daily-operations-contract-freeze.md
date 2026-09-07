# Daily Operations 字段级合同冻结

## 1. 合同边界

Daily Operations 使用三个独立服务合同：

| Service | Contract id | Proto package | 权威范围 |
| --- | --- | --- | --- |
| `WorkbenchAssetService` | `workbench.assets.v0.1` | `workbench.assets.v1alpha1` | Asset safe projection、Collection、SavedView、Search、Asset events |
| `WorkbenchWorkItemService` | `workbench.workitems.v0.1` | `workbench.workitems.v1alpha1` | WorkItem、assignment、dependency、acceptance、links、events |
| `WorkbenchOperationsService` | `workbench.operations.v0.1` | `workbench.operations.v1alpha1` | Inbox、Approval、Activity、Delivery、source command、reconcile、events |

Task/Gate/Attempt/Receipt 继续由 `workbench.task.v1alpha1.WorkbenchTaskService` 与 R2 Owner receipt contract 所有；Operations 只保存 safe refs/status projection，不复制 Task 或 Owner 执行真源。

Proto request 使用各 package 自己的 typed `WorkspaceScope`，JSON/SDK 使用 flat `tenantRef`/`workspaceRef`。Adapter 必须显式转换；不得接受 `principalRef`、role、membership、allowedActions、bearer、credential 或 browser-provided authority 字段。

## 2. 通用字段规则

| 类型 | 规则 |
| --- | --- |
| `contractVersion` | 响应/事件必填，精确匹配上述 contract id |
| opaque ref | 1–256 字符，批准字符集，不接受 URL/path/control character |
| version | `uint64`/非负安全整数；mutation 的 `expectedVersion` 必须大于 0，create 除外 |
| idempotency key | mutation 必填，1–128 safe chars；header/body 必须一致 |
| digest | `sha256:<64 lowercase hex>` |
| time | JSON/SDK RFC3339Nano string；proto 同样使用 string 与现有 Layout 合同一致 |
| page size | 默认 50，最大 100；0 只表示默认 |
| page token | opaque，最大 512；绑定 tenant/workspace/query/sort/generation |
| summary/title | safe bounded text；title ≤200，summary ≤2,000，不接受 markup/raw payload |
| repeated refs | 每字段最多 64；batch mutation 最多 100 items |
| diagnostic | stable `code` + safe English `summary` + optional safe action id，不含 provider raw message |

所有 SDK normalizer 必须拒绝 unknown contract version、unknown enum、重复 identity、超限数组、跨 scope ref 和 unsafe string。服务端 request decoder 对 mutation 使用 strict unknown-field rejection。

## 3. AssetService 模型

### 3.1 `AssetEntry`

| Field | Type | Required | 说明 |
| --- | --- | --- | --- |
| `contractVersion` | string | yes | `workbench.assets.v0.1` |
| `assetRef` | opaque ref | yes | Workbench projection identity |
| `tenantRef` / `workspaceRef` | opaque ref | yes | authority scope |
| `ownerRef` / `resourceRef` | opaque ref | yes | R2 source identity |
| `projectionType` | versioned id | yes | allowlisted type |
| `sourceVersion` | string | yes | Owner version/etag safe form |
| `sourceCursor` | string | yes | source-local cursor |
| `projectionDigest` | digest | yes | safe projection canonical digest |
| `title` / `summary` | bounded text | yes/optional | safe projection only |
| `status` | enum | yes | `current/stale/permission_hidden/tombstoned` |
| `freshness` | enum | yes | `fresh/stale/offline/unknown` |
| `rightsState` | enum | yes | `verified/restricted/unknown/expired` |
| `reviewState` | enum | yes | `unreviewed/in_review/approved/changes_requested/rejected/unknown` |
| `lineageRefs` / `evidenceRefs` | repeated opaque ref | no | safe refs only |
| `allowedActions` | repeated versioned id | no | 当前投影，不替代 dispatch 时授权 |
| `occurredAt` / `observedAt` / `updatedAt` | time | yes | source 与 Workbench 时间 |
| `tombstone` | `AssetTombstone` | conditional | reason code/source version，不含旧 metadata |

不得新增 `rawPayload`、`content`、`bytes`、`prompt`、`privatePath`、任意 URL 或通用 metadata map。

### 3.2 `Collection`

字段：`contractVersion`、`collectionRef`、scope、`name`、`description`、`version`、`memberCount`、`createdAt`、`updatedAt`、`archived`。成员使用独立 `CollectionMember { collectionRef, assetRef, version, addedAt }`；Asset tombstone 后成员只保留 opaque ref。

### 3.3 `SavedView` 与 `AssetSearchQuery`

`SavedView` 字段：ref、scope、name、version、typed query、created/updatedAt、archived。

`AssetSearchQuery` 只允许：

- `text`（≤256，最多16 tokens）；
- `projectionTypes`、`ownerRefs`、`statuses`、`rightsStates`、`reviewStates`、`freshnessStates`（各≤8）；
- `collectionRef`；
- `sort`：`updated_desc/updated_asc/title_asc/freshness_desc/review_desc`；
- `pageToken`、`pageSize`。

`AssetSearchResult`：`asset`、最多 3 个 `SafeHighlight { field: title|summary, text }`、`scoreBucket`（枚举而非原始 DB score）。Response 还包含 `queryDigest`、`indexGeneration`、`nextPageToken`、`observedAt`。

## 4. AssetService 方法和路由

| Method | HTTP | Mutation | Request key fields |
| --- | --- | --- | --- |
| `GetAsset` | `GET /v1alpha1/assets/{assetRef}` | no | assetRef |
| `ListAssets` | `GET /v1alpha1/assets` | no | flat scope/status/owner/page |
| `SearchAssets` | `POST /v1alpha1/assets/search` | safe query | scope/query；无 idempotency |
| `ListCollections` | `GET /v1alpha1/collections` | no | scope/page |
| `CreateCollection` | `POST /v1alpha1/collections` | yes | scope/name/description/idempotency |
| `UpdateCollection` | `POST /v1alpha1/collections/{ref}:update` | yes | expectedVersion/fields/idempotency |
| `ArchiveCollection` | `POST /v1alpha1/collections/{ref}:archive` | yes | expectedVersion/idempotency |
| `AddCollectionMembers` | `POST /v1alpha1/collections/{ref}:add-members` | yes | expectedVersion/assetRefs/idempotency |
| `RemoveCollectionMembers` | `POST /v1alpha1/collections/{ref}:remove-members` | yes | expectedVersion/assetRefs/idempotency |
| `ListSavedViews` | `GET /v1alpha1/saved-views` | no | scope/page |
| `CreateSavedView` | `POST /v1alpha1/saved-views` | yes | scope/name/query/idempotency |
| `UpdateSavedView` | `POST /v1alpha1/saved-views/{ref}:update` | yes | expectedVersion/name/query/idempotency |
| `ArchiveSavedView` | `POST /v1alpha1/saved-views/{ref}:archive` | yes | expectedVersion/idempotency |
| `WatchAssetEvents` | `GET /v1alpha1/assets/events/watch` | stream | scope/source cursors |

`SearchAssets` 使用 POST 仅因 typed query 结构；语义只读，但 managed BFF 仍执行 Host/Origin/session/CSRF/body limit，不能被 notification 或 cache prefetch 当 mutation。

## 5. Asset events

`AssetEvent` 字段固定：contractVersion、eventRef、eventType、tenantRef、workspaceRef、assetRef、ownerRef、resourceRef、source、cursor、sourceVersion、projectionDigest、status、occurredAt、observedAt、traceRef。

Event types：`asset.upserted.v1`、`asset.stale.v1`、`asset.tombstoned.v1`、`asset.permission_hidden.v1`、`asset.rebuild_started.v1`、`asset.rebuild_completed.v1`、`asset.resync_required.v1`。Event 不携带 AssetEntry body；consumer 按 ref/version重新读取 canonical projection。

## 6. WorkItemService 模型

### 6.1 `WorkItem`

字段：contractVersion、workItemRef、scope、version、title、description（≤8KiB纯文本）、status、priority、assignee、dueAt、blockers、acceptanceChecks、dependencies、links、createdBy/updatedBy safe actor refs、createdAt/updatedAt/archivedAt。

Enums：

- status：`draft/ready/in_progress/blocked/in_review/done/cancelled/archived`；
- priority：`low/normal/high/urgent`；
- assignee kind：`user/team/automation`；
- blocker kind：`dependency/approval/owner_offline/permission/delivery/manual`；
- acceptance state：`open/passed/failed/waived`；
- link kind：`asset/task/approval/delivery/evidence/receipt`。

`WorkItemAssignee` 只有 `kind` + `actorRef`；不得携带 display profile/role/token。`WorkItemLink` 只有 kind/ref/sourceVersion/createdAt；详情从 owning service读取。

### 6.2 mutation fields

- create：scope、title、description、priority、assignee?、dueAt?、idempotencyKey；
- update details：workItemRef、expectedVersion、optional title/description/priority/dueAt、fieldMask enum、idempotencyKey；
- transition：ref、expectedVersion、targetStatus、reasonCode、overrideAcceptance（bool）、overrideReason、idempotency；
- assign：ref、expectedVersion、assignee、idempotency；
- dependency：ref、expectedVersion、dependencyRef、kind `blocks|relates`、idempotency；
- acceptance：ref、expectedVersion、checkRef、targetState、evidenceRefs、reason、idempotency；
- link：ref、expectedVersion、typed link、idempotency；
- archive：ref、expectedVersion、idempotency。

Field mask 是批准 enum列表，不接受 arbitrary protobuf `FieldMask` path或 JSON string path。

## 7. WorkItemService 方法和路由

| Method | HTTP | Request |
| --- | --- | --- |
| `CreateWorkItem` | `POST /v1alpha1/workitems` | create fields |
| `GetWorkItem` | `GET /v1alpha1/workitems/{ref}` | ref |
| `ListWorkItems` | `GET /v1alpha1/workitems` | scope/status/assignee/priority/page |
| `UpdateWorkItem` | `POST /v1alpha1/workitems/{ref}:update` | approved fields |
| `TransitionWorkItem` | `POST /v1alpha1/workitems/{ref}:transition` | target/status/reason |
| `AssignWorkItem` | `POST /v1alpha1/workitems/{ref}:assign` | typed assignee |
| `AddWorkItemDependency` | `POST /v1alpha1/workitems/{ref}:add-dependency` | dependency ref/kind |
| `RemoveWorkItemDependency` | `POST /v1alpha1/workitems/{ref}:remove-dependency` | dependency ref |
| `UpdateAcceptanceCheck` | `POST /v1alpha1/workitems/{ref}:update-acceptance` | check/state/evidence |
| `AddWorkItemLink` | `POST /v1alpha1/workitems/{ref}:add-link` | typed link |
| `RemoveWorkItemLink` | `POST /v1alpha1/workitems/{ref}:remove-link` | typed link identity |
| `ArchiveWorkItem` | `POST /v1alpha1/workitems/{ref}:archive` | expected version |
| `WatchWorkItemEvents` | `GET /v1alpha1/workitems/events/watch` | scope/after cursor |

Mutation response 统一 `WorkItemMutationResult { contractVersion, changed, replayed, workItem, eventRef }`。

## 8. WorkItem events

`WorkItemEvent`：contractVersion、eventRef/type、scope、workItemRef、version、actorRef、sourceRef?、cursor、occurredAt、summary、traceRef。Types：created、updated、transitioned、assigned、blocked、unblocked、acceptance_updated、dependency_added/removed、link_added/removed、archived。事件不携带 description/完整 acceptance 内容。

## 9. OperationsService 模型

### 9.1 `InboxItem`

字段：contractVersion、inboxItemRef、scope、version、sourceType、sourceRef、sourceVersion、actionKind、state、priority、dueAt、assignedActorRef?、safeSummary、receiptRef?、freshness、createdAt/updatedAt/resolvedAt。

Enums：state `open/deferred/resolved/stale/tombstoned`；actionKind `approve/review/reconcile/retry_safe_read/resolve_blocker/refresh_permission/complete_delivery`。

### 9.2 `ApprovalItem`

字段：approvalRef、scope、version、sourceType/ref/version、requiredAction、state、requesterRef、approverPolicyRef、safeSummary、expiresAt、decisionActorRef?、decisionReason?、receiptRef?、created/updated/decidedAt。

State：`open/deciding/approved/rejected/changes_requested/stale/expired/revoked`。Client 不能提交 approver identity；来自 PrincipalContext。

### 9.3 `ActivityItem`

字段：activityRef、scope、source、sourceRef、sourceEventRef、sourceCursor、eventType、subjectRef?、actorRef?、safeSummary、outcomeCode、occurredAt、observedAt、traceRef/evidenceRefs。不得提供通用 payload map。

### 9.4 `Delivery`

字段：deliveryRef、scope、version、workItemRefs、ownerRef、operationType、state、manifestRef/checksum/version、blockers、parentTaskRef/receiptRef、children、allowedActions、created/updated/completedAt。

`DeliveryChild`：childRef、resourceRef、state、idempotencyRef（opaque digest/ref，不返回 key）、receiptRef/statusRef、attempt、diagnostic。State：`not_dispatched/accepted/running/succeeded/failed/unknown/cancel_requested/cancelled`。

## 10. OperationsService 方法和路由

| Method | HTTP | 关键字段 |
| --- | --- | --- |
| `ListInboxItems` | `GET /v1alpha1/inbox` | scope/state/action/page |
| `GetInboxItem` | `GET /v1alpha1/inbox/{ref}` | ref |
| `DeferInboxItem` | `POST /v1alpha1/inbox/{ref}:defer` | expectedVersion/due/idempotency |
| `ExecuteInboxAction` | `POST /v1alpha1/inbox/{ref}:execute` | expectedVersion/actionKind/idempotency |
| `ListApprovalItems` | `GET /v1alpha1/approvals` | scope/state/page |
| `GetApprovalItem` | `GET /v1alpha1/approvals/{ref}` | ref |
| `DecideApproval` | `POST /v1alpha1/approvals/{ref}:decide` | expectedVersion/decision/reason/idempotency |
| `ListActivity` | `GET /v1alpha1/activity` | scope/source cursors/page |
| `WatchActivity` | `GET /v1alpha1/activity/events/watch` | scope/source cursors |
| `ListDeliveries` | `GET /v1alpha1/deliveries` | scope/state/owner/page |
| `GetDelivery` | `GET /v1alpha1/deliveries/{ref}` | ref |
| `PrepareDelivery` | `POST /v1alpha1/deliveries` | scope/workItems/owner/operation/expected versions/idempotency |
| `DispatchDelivery` | `POST /v1alpha1/deliveries/{ref}:dispatch` | expectedVersion/idempotency |
| `ReconcileDelivery` | `POST /v1alpha1/deliveries/{ref}:reconcile` | expectedVersion/idempotency |
| `RetryDeliveryChildren` | `POST /v1alpha1/deliveries/{ref}:retry-children` | expectedVersion/childRefs/idempotency |
| `WatchOperationsEvents` | `GET /v1alpha1/operations/events/watch` | scope/after cursor |

`ExecuteInboxAction` 只接受 item 当前 `actionKind` 对应的 enum，不接受任意 command name/URL/input JSON。`RetryDeliveryChildren` 对 unknown child 必须拒绝为 `failed_precondition`，由 reconcile先收敛。

## 11. Operations events

Operations event 使用 discriminated envelope，不使用 arbitrary JSON：contractVersion、eventRef、eventType、scope、resourceKind、resourceRef、version、sourceRef?、receiptRef?、cursor、occurredAt、safeSummary、traceRef。

Types：`inbox.opened/resolved/stale`、`approval.opened/deciding/decided/stale`、`delivery.prepared/dispatched/progress/partial/succeeded/failed/reconciled`、`operations.resync_required`。完整对象需通过 Get/List读取。

## 12. Idempotency 和 version 规则

| 操作 | Expected version | Idempotency | Replay |
| --- | --- | --- | --- |
| create | none | required | 同 digest返回相同对象；drift冲突 |
| metadata update | required | required | 返回相同 version/result |
| transition/decision | required | required | 终态相同返回 replay；不同 target/digest冲突 |
| source execute/dispatch | required | required并绑定 Task/Owner key | unknown outcome不生成新 key |
| reconcile | required | required | 只读 Owner truth后推进 projection |
| retry children | required | required，绑定明确 child set | unknown child拒绝 |

Request digest 由服务端对 canonical request生成；header/body idempotency mismatch 原子拒绝。Principal/session revision不进入业务 digest，但在授权和 audit中记录，避免客户端伪造 replay scope。

## 13. Stable errors 和 transport mapping

| Domain code | HTTP | gRPC | JSON-RPC numeric/data |
| --- | --- | --- | --- |
| `authentication_required` | 401 | Unauthenticated | `-32001` / same code |
| `permission_denied` | 403 | PermissionDenied | `-32003` |
| `not_found` | 404 | NotFound | `-32004` |
| `invalid_argument` / `invalid_cursor` | 400 | InvalidArgument | `-32602` / data code |
| `idempotency_conflict` | 409 | AlreadyExists | `-32009` |
| `version_conflict` | 409 | Aborted | `-32010` |
| `invalid_transition` / `dependency_cycle` | 409 | FailedPrecondition | `-32011` / data code |
| `approval_stale` / `delivery_blocked` / `receipt_mismatch` | 409 | FailedPrecondition | `-32011` / data code |
| `contract_mismatch` | 412 | FailedPrecondition | `-32012` |
| `owner_offline` / `unavailable` / `rate_limited` | 503/429 | Unavailable/ResourceExhausted | `-32013` / data code |
| `needs_contract` | 412 | FailedPrecondition | `-32014` |
| `query_too_complex` | 422 | ResourceExhausted | `-32011` / data code |

`unknown_accept`、`partial`、`cancel_requested` 是 Task/Delivery 状态，不默认作为 transport error。Error message 固定安全文本，provider raw message/body 只在 provider side脱敏证据中处理，不能返回浏览器。

## 14. Namespace 和 SDK

- JSON-RPC namespaces：`workbench.assets.v1alpha1.*`、`workbench.workitems.v1alpha1.*`、`workbench.operations.v1alpha1.*`。
- TypeScript：`WorkbenchAssetClient`、`WorkbenchWorkItemClient`、`WorkbenchOperationsClient`，挂载在 `WorkbenchClient.assets/workItems/operations`。
- Browser HTTP 只走 same-origin BFF；所有 mutation 发送 cookie、CSRF、session revision，BFF删除 browser credential并注入server context。
- JSON-RPC mutation notification（无 id）必须拒绝；stream 仅使用批准 watch method。
- Response normalizer fail-closed；unknown enum/field不转换为可用 action。

## 15. 兼容和生成

生成资产路径：

```text
api/proto/workbench/assets/v1alpha1/assets.proto
api/proto/workbench/workitems/v1alpha1/workitems.proto
api/proto/workbench/operations/v1alpha1/operations.proto
api/schema/workbench/assets/v1alpha1/*.schema.json
api/schema/workbench/workitems/v1alpha1/*.schema.json
api/schema/workbench/operations/v1alpha1/*.schema.json
service/gen/workbench/{assets,workitems,operations}/v1alpha1/**
packages/task-sdk/src/{asset,workitem,operations}-{models,client}.ts
```

- 字段只 additive；proto field number 删除后 reserved，enum value不复用。
- `v0.1/v1alpha1` 未稳定前可以 additive迭代；一旦 canary consumer 发布，breaking change新建 package/contract version。
- Schema/SDK/proto digest进入 registry descriptor、conformance evidence 和 release manifest。
- 结构化资产只能由 contract generation command生成，不手写 JSON/YAML metadata。

## 16. Contract verification

```bash
task daily:contract:generate
task daily:contract:test
task test:daily-contract:component
```

验证必须覆盖：generated clean check、Buf lint、Go compile、JSON Schema positive/negative、SDK normalizer、method/route/namespace parity、error mapping、idempotency header/body、principal injection、cross-tenant refs、unknown fields、array/size/cursor limits和敏感字段扫描。Component evidence写入标准六件套。
