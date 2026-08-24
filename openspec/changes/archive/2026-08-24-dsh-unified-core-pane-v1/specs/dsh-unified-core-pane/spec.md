## ADDED Requirements

### Requirement: Tool Details SHALL use the standard Pane Workbench Core when available

DSH Tool Details SHALL register and open as singleton Core view `dsh.tool-details` through the same Pane Workbench registry、controller、Right/Bottom host and chrome used by ecosystem views. It MUST NOT create a second Pane reducer、Tab system、sidebar or production overlay.

#### Scenario: User inspects a Bash tool call with Core Pane attached

- **WHEN** conversation selection chooses a Bash tool call and invokes `layout.openDetails()` while a Core Pane host is attached
- **THEN** Pane Workbench SHALL open or focus the singleton `dsh.tool-details` view
- **AND** the independent legacy Details column SHALL remain closed

#### Scenario: Tool Details is moved to Bottom

- **WHEN** the user moves the open `dsh.tool-details` Tab from Right to Bottom
- **THEN** the view SHALL continue to render the DSH-owned Details occupant through the same selection store
- **AND** no duplicate Details subtree or tool data store SHALL be created

#### Scenario: Session or client generation changes

- **WHEN** the current DSH Session changes or Pane Workbench restores a new client generation
- **THEN** any stale `dsh.tool-details` view SHALL be closed before it can expose prior-session content
- **AND** the next owner-authored inspect action SHALL open a fresh singleton view

### Requirement: Core Pane SHALL preserve a legacy Details fallback for one RC

DSH SHALL retain the existing `details` slot、layout store action and column for one compatibility RC. When no Core Pane host is attached, `layout.openDetails()` and `closeDetails()` SHALL preserve their existing behavior. The fallback MUST NOT be removed until a later OpenSpec change records consumer evidence、deprecation completion and rollback.

#### Scenario: Pane Workbench is not installed

- **WHEN** the Web profile has no Core Pane host adapter
- **THEN** selecting a Tool call SHALL open the legacy Details column
- **AND** Tool Details SHALL remain usable without a Yeisme package dependency

#### Scenario: Pane Workbench unloads

- **WHEN** the Core Pane layout handle is disposed by bundle removal or HMR
- **THEN** subsequent Tool Details opens SHALL use the legacy column
- **AND** the disposed adapter MUST NOT receive new open or close callbacks

### Requirement: Core view content SHALL remain owner-authored and local

The Core Pane host SHALL receive Tool Details content only through a local DSH owner render callback. Pane state and persistence MUST NOT copy tool arguments、tool output、terminal content、raw prompts、provider payloads or private arguments. Unknown core ids MUST NOT execute or select arbitrary components.

#### Scenario: Active Tool Details view renders

- **WHEN** `dsh.tool-details` is the active Pane view
- **THEN** the local provider SHALL render the owner callback result as `hostContent`
- **AND** persisted layout SHALL contain only the safe view identity and presentation state

#### Scenario: Unknown core view id is requested

- **WHEN** a caller requests a core id outside the DSH-defined allowlist
- **THEN** the workspace bridge SHALL reject or ignore the request
- **AND** it MUST NOT dynamic-import code、render a remote component or create an iframe

### Requirement: Core Tool Details SHALL be owner-triggered rather than discoverable

`dsh.tool-details` SHALL NOT appear in the generic Open View picker. It SHALL open only from an owner-authored inspect/details action with a current DSH selection.

#### Scenario: User opens the generic view picker

- **WHEN** Pane Workbench lists discoverable providers
- **THEN** `dsh.tool-details` SHALL be absent
- **AND** ordinary File、Terminal、Agent or domain providers SHALL remain discoverable according to their registrations
