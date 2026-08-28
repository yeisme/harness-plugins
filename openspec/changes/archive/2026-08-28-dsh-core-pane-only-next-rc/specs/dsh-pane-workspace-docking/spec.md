## ADDED Requirements

### Requirement: Workspace layout SHALL require a Core Pane host bridge

`ctx.workspaceLayout.attach()` SHALL require a Core Pane host adapter that supports the DSH-defined `dsh.tool-details` open/close lifecycle. Snapshot SHALL expose the attached Core Pane owner, and disposed handles MUST immediately stop receiving callbacks. The layout service MUST NOT retain an independent Details geometry or fallback.

#### Scenario: Pane Workbench attaches the Core adapter

- **WHEN** Pane Workbench calls `attach(ownerId, preference, corePaneHost)`
- **THEN** the snapshot SHALL report the Core host as attached
- **AND** `openCorePane('dsh.tool-details')` / `closeCorePane('dsh.tool-details')` SHALL route to that live adapter

#### Scenario: Caller omits the Core adapter

- **WHEN** a caller attempts to attach a workspace owner without `corePaneHost`
- **THEN** attach SHALL fail before changing layout state
- **AND** Tool Details MUST NOT fall back to an independent column

## REMOVED Requirements

### Requirement: Workspace layout SHALL expose an optional Core Pane host bridge

**Reason**: The breaking Core-only RC makes the bridge mandatory at attach time; an optional bridge would keep alive the dual geometry the change removes.

**Migration**: Upgrade DSH and Pane Workbench as one matching RC set; attach callers must always pass `corePaneHost`.

## MODIFIED Requirements

### Requirement: Workspace slots SHALL provide owner-authored Core view renderers

Right and Bottom workspace owner props SHALL expose a local `renderCoreView(id)` callback. AppFrame SHALL resolve `dsh.tool-details` to the canonical DSH Details occupant and unknown ids to no content. The callback MUST NOT accept remote module、URL or component descriptors. AppFrame MUST NOT contain a second Details mount location.

#### Scenario: Core Tool Details is active in Right

- **WHEN** the Right Pane host requests `renderCoreView('dsh.tool-details')`
- **THEN** AppFrame SHALL return the canonical DSH Details occupant
- **AND** no other AppFrame region SHALL mount that occupant

#### Scenario: Legacy fallback is active

- **WHEN** no Core Pane host is attached
- **THEN** no legacy Details column SHALL mount and `dsh.tool-details` SHALL render no content
- **AND** workspace owner props SHALL NOT cause a second Details mount

#### Scenario: Unknown Core id is requested

- **WHEN** a workspace owner requests an id outside the DSH allowlist
- **THEN** AppFrame SHALL return no content
- **AND** it MUST NOT create a fallback Details surface
