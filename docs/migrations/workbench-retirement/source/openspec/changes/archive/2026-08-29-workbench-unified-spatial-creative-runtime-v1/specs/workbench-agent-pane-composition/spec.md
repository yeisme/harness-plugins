## ADDED Requirements

### Requirement: Spatial Focus SHALL use the canonical Agent layout state
Spatial Focus MUST be represented by the existing session-scoped Agent layout reducer and MUST preserve the conversation/composer anchor, Pane documents, focus-return trigger and visible/split limits. It MUST NOT create a second docking engine or remount the composer when modes change.

#### Scenario: User switches from Split to Spatial Focus
- **WHEN** a session with an open Review Pane enters Spatial Focus
- **THEN** the Spatial Surface becomes primary while the Review Pane document and composer draft remain mounted or recoverable in the same layout state
- **AND** no Task, proposal or Owner subscription is recreated solely because of the layout change

### Requirement: Desktop spatial mode SHALL not alter mobile Pane behavior
The desktop-only Spatial capability MUST NOT require new phone/tablet Pane or Sheet variants. Existing non-spatial Agent conversation responsive behavior MAY remain, but a narrow viewport MUST not mount the Spatial editor.

#### Scenario: Existing mobile Agent conversation opens
- **WHEN** a user accesses the ordinary Agent conversation on a narrow viewport
- **THEN** its existing Pane/Sheet behavior MAY continue unchanged
- **AND** Spatial capability MUST remain unavailable without adding a mobile spatial layout
