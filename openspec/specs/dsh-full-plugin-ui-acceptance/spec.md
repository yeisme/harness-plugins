# dsh-full-plugin-ui-acceptance Specification

## Purpose
TBD - created by archiving change dsh-full-plugin-ui-acceptance. Update Purpose after archive.
## Requirements
### Requirement: Full plugin acceptance distinguishes loading from functionality
The local acceptance runner SHALL inventory every discoverable bundle and distinguish profile boot, visible UI interaction, unavailable capabilities and unverified functions. Missing owner services SHALL NOT be reported as functional success.

#### Scenario: All bundles boot but a surface is unavailable
- **WHEN** the full profile loads and an entry is disabled or produces no visible change
- **THEN** evidence records the entry and its reason separately from boot success
- **AND** the result does not claim complete functional acceptance

### Requirement: Creator Studio tolerates late Pane availability
Creator Studio SHALL update its launcher when the optional Pane service arrives, changes or disappears, and SHALL discard asynchronous mounts from an older service generation.

#### Scenario: Pane arrives after Creator Studio
- **WHEN** Creator Studio initially displays an unavailable launcher and Pane becomes available
- **THEN** the unavailable registration is removed and the real launcher is installed after remote resolution
- **AND** disposal removes the service listener and prevents later mounting

### Requirement: Shared UI follows canonical font and control scales
Plugin surfaces SHALL inherit the host font family, use the canonical body size, style text inputs consistently with other fields, and expose the documented touch and spacing variables.

#### Scenario: Compact annotation in Chinese or English
- **WHEN** the real annotation client is opened at 360, 560 or 960 pixels
- **THEN** the labeled composer remains inside the viewport, focuses its input, permits a nonempty local comment and closes with Escape
- **AND** visual evidence captures the real component

### Requirement: Missing Web base is rejected during preparation
The Web development preparation command SHALL reject a composed profile without the official Web app instead of reporting it ready.

#### Scenario: Custom profile only contains business bundles
- **WHEN** configuration composition succeeds but the Web app is absent
- **THEN** preparation fails with instructions to use an isolated Web profile or install the official base layers

