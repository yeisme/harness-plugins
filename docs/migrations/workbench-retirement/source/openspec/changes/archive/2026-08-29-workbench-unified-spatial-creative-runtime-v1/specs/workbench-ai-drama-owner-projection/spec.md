## ADDED Requirements

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
