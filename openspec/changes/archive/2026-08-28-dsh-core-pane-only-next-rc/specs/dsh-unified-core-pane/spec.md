## ADDED Requirements

### Requirement: Tool Details SHALL use the standard Pane Workbench Core

DSH Tool Details SHALL register and open as singleton Core view `dsh.tool-details` through the same Pane Workbench registry、controller、Right/Bottom host and chrome used by ecosystem views. It MUST NOT create a second Pane reducer、Tab system、sidebar、Details column or production overlay.

#### Scenario: User inspects a Bash tool call

- **WHEN** conversation selection chooses a Bash tool call and invokes `layout.openDetails()`
- **THEN** Pane Workbench SHALL open or focus the singleton `dsh.tool-details` view
- **AND** no independent Details column SHALL exist

#### Scenario: Core Pane owner is unavailable

- **WHEN** DSH receives an inspect action before the required Core Pane owner is attached
- **THEN** the action SHALL fail with an actionable incompatible-profile error
- **AND** DSH MUST NOT mount a legacy Details occupant or overlay fallback

## REMOVED Requirements

### Requirement: Tool Details SHALL use the standard Pane Workbench Core when available

**Reason**: The one-RC compatibility window completed; Tool Details now registers only through the unified Pane Workbench Core, so the conditional name no longer reflects the contract.

**Migration**: Upgrade DSH and Pane Workbench as one matching RC set; mixed versions are unsupported.

### Requirement: Core Pane SHALL preserve a legacy Details fallback for one RC

**Reason**: The one-RC compatibility window completed; retaining the column creates a second geometry and content lifecycle that bypasses the unified Pane owner.

**Migration**: Upgrade DSH and Pane Workbench as one matching RC set. Roll back by restoring the previous complete RC set; mixed versions are unsupported.
