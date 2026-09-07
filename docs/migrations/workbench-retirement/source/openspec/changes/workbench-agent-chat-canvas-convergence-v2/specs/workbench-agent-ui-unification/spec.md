## MODIFIED Requirements

### Requirement: Agent-first shell SHALL expose one stable visual hierarchy
The `/agent` shell MUST present one compact product rail, an optional Session drawer, a persistent left Chat rail with timeline/composer, a central Canvas/registered Pane document dock and one right Context rail. Conversation, Split and Spatial Focus SHALL remain compatibility ingress/layout preferences rather than separate primary modes. Lens renderers MUST NOT add a competing fixed-width business sidebar, and Chat/Canvas/Pane state MUST remain mounted or recoverable when document focus or responsive presentation changes.

#### Scenario: User enters ordinary Agent workspace
- **WHEN** a user opens `/agent` without a trusted document ingress
- **THEN** Chat SHALL be visible and the central dock SHALL open the current or default Canvas/Pane document according to capability
- **AND** Session and Context navigation SHALL remain discoverable without a modebar or second shell

#### Scenario: User enters through trusted Spatial ingress
- **WHEN** a trusted project or Spatial link opens the workspace
- **THEN** the central dock SHALL focus the Canvas document while Chat/composer remain available in the left rail
- **AND** Detail, Inspector, Review and Evidence SHALL use the shared right rail

#### Scenario: User opens or focuses a document
- **WHEN** a user opens Canvas, Review, Evidence or another registered Pane
- **THEN** active document, composer draft, pending/attached refs and focus-return trigger SHALL remain in the same layout state
- **AND** no Task, content invocation, Owner subscription or second event stream SHALL be created solely by the visual change

## ADDED Requirements

### Requirement: The adaptive shell SHALL prioritize usable minimum widths
At wide desktop the shell SHALL default to left Chat, central document and right Context. When effective width decreases, Session and Context SHALL become Sheets before Chat or Canvas fall below their usable minimums. Below the desktop Canvas threshold, Workbench SHALL show Chat plus accessible Canvas summaries/review without mounting the full editor.

#### Scenario: Shell renders at 1440 pixels
- **WHEN** the viewport is 1440×960 with the default layout
- **THEN** Chat, one central document and Context SHALL remain simultaneously usable without page-level overflow
- **AND** the Session drawer MAY be opened or pinned without losing draft/document state

#### Scenario: Shell renders at 390 pixels
- **WHEN** the viewport is 390×844
- **THEN** Chat/composer SHALL remain primary and Canvas/Context/Review SHALL use labelled Sheets or lists
- **AND** Pixi/WebGL and freeform Draft editing SHALL not mount

