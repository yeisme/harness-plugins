## ADDED Requirements

### Requirement: Spatial Canvas SHALL remain an Agent-first contextual workspace

Workbench SHALL mount the full Spatial Canvas only inside `/agent` and SHALL preserve the Agent timeline/composer as an uncloseable anchor. Plain Agent ingress SHALL default to conversation mode; trusted project, DSH or spatial ingress SHALL default to Spatial Focus. Route state, query parameters or local preferences MUST NOT grant spatial capability.

#### Scenario: User opens a plain Agent session

- **WHEN** a user opens `/agent` without a trusted project or spatial ingress
- **THEN** Workbench SHALL show the conversation-first layout
- **AND** SHALL allow the user to enter Spatial Focus without creating a second session or composer

#### Scenario: User opens a trusted project object

- **WHEN** server-authorized ingress resolves a project object and an available spatial capability
- **THEN** Workbench SHALL open Spatial Focus with the object selected
- **AND** SHALL keep the Agent composer visible

### Requirement: All Lens kinds SHALL share one core capability contract

Creative Production, Workflow, Run, Review and Evidence Lens SHALL all provide navigation, search, selection, Draft, layout, proposal, runtime/review/evidence handoff, truthful availability and accessible object navigation. Each Lens SHALL use its domain-appropriate projection grammar and MUST NOT create a separate Task, proposal, session or Owner state machine.

#### Scenario: User switches from Creative to Evidence

- **WHEN** the selected Owner object has an Evidence projection
- **THEN** Workbench SHALL retain the selected identity and locate its Evidence projection
- **AND** SHALL display provenance using Evidence-specific regions and relations

#### Scenario: Selected object is absent from the target Lens

- **WHEN** the user switches Lens and the selected object has no authorized target projection
- **THEN** Workbench SHALL show `not_projected_in_lens`
- **AND** SHALL offer related authorized objects without inventing coordinates or data

### Requirement: Spatial Focus SHALL use an adaptive context rail

At viewports of at least 1440px, Workbench SHALL allow Timeline/Agent and Inspector to appear side by side. At 1024–1439px, it SHALL provide one 320–384px tabbed context rail while preserving at least 640px for the canvas. The composer SHALL remain visible in both layouts. Lens implementations MUST NOT add a second fixed-width business rail inside the canvas.

#### Scenario: Creative Lens opens at 1024px

- **WHEN** Spatial Focus opens at a 1024×768 viewport
- **THEN** the canvas SHALL retain at least 640px usable width
- **AND** Creative details SHALL appear in the shared context rail rather than a fixed 430px inner panel

#### Scenario: Viewport is below the desktop editor threshold

- **WHEN** the viewport is narrower than 1024px
- **THEN** Workbench SHALL not mount the full spatial editor
- **AND** SHALL expose a searchable accessible object list, current selection summary and approved Owner deep links

### Requirement: Spatial Canvas SHALL expose a bounded navigation HUD

The persistent HUD SHALL include Lens switching, breadcrumb/status, Draft mode, zoom percentage, zoom in/out, fit Lens, fit selection, recenter, interactive minimap, global spatial search and command palette. Object-specific actions SHALL appear only in a contextual toolbar or command palette. Disabled actions SHALL remain visible with a server-authored reason.

#### Scenario: User loses the content origin

- **WHEN** the viewport no longer intersects known content
- **THEN** the HUD SHALL expose recenter and fit-Lens actions
- **AND** the minimap SHALL show the current viewport relative to regions and clusters

#### Scenario: User selects canonical and Draft objects

- **WHEN** the current selection contains canonical objects and Draft objects
- **THEN** the contextual toolbar SHALL separate presentation/layout actions from Draft editing and promotion actions
- **AND** SHALL not offer a direct canonical mutation from a drag or style control

### Requirement: Spatial navigation SHALL have keyboard and non-drag equivalents

Workbench SHALL support `Space` for temporary pan, `V/Escape` for selection, `H` for hand mode, `+/-` for zoom, `Shift+1` for fit Lens, `Shift+2` for fit selection, `Ctrl/Cmd+F` for spatial search and `Ctrl/Cmd+K` for the command palette. Every drag operation SHALL have a keyboard or menu equivalent, and focus SHALL return to the real trigger when overlays close.

#### Scenario: Keyboard user focuses a search result

- **WHEN** a keyboard user selects a spatial search result
- **THEN** Workbench SHALL switch to the relevant Lens if required, locate the object and move focus to its accessible representation
- **AND** SHALL announce Lens, object state and selection count

#### Scenario: Reduced motion is enabled

- **WHEN** the user requests reduced motion
- **THEN** Lens switching, recentering and fit actions SHALL avoid non-essential camera animation
- **AND** SHALL preserve the same final viewport and focus result

### Requirement: Global spatial search SHALL span authorized Lens projections and Drafts

Spatial search SHALL query authorized canonical projections and project Draft objects, group results by Lens/source and expose freshness/availability. Search SHALL use safe summaries only, SHALL bound returned results and MUST NOT index Owner private payloads.

#### Scenario: Object exists in multiple Lens kinds

- **WHEN** a search result has Creative, Review and Evidence projections
- **THEN** Workbench SHALL group those projections under one stable object identity
- **AND** SHALL let the user choose the target Lens without duplicating the object

#### Scenario: Search source is stale

- **WHEN** a matching Owner projection is stale or offline
- **THEN** the result SHALL display the last-confirmed safe summary and freshness state
- **AND** SHALL disable actions that require a fresh revision

### Requirement: Relations SHALL be revealed according to semantic context

Atlas SHALL not render individual relations. Cluster SHALL render only key cross-region or selected/search-highlighted relations. Object and Detail SHALL keep unrelated relations visually subdued and SHALL emphasize only focus paths, selected relation types or explicit filters. Relation visibility MUST NOT alter canonical dependency state.

#### Scenario: User selects a blocked workflow step

- **WHEN** a workflow step is selected
- **THEN** the Workflow Lens SHALL emphasize its upstream blockers and downstream affected path
- **AND** SHALL leave unrelated edges subdued

#### Scenario: User clears the selection

- **WHEN** the user clears selection and relation filters
- **THEN** temporary relation emphasis SHALL disappear
- **AND** canonical relationships SHALL remain unchanged

### Requirement: Spatial Canvas SHALL remain truthful and accessible when rendering degrades

Each semantic level SHALL expose an accessible region/cluster/object summary independent of rich DOM overlays. WebGL, worker or context loss SHALL produce a visible degraded state and a bounded accessible renderer/list. Atlas/Cluster MUST NOT be considered correct solely because rich DOM count is zero.

#### Scenario: Atlas response contains density but no nodes

- **WHEN** the server returns density tiles and region summaries without individual nodes
- **THEN** the renderer SHALL display visible density/region marks
- **AND** the accessible navigator SHALL announce non-zero regions or clusters

#### Scenario: WebGL context is lost

- **WHEN** the browser loses the WebGL context
- **THEN** Workbench SHALL show a truthful degraded reason and preserve accessible search/selection/inspection
- **AND** SHALL rebuild from the last canonical snapshot after context restoration

