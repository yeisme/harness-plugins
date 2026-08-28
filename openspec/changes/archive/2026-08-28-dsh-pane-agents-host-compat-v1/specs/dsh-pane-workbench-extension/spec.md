## MODIFIED Requirements

### Requirement: Pane Workbench SHALL fail clearly on a pre-Core host contract

The unified Core Pane bundle SHALL require the DSH layout version that provides the Core Pane adapter and render callback. It MUST NOT silently load the dual-sidebars combination against an older host seam. Fail-closed applies only when both workspace slots are already declared without `workspace.core-pane.v1`. Official DSH that exposes a residual `workspaceLayout` without declaring `shell.workspace.right` and `shell.workspace.bottom` SHALL use the additive official overlay host and provide `paneWorkbench`.

#### Scenario: Workspace slots exist but the Core bridge is missing

- **WHEN** Pane Workbench detects Right/Bottom slots without the required Core contract
- **THEN** plugin load SHALL fail with an actionable compatibility message
- **AND** it MUST NOT register `details`、`shell.overlay` or a second sidebar as fallback

#### Scenario: Residual workspaceLayout without declared workspace slots

- **WHEN** `ctx.workspaceLayout` exists without `workspace.core-pane.v1` and slots do not declare `shell.workspace.right` and `shell.workspace.bottom`
- **THEN** Pane Workbench SHALL mount the additive official overlay / footer / header host
- **AND** it SHALL `provide('paneWorkbench')`
- **AND** it MUST NOT occupy `sidebar`、`conversation` or `details`
