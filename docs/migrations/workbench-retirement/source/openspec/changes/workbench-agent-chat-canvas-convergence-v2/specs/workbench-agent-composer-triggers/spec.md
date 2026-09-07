## ADDED Requirements

### Requirement: Composer SHALL expose a pending Canvas selection tray
Canvas and approved artifact selections SHALL enter a bounded pending tray above the Composer with safe label, type, freshness and remove/attach actions. The tray MUST be per-session and per-draft, deduplicated by canonical ref/revision, and MUST NOT silently prepare Context, insert text or submit a turn.

#### Scenario: Canvas selection enters the tray
- **WHEN** a user selects an authorized Canvas object
- **THEN** the tray SHALL show it as pending and provide “用于本次提问” and Remove actions
- **AND** the textarea value and existing attached Context Pack SHALL remain unchanged

#### Scenario: Confirmed turn is submitted
- **WHEN** the Task is authoritatively accepted with the attached Context Pack/artifact refs
- **THEN** the per-draft pending and attached chips SHALL clear for the next draft
- **AND** the prior turn SHALL retain only its safe Context/artifact references

### Requirement: Safe artifact refs SHALL use owner-authorized attachment
The Composer MAY attach only artifact refs returned by an approved owner facade with exact scope/revision and supported preview/use semantics. Workbench MUST NOT accept arbitrary local paths, URLs, signed URLs, raw bytes or provider payload as artifact attachment fields in this capability.

#### Scenario: User attaches an approved artifact
- **WHEN** an owner facade returns an authorized artifact ref and revision
- **THEN** the Composer SHALL add it to the pending/attached flow and the turn intent SHALL reference the safe ref
- **AND** the owner SHALL remain responsible for content access and authorization

#### Scenario: Artifact grant is stale
- **WHEN** the artifact ref is expired, revoked or revision-mismatched before sealing
- **THEN** attachment SHALL be blocked with Refresh or Remove
- **AND** Workbench SHALL NOT fetch raw bytes or silently replace the artifact

