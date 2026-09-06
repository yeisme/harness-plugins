## ADDED Requirements

### Requirement: Magnetic docking preview
The host SHALL offer proportional edge targets, stable edge retention, and a preview of the actual resulting layout without committing it during a drag.

#### Scenario: Drag near an edge
- **WHEN** a Pane enters an eligible proportional edge zone
- **THEN** neighboring Pane content makes room using the final drop geometry
- **AND** the saved layout remains unchanged until pointer release

#### Scenario: Cancel a preview
- **WHEN** Escape, pointer cancellation, focus loss, or a concurrent layout change occurs
- **THEN** the original layout and session identities remain intact

### Requirement: Adaptive presentation
The host SHALL preserve saved topology and preferred ratios while adapting the presentation to available dimensions.

#### Scenario: Narrow then widen
- **WHEN** horizontal panes cannot maintain their minimum widths but can stack vertically
- **THEN** they are presented vertically without rewriting the saved layout
- **AND** widening restores the preferred horizontal presentation

### Requirement: Intentional merging and floating
The host SHALL support body-area merging while preserving deliberate floating.

#### Scenario: Merge through content
- **WHEN** a Pane is dropped in another group's central content area
- **THEN** its existing reference joins that group's tabs

#### Scenario: Bypass magnetic targets
- **WHEN** Alt is held during a Pane drag
- **THEN** the Pane may float without an edge target intercepting the drop
