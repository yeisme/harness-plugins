## ADDED Requirements

### Requirement: Workspace layout SHALL expose an optional Core Pane host bridge

`ctx.workspaceLayout.attach()` SHALL accept an optional Core Pane host adapter without changing existing two-argument callers. The adapter SHALL support the DSH-defined `dsh.tool-details` open/close lifecycle. Snapshot SHALL expose whether the Core Pane host is attached, and disposed handles MUST immediately stop receiving callbacks.

#### Scenario: Existing owner attaches without a Core adapter

- **WHEN** an existing consumer calls `attach(ownerId, preference)`
- **THEN** the workspace service SHALL preserve the current layout contract
- **AND** Tool Details SHALL continue through the legacy Details fallback

#### Scenario: Pane Workbench attaches a Core adapter

- **WHEN** Pane Workbench calls `attach(ownerId, preference, corePaneHost)`
- **THEN** the snapshot SHALL report the Core host as attached
- **AND** `openCorePane('dsh.tool-details')` / `closeCorePane('dsh.tool-details')` SHALL route to that live adapter

### Requirement: Workspace slots SHALL provide owner-authored Core view renderers

Right and Bottom workspace owner props SHALL expose a local `renderCoreView(id)` callback. AppFrame SHALL resolve `dsh.tool-details` to the existing `details` slot occupant and unknown ids to no content. The callback MUST NOT accept remote module、URL or component descriptors.

#### Scenario: Core Tool Details is active in Right

- **WHEN** the Right Pane host requests `renderCoreView('dsh.tool-details')`
- **THEN** AppFrame SHALL return the canonical DSH Details occupant
- **AND** AppFrame SHALL NOT mount that occupant in the legacy Details column at the same time

#### Scenario: Legacy fallback is active

- **WHEN** no Core Pane host is attached
- **THEN** AppFrame SHALL mount the existing `details` slot in the legacy column
- **AND** workspace owner props SHALL NOT cause a second Details mount

