# workbench-auctra-screenplay-room Specification

## Purpose
TBD - created by archiving change workbench-auctra-screenplay-room-v1. Update Purpose after archive.
## Requirements
### Requirement: Screenplay Room SHALL be a Creative Production Spatial surface

Workbench SHALL expose Screenplay Room as a closed professional surface inside `/agent` Spatial Focus and Creative Production. It MUST retain the Agent conversation/composer, TaskService, ProposalAuthority and one shared context rail, and MUST NOT create a parallel `/screenplay` shell or iframe an Auctra page.

#### Scenario: User opens the approved Screenplay Room

- **WHEN** ingress, Auctra capability and project scope are valid
- **THEN** the central Spatial renderer SHALL show the Screenplay Room surface
- **AND** the current Agent session, composer draft and registered Pane state SHALL remain mounted or recoverable.

#### Scenario: Auctra contract is unavailable

- **WHEN** the capability is `needs_contract`, offline or contract-mismatched
- **THEN** the surface SHALL preserve its frame and show one truthful recovery action
- **AND** it MUST NOT render fixture data as live or probe private Auctra state.

### Requirement: The main canvas SHALL use synchronized narrative and story-time tracks

The upper track SHALL represent Auctra screenplay order and the lower track SHALL represent Auctra story-time anchors/relations. Both SHALL share selection, viewport and semantic zoom, but moving one track MUST NOT mutate the other.

#### Scenario: User reorders a Scene

- **WHEN** the user moves a Scene in the narrative track and the owner confirms the structure receipt
- **THEN** the narrative order SHALL update to the returned revision
- **AND** the story-time anchor SHALL remain unchanged.

#### Scenario: User changes story time

- **WHEN** the user edits a time anchor or before/after relation
- **THEN** only the story-time owner action SHALL be submitted
- **AND** the Scene hierarchy and screenplay order SHALL remain unchanged.

### Requirement: The timeline SHALL provide four semantic detail levels

The surface SHALL provide project/season-or-feature, episode-or-act/sequence, Scene and Beat detail levels. Semantic zoom MUST change rendered information density rather than merely scaling the same card. The selected Scene and viewport SHALL remain stable across level changes when possible.

#### Scenario: User zooms from feature overview to one Scene

- **WHEN** zoom crosses the configured semantic thresholds
- **THEN** aggregate act/sequence summaries SHALL progressively reveal Scene cards and the selected Scene's Beat track
- **AND** hidden detail SHALL remain accessible through selection/Inspector without changing owner state.

### Requirement: Scene cards SHALL be compact, truthful and media-bounded

Scene cards SHALL show title/order, function, primary character/location, story-time label, state delta, review/freshness, blocker count and optional authorized thumbnail. Full contract, evidence and technical refs MUST be placed in the context rail. Missing media MUST use typography/initial/semantic icon rather than a fabricated portrait.

#### Scenario: A Scene has accepted media

- **WHEN** Auctra marks an owned accepted image as card-eligible
- **THEN** Workbench SHALL show a bounded thumbnail without obscuring title/status
- **AND** the card SHALL still expose icon/text status for non-visual and assistive users.

#### Scenario: A Scene has only candidate or no media

- **WHEN** no accepted card image exists
- **THEN** candidate media SHALL remain labelled in detail or assets context and the card SHALL use a deterministic fallback
- **AND** Workbench MUST NOT promote the candidate or generate a placeholder image.

### Requirement: Structure editing SHALL wait for owner receipts

Drag/drop and non-drag move controls SHALL create local preview only until TaskService receives an Auctra receipt. The UI MUST use expected revision and idempotency, and MUST handle version conflict, unknown acceptance, offline, permission and failure without optimistic success.

#### Scenario: A drag succeeds

- **WHEN** pointer-up submits a current Auctra structure action and a terminal receipt returns
- **THEN** the ghost placement SHALL become confirmed and the room SHALL refetch the returned revision
- **AND** the UI SHALL not infer confirmation from pointer-up, HTTP dispatch or Task creation alone.

#### Scenario: A drag conflicts

- **WHEN** Auctra returns `version_conflict`
- **THEN** Workbench SHALL preserve a safe summary of the local intent and offer compare/refetch
- **AND** it MUST NOT silently rebase or resubmit the move.

#### Scenario: Acceptance is unknown

- **WHEN** dispatch may have reached Auctra but no terminal result is available
- **THEN** the Task/room SHALL enter reconcile-only state using the original identity
- **AND** no new idempotency key or duplicate mutation MAY be created.

### Requirement: Scene Card and screenplay body SHALL keep separate draft lifecycles

The Scene Inspector SHALL edit the Auctra Scene Card draft with its own revision. Focus writing SHALL open one Scene body through Auctra text draft operations, retain a compact timeline strip and preserve a separate body version/dirty state. Submitting either draft MUST follow its corresponding owner review path.

#### Scenario: User saves a Scene Card

- **WHEN** current structured fields are saved
- **THEN** Workbench SHALL display the new Scene Card draft revision from Auctra
- **AND** the body draft and Canon SHALL not be changed.

#### Scenario: User writes one Scene

- **WHEN** focus mode opens the Scene text draft
- **THEN** the editor SHALL load/save with expected body version and keep timeline orientation
- **AND** closing focus mode with unsaved text SHALL warn and preserve the browser buffer without claiming durable save.

#### Scenario: User submits for review

- **WHEN** the user explicitly submits the current Scene Card or body draft
- **THEN** Workbench SHALL show the Auctra pending review ref/receipt
- **AND** it MUST NOT display accepted Canon before an owner review decision.

### Requirement: Context Graph SHALL be fully reachable through progressive focus

Selecting a Scene SHALL request direct authoring constraints first and SHALL allow bounded expansion/search across all authorized graph domains. Graph selection SHALL highlight Scene occurrences and update the shared context rail, but MUST NOT reorder structure, change story time, attach composer context or create a Task automatically.

#### Scenario: User inspects Scene context

- **WHEN** a Scene is selected
- **THEN** direct people, locations, knowledge, obligations, setup/payoff and state changes SHALL appear first
- **AND** the UI SHALL clearly expose how to expand domains, hops or the full graph.

#### Scenario: User selects a graph node

- **WHEN** a character, location or obligation is selected
- **THEN** all currently loaded matching Scene occurrences SHALL be highlighted in the timeline
- **AND** adding the ref to Agent context SHALL require an explicit action.

### Requirement: Agent screenplay changes SHALL remain proposal-first

Agent output MAY present a validated screenplay change-set preview, but any durable structure, story-time, Scene Card or body action MUST pass ProposalAuthority and TaskService with current owner descriptor, basis and revision. Presentation-only intents MUST NOT mutate or focus-steal.

#### Scenario: Agent suggests moving three Scenes

- **WHEN** a valid preview change set is received
- **THEN** Workbench SHALL show ghost positions and an impact summary
- **AND** Auctra SHALL not be called until the user explicitly accepts the current proposal.

### Requirement: Screenplay Room SHALL use the unified visual and icon system

The surface SHALL use shared Workbench tokens, surface/status/empty/recovery components, Chinese-first locale sources, secondary mono technical metadata and the controlled icon registry. Status MUST use icon/text in addition to color. No server value MAY select arbitrary component, SVG path, HTML or URL.

#### Scenario: A new screenplay semantic icon is needed

- **WHEN** Scene, Beat, time conflict or obligation needs an icon
- **THEN** a stable local icon token SHALL be added to the controlled registry and both locales/guidance updated
- **AND** feature components SHALL not import an ad-hoc business icon directly.

### Requirement: Mobile SHALL support review without mounting the full editor

At widths below 1024px and at 200% effective width, Workbench SHALL provide searchable Scene order, story-time summary, Scene detail, review/approve and owner status in accessible list/Sheet form. It MUST NOT mount the full drag timeline or focus text editor.

#### Scenario: User opens Screenplay Room on mobile

- **WHEN** the viewport is 390×844
- **THEN** the user SHALL be able to inspect Scenes, blockers, graph summaries and pending reviews
- **AND** creation/reorder/body editing SHALL be disabled with a truthful desktop requirement rather than hidden failure.

### Requirement: Provider/consumer/browser evidence SHALL gate availability

Auctra room capabilities SHALL remain `needs_contract` until provider contract tests, Workbench connector/SDK tests, real loopback read/mutation/reconcile evidence and browser acceptance pass. Each integration/e2e run MUST write the standard redacted evidence directory in the owning subproject.

#### Scenario: Fixture UI passes but live owner proof is absent

- **WHEN** component and Playwright tests pass only against deterministic fixture data
- **THEN** the feature MAY remain a UI canary but owner capability MUST stay `needs_contract`
- **AND** documentation MUST NOT call it live, mature or production-ready.

