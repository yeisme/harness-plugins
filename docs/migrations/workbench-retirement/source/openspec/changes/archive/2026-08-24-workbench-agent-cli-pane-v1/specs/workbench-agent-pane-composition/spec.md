## MODIFIED Requirements

### Requirement: Panes without a contract SHALL be fail-closed in the catalog

A registered pane kind whose contract is not registered MUST appear in the pane command palette as a disabled `needs_contract` entry with its reason, and MUST NOT open a stub pane that always renders unavailable. Once a first-party Pane has a sealed data/action contract, local renderer, required capability projection and safe recovery states, the same catalog entry MAY become available without introducing a second registry. The CLI Pane MUST remain disabled until its command catalog, prepared intent, Task/Host execution, output, permission, evidence and rollback contracts are all ready.

#### Scenario: A user browses the pane palette
- **WHEN** the palette lists a pane kind with no registered contract
- **THEN** the entry is disabled with the missing-contract reason
- **AND** selecting it does not open a pane

#### Scenario: The CLI Pane contract is promoted
- **WHEN** `agent.cli.v1` has a registered renderer and server capability confirms compatible command/runtime contracts
- **THEN** the existing Pane catalog entry MAY become enabled and SHALL resolve through the same versioned Pane registry
- **AND** availability loss SHALL return it to a truthful disabled/offline/stale state without loading a stub or browser fallback
