## ADDED Requirements

### Requirement: Creative Production SHALL host a closed Screenplay Room renderer

The `creative_production` Lens SHALL support a closed `screenplay_room` surface descriptor that replaces the central generic renderer while preserving the existing Spatial selection, context rail, Agent intent, proposal and focus contracts. Unknown surface values MUST fail closed to the existing Creative Production experience.

#### Scenario: Screenplay Room surface is selected

- **WHEN** trusted ingress and server capability resolve `creativeSurface=screenplay_room`
- **THEN** the central surface SHALL mount the specialized dual-timeline renderer
- **AND** it SHALL not add a second fixed business rail, composer, event stream or Task control plane.

#### Scenario: User exits Screenplay Room

- **WHEN** the user returns to the previous Creative Production surface
- **THEN** Agent session/composer and safe Pane state SHALL remain recoverable
- **AND** exiting SHALL not cancel owner mutations or discard confirmed receipts.
