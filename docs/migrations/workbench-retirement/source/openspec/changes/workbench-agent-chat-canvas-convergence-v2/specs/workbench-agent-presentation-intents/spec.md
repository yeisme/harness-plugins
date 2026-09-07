## MODIFIED Requirements

### Requirement: Follow Pi is temporary, reversible, and presentation-only
Soft Follow SHALL be scoped to the active session grant and enabled by default only after the user explicitly confirms a Session Profile whose soft-follow preference is enabled. The preference MAY be restored with that unexpired grant and MUST remain directly reversible. Automatic effects SHALL be limited to live foreground authorized highlight, compare, bounded preview and Context-rail projection; they MUST NOT auto-apply `request_review`, `prefill_draft`, runtime switch, camera movement, Context attachment, proposal decision or mutation.

#### Scenario: Profile enables Soft Follow
- **WHEN** the user confirms a Session Profile with soft follow enabled and the active visible turn emits an eligible safe-ref intent
- **THEN** the workspace MAY render temporary highlights/previews and update the shared Context rail without moving keyboard focus
- **AND** it SHALL announce the reversible presentation change and expose a Stop following control

#### Scenario: Soft Follow reaches a protected interaction
- **WHEN** an eligible intent arrives while the Composer is dirty, Review/modal is active, the event is replayed, or the target is stale/expired/scope-mismatched
- **THEN** the workspace SHALL keep existing presentation unchanged and render the intent as a suggestion or safe rejection
- **AND** user input, camera, Context, Task, proposal and Owner state SHALL remain unchanged

#### Scenario: Grant is revoked or runtime changes
- **WHEN** the active grant expires, is revoked, or the user switches runtime Profile
- **THEN** automatic following SHALL stop immediately until a new explicit Profile confirmation
- **AND** historical intents SHALL remain suggestion-only

## ADDED Requirements

### Requirement: Presentation intents SHALL correlate to real content attempts
Any presentation or spatial intent rendered from a real answer MUST carry authorized session, turn, attempt, source Block/output, expiry and safe target refs. Replay from an old or superseded attempt MUST NOT auto-apply even when the active session has soft follow enabled.

#### Scenario: Retry produces a new attempt
- **WHEN** a retried turn emits presentation intents after an earlier partial attempt
- **THEN** Workbench SHALL deduplicate and authorize effects using the new attempt identity
- **AND** SHALL NOT replay or merge automatic effects from the old attempt

