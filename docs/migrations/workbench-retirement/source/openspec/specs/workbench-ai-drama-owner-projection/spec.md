# workbench-ai-drama-owner-projection Specification

## Purpose
TBD - created by archiving change workbench-ai-drama-show-control-room-v1. Update Purpose after archive.
## Requirements
### Requirement: Show workspace 必须使用严格安全投影

Owner segment SHALL 只包含 opaque refs、versions、bounded display summaries、freshness、readiness、allowed actions、evidence refs、receipt refs 和批准的 deep links。raw prompt、provider payload、credential、private path、signed URL 和 artifact bytes MUST NOT 进入浏览器投影。

#### Scenario: Owner 返回不安全字段

- **WHEN** owner segment 包含不安全字段、未知字段或超过大小限制
- **THEN** Workbench SHALL 拒绝整个 segment
- **AND** SHALL 显示 redacted contract_mismatch

### Requirement: Scaena 只能作为既有合同 consumer

Show Control Room SHALL NOT 要求新的 Scaena capability。已有 Scaena projection 可以显示；缺失、stale 或不可验证时 SHALL 显示 needs_contract 或 reconcile_required。

#### Scenario: Scaena projection 缺失

- **WHEN** 其他 owner 已能支持剧本、视觉候选和 review，但 Scaena projection 不可用
- **THEN** Workbench SHALL 允许非 production 纵切继续
- **AND** SHALL 禁用依赖 Scaena 的 assembly/delivery mutation

### Requirement: Show owner projections MUST compose into Spatial snapshots
Workbench MAY compose validated Show/Episode/Scene/Shot/Asset/Review/Delivery owner segments into `SpatialSurfaceSnapshotV1` with safe ref、owner、version、freshness、readiness、allowed action、receipt and provenance. Composition MUST NOT persist or reinterpret Owner canonical content.

#### Scenario: One Owner is unavailable
- **WHEN** Eikona projection is offline while Auctra show/episode projection is current
- **THEN** the creative Lens MUST preserve the authorized Auctra segment and mark the Eikona segment offline
- **AND** MUST NOT infer asset candidates, rights or generation success from Board metadata

### Requirement: Owner hierarchy MUST remain immutable projection
Show→Episode→Scene→Shot hierarchy and Owner-authored candidate/asset lineage MUST render as immutable projected relations. User organization edges MAY reference those safe objects but MUST NOT overwrite Owner hierarchy.

#### Scenario: User rearranges a Shot card
- **WHEN** the user moves or groups a projected Shot in the Board
- **THEN** only Workbench geometry/group metadata MAY change
- **AND** the Owner episode/scene/shot relationship MUST remain unchanged

