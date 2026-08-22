## MODIFIED Requirements

### Requirement: Pane Workbench SHALL use a bounded canonical layout

Pane Workbench SHALL represent Right/Bottom regions、split tree、pane group、Tab、active group and region visibility in versioned `PaneWorkspaceV1`, owned by one external controller shared across both slot roots. Split tree depth MUST NOT exceed 2，visible pane hard limit MUST be 4，and every Pane SHALL satisfy 280×180px minimum size. Projection into rail、dock、sheet or maximize MUST NOT mutate the canonical tree.

#### Scenario: User attempts a fifth visible pane
- **WHEN** canonical layout already contains four visible groups and a Tab is dropped on an edge zone
- **THEN** the edge target SHALL be disabled while center merge remains available
- **AND** no fifth group or deeper split SHALL be created

#### Scenario: Both slot roots render
- **WHEN** Right and Bottom hosts subscribe to the controller
- **THEN** each host SHALL render only groups belonging to its region from the same snapshot
- **AND** no group、Tab or view instance SHALL be cloned between hosts

### Requirement: Persistence SHALL store only safe V2 presentation state

Pane Workbench SHALL persist `pane.workspace.persisted.v2` with region visibility/size、split ratio、group role/lock、view kind、safe resource ref、preview/pinned、active ids and provider-approved metadata. It MUST NOT store temporary maximize、overlay visibility、body、terminal output、credential、raw prompt、provider payload、private arguments or absolute path. V1 snapshots SHALL migrate safe regions、groups、Tabs and split state into V2 and discard transient fields.

#### Scenario: V1 snapshot contains maximized group
- **WHEN** a V1 snapshot with valid groups and `maximizedGroupId` is loaded
- **THEN** valid layout and Tab state SHALL restore through the V2 normalizer
- **AND** no group SHALL start maximized

#### Scenario: Current client lacks a stored view kind
- **WHEN** a V2 layout references an unregistered provider
- **THEN** that Tab SHALL restore as orphaned or safely discard unparseable metadata
- **AND** other regions、groups、Tabs and ratios SHALL continue restoring

## ADDED Requirements

### Requirement: Cross-region drag SHALL be coordinated across slot roots

Right and Bottom region chrome SHALL use one drag coordinator per controller generation. Tab reorder、cross-group move、cross-region move and edge split SHALL submit one existing reducer intent on valid drop. Pointer cancel、Escape、window blur、source unmount and HMR SHALL cancel without deleting source state.

#### Scenario: Right Tab moves to Bottom
- **WHEN** a Right Tab is dragged to a valid Bottom group center
- **THEN** the coordinator SHALL submit one `move_view` intent to the shared controller
- **AND** both hosts SHALL observe the atomically updated snapshot

#### Scenario: Drop target becomes invalid
- **WHEN** a provider unload or size constraint invalidates the target before pointerup
- **THEN** the coordinator SHALL clear preview and announce cancellation
- **AND** the source Tab SHALL remain in its original group

### Requirement: Navigation SHALL be contextual rather than a fixed module bar

Region chrome SHALL display only opened Tabs/views and a compact `+` view selector. It MUST NOT permanently render seven fixed module tabs. `openView()` SHALL reveal the resolved target region; files、documents and media default Right while terminal defaults Bottom, unless the request explicitly selects another valid target.

#### Scenario: Fresh installation
- **WHEN** the Pane bundle starts without saved layout
- **THEN** both regions SHALL be canonically closed and Right SHALL appear only as the 44px activity rail
- **AND** no fixed module tabs SHALL be synthesized

#### Scenario: External terminal open
- **WHEN** a provider calls compatible `openView()` for a terminal with preferred Bottom
- **THEN** Bottom SHALL expand automatically and activate that Tab
- **AND** the caller SHALL NOT need to read workspace layout internals

