## MODIFIED Requirements

### Requirement: V2 SHALL use official additive DSH workspace seams without replacing core surfaces

V2 client plugin SHALL render shared Pane Workbench hosts through official `shell.workspace.right` and `shell.workspace.bottom` single slots and SHALL attach one owner to `ctx.workspaceLayout`. It MUST NOT occupy `sidebar`、`conversation`、`details` or production `shell.overlay`; MUST NOT use private DOM selector、root margin or global layout patch. If either workspace slot or `ctx.workspaceLayout` is absent, loading MUST fail with an explicit minimum-version compatibility error and MUST NOT fall back to overlay.

#### Scenario: Pane Workbench and Tool Details are enabled
- **WHEN** Tool Details is open and the user opens Pane Workbench
- **THEN** Tool Details SHALL remain owned by its existing details occupant
- **AND** DSH AppFrame SHALL decide dock、derived collapse or sheet without Pane DOM offsets

#### Scenario: Old DSH loads the V2 bundle
- **WHEN** the runtime does not expose the workspace service or the two declared slots
- **THEN** the bundle SHALL report an actionable compatibility error
- **AND** no frame-wide Pane overlay SHALL mount

### Requirement: Bundle installation and removal SHALL be reversible

Pane Workbench SHALL be installed through the DSH plugin/profile bundle and SHALL mount only repository-owned package rows. Installation、inspection and removal SHALL use real DSH CLI. Removal SHALL dispose both slot registrations、the layout handle、drag coordinator、subscriptions and persistence listeners; no rail、row、column or duplicate mount MAY remain.

#### Scenario: User removes bundle
- **WHEN** the user removes Pane Workbench from the Web profile and reloads DSH
- **THEN** both workspace occupants、client service and provider entries SHALL disappear
- **AND** sidebar、conversation、details and settings SHALL recover their baseline assembly with no reserved workspace tracks

## ADDED Requirements

### Requirement: Two workspace hosts SHALL share one controller generation

Right and Bottom slot components SHALL read the same external Pane controller/store via `useSyncExternalStore`. Registry unload、session switch、openView、Tab move、split、resize and persistence changes SHALL become visible to both hosts without duplicating view ids or registering a second owner.

#### Scenario: Provider unloads while visible in Right
- **WHEN** a registered view provider disposes while Right and Bottom hosts are mounted
- **THEN** both hosts SHALL observe the same orphaned workspace snapshot
- **AND** only the affected Tab SHALL show recovery UI

