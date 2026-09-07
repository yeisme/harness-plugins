## ADDED Requirements

### Requirement: Spatial Surface MUST remain inside the Agent-first shell
Workbench MUST expose Conversation、Split 与 Spatial Focus desktop modes inside `/agent`. Agent timeline、composer、session state、gate alerts and proposal attention MUST remain mounted and MUST NOT be replaced by a parallel Canvas or Show application shell.

#### Scenario: User enters Spatial Focus
- **WHEN** a desktop user activates Spatial Focus
- **THEN** Spatial Surface occupies the primary workspace while the compact composer and current session state remain available
- **AND** the existing Pane layout reducer, visible limit and split-depth rules remain authoritative

### Requirement: Spatial Surface MUST provide versioned Lens composition
The surface MUST support only registered `creative_production`、`workflow`、`run`、`review` and `evidence` Lens descriptors in v1. Each Lens MUST declare allowed projection kinds, overlays, commands, capability requirements and recovery state through a closed server-authored descriptor.

#### Scenario: Unknown Lens is requested
- **WHEN** a route, Agent intent or restored layout requests an unknown Lens or registry version
- **THEN** the request MUST fail closed with `needs_contract`
- **AND** the browser MUST NOT load a dynamic component or fallback Lens

### Requirement: Spatial snapshots MUST preserve provenance and Owner authority
`SpatialSurfaceSnapshotV1` MUST include surface and Board revision, Lens descriptor, bounded tiles, projection provenance, freshness, capability and runtime overlays. It MUST contain only safe refs and bounded summaries and MUST NOT include Owner payloads, credentials, private paths, raw prompts, provider payloads, arbitrary URLs or artifact bytes.

#### Scenario: Owner segment violates the closed contract
- **WHEN** an Owner segment contains an unknown field, unsafe ref or forbidden content
- **THEN** the affected segment MUST become redacted `contract_mismatch`
- **AND** the remaining snapshot MUST NOT infer or recreate the rejected Owner facts

### Requirement: Viewport v2 MUST bound 50k logical surfaces
`SpatialViewportQueryV2` MUST query by surface ref, expected revision, bounds, zoom bucket, LOD, filter, tile cursor and maximum primitive budget. The service MUST return bounded tiles/clusters/projections with next cursor and MUST NOT return unbounded canonical detail.

#### Scenario: 50k Board is viewed at far LOD
- **WHEN** a Board containing 50k nodes, 75k relations and 1k groups is opened at far LOD
- **THEN** the service MUST return bounded clusters or lightweight primitives within the approved tile budget
- **AND** the browser MUST NOT mount all addressable objects as rich DOM nodes

### Requirement: Renderer MUST use bounded WebGL and DOM layers
Far and medium LOD MUST use the registered WebGL renderer; near selected objects, forms, Review and Workflow editing MAY use React DOM or React Flow overlays but rich DOM mounts MUST remain at or below 200. Renderer loss or unsupported worker capability MUST produce an explicit degraded state and bounded fallback.

#### Scenario: WebGL context is lost
- **WHEN** the renderer reports context loss while no mutation is pending
- **THEN** browser render caches MUST be discarded and rebuilt from the latest canonical snapshot
- **AND** no Board, Workflow or Owner mutation MAY be inferred from the lost frame

### Requirement: Spatial Surface MUST be desktop-only
Spatial Surface v1 MUST provide full editing only on the approved desktop capability envelope. The project MUST NOT add phone/tablet responsive editing, touch-specific product flows, mobile screenshots or mobile E2E for this capability.

#### Scenario: Narrow viewport opens a spatial entry
- **WHEN** the viewport does not satisfy the desktop capability envelope
- **THEN** Workbench MUST show a desktop-required unavailable state
- **AND** MUST NOT mount a hidden or reduced mobile Spatial editor

### Requirement: Spatial interactions MUST have accessible equivalents
Every pan-independent action, selection, move, connect, group, review and runtime command MUST have a keyboard/menu equivalent. The surface MUST expose a bounded accessible object list and screen-reader summary that mirror the current authorized viewport without creating a second data owner.

#### Scenario: Keyboard user selects a projected Shot
- **WHEN** the user navigates the accessible viewport list and activates a Shot projection
- **THEN** the same safe ref MUST become selected in the visual surface and inspector
- **AND** focus MUST remain predictable without relying on color or pointer-only hit testing

### Requirement: Spatial performance MUST have deterministic promotion gates
The approved reference environment MUST measure PostgreSQL viewport p95, first-frame latency, frame timing, highlight latency, DOM mounts, primitive count, long tasks and context recovery against the budgets declared in design.md. Results MUST be recorded as capacity evidence and MUST NOT be presented as production SLO without staging evidence.

#### Scenario: Browser capacity gate exceeds a budget
- **WHEN** the 50k Chromium run exceeds a required frame, mount, first-frame or long-task budget
- **THEN** Spatial Surface MUST remain below promoted readiness
- **AND** a smaller fixture or warm-cache-only result MUST NOT close the gate
