## ADDED Requirements

### Requirement: DSH SHALL expose official dual workspace regions

DSH `ui-layout` SHALL declare root-scoped single slots `shell.workspace.right` and `shell.workspace.bottom`. AppFrame SHALL render sidebar、conversation、right workspace、Tool Details as four columns and conversation/bottom workspace as two rows, where sidebar、right workspace and Tool Details span both rows and bottom workspace exists only below conversation.

#### Scenario: Pane bundle is installed
- **WHEN** one workspace owner attaches and registers both slot occupants
- **THEN** the right occupant SHALL render in `shell.workspace.right` and the bottom occupant SHALL render in `shell.workspace.bottom`
- **AND** neither occupant SHALL register into `shell.overlay`

#### Scenario: Pane bundle is removed
- **WHEN** the owner disposes its layout handle and both slot registrations
- **THEN** the 44px rail and all right/bottom layout reservation SHALL disappear
- **AND** sidebar、conversation and Tool Details SHALL keep their normal layout

### Requirement: Workspace layout service SHALL have exclusive symmetric ownership

`ctx.workspaceLayout` SHALL expose `attach(ownerId, initialPreference)` returning a `WorkspaceLayoutHandle` with `update()`、`getSnapshot()`、`subscribe()` and idempotent `dispose()`. A second live attach, including the same owner id, MUST fail during loading rather than sharing or replacing the current owner.

#### Scenario: Duplicate owner attaches
- **WHEN** a workspace owner is already attached and another attach is attempted
- **THEN** `attach()` SHALL throw a compatibility/ownership error before changing the current snapshot
- **AND** the original handle SHALL remain usable

#### Scenario: HMR disposes the owner
- **WHEN** the live handle is disposed during plugin unload or HMR
- **THEN** subscribers SHALL observe the detached snapshot once
- **AND** later calls through the disposed handle SHALL NOT recreate layout reservation

### Requirement: DSH SHALL solve workspace geometry without obscuring the sidebar

Right workspace SHALL default to 480px, clamp to 360–840px and not exceed 60% of the region right of sidebar. Bottom workspace SHALL default to 34% height, clamp to 180px–65%. Conversation SHALL retain a target minimum of 420×320px. An attached closed workspace SHALL render a 44px right rail; insufficient active workspace SHALL project as a sheet whose left boundary is never less than the resolved sidebar width.

#### Scenario: Standard desktop width
- **WHEN** AppFrame is 1440px wide and Right is open
- **THEN** the solver SHALL preserve the resolved sidebar and provide a docked Right region when the conversation floor fits
- **AND** workspace content SHALL NOT overlap sidebar

#### Scenario: Narrow viewport
- **WHEN** AppFrame width is 768px or 390px and an active pane cannot dock beside a 420px conversation
- **THEN** that pane SHALL render in `sheet` mode over only the area right of sidebar
- **AND** the sidebar SHALL remain mounted and visible

### Requirement: Right workspace and Tool Details SHALL use reversible priority

When Right workspace and Tool Details cannot both fit, the last explicitly opened auxiliary surface SHALL remain usable. The other surface SHALL derive a collapsed/closed projection while preserving its width and open preference, and SHALL restore automatically when space returns or priority changes.

#### Scenario: Details opens after Right
- **WHEN** Right is preferred open, available width is insufficient for both, and `ctx.layout.openDetails()` is invoked last
- **THEN** Details SHALL receive the available dock space and Right SHALL derive to its rail
- **AND** Right's stored open preference and width SHALL remain unchanged

#### Scenario: Pane opens after Details
- **WHEN** Details is open and a Pane owner explicitly opens Right last
- **THEN** Right SHALL receive the workspace dock or sheet and Details SHALL derive closed
- **AND** widening the frame SHALL restore both without another open action

### Requirement: Workspace resize and maximize SHALL be AppFrame-owned and accessible

AppFrame SHALL own Right and Bottom separators with pointer capture、rAF visual updates、single final commit and keyboard Arrow adjustments. Maximize SHALL hide but not unmount conversation、other Pane regions and Details; `Escape` and a restore action SHALL return to the prior layout. Browser Fullscreen API MUST NOT be used.

#### Scenario: Keyboard resize
- **WHEN** focus is on the Right or Bottom separator and the user presses the corresponding Arrow key
- **THEN** AppFrame SHALL update the attached preference within contract bounds
- **AND** the separator SHALL expose `role=separator`、orientation and current value

#### Scenario: Restore maximized Pane
- **WHEN** one Pane region is maximized and the user presses Escape
- **THEN** the pre-maximize right/bottom/details preferences SHALL resume
- **AND** the sidebar SHALL have remained visible for the entire transition

### Requirement: Workspace content SHALL stay mounted across derived visibility changes

Conversation、both workspace slot occupants and Tool Details SHALL remain mounted while their derived mode is hidden、rail、sheet or maximized by another surface. Only owner disposal、slot unregister or session scope teardown MAY unmount the corresponding subtree.

#### Scenario: Width concession temporarily hides Details
- **WHEN** Right wins auxiliary priority and Details derives to zero width
- **THEN** the Details subtree SHALL keep its React identity
- **AND** widening the frame SHALL reveal the same subtree without re-registration

