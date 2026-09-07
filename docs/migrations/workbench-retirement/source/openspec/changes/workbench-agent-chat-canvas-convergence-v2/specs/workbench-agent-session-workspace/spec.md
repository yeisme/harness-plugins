## MODIFIED Requirements

### Requirement: Unified Agent-first Pane workspace
The Workbench SHALL expose one adaptive Agent workspace with one compact product rail, one optional Session drawer, one persistent Chat rail with timeline/composer, one central document dock containing Spatial Canvas and registered Pane documents, and one shared Context rail. The workspace SHALL reuse the existing Agent Task/event transport plus the approved Conversation Runtime content facade and SHALL NOT run a second chat, spatial, plugin or tool execution control plane.

#### Scenario: Agent route renders the v2 shell
- **WHEN** the `agent-chat-canvas-v2` capability is enabled for the current server-authorized cohort
- **THEN** `/agent` renders Chat on the left, the active Canvas/Pane document in the center and Detail/Inspector/Review/Evidence on the right according to viewport constraints
- **AND** Session navigation uses a drawer that MAY be pinned without changing session, draft, document or event ownership

#### Scenario: Capability is disabled
- **WHEN** the v2 capability is absent, incompatible or disabled
- **THEN** the route uses the existing v1 conversation/workspace fallback
- **AND** disabling the capability does not alter or delete Task, event, receipt, Context Pack, Pane layout or Conversation Runtime content

### Requirement: Agent workspace persists only safe data
Workbench control-plane persistence, session summaries, presentation metadata, lifecycle streams, logs, tests and evidence SHALL contain only approved safe summaries, opaque refs, digests, revisions, reason codes, timestamps and state projections. User-visible message正文 and assistant Blocks MAY be persisted only by the independent Conversation Runtime encrypted content owner and projected through the typed content facade. Raw provider payloads, hidden system prompts, chain-of-thought, tool raw arguments, credentials, private paths, signed URLs and artifact blobs MUST NOT be persisted or exposed by Workbench.

#### Scenario: Sensitive sentinel reaches a control payload
- **WHEN** a session summary, title, lifecycle event, presentation update, pane target or evidence payload contains a configured sensitive sentinel or forbidden field
- **THEN** Workbench validation/redaction SHALL fail closed before persistence or projection
- **AND** contract and integration evidence SHALL confirm the value is absent from Workbench database rows, logs, Task SSE, receipts, screenshots and evidence bundles

#### Scenario: Safe content Blocks are displayed
- **WHEN** Conversation Runtime returns authorized structured Blocks for the selected session
- **THEN** Workbench MAY render the user-visible content from the typed content facade
- **AND** SHALL NOT copy that content into Task/session-summary persistence, search indexes, logs or evidence

#### Scenario: Hover or focus previews a session
- **WHEN** a user hovers or keyboard-focuses a session row
- **THEN** the UI MAY show only already-loaded safe labels, attention and content-availability summaries
- **AND** SHALL NOT fetch message正文, Owner data, authorize a Context Pack, resolve a paid action or expose hidden history

### Requirement: Agent workspace SHALL render Agent Framework and Aigora Access states separately
For an Aigora-backed session, the workspace SHALL render distinct source-labelled Agent Framework and Aigora Access cards. Each SHALL distinguish `loading`, `disabled`, `pending`, `active`, `stale`, `degraded`, `forbidden`, `unknown`, `blocked` and `recovery` for its own capabilities. The workspace MUST NOT synthesize a global ready state and MUST preserve independently confirmed content, Task and source facts when one source degrades.

#### Scenario: MCP bridge degrades during a conversation
- **WHEN** model chat remains eligible but the fixed MCP bridge becomes unavailable
- **THEN** Workbench SHALL keep confirmed content and model readiness visible while marking only MCP degraded
- **AND** it SHALL not clear the session, recreate the turn or present a combined offline state

#### Scenario: Grant acceptance is unknown
- **WHEN** Aigora cannot confirm grant replacement or dispatch acceptance
- **THEN** the workspace SHALL expose original-operation reconcile and disable retry/profile/protocol switching as required
- **AND** it SHALL not auto-submit a second model, tool or grant operation

#### Scenario: Agent Framework is blocked while Aigora Access is active
- **WHEN** ACP/Pi/OMP qualification is blocked but the Aigora local access binding is healthy
- **THEN** the Agent Framework card SHALL show the block and the Aigora Access card SHALL retain its active facts
- **AND** Workbench SHALL not claim the session can run or claim Aigora is degraded

### Requirement: Aigora-backed workspace SHALL meet two-source accessibility and viewport gates
The Aigora profile/readiness/deep-link experience SHALL have complete zh-CN and en-US copy, keyboard/focus/live-region behavior and responsive layouts for 360, 768, 1280 and 1536 pixel viewports. A2A controls MUST remain absent until a compatible A2A capability exists.

#### Scenario: Mobile user reviews an Aigora session
- **WHEN** the workspace renders at 360 or 768 pixels
- **THEN** grant/model/MCP status and recovery actions SHALL remain reachable without horizontal overflow
- **AND** focus SHALL return predictably after a Sheet or approval dialog closes

#### Scenario: A2A capability is absent
- **WHEN** the server descriptor contains no implemented A2A capability
- **THEN** Workbench SHALL omit actionable A2A controls
- **AND** it SHALL not display an empty Agent Directory or misleading readiness state

## ADDED Requirements

### Requirement: Selected-session supervision SHALL merge content and lifecycle with independent cursors
The Browser SHALL use at most one workspace directory stream and one selected-session stream that merges Conversation Runtime content events with Task/proposal/receipt lifecycle events. The projection MUST retain separate content and lifecycle cursor, freshness and error state and MUST deduplicate by turn/attempt/sequence.

#### Scenario: Selected session reconnects
- **WHEN** the Browser reconnects with last-confirmed content and lifecycle cursors
- **THEN** the BFF SHALL resume or bounded-refetch each source independently and emit a correlated projection
- **AND** SHALL NOT open one stream per message, attempt, proposal or Pane

#### Scenario: Session changes while a turn runs
- **WHEN** the user switches to another session
- **THEN** the old Task/runtime attempt SHALL continue under its owners while only the selected-session stream changes
- **AND** directory attention SHALL preserve partial, review, failed and unknown states
