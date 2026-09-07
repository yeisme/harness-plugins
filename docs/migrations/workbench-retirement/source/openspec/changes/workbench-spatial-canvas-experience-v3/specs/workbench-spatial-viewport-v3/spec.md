## ADDED Requirements

### Requirement: Spatial Viewport V3 SHALL evolve additively beside V2

Workbench SHALL add `SpatialViewportQueryV3`, `SpatialViewportResponseV3`, `SpatialSemanticLevelV1` and `SpatialRegionV1` through new contract identities and transport methods. Existing V2 query/response shapes, `far | medium | near` values, method identities and strict normalizers SHALL remain unchanged. A V2 request MUST receive a V2 response.

#### Scenario: Existing V2 client queries a surface after V3 deployment

- **WHEN** an existing client calls the V2 method with a valid V2 query
- **THEN** the service SHALL return the existing V2 shape and semantics
- **AND** SHALL not include V3-only keys that strict V2 clients reject

#### Scenario: V3 capability is disabled

- **WHEN** `spatialViewportV3` is disabled for the principal or environment
- **THEN** the V3 method SHALL return truthful capability unavailability
- **AND** the existing V2 path SHALL remain usable when its capability is available

### Requirement: V3 SHALL define four semantic levels

V3 SHALL support `atlas`, `cluster`, `object` and `detail`. The default client resolver SHALL use `<0.30`, `0.30–<0.70`, `0.70–<1.30` and `>=1.30` zoom ranges with 5% hysteresis. Semantic level changes SHALL change information density rather than geometrically scaling identical rich cards.

#### Scenario: User zooms from Atlas into Detail

- **WHEN** the camera crosses semantic thresholds
- **THEN** the renderer SHALL progress from density/regions to clusters, lightweight objects and bounded rich detail
- **AND** SHALL preserve stable selection and world coordinates

#### Scenario: Camera oscillates around a threshold

- **WHEN** small wheel or trackpad movement stays inside the hysteresis band
- **THEN** Workbench SHALL keep the previous semantic level
- **AND** SHALL avoid repeated query and renderer teardown

### Requirement: Atlas and Cluster SHALL return visible aggregate projections

Atlas responses SHALL contain bounded density and region marks; Cluster responses SHALL contain bounded clusters, region titles and key statuses. Aggregate projections SHALL include count, bounds, dominant safe type/status and provenance sufficient for rendering and accessibility. They MUST NOT require individual node payloads.

#### Scenario: Ready density projection is available

- **WHEN** exact-revision tile density is ready for an Atlas query
- **THEN** V3 SHALL return non-empty density/region projections for non-empty bounds
- **AND** SHALL not return a visually empty success response

#### Scenario: Density projection is unavailable

- **WHEN** tile density is not ready or fails validation
- **THEN** the service SHALL fall back to an exact-revision bounded Board query or return degraded/resync state
- **AND** SHALL not label stale density as fresh

### Requirement: V3 SHALL preserve exact-revision and resync semantics

Every V3 viewport, layout and search projection SHALL identify the authoritative surface/board revision and projection provenance. A revision change between projection read and response SHALL produce `resync_required`; streams SHALL emit a resync control event rather than casting stale data as a new snapshot.

#### Scenario: Board revision changes during density read

- **WHEN** the Board revision changes before the V3 response linearization point
- **THEN** the service SHALL return `resync_required`
- **AND** SHALL not return the old density as current

#### Scenario: Client receives a resync event

- **WHEN** a watch consumer receives a V3 resync control event
- **THEN** it SHALL reload the current board/layout revisions and issue a new viewport query
- **AND** SHALL not replay layout, Draft or Owner mutation

### Requirement: Lens layout SHALL be independent from Owner and Board state

Workbench SHALL persist `SpatialLensLayoutV1` by surface and Lens with `layoutRevision`, placements, region membership, z-order and default arrangement. Layout patches SHALL use closed operations, expected revision and idempotency. Moving or grouping a canonical object SHALL change only the Lens projection and MUST NOT change Owner content, business relation or Board canonical revision.

#### Scenario: User drags a Scene in Creative Lens

- **WHEN** the user commits a drag for an authorized Scene projection
- **THEN** Workbench SHALL patch Creative Lens placement with expected layout revision
- **AND** the same Scene's Owner revision and Workflow Lens placement SHALL remain unchanged

#### Scenario: Concurrent layout writer wins first

- **WHEN** two clients patch the same placement from the same layout revision
- **THEN** one patch SHALL succeed and the other SHALL receive a typed revision conflict with current safe layout
- **AND** the losing client SHALL not silently overwrite the winner

### Requirement: User view preferences SHALL not become shared canonical layout

Camera, active Lens, filter, temporary collapse/visibility, context rail tab and minimap state SHALL be saved as user/project-scoped `SpatialViewPreferenceV1`. Preference failure SHALL not change canonical layout or disable viewing, and browser state MUST NOT grant capability.

#### Scenario: User returns to a project

- **WHEN** the same principal reopens a project with an available preference record
- **THEN** Workbench SHALL restore the last valid Lens and camera after validating current bounds and capability
- **AND** SHALL fall back to contextual defaults when the preference is stale or invalid

#### Scenario: Preference save fails

- **WHEN** the debounced preference write fails
- **THEN** the UI SHALL mark the preference as unsaved and offer retry
- **AND** SHALL not change shared layout or Owner state

### Requirement: V3 SHALL enforce bounded projection and rendering budgets

The reference capacity SHALL be 50,000 addressable objects, 75,000 relations and 1,000 regions without full-client loading. Atlas SHALL render at most 512 aggregate marks, Cluster at most 1,024 clusters and 128 labels, Object/Detail SHALL default to 4,096 primitives with an 8,192 hard cap, and rich DOM SHALL remain at or below 200.

#### Scenario: 50k reference fixture opens at Atlas

- **WHEN** the approved 50k fixture opens at 1440×960
- **THEN** the response and renderer SHALL remain within Atlas budgets
- **AND** SHALL expose visible non-empty aggregate information

#### Scenario: Detail query exceeds the requested budget

- **WHEN** more primitives are available than the V3 `maxPrimitives` budget
- **THEN** the service SHALL return a bounded page/cursor or aggregate representation
- **AND** the renderer SHALL never mount unbounded rich DOM

### Requirement: Camera bounds SHALL follow the real renderer host

The Web client SHALL observe the renderer host dimensions and SHALL update camera width/height when Spatial mode, context rail, Pane layout or browser viewport changes. Viewport bounds MUST NOT remain pinned to the initial 1280×760 defaults after the host has a measured size.

#### Scenario: Context rail changes width

- **WHEN** the context rail opens, closes or changes between split and tabbed layout
- **THEN** the client SHALL recompute viewport bounds from the measured canvas host
- **AND** SHALL issue the next bounded query with those dimensions

#### Scenario: Observer is unavailable

- **WHEN** `ResizeObserver` is unavailable
- **THEN** Workbench SHALL use a bounded window/host measurement fallback
- **AND** SHALL expose degraded capability rather than using invalid dimensions

### Requirement: V3 performance evidence SHALL preserve the existing browser gate

On the approved 1440×960 Chromium host and 50k fixture, cold first frame SHALL be at most 2,500ms, warm first frame at most 1,200ms, highlight latency at most 50ms, frame P95 at most 20ms, long-task count at most one, optional JS heap below 512MiB and rich DOM at most 200. Context loss/restoration SHALL be included in the evidence.

#### Scenario: Performance gate is executed

- **WHEN** `WORKBENCH_SPATIAL_PERF=1` runs the V3 performance journey
- **THEN** the evidence bundle SHALL record fixture size, semantic level, viewport, frame, latency, heap, long-task, DOM and context recovery metrics
- **AND** any exceeded threshold SHALL fail the command with the original exit code

