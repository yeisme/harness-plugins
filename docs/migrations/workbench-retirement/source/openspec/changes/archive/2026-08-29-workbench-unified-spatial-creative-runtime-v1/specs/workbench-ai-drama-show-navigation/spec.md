## ADDED Requirements

### Requirement: Creative production MUST open as a Spatial Lens
Show、Episode、Series Bible、Asset、Review、Run/Evidence、Delivery and Next Episode navigation MUST resolve to the `/agent` Creative Production Lens with validated safe refs and current owner projection. Workbench MUST not mount an independent Show application shell.

#### Scenario: DSH opens an existing Episode
- **WHEN** a valid DSH handoff is revalidated by the server
- **THEN** `/agent` MUST open the Creative Production Lens focused on the authorized show/episode refs
- **AND** the Lens MUST reread owner projection rather than trusting the handoff revision

## REMOVED Requirements

### Requirement: Workbench 必须提供 Show-first 控制室
**Reason**: 独立 Show Control Room 与 `/agent` 单一主壳、统一 Spatial Surface 和 proposal interaction 重复，用户明确要求立即清理该历史产品壳。

**Migration**: 所有 Agent、Project 与 DSH 入口改用 `/agent` typed `SpatialEntryIntentV1` 和 `creative_production` Lens；稳定 Show SDK/service contracts 继续作为 projection/action source。旧 `/show-control-room` URL 不提供 redirect。
