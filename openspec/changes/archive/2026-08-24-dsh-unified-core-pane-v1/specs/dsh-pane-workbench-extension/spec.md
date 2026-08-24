## ADDED Requirements

### Requirement: Pane Workbench SHALL install the DSH Core Tool Details provider

The production Pane Workbench apply path SHALL register `dsh.tool-details` into its existing local `PaneViewRegistry` before attaching the workspace layout owner. It SHALL pass a Core Pane host adapter to `ctx.workspaceLayout.attach()` and dispose the built-in registration with the rest of the plugin lifecycle.

#### Scenario: Pane Workbench loads on a compatible DSH

- **WHEN** both workspace slots、the layout service and the Core Pane bridge are present
- **THEN** Pane Workbench SHALL register one built-in Tool Details provider and one layout owner
- **AND** Right and Bottom SHALL continue to share one controller generation

#### Scenario: Pane Workbench unloads

- **WHEN** the plugin disposer runs
- **THEN** the Core Tool Details registration、both slot occupants and layout adapter SHALL be removed idempotently
- **AND** no core view callback SHALL survive the disposed generation

### Requirement: Pane Workbench SHALL fail clearly on a pre-Core host contract

The unified Core Pane bundle SHALL require the DSH layout version that provides the Core Pane adapter and render callback. It MUST NOT silently load the dual-sidebars combination against an older host seam.

#### Scenario: Workspace slots exist but the Core bridge is missing

- **WHEN** Pane Workbench detects Right/Bottom slots and `ctx.workspaceLayout` without the required Core contract
- **THEN** plugin load SHALL fail with an actionable compatibility message
- **AND** it MUST NOT register `details`、`shell.overlay` or a second sidebar as fallback

