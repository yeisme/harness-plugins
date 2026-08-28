## ADDED Requirements

### Requirement: Pane Workbench SHALL require the Core host contract

The Pane Workbench client plugin SHALL require `workspace.core-pane.v1`、`shell.workspace.right`、`shell.workspace.bottom` and `ctx.workspaceLayout`. It SHALL register only the two workspace occupants and one Core owner. Missing or partial seams MUST fail with an actionable compatibility error. The plugin MUST NOT register `details`、`shell.overlay`、`sidebar.footer.action` or patch `ctx.layout` methods as fallback.

#### Scenario: Complete Core seam is available

- **WHEN** all required slots、service and Core version are present
- **THEN** Pane Workbench SHALL attach one owner and register Right/Bottom occupants
- **AND** Tool Details SHALL open through the attached Core adapter

#### Scenario: Old or partial host loads the new bundle

- **WHEN** any required Core seam is absent or has a different version
- **THEN** plugin load SHALL fail before providing `paneWorkbench`
- **AND** no overlay、footer action、Details column or monkey patch SHALL be installed

## REMOVED Requirements

### Requirement: Pane Workbench SHALL fail clearly on a pre-Core host contract

**Reason**: Superseded by the stricter Core-only requirement; the additive official overlay host fallback it permitted is deleted in this RC.

**Migration**: Upgrade DSH and Pane Workbench as one matching RC set; hosts without the full Core seam can no longer load the new Pane Workbench bundle.
