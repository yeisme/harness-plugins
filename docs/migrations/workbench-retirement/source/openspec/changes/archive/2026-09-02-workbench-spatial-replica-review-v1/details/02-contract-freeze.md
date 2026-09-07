# 0.2 合同冻结：`workbench.spatial_replica_workspace_projection.v1alpha1`（2026-09-01）

> 对应 task 0.2。本文是**字段级可实现合同草案**：proto 字段号、enum 值、closed pane parameter schema、error model 与兼容/回滚分类在此冻结，task 1.1 起按本文直接落地 proto/schema/Go/SDK。
> 长期文档 `docs/interfaces/spatial-replica-review.md`（§4「最终字段号以生成合同为准」）以本文为其字段号决议来源；两文冲突时以本文为准并回写长期文档。

## 1. 放置与命名

| 项 | 冻结值 |
| --- | --- |
| contract name | `workbench.spatial_replica_workspace_projection.v1alpha1` |
| proto 文件（新建） | `api/proto/workbench/spatialreplica/v1alpha1/spatialreplica.proto` |
| proto package | `workbench.spatialreplica.v1alpha1` |
| go_package | `github.com/yeisme/yeisme-workbench/service/gen/workbench/spatialreplica/v1alpha1;spatialreplicav1alpha1` |
| JSON Schema（新建） | `api/schema/workbench/spatialreplica/v1alpha1/spatialreplica.schema.json` |
| service | `WorkbenchSpatialReplicaService`（5 个 rpc，见 §10） |
| 共享类型来源 | `import "workbench/agent/v1alpha1/agent.proto"` 复用 `ActionDescriptorV1`/`ActionAvailability`（**零重定义、零改义**；`AgentOutputV1.expected_versions` 的 `map<string,string>` 模式可作为 wrapper 版本 echo 参考） |
| 兼容分类 | additive、experimental `v1alpha1`、default-off、stable-surface（enum/field 号一经发布不得 rename/retype/repurpose；演进必须拆独立 evolutionary change） |

SafeRef 冻结为 **bounded string**（非 message）：`^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9._:-]{0,127}$`，scheme 属 owner 命名空间（`ana:`/`auc:`/`sca:`/`wb:`）。SafeRef 携带类型前缀但不携带 version（version 恒为独立字段），禁止内嵌 URL/path/query。

## 2. Enum 冻结（proto enum + 值号）

| Enum | 值（= 号后为 proto number） | 备注 |
| --- | --- | --- |
| `SpatialReplicaOwner` | `UNSPECIFIED=0; ANATOMIA=1; AUCTRA=2; SCAENA=3; WORKBENCH=4` | closed；未知值 fail closed |
| `SpatialReplicaReadiness` | `UNSPECIFIED=0; AVAILABLE=1; DEGRADED=2; OFFLINE=3; NEEDS_CONTRACT=4; CONTRACT_MISMATCH=5; PERMISSION_REQUIRED=6; UNAVAILABLE=7` | per-segment |
| `SpatialReplicaCurrentness` | `UNSPECIFIED=0; CURRENT=1; LAST_CONFIRMED=2; STALE=3; REVOKED=4; UNKNOWN=5` | per-segment |
| `SpatialReplicaProjectionStatus` | `UNSPECIFIED=0; READY=1; PARTIAL=2; STALE=3; OFFLINE=4; REVOKED=5; NEEDS_CONTRACT=6; PERMISSION_REQUIRED=7; CONTRACT_MISMATCH=8` | top-level 聚合视图，不遮蔽 per-segment |
| `SpatialReplicaLayerKind` | `UNSPECIFIED=0; GRAYSCALE=1; DEPTH=2; MASK=3; FLOW=4; SKELETON=5; CAMERA=6; QUALITY=7` | 7 种 evidence layer |
| `SpatialReplicaScaleTier` | `UNSPECIFIED=0; UNKNOWN_TIER=1; RELATIVE=2; METRIC_APPROXIMATE=3; METRIC_VERIFIED=4` | JSON 值 `unknown/relative/metric_approximate/metric_verified` |
| `SpatialReplicaStageMode` | `UNSPECIFIED=0; REFERENCE_EVIDENCE=1; SCREENPLAY_DRIVEN=2` | Scaena stage mode |
| `SpatialReplicaTruthLayer` | `UNSPECIFIED=0; EVIDENCE=1; CANDIDATE=2; PRODUCTION_OVERRIDE=3; FROZEN=4` | Inspector 四层真相 |
| `SpatialReplicaObjectKind` | `UNSPECIFIED=0; CAMERA=1; GROUND=2; PLANE=3; BOX=4; CAPSULE=5; BOUNDS=6; PROXY=7; ACTOR_PLACEHOLDER=8; SKELETON_JOINT=9; CONTACT_MARKER=10; OCCLUSION_MARKER=11; CANDIDATE_GHOST=12; DERIVATIVE_REF=13` | P1 stage primitive closed set |
| `SpatialReplicaTrackKind` | `UNSPECIFIED=0; SOURCE_SEGMENT=1; CAMERA_TRACK=2; ACTOR_ROOT=3; JOINT=4; KEYFRAME=5; CONTACT=6; OCCLUSION=7; AUDIO=8; QUALITY_TRACK=9; RECEIPT=10` | timeline track family |
| `SpatialReplicaInquiryStatus` | `UNSPECIFIED=0; ANSWERED=1; PARTIAL=2; UNKNOWN_RESULT=3; INSUFFICIENT_EVIDENCE=4` | JSON `answered/partial/unknown/insufficient_evidence` |
| `SpatialReplicaConfirmation` | `UNSPECIFIED=0; NONE=1; CONFIRM=2; REVIEW_REQUIRED=3` | action confirmation policy |
| `SpatialReplicaExecutionPath` | `UNSPECIFIED=0; DIRECT_TASK=1; PROPOSAL_THEN_TASK=2` | |
| `SpatialReplicaSubmitStatus` | `UNSPECIFIED=0; ACCEPTED=1; REJECTED=2; CONFLICT=3; DUPLICATE=4; UNKNOWN_ACCEPT=5` | submit 瞬时结果；后续态复用既有 `task.v1alpha1.TaskStatus`（含 `TASK_STATUS_UNKNOWN_ACCEPT=7`），不重定义 |
| `SpatialReplicaScreenplayDepth` | `UNSPECIFIED=0; METADATA_ONLY=1; SCENE=2; BEAT=3; LINE=4` | Auctra safe text 授权深度 |
| `SpatialReplicaEventKind` | `UNSPECIFIED=0; SNAPSHOT=1; SEGMENT_STATE=2; TASK_EVENT=3; OWNER_RECEIPT=4; CAPABILITY_CHANGE=5; RESYNC=6` | watch envelope closed kind（对齐 spatial.proto 既有 `snapshot|event|resync` string-kind 语义，新面用 enum） |
| `SpatialReplicaDerivativeKind` | `UNSPECIFIED=0; GLB_PREVIEW=1; CONTROL_PASS=2; FROZEN_DERIVATIVE=3` | |
| `SpatialReplicaPaneState` | `UNSPECIFIED=0; LOADING=1; EMPTY=2; PARTIAL=3; STALE=4; ERROR=5; REVOKED=6; PERMISSION_REQUIRED=7; OFFLINE=8; NEEDS_CONTRACT=9; UNSUPPORTED_VERSION=10` | Pane 呈现态（`duplicate_action/unknown_accept/limit_reached/navigation_away/sync_degraded/view_too_large/webgl_unavailable` 属 action/region 子状态，不入本 enum，见 §9） |

## 3. 基础标量/时间/坐标 message

| Message | 字段（名: 类型 = 号） |
| --- | --- |
| `SpatialReplicaRational` | `value: int64 = 1`（有符号计数）；`timescale: int64 = 2`（>0，Hz）；RationalTime = value/timescale。禁止 float 表达 join key |
| `SpatialReplicaPtsRange` | `start_pts: SpatialReplicaRational = 1`；`end_pts: SpatialReplicaRational = 2`（半开区间 `[start,end)`）；`segment_id: string = 3`（owner cut/segment id，optional） |
| `SpatialReplicaPtsMap` | `source_ref: string = 1`（SafeRef）；`timebase: SpatialReplicaRational = 2`；`segments: repeated SpatialReplicaPtsRange = 3`（≤8）；`frame_intervals_ref: string = 4`（NumericArtifactRef，VFR 帧距表；inline 时为空）；`inline_frame_intervals: repeated SpatialReplicaRational = 5`（≤4096，仅 P1 fixture 允许 inline）；`frame_policy: string = 6` 固定 `owner_pts_map`；`discontinuities: repeated SpatialReplicaPtsRange = 7`（gap/duplicate 标注） |
| `SpatialReplicaCoordinateFrame` | `frame_ref: string = 1`；`handedness: string = 2`（`right_handed`｜`left_handed`）；`up_axis: string = 3`；`forward_axis: string = 4`；`origin_definition: string = 5`（bounded）；`unit: string = 6`（SI 单位或 `unitless`）；`parent_frame_ref: string = 7`（optional）；`valid_pts: SpatialReplicaPtsRange = 8`；`capture_profile_ref: string = 9`（optional）；`limitations: repeated SpatialReplicaLimitation = 10`。Scaena P1 约定冻结：right_handed、`+Y` up、camera look `-Z` |
| `SpatialReplicaLimitation` | `code: string = 1`（stable English）；`message_key: string = 2`（i18n catalog key）；`detail: string = 3`（bounded ≤200 chars，redacted） |
| `SpatialReplicaQualitySummary` | `profile_ref: string = 1`；`currentness: SpatialReplicaCurrentness = 2`；`note_key: string = 3`（optional）；`bounded_metrics: map<string,string> = 4`（≤8 项，display-only，value ≤64 chars） |

## 4. Owner segment 与 projection 骨架

| Message | 字段 |
| --- | --- |
| `SpatialReplicaOwnerSegment` | `owner: SpatialReplicaOwner = 1`；`contract_name: string = 2`；`contract_version: string = 3`；`resource_ref: string = 4`（SafeRef）；`resource_version: string = 5`（optional）；`digest: string = 6`（optional，hex ≥32）；`readiness: SpatialReplicaReadiness = 7`；`currentness: SpatialReplicaCurrentness = 8`；`last_confirmed_at_unix_ms: int64 = 9`（optional）；`owner_cursor: string = 10`（optional）；`limitations: repeated SpatialReplicaLimitation = 11` |
| `SpatialReplicaPreviewRef` | `opaque_ref: string = 1`（server 签发，非 owner URL）；`media_kind: string = 2`（`video|image|canvas_overlay`）；`expires_at_unix_ms: int64 = 3`；`content_type: string = 4`。仅渲染/播放用途；进入数值 API 一律拒绝 |
| `SpatialReplicaNumericArtifactRef` | `opaque_ref: string = 1`；`schema_ref: string = 2`；`coordinate_frame: SpatialReplicaCoordinateFrame = 3`；`unit: string = 4`；`lineage_refs: repeated string = 5`（≤8，snapshot/bundle SafeRefs） |
| `SpatialReplicaEvidenceLayerManifest` | `layer_ref: string = 1`；`kind: SpatialReplicaLayerKind = 2`；`preview: SpatialReplicaPreviewRef = 3`（optional）；`numeric_artifact: SpatialReplicaNumericArtifactRef = 4`（optional）；`snapshot_ref: string = 5`；`bundle_ref: string = 6`（optional）；`pts_coverage: repeated SpatialReplicaPtsRange = 7`（≤16）；`scale_tier: SpatialReplicaScaleTier = 8`；`quality: SpatialReplicaQualitySummary = 9`；`currentness: SpatialReplicaCurrentness = 10`；`limitations: repeated SpatialReplicaLimitation = 11` |
| `SpatialReplicaSourceProjection` | `source_ref: string = 1`；`media_preview: SpatialReplicaPreviewRef = 2`；`duration: SpatialReplicaRational = 3`；`pts_map: SpatialReplicaPtsMap = 4`；`layers: repeated SpatialReplicaEvidenceLayerManifest = 5`（≤10，P1 预算）；`limitations: repeated SpatialReplicaLimitation = 6` |
| `SpatialReplicaObjectSummary` | `object_ref: string = 1`（SafeRef，selectable identity）；`kind: SpatialReplicaObjectKind = 2`；`truth_layer: SpatialReplicaTruthLayer = 3`；`label: string = 4`（bounded display，不参与 identity）；`owner_version: string = 5`；`pts_range: SpatialReplicaPtsRange = 6`（optional）；`parent_ref: string = 7`（optional）；`budget_cost: int32 = 8`（primitive cost 单位）；`limitations: repeated SpatialReplicaLimitation = 9` |
| `SpatialReplicaMotionProjection` | `motion_ref: string = 1`；`sample_refs: repeated string = 2`（≤64，NumericArtifactRef per curve）；`keyframe_count: int32 = 3`；`interpolation_allowed: bool = 4`（对应 owner `render_interpolation_allowed`；仅 display sample 可插值） |
| `SpatialReplicaCandidateSummary` | `candidate_ref: string = 1`；`truth_layer: SpatialReplicaTruthLayer = 2`（CANDIDATE）；`selected: bool = 3`；`provenance_refs: repeated string = 4`（≤4）；`quality: SpatialReplicaQualitySummary = 5` |
| `SpatialReplicaFrozenStageSummary` | `frozen_ref: string = 1`；`stage_version: string = 2`；`receipt_ref: string = 3`；`frozen_at_unix_ms: int64 = 4` |
| `SpatialReplicaBrowserBudget` | `max_primitives: int32 = 1`；`max_texture_bytes: int64 = 2`；`max_joints: int32 = 3`；`max_artifacts: int32 = 4`；`declared_cost: int32 = 5`；超限 → `view_too_large`，不静默降采样 |
| `SpatialReplicaDerivativeRef` | `kind: SpatialReplicaDerivativeKind = 1`；`derivative_ref: string = 2`（SafeRef）；`version: string = 3`；`expires_at_unix_ms: int64 = 4`（optional） |
| `SpatialReplicaClaimScope` | `scope_ref: string = 1`；`pts_range: SpatialReplicaPtsRange = 2`；`object_refs: repeated string = 3`（≤8）；`quantity: string = 4`；`unit: string = 5`；`tolerance: string = 6`（bounded）；`evidence_refs: repeated string = 7`（≤8）；`excluded_region_refs: repeated string = 8`（≤8）；`receipt_ref: string = 9`（optional） |
| `SpatialReplicaStageProjection` | `stage_ref: string = 1`；`stage_version: string = 2`；`mode: SpatialReplicaStageMode = 3`；`evidence_binding_segment: SpatialReplicaOwnerSegment = 4`；`screenplay_binding_segment: SpatialReplicaOwnerSegment = 5`（optional）；`coordinate_frame: SpatialReplicaCoordinateFrame = 6`；`scale_tier: SpatialReplicaScaleTier = 7`；`claim_scopes: repeated SpatialReplicaClaimScope = 8`（≤8）；`objects: repeated SpatialReplicaObjectSummary = 9`（≤64，P1 预算 §0.5）；`motion: SpatialReplicaMotionProjection = 10`；`candidates: repeated SpatialReplicaCandidateSummary = 11`（≤4）；`frozen: SpatialReplicaFrozenStageSummary = 12`（optional）；`browser_budget: SpatialReplicaBrowserBudget = 13`；`derivatives: repeated SpatialReplicaDerivativeRef = 14`（≤4）；`quality: SpatialReplicaQualitySummary = 15`；`limitations: repeated SpatialReplicaLimitation = 16` |
| `SpatialReplicaScreenplayPanelProjection` | `screenplay_ref: string = 1`；`screenplay_version: string = 2`；`depth_granted: SpatialReplicaScreenplayDepth = 3`；`nodes: repeated SpatialReplicaScreenplayNode = 4`（≤500）；`deep_link: SpatialReplicaDeepLink = 5`（optional）；`limitations: repeated SpatialReplicaLimitation = 6` |
| `SpatialReplicaScreenplayNode` | `node_ref: string = 1`；`depth: SpatialReplicaScreenplayDepth = 2`；`parent_ref: string = 3`（optional）；`safe_text: string = 4`（owner 授权文本，≤2000 chars；`METADATA_ONLY` 时为空）；`order_key: string = 5` |
| `SpatialReplicaStoryboardPanelProjection` | `storyboard_ref: string = 1`；`stage: SpatialReplicaStageProjection = 2`（同 identity 引用，不复制第二份 canonical）；`mode: SpatialReplicaStageMode = 3`；`binding_version: string = 4`；`review_state: string = 5`（Scaena 枚举 echo）；`limitations: repeated SpatialReplicaLimitation = 6` |
| `SpatialReplicaDeepLink` | `url_template: string = 1`（owner approved，host 须在 allowlist）；`label_key: string = 2`；`scope: string = 3`（bounded）；渲染前 server 验证 scheme/host/path/scope；含 credential query 即拒绝 |
| `SpatialReplicaInquiryCapability` | `inquiry_contract: string = 1`；`presets: repeated string = 2`（≤12，preset key）；`max_question_length: int32 = 3`（冻结 512） |
| **`SpatialReplicaWorkspaceProjection`**（top-level） | `contract_version: string = 1`（固定 `workbench.spatial_replica_workspace_projection.v1alpha1`）；`workspace_ref: string = 2`；`project_ref: string = 3`；`episode_ref: string = 4`；`shot_ref: string = 5`；`composition_token: string = 6`（opaque digest，仅 stale detection）；`composed_at_unix_ms: int64 = 7`；`atomicity: string = 8` 固定 `non_atomic_owner_projection`；`status: SpatialReplicaProjectionStatus = 9`；`segments: repeated SpatialReplicaOwnerSegment = 10`（≤5：4 owner + 1 registry/policy）；`source: SpatialReplicaSourceProjection = 11`（optional）；`stage: SpatialReplicaStageProjection = 12`（optional）；`screenplay_panel: SpatialReplicaScreenplayPanelProjection = 13`（optional）；`storyboard_panel: SpatialReplicaStoryboardPanelProjection = 14`（optional）；`inquiry: SpatialReplicaInquiryCapability = 15`（optional）；`actions: repeated SpatialReplicaActionDescriptor = 16`（≤24）；`receipts: SpatialReplicaReceiptPage = 17`；`workspace_cursor: string = 18`（optional）；`limitations: repeated SpatialReplicaLimitation = 19` |

## 5. 五个 Pane type 与 closed parameter schema（registry additive 注册）

Pane type 字符串冻结（`agent-pane-registry.ts` additive key）：

```text
agent.spatial-replica.v1
agent.spatial-replica-inspector.v1
agent.auctra-screenplay.v1
agent.scaena-storyboard.v1
agent.owner-receipts.v1
```

| Pane type | closed params（必填=√） | required capability（见 04 truth table） | preferred width | 依赖 segment |
| --- | --- | --- | --- | --- |
| `agent.spatial-replica.v1` | `workspaceRef`√ `projectRef`√ `episodeRef`√ `shotRef`√ `selectedRef`- | projectionRead+mediaPreview（viewport3d 才挂 3D） | 560–720px | anatomia+scaena |
| `agent.spatial-replica-inspector.v1` | `workspaceRef`√ `shotRef`√ `selectedRef`- | projectionRead | 360–420px | 任意 current |
| `agent.auctra-screenplay.v1` | `workspaceRef`√ `episodeRef`√ `screenplayRef`- | auctraPane | 400–480px | auctra |
| `agent.scaena-storyboard.v1` | `workspaceRef`√ `shotRef`√ `stageRef`- | scaenaPane | 420–520px | scaena |
| `agent.owner-receipts.v1` | `workspaceRef`√ `shotRef`- | receiptStream | 400–480px | workbench |

规则：params 全部为 SafeRef；未知 param/version fail closed（registry 既有 `createAllowlistParamsValidator` 语义）；五个 Pane 复用既有 registry/layout/composer/session/stream，hard limit 4 不变。

## 6. Action / receipt / event 合同

### 6.1 `SpatialReplicaActionDescriptor`（wrapper；复用共享 `ActionDescriptorV1`）

| 字段 | 类型 = 号 | 说明 |
| --- | --- | --- |
| `binding_ref` | `string = 1` | wrapper 唯一 ref（SafeRef） |
| `action_descriptor` | `workbench.agent.v1alpha1.ActionDescriptorV1 = 2` | **既有共享合同，原样内嵌**（action_id/target_operation_type/availability/reason_code/recovery_hint/descriptor_revision/tenant_ref/workspace_ref 九字段不动） |
| `owner` | `SpatialReplicaOwner = 3` | canonical owner（anatomia/auctra/scaena） |
| `target_ref` | `string = 4` | owner 资源 SafeRef |
| `expected_owner_version` | `string = 5` | submit 时 echo，server 复验 |
| `required_capability` | `string = 6` | §0.4 capability id |
| `input_schema_ref` | `string = 7` | closed input schema ref |
| `confirmation` | `SpatialReplicaConfirmation = 8` | |
| `execution_path` | `SpatialReplicaExecutionPath = 9` | |
| `idempotency_scope` | `string = 10` | opaque digest（descriptor+target+base version 派生） |
| `expires_at_unix_ms` | `int64 = 11` | 过期即 stale fail closed |
| `receipt_contract` | `string = 12` | owner receipt contract name |
| `reconcile_operation` | `string = 13` | 固定 `ReconcileSpatialReplicaAction` |

不变量：wrapper 无独立 availability/permission；base descriptor 与 wrapper 任一缺失/不一致/过期 → action 禁用（fail closed）。浏览器只可提交 `binding_ref + action_id + descriptor_revision + expected_owner_version + validated input + idempotency_key`。

### 6.2 Execute / Reconcile / Receipt

| Message | 字段 |
| --- | --- |
| `ExecuteSpatialReplicaActionRequest` | `workspace_ref: string = 1`；`binding_ref: string = 2`；`action_id: string = 3`；`descriptor_revision: string = 4`；`target_ref: string = 5`；`expected_owner_version: string = 6`；`idempotency_key: string = 7`（client 生成，≤64 chars）；`input_json: string = 8`（closed schema 校验后的 bounded JSON ≤16 KiB，无 credential/raw prompt）；`principal_context` 由 transport 注入，不来自 body |
| `ExecuteSpatialReplicaActionResponse` | `status: SpatialReplicaSubmitStatus = 1`；`task_ref: string = 2`（optional）；`receipt_ref: string = 3`（optional）；`existing_task_ref: string = 4`（DUPLICATE 时指向原 Task）；`reason_code: string = 5`；`recovery_hint_key: string = 6` |
| `ReconcileSpatialReplicaActionRequest` | `workspace_ref: string = 1`；`task_ref: string = 2`；`idempotency_key: string = 3`（原 key，禁新 key） |
| `ReconcileSpatialReplicaActionResponse` | `resolved: bool = 1`；`terminal_status: string = 2`（映射 TaskStatus echo；未决时 `unknown`）；`owner_version: string = 3`（optional）；`receipt_ref: string = 4`（optional）；`reason_code: string = 5` |
| `SpatialReplicaReceipt` | `receipt_ref: string = 1`；`source: SpatialReplicaOwner = 2`；`task_ref: string = 3`（optional）；`owner_sequence: string = 4`（optional）；`workspace_cursor: string = 5`；`event_time_unix_ms: int64 = 6`（optional）；`observed_at_unix_ms: int64 = 7`；`status: string = 8`；`currentness: SpatialReplicaCurrentness = 9`；`resource_ref: string = 10`（optional）；`resource_version: string = 11`（optional）；`safe_summary_key: string = 12`（optional） |
| `SpatialReplicaReceiptPage` | `receipts: repeated SpatialReplicaReceipt = 1`（≤100）；`next_cursor: string = 2`（optional）；`gap_detected: bool = 3`（gap → 受影响 action 保持 unknown） |

### 6.3 `SpatialReplicaWorkspaceEvent` 与 watch envelope

| Message | 字段 |
| --- | --- |
| `SpatialReplicaWorkspaceEvent` | `workspace_cursor: string = 1`；`source: SpatialReplicaOwner = 2`；`owner_cursor: string = 3`（optional）；`owner_sequence: string = 4`（optional）；`event_ref: string = 5`；`kind: SpatialReplicaEventKind = 6`；`event_time_unix_ms: int64 = 7`（optional）；`observed_at_unix_ms: int64 = 8`；`resource_ref: string = 9`（optional）；`resource_version: string = 10`（optional）；`task_ref: string = 11`（optional）；`receipt_ref: string = 12`（optional）；`safe_summary_key: string = 13`（optional）；`reason_code: string = 14`（optional） |
| `WatchSpatialReplicaWorkspaceResponse` | `contract_version: string = 1`；`snapshot: SpatialReplicaWorkspaceProjection = 2`；`resync_required: bool = 3`（gap/retention → 复用既有语义，client 重取 snapshot）；`cursor: string = 4`（`srw:<sequence>` 形态，对齐 `spatial:<sequence>` 惯例）；`kind: SpatialReplicaEventKind = 5`；`event: SpatialReplicaWorkspaceEvent = 6`；`reason_code: string = 7` |

每 workspace 至多一个 browser stream；Pane 共享 query cache。

## 7. Inquiry

| Message | 字段 |
| --- | --- |
| `AskSpatialReplicaRequest` | `workspace_ref: string = 1`；`shot_ref: string = 2`；`question: string = 3`（≤512 chars，用户原文只用于本次 Anatomia inquiry，不落 Task/receipt/log/fixture）；`pts_range: SpatialReplicaPtsRange = 4`（optional）；`selected_refs: repeated string = 5`（≤8）；`expected_snapshot_ref: string = 6`（optional） |
| `AskSpatialReplicaResponse` | `result_ref: string = 1`；`status: SpatialReplicaInquiryStatus = 2`；`answer_key: string = 3`（i18n key 或 bounded 文本 ≤1000 chars）；`snapshot_ref: string = 4`；`bundle_refs: repeated string = 5`（≤4）；`pts_range: SpatialReplicaPtsRange = 6`（optional）；`coordinate_frame: SpatialReplicaCoordinateFrame = 7`（optional）；`unit: string = 8`（optional）；`confidence: string = 9`（bounded，optional）；`evidence_refs: repeated string = 10`（≤8）；`limitations: repeated SpatialReplicaLimitation = 11` |

## 8. Error model（closed；与 `docs/interfaces` §15 一致）

`identity_mismatch`、`contract_mismatch`、`needs_contract`、`stale_projection`、`permission_denied`（existence-hiding）、`revoked`、`sync_degraded`、`view_too_large`、`duplicate_action`、`unknown_accept`、`resync_required`、`unsupported_version`。

Transport 映射冻结：HTTP 400（contract_mismatch/identity_mismatch/unsupported_version）、403（permission_denied）、409（stale_projection/duplicate_action）、404（existence-hiding not_found 合并入 permission_denied 语义）、410（revoked）、413（超预算 → contract_mismatch payload）、422（view_too_large）、503（offline）；gRPC 用对应 `InvalidArgument/PermissionDenied/NotFound/FailedPrecondition/Aborted/ResourceExhausted/Unavailable`；JSON-RPC error code 沿用 SDK 既有映射层。错误 payload 只含 code+message_key+bounded redacted detail，绝不回显 owner response/credential/private path。

## 9. Region/action 子状态（非 enum，字符串 reason）

`duplicate_action`、`unknown_accept`、`limit_reached`、`navigation_away`、`sync_degraded`、`view_too_large`、`webgl_unavailable` 作为 UI/测试矩阵状态保留英文名（`docs/ui/spatial-replica-review-workspace.md` §12），不进 proto enum，避免与 readiness/currentness 双轨。

## 10. Service rpc 面（5 个，三 transport 同语义）

| rpc | 类型 |
| --- | --- |
| `GetSpatialReplicaWorkspace` | unary（HTTP `GET /v1alpha1/spatial-replica/workspaces/{workspace_ref}/shots/{shot_ref}`） |
| `WatchSpatialReplicaWorkspace` | server stream（SSE `.../events?cursor=`） |
| `AskSpatialReplica` | unary |
| `ExecuteSpatialReplicaAction` | unary |
| `ReconcileSpatialReplicaAction` | unary |

media/preview 不走以上 rpc：BFF same-origin `GET /bff/spatial-replica/media/{opaque_media_ref}` + `Range`（task 2.7）。

## 11. Owner contract 占位（wave 2 以 deterministic local fixture 填充，不得以 mock 冒充 ready）

| owner | fixture contract name（冻结占位） | readiness |
| --- | --- | --- |
| Anatomia | `anatomia.spatial_evidence_projection.v1`（fixture provenance 显式 `fixture`） | `needs_contract` 直到 owner 发布 |
| Scaena | `scaena.replica_stage_projection.v1`（fixture） | 同上 |
| Auctra | `auctra.screenplay_projection.v1`（fixture） | 同上 |

## 12. 兼容与 rollback 分类记录

- **additive**：新 package/新 service/新 5 Pane key/新 SDK facade `WorkbenchClient.spatialReplica`；不触碰既有 Agent/Task/Spatial/owner 字段语义；共享挂载文件只 append。
- **experimental v1alpha1**：enum/field 号仍按 stable-surface 纪律管理——发布后 rename/retype/repurpose/删号一律禁止，演进拆独立 change。
- **default-off**：十个 capability 全部 `not_enabled_by_default`（见 `04-capability-truth-table.md`）。
- **rollback**：capability off → 停 stream、卸 renderer、清 session draft/cache；无 persistence migration、无破坏性 DDL；conversation/Task/proposal/receipt 保留。
- 前向兼容：未知 enum 值/未知 optional 字段 → 忽略或显示 unsupported，绝不映射为 enabled/ready。

## 13. 冻结校验

- `openspec validate workbench-spatial-replica-review-v1 --strict`：PASS（2026-09-01）。
- 无既有 contract/Pane/route 改义或删除：本波未改 `api/**`、`apps/**`、`service/**`、`packages/**` 任何文件（`git status` 复核见 `01-baseline-ownership.md`）。
