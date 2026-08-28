# dsh-unified-core-pane Specification

## Purpose
TBD - created by archiving change dsh-unified-core-pane-v1. Update Purpose after archive.
## Requirements
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

