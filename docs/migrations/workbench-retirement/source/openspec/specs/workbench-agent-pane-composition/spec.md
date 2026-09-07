# workbench-agent-pane-composition Specification

## Purpose
TBD - created by archiving change workbench-agent-pane-composition-r1. Update Purpose after archive.
## Requirements
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

The Pane frame header MUST render the pane title exactly once through the shared `PaneChrome`/`PaneFrame` composite, MUST NOT render a redundant eyebrow label, and MUST demote version, freshness and contract identity to secondary muted metadata. Desktop frames and mobile Sheet frames MUST share the same title/status/action slots; the tab strip continues to carry the pane label and type metadata without duplicating the full title block.

#### Scenario: A context pane is opened
- **WHEN** the user opens the Context Pane
- **THEN** the frame shows one localized title, one status treatment and secondary version/freshness metadata
- **AND** no repeated "Agent pane" or raw contract id appears as primary content

#### Scenario: A pane opens on a mobile viewport
- **WHEN** a Pane opens as a Sheet on a narrow viewport
- **THEN** the Sheet uses the same shared chrome slots as desktop
- **AND** focus containment, Escape, scroll lock and focus restoration behave as before

### Requirement: Every pane SHALL implement the four-state content matrix

Each registered Pane MUST define loading, empty, unavailable and ready presentations using the shared status, empty and recovery slots. Loading MUST use structured skeleton rows, not a blank card. Unavailable MUST pair the truthful status block and at most one declared recovery action with a structural placeholder of the ready content. Empty MUST use a centered icon, one line of explanation and at most one call to action. A Pane MUST NOT show synthetic content to hide a missing contract or unavailable projection.

#### Scenario: A pane is loading its projection
- **WHEN** its projection is in flight
- **THEN** structured skeleton placeholders preserve the expected content hierarchy
- **AND** no fabricated content or fake success is shown

#### Scenario: A pane is unavailable
- **WHEN** its projection reports offline, failed, stale or needs_contract
- **THEN** the Pane renders the truthful status, user impact, one recovery action and the structural ready-state placeholder
- **AND** technical reason codes remain secondary details rather than the main title

#### Scenario: A Pane is empty
- **WHEN** the canonical projection is valid but contains no items
- **THEN** the Pane renders one real next action or a clear no-action explanation
- **AND** it does not add demo records or duplicate an action already owned by the composer

### Requirement: Panes without a contract SHALL be fail-closed in the catalog

A registered pane kind whose contract is not registered MUST appear in the pane command palette as a disabled `needs_contract` entry with its reason, and MUST NOT open a stub pane that always renders unavailable. The stub rendering path for such panes MUST be removed. Once a first-party Pane has a sealed data/action contract, local renderer, required capability projection and safe recovery states, the same catalog entry MAY become available without introducing a second registry. The CLI Pane MUST remain disabled until its command catalog, prepared intent, Task/Host execution, output, permission, evidence and rollback contracts are all ready.

#### Scenario: A user browses the pane palette
- **WHEN** the palette lists a pane kind with no registered contract
- **THEN** the entry is disabled with the missing-contract reason
- **AND** selecting it does not open a pane

#### Scenario: The CLI Pane contract is promoted
- **WHEN** `agent.cli.v1` has a registered renderer and server capability confirms compatible command/runtime contracts
- **THEN** the existing Pane catalog entry MAY become enabled and SHALL resolve through the same versioned Pane registry
- **AND** availability loss SHALL return it to a truthful disabled/offline/stale state without loading a stub or browser fallback

### Requirement: Pane content SHALL lead with user-meaningful labels

Pane content MUST lead with localized, human-readable labels (proposal titles, object names, status text). Raw identifiers (output refs, task ids, turn UUIDs, reason codes) MUST be demoted to secondary muted mono metadata or a technical-details disclosure, and MUST NOT serve as the primary text of any content row or section.

#### Scenario: A review pane renders a proposal
- **WHEN** the review pane renders a proposal projection
- **THEN** the primary text is the human-readable proposal label and its status
- **AND** output refs, task ids, and sequence numbers appear only as secondary mono metadata
- **AND** reason codes such as `needs_contract` appear only as secondary metadata next to the status chip

### Requirement: Spatial Focus SHALL use the canonical Agent layout state

Spatial Focus MUST be represented by the existing session-scoped Agent layout reducer and MUST preserve the conversation/composer anchor, Pane documents, focus-return trigger and visible/split limits. The Spatial surface MUST use the shared context rail for Detail, Inspector, Review and Evidence, MUST NOT create a second docking engine, and MUST NOT remount the composer when modes or the last Pane change.

#### Scenario: User switches from Split to Spatial Focus
- **WHEN** a session with an open Review Pane enters Spatial Focus
- **THEN** the Spatial surface becomes primary while the Review Pane document, composer draft and selected refs remain mounted or recoverable in the same layout state
- **AND** no Task, proposal or Owner subscription is recreated solely because of the layout change

#### Scenario: A context rail tab changes
- **WHEN** the user switches between Detail, Inspector, Review and Evidence
- **THEN** the rail swaps the current safe projection in place
- **AND** the canvas and composer keep their current state and focus unless the user explicitly invoked the tab change

### Requirement: Desktop spatial mode SHALL not alter mobile Pane behavior
The desktop-only Spatial capability MUST NOT require new phone/tablet Pane or Sheet variants. Existing non-spatial Agent conversation responsive behavior MAY remain, but a narrow viewport MUST not mount the Spatial editor.

#### Scenario: Existing mobile Agent conversation opens
- **WHEN** a user accesses the ordinary Agent conversation on a narrow viewport
- **THEN** its existing Pane/Sheet behavior MAY continue unchanged
- **AND** Spatial capability MUST remain unavailable without adding a mobile spatial layout

