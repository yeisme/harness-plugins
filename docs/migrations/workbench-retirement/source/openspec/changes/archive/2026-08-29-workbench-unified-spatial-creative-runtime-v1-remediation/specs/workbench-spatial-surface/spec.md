## ADDED Requirements

### Requirement: Production spatial composition SHALL bind safe runtime sources
The runtime MUST bind the authorized Board watch source plus approved owner and runtime overlay ports before advertising an available spatial capability. Snapshots and watch events MUST contain only closed safe refs, provenance, descriptors, receipts and evidence; expired or cross-tenant content MUST fail closed.

#### Scenario: Watch reports a gap
- **WHEN** the Board source reports a cursor gap
- **THEN** every transport emits the closed spatial resync event and the SDK re-enters through canonical query
- **AND** it MUST NOT parse resync as a snapshot or invent intermediate state

### Requirement: Desktop capability SHALL gate spatial mounting
Before spatial query, worker or renderer creation, the desktop envelope MUST be satisfied. A narrow viewport MUST show only a desktop-required unavailable state and MUST make zero spatial query or worker/render requests.

#### Scenario: Narrow viewport opens spatial ingress
- **WHEN** a viewport is outside the approved desktop envelope
- **THEN** the Agent shell renders desktop-required unavailable state
- **AND** no Spatial Surface data request, worker or WebGL renderer is mounted

### Requirement: Tile and density projections SHALL be production-derived
GORM-managed tile/density projections MUST be invalidated from the same Board commit transaction by a revision-bound rebuild job. A dedicated projection worker, independent from Board outbox delivery, MUST publish an exact-revision complete far grid atomically with its ready head. Far/no-complex-filter viewport reads MUST attempt that ready index before canonical node/edge/group reads; medium and near reads remain canonical. A ready head MUST prove its full persisted tile count, digest and requested-grid coverage. The 128-tile viewport read cap MUST NOT cap a complete Board projection. Missing, pending, stale, incomplete, over-budget or unsupported projections MUST use a bounded canonical fallback marked degraded, and MUST NOT return tiles from an older revision. A 50k fixture MUST exercise the indexed query path and bounded fallback behavior.

`SpatialSurfaceSnapshotV1.ownerSegments` is an additive closed safe projection; gRPC, HTTP and JSON-RPC MUST preserve the same owner ref/readiness/health/redaction/summary fields and omit it when unbound. Watch envelopes use `workbench.spatial_watch_event.v1` with closed `snapshot|event|resync` kind, cursor, lens kind, optional event ref and exact current revision. A resyncing client MUST obtain an expected revision from the authorized additive `GetSpatialSurfaceRevision` facade (or its HTTP/JSON-RPC equivalent), never from a guessed cursor.

#### Scenario: Board geometry changes
- **WHEN** an atomic Board change-set commits
- **THEN** affected tiles are invalidated or rebuilt for the new Board revision
- **AND** a later viewport query MUST NOT return tiles from an older revision

#### Scenario: Far projection has an incomplete requested grid
- **WHEN** the current-revision head exists but a persisted overlapping grid tile is absent or its total count/digest no longer matches the head
- **THEN** the far viewport MUST reject the density index and use bounded canonical fallback with `degraded` provenance
- **AND** it MUST NOT undercount the viewport by treating the partial grid as ready

#### Scenario: Two workers observe an expired projection lease
- **WHEN** two projection workers race to reclaim the same expired job
- **THEN** only the worker that conditionally replaces the observed old lease may publish
- **AND** a late worker with the old lease MUST be rejected without replacing the current head

#### Scenario: Projection completes while Board revision advances
- **WHEN** a far density read succeeds but the final authorized Board read observes a different tenant, workspace, active state or revision
- **THEN** the surface MUST return `board_resync_required`
- **AND** it MUST NOT return the already-read density as fresh

#### Scenario: Projection publisher races a Board commit
- **WHEN** an exact-revision publisher and a Board commit race
- **THEN** the publisher MUST lock the exact active Board row before it deletes or writes projection rows
- **AND** if the publisher wins first, the following commit MUST serialize and rebind or invalidate that newly published head for its new revision
- **AND** if the commit wins first, the old publisher MUST return stale before changing tiles or the head

#### Scenario: Display-only Board revision preserves exact density semantics
- **WHEN** a density-neutral Board mutation advances revision and the prior ready head has complete matching tiles
- **THEN** the commit transaction MUST atomically rebind all tiles and the head to the new revision with a new revision-bound digest
- **AND** the next far Surface query MUST return fresh tile provenance without waiting for a worker
- **BUT WHEN** the prior head or tile set is incomplete
- **THEN** the transaction MUST invalidate it and schedule an exact-revision rebuild

#### Scenario: Valid Board exceeds derived projection bounds
- **WHEN** a Board is valid but exceeds the declared grid or entity capacity for the derived far projection
- **THEN** the worker MUST persist a parked reason for that required revision and stop retrying it
- **AND** a transient failure MUST instead use bounded retry backoff; a later density-affecting revision may reset work to pending
