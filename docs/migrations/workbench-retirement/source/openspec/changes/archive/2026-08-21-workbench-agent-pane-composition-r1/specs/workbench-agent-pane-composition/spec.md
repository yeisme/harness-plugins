# workbench-agent-pane-composition Specification Delta

## ADDED Requirements

### Requirement: The hero composer SHALL compose correctly with the pane dock

The centered hero composer treatment MUST apply only when the conversation is empty and no pane is visible. Whenever at least one pane is visible (desktop dock or mobile sheet), the composer MUST render docked at the bottom of the conversation column, the empty-state spacer and hero brand block MUST NOT render, and the composer MUST NOT remount when the last pane opens or closes.

#### Scenario: A pane opens on an empty conversation
- **WHEN** a user opens a pane while the conversation has no turns
- **THEN** the composer docks at the bottom of the conversation column
- **AND** the empty-state spacer below the composer is removed
- **AND** the composer's draft and focus state are preserved

#### Scenario: The last pane closes on an empty conversation
- **WHEN** the user closes the last visible pane and the conversation is still empty
- **THEN** the hero treatment returns without remounting the composer

### Requirement: Pane frames SHALL render the title once through the shared chrome

The pane frame header MUST render the pane title exactly once, MUST NOT render a redundant eyebrow label, and MUST demote version and freshness information to secondary muted metadata. Desktop frames and mobile sheet frames MUST be composed from the shared `PaneChrome` composite rather than hand-rolled header markup; the tab strip continues to carry the pane label and type metadata.

#### Scenario: A context pane is opened
- **WHEN** the user opens the context pane
- **THEN** the frame shows the pane title once, with version and freshness as secondary metadata
- **AND** no eyebrow repeating "Agent pane" or the pane title appears

#### Scenario: A pane opens on a mobile viewport
- **WHEN** a pane opens as a sheet on a narrow viewport
- **THEN** the sheet uses the same shared chrome header
- **AND** focus containment, Escape, scroll lock, and focus restoration behave as before

### Requirement: Every pane SHALL implement the four-state content matrix

Each registered pane MUST define loading, empty, unavailable, and ready presentations. Loading MUST use structured skeleton rows, not a bare card or blank area. Unavailable MUST pair the truthful status card and its declared recovery action with a structural placeholder of the ready content, never a single floating card in empty space. Empty MUST use a centered icon, one line of explanation, and at most one call to action.

#### Scenario: A pane is loading its projection
- **WHEN** a pane's data is in flight
- **THEN** the pane renders structured skeleton placeholders
- **AND** no fabricated content or fake success is shown

#### Scenario: A pane is unavailable
- **WHEN** a pane's projection reports offline, failed, or needs_contract
- **THEN** the pane renders the truthful status with its recovery action and a structural placeholder
- **AND** the unavailable meaning is not weakened

### Requirement: Panes without a contract SHALL be fail-closed in the catalog

A registered pane kind whose contract is not registered MUST appear in the pane command palette as a disabled `needs_contract` entry with its reason, and MUST NOT open a stub pane that always renders unavailable. The stub rendering path for such panes MUST be removed.

#### Scenario: A user browses the pane palette
- **WHEN** the palette lists a pane kind with no registered contract
- **THEN** the entry is disabled with the missing-contract reason
- **AND** selecting it does not open a pane

### Requirement: Pane content SHALL lead with user-meaningful labels

Pane content MUST lead with localized, human-readable labels (proposal titles, object names, status text). Raw identifiers (output refs, task ids, turn UUIDs, reason codes) MUST be demoted to secondary muted mono metadata or a technical-details disclosure, and MUST NOT serve as the primary text of any content row or section.

#### Scenario: A review pane renders a proposal
- **WHEN** the review pane renders a proposal projection
- **THEN** the primary text is the human-readable proposal label and its status
- **AND** output refs, task ids, and sequence numbers appear only as secondary mono metadata
- **AND** reason codes such as `needs_contract` appear only as secondary metadata next to the status chip
