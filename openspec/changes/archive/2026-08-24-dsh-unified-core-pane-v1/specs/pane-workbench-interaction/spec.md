## ADDED Requirements

### Requirement: Core and ecosystem views SHALL share one canonical interaction model

Built-in Core views and ecosystem views SHALL use the same `PaneWorkspaceV1` view instances、open routing、Tab/group chrome、split/move/maximize actions、focus model、error boundary and teardown. A Core view MAY be non-discoverable in the generic picker while remaining fully movable and closable after owner-triggered open.

#### Scenario: Core Tool Details and File Preview are both open

- **WHEN** `dsh.tool-details` and a File Preview view share the Right workspace
- **THEN** both SHALL participate in the same Tab and group model
- **AND** opening、moving or closing one SHALL NOT create a second controller or layout owner

#### Scenario: Non-discoverable provider is registered

- **WHEN** a local provider registers with `showInPicker=false`
- **THEN** generic picker enumeration SHALL omit it
- **AND** an explicit `openView()` request SHALL still open and activate it normally

### Requirement: Local view factories MAY receive owner-authored host content

`PaneLocalViewProps` SHALL add optional `hostContent` supplied only by the workspace slot owner callback. Existing component factories that ignore the field SHALL remain compatible. Remote projection MUST NOT set or serialize `hostContent`.

#### Scenario: Existing ecosystem view renders

- **WHEN** a provider component implements the previous `PaneLocalViewProps` subset
- **THEN** it SHALL continue to render without changes
- **AND** the new optional field SHALL NOT become required

#### Scenario: Core view receives host content

- **WHEN** a registered Core view is active and AppFrame supplies local content
- **THEN** its component factory SHALL receive that React content as `hostContent`
- **AND** persistence and Pane event envelopes SHALL omit it

