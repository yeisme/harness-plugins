## MODIFIED Requirements

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
