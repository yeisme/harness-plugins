## MODIFIED Requirements

### Requirement: Spatial Focus SHALL use the canonical Agent layout state
Legacy Conversation, Split and Spatial Focus ingress SHALL resolve into one session-scoped `AgentWorkbenchLayoutV2`. Spatial Canvas and registered Panes MUST be documents in the same bounded central dock, while Chat/composer and the shared Context rail remain layout anchors. The implementation MUST NOT create a second docking engine, remount the composer, or recreate Task/content/Owner subscriptions when document focus or compatibility view changes.

#### Scenario: Legacy Spatial Focus deep link opens
- **WHEN** `?view=spatial-focus` is opened with an authorized session and Board
- **THEN** the v2 layout SHALL focus the Canvas document while preserving Chat rail, composer draft, Pane documents, pending selection and focus-return state
- **AND** SHALL NOT enter a separate route-owned mode state

#### Scenario: User focuses a registered Pane
- **WHEN** a Review or Evidence Pane becomes the active central document or split companion
- **THEN** it SHALL use the same document dock, visible limit, split depth and registry resolution as Canvas
- **AND** the shared Context rail SHALL update in place without duplicating a business sidebar

### Requirement: Desktop spatial mode SHALL not alter mobile Pane behavior
The v2 Spatial capability MUST NOT mount the full Canvas editor below the desktop threshold. Narrow viewports SHALL still provide the real Chat timeline/composer, pending-selection summary, accessible Canvas object/region list and registered Review/Context Sheets using the existing focus containment and restoration contract.

#### Scenario: Mobile Agent conversation opens a Canvas-linked session
- **WHEN** a user accesses a session with Canvas selection or preview on a narrow viewport
- **THEN** Workbench SHALL render Chat plus a labelled object/review Sheet without Pixi/WebGL/Draft editor mount
- **AND** the user SHALL be able to inspect Context, accept/reject a proposal and return focus to Chat

## ADDED Requirements

### Requirement: Canvas SHALL be a first-class registered document
The central document registry SHALL support a closed Canvas document identity with authorized workspace/project/board/surface refs and Lens parameters. Duplicate Canvas opens SHALL focus the existing document; close/focus/split SHALL affect only layout and MUST NOT cancel queries, delete Board state or alter Context/Task/Proposal state.

#### Scenario: User opens the same Canvas twice
- **WHEN** two actions request the same canonical Canvas document identity
- **THEN** the dock SHALL focus the existing document and preserve camera/selection state
- **AND** SHALL NOT create a duplicate Spatial owner query or document

#### Scenario: Document limit is reached
- **WHEN** adding Canvas or a Pane would exceed the visible/split limit
- **THEN** the dock SHALL return `limit_reached` and offer explicit Close/Replace choices
- **AND** SHALL NOT silently replace Chat, Canvas or another Pane

