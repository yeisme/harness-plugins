# V2/V3 Surface Inventory（0.1 冻结件）

实现前冻结的 V2 既有面与 V3 增量分类。本文件是 `workbench-spatial-canvas-experience-v3` 的 surface inventory 真值：任何实现切片不得使下表 V2 项发生 rename/remove/reinterpret/widen。

## V2 既有面（全部保持原样）

### protobuf（`api/proto/workbench/spatial/v1/spatial.proto`，package `workbench.spatial.v1`）

RPC（5）：

| Method | 请求 | 响应 |
| --- | --- | --- |
| `QuerySpatialSurface` | `QuerySpatialSurfaceRequest` | `QuerySpatialSurfaceResponse` |
| `GetSpatialSurfaceRevision` | `GetSpatialSurfaceRevisionRequest` | `GetSpatialSurfaceRevisionResponse` |
| `WatchSpatialSurface` | `WatchSpatialSurfaceRequest` | `stream WatchSpatialSurfaceResponse` |
| `PlanSpatialLayout` | `PlanSpatialLayoutRequest` | `PlanSpatialLayoutResponse` |
| `ApplySpatialChangeSet` | `ApplySpatialChangeSetRequest` | `ApplySpatialChangeSetResponse` |

Enum（2）：`SpatialLensKind`（0–5，creative_production/workflow/run/review/evidence）、`SpatialLod`（0–3，far/medium/near）。

Message（28，含 field number 冻结）：`SpatialBounds`(1-4)、`SpatialCapability`(1-3)、`SpatialLensDescriptor`(1-8)、`SpatialViewportFilter`(1-3)、`SpatialViewportQuery`(1-10)、`SpatialPrimitive`(1-13)、`SpatialRelationPrimitive`(1-5)、`SpatialTile`(1-5)、`SpatialCluster`(1-5)、`SpatialProjectionProvenance`(1-5)、`SpatialViewportResponse`(1-9)、`SpatialRuntimeAction`(1-7)、`SpatialRuntimeStep`(1-5)、`SpatialRuntimeProjection`(1-14)、`SpatialOverlay`(1-6)、`SpatialOwnerSegment`(1-8)、`SpatialSurfaceSnapshot`(1-13)、`SpatialGeometry`(1-4)、`SpatialChangeOperation`(1-9)、`SpatialChangeSetProposal`(1-14)、五个 RPC 的 Request/Response 消息（含 `WatchSpatialSurfaceResponse` 1-10 additive envelope）。

### Go service contract（`service/internal/spatial`）

- Contract 常量：`workbench.spatial_surface.v1`、`workbench.spatial_viewport.v2`、`workbench.spatial_lens.v1`、`workbench.spatial_change_set.v1`、`workbench.spatial_runtime_projection.v1`、`workbench.board_type_registry.v2`。
- `ViewportQuery`/`ViewportResponse` strict 校验：zoomBucket ∈ [-16,16]、lod ∈ far|medium|near、maxPrimitives ∈ [1,8192]、tileCursor ≤512。
- `QuerySurface`/`CurrentSurfaceRevision`/`WatchSurface`/`PlanLayout`/`ApplyChangeSet`/`ExecuteApprovedChangeSet` 行为与 error 面（`ErrInvalidArgument`/`ErrNeedsContract`/resync）。

### TypeScript SDK（`packages/task-sdk/src/spatial-models.ts`、`spatial-client.ts`）

- 常量/类型：`spatialSurfaceContractVersion` … `spatialBoardRegistryVersion`；`SpatialLensKind`、`SpatialLOD`、`SpatialCapabilityState`、`SpatialRendererCapability`、`SpatialNodeType`、`SpatialIntentKinds`、`SpatialChangeOperationKinds`；全部 `*V1/V2` interface。
- Strict normalizer（未知 key 即拒绝）：`normalizeSpatialBounds/LensDescriptor/ViewportQuery/ViewportResponse/RuntimeProjection/SurfaceSnapshot/AgentSpatialIntent/ChangeSetProposal` 及私有 item normalizer。
- Client 方法：`querySpatialSurface`、`watchSpatialSurfaceEvents`、`watchSpatialSurface`（deprecated shim）、`planSpatialLayout`、`applySpatialChangeSet`、`normalizeAgentIntent`；`workbenchSpatialMethods` 方法名映射；watch 事件 union（snapshot|event|resync，`workbench.spatial_watch_event.v1`）。

### 传输 identity

- HTTP/SSE：`POST /v1/spatial/surfaces:query`、`GET /v1/spatial/surfaces:revision`、`GET /v1/spatial/surfaces:watch`、`POST /v1/spatial/layouts:plan`、`POST /v1/spatial/change-sets:apply`（`DisallowUnknownFields`）。
- JSON-RPC：`workbench.spatial.v1.QuerySpatialSurface/GetSpatialSurfaceRevision/WatchSpatialSurface/PlanSpatialLayout/ApplySpatialChangeSet`；SSE 事件 `workbench.spatial.v1.SurfaceEvent/SurfaceResync`。
- gRPC：`WorkbenchSpatialService` 五方法（proto view codec）。

### 仓内消费者（V2 保持 source-compatible 的核对范围）

- Web：`apps/web/src/workbench/agent/spatial/**`（`spatial-intent-projection/resolver`、`pixi-spatial-renderer`、`spatial-surface`、workflow-lens、creative-production lens、change-set-review）、`apps/web/e2e/agent-spatial.spec.ts`、`creative-production.spec.ts`。
- 测试：`service/test/conformance/spatial_transport_parity_test.go`、`conformance_test.go`、`service/internal/transport/{spatialhttp,spatialgrpc}/handler_test.go`、`service/internal/transport/jsonrpc/spatial_test.go`、`packages/task-sdk/test/spatial-*`。
- SDK facade：`workbench-client.ts` 挂载 `WorkbenchSpatialClient`（namespace `workbench.spatial.v1`）。

## V3 增量（全部 additive）

| 面 | 增量 | 分类 |
| --- | --- | --- |
| protobuf | `SpatialSemanticLevelV1` enum、`SpatialRegionV1`、`SpatialViewportQueryV3/ResponseV3`、layout/preference、draft/presence/promotion 新 message、`QuerySpatialSurfaceV3` 等新 RPC | additive：新 message/新 field number（≥ 各消息未占用段）/新 method；旧 field number 不复用 |
| Go service | V3 query/layout/preference/draft/search/presence/promotion service 方法与 `workbench.spatial_viewport.v3` 等 contract 常量 | additive |
| SDK | `SpatialViewportQueryV3` 等 V3 类型 + strict normalizer + client 新方法（V2 导出不动） | additive |
| HTTP/JSON-RPC/gRPC | V3-only 路径/方法名（`:queryV3`、`workbench.spatial.v3.*` 等）；旧 identity 永不返回 V3 shape | additive |
| database | lens layout / view preference / draft document·object·event·idempotency·promotion provenance 新表+索引；presence 不落库 | expand-only |
| config/capability | `spatialCanvasShellV3`、`spatialViewportV3`、`spatialDraftCollaboration`、`spatialPresence` default-off flag | additive |
| UI deep link | 旧 `/agent?view=` 保留；V3 新参数 closed-normalize | additive |

## breaking_surfaces

```yaml
breaking_surfaces: []
```

约束回读：V2 request 必须
收到 V2 response（strict normalizer 不感知 V3-only key）；`far|medium|near` 枚举值、zoomBucket 区间、8192 上限、watch envelope 语义不变；任何需要 V2 重解释/删除/变形的实现发现都应停止并另建 deprecation change。
