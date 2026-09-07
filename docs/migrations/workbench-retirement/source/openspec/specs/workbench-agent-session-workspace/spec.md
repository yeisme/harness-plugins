# workbench-agent-session-workspace Specification

## Purpose
TBD - created by archiving change workbench-agent-pi-workspace-v1. Update Purpose after archive.
## Requirements
### Requirement: Unified Agent-first Pane workspace
The Workbench SHALL expose one conversation-first Agent workspace with one compact product rail, one session rail, one conversation timeline, one session-scoped composer, and one bounded plugin Pane dock. The workspace SHALL reuse the existing Agent Task/event transport and SHALL NOT run a second chat, spatial, plugin, or tool execution control plane.

#### Scenario: Agent route renders the unified shell
- **WHEN** the `pi-workspace-v1` capability is enabled for the current server-authorized cohort
- **THEN** `/agent` renders one product rail, one session rail, one timeline, one composer, and one registered Pane dock backed by the existing Agent client
- **AND** Operations Orbit, Context Canvas, Inspector, Activity, review, and evidence surfaces are available only as registered Pane content, explicit advanced routes, or approved Owner deep links

#### Scenario: Capability is disabled
- **WHEN** the `pi-workspace-v1` capability is absent or disabled
- **THEN** the route uses the existing conversation workspace fallback
- **AND** disabling the capability does not alter or delete Task, event, receipt, session projection, or presentation records

### Requirement: Plugin Pane layout is bounded and session-scoped
The desktop workspace SHALL support one to three visible registered Panes by default, with a hard maximum of four visible Panes and a maximum split depth of two. Pane layout SHALL remain browser-local and session-scoped unless a later approved contract explicitly defines safe cross-device presentation metadata.

#### Scenario: User opens panes within the default limit
- **WHEN** the user opens distinct authorized Context, Run, and Evidence Panes in one desktop session
- **THEN** the Pane dock keeps all three visible without replacing the conversation, draft, timeline position, selected Task, or event subscription
- **AND** switching sessions restores the other session's independent browser-local Pane layout

#### Scenario: User reaches the visible pane limit
- **WHEN** opening another Pane would exceed the configured visible limit or split-depth limit
- **THEN** the layout action returns a typed `limit_reached` result and presents explicit Close or Replace choices
- **AND** it does not silently close, replace, persist, or mutate an existing Pane or authoritative Agent state

#### Scenario: User opens an already visible pane
- **WHEN** the requested closed Pane document is already visible in the selected session
- **THEN** the existing Pane receives visual focus and no duplicate Pane instance is created
- **AND** keyboard focus moves only after a direct user action, not merely because an Agent presentation intent arrived

#### Scenario: User closes a pane
- **WHEN** the user closes a visible Pane
- **THEN** focus returns to the real trigger or nearest visible Pane and the browser removes only that layout entry
- **AND** no Task, proposal, receipt, Context Pack, Owner state, timeline event, or draft is changed

#### Scenario: Tablet or mobile opens a pane
- **WHEN** the viewport is below the desktop Pane-dock breakpoint
- **THEN** registered Pane content is presented as one labelled Sheet/Dialog at a time with focus containment, Escape close, scroll lock, and focus restoration
- **AND** the hidden desktop layout state is not discarded or represented as authoritative server state

### Requirement: Session workspace summary is a rebuildable projection
The service SHALL project `AgentSessionWorkspaceSummaryV1` from persisted Agent turn Tasks and safe event/proposal/receipt indexes. The projection SHALL NOT become a canonical session lifecycle, execute an operation, or override Task or Owner state, and it SHALL be rebuildable from canonical records.

#### Scenario: First accepted turn materializes a session
- **WHEN** the server accepts the first Agent turn Task for a new `sessionRef`
- **THEN** the session projector creates or updates the corresponding workspace summary
- **AND** the summary contains only bounded safe fields, counts, refs, revisions, timestamps, attention, and activity cursor data

#### Scenario: Empty local draft is not a server session
- **WHEN** a user starts a new conversation but has not submitted an accepted turn Task
- **THEN** the draft remains browser-local
- **AND** the service does not list a canonical or empty session record and does not accept presentation metadata for it

#### Scenario: Projection is rebuilt
- **WHEN** the projection store is empty or its high-water mark is behind canonical Task/event records
- **THEN** the projector can rebuild the same safe session summaries without changing Tasks, attempts, receipts, proposals, or Owner state
- **AND** projection lag is exposed as degraded freshness rather than hidden as current truth

### Requirement: User-scoped session presentation metadata
The service SHALL store session title override, pinned, archived, and last-seen activity cursor as `AgentSessionPresentationV1` scoped to the server-resolved principal, tenant, workspace, and authorized `sessionRef`. Presentation metadata SHALL NOT contain Agent phase, Task state, Owner state, raw chat content, or execution authority.

#### Scenario: Rename or pin succeeds with concurrency control
- **WHEN** an authorized user updates a session title or pinned state with a valid field mask, expected presentation revision, and idempotency key
- **THEN** the service stores the update for the server-resolved principal and returns the incremented revision
- **AND** repeating the same idempotency key and payload returns the original result without a duplicate write

#### Scenario: Conflicting presentation update
- **WHEN** an update carries a stale expected revision or reuses an idempotency key with a different payload digest
- **THEN** the service returns a typed conflict with the current safe presentation revision
- **AND** the client does not overwrite the newer state automatically

#### Scenario: Browser supplies an actor identity
- **WHEN** a presentation request contains an actor/principal identity that is not resolved by the authenticated server context
- **THEN** the service ignores or rejects that identity and does not write metadata under another user

#### Scenario: Unsafe title is submitted
- **WHEN** a title override exceeds the bounded length or contains forbidden control, sentinel, credential-like, private-path, or unsafe payload content
- **THEN** the service rejects it with a safe validation reason
- **AND** the rejected value is not persisted, logged, streamed, or echoed in evidence

### Requirement: Archive does not conceal active or unresolved work
Archiving SHALL only change the current user's default directory visibility. It SHALL NOT delete, cancel, pause, retry, settle, or hide canonical Task/evidence state, and the service SHALL reject archive while the session has an active Task, pending review, or unresolved `unknown_accept` attention.

#### Scenario: Settled session is archived
- **WHEN** a user archives a session with no active Task, pending review, or unknown outcome
- **THEN** the session is omitted from the default active directory for that user
- **AND** it remains queryable in the archived filter with its safe summary, attention history, turns, and evidence refs intact

#### Scenario: Active session archive is attempted
- **WHEN** a user attempts to archive a session whose derived attention is `running`, `waiting_review`, or `unknown_accept`
- **THEN** the service rejects the archive with a truthful reason and next action
- **AND** the Task continues unchanged

### Requirement: Server-authored attention and unread semantics
The service SHALL derive session attention from safe Task/gate/proposal/receipt state and SHALL compute unread from a server-issued session activity cursor and the current principal's acknowledged cursor. The browser SHALL NOT derive attention or unread from timestamps, colors, local selection, or guessed Task text.

#### Scenario: Background proposal raises attention
- **WHEN** a background session receives a proposal requiring review
- **THEN** its projection advances the activity cursor, sets `waiting_review` according to the normative attention precedence, and marks it unread for principals whose acknowledged cursor is older

#### Scenario: Unknown accept has highest priority
- **WHEN** any unresolved Task in a session enters `unknown_accept`
- **THEN** the session attention state is `unknown_accept` even if another Task is running, failed, or waiting for review
- **AND** the directory exposes reconcile as the next safe action without suggesting retry or cancellation

#### Scenario: Merely selecting a session
- **WHEN** a user selects or lists a session but the latest timeline cursor has not been loaded and visible in the foreground
- **THEN** the service and client keep the session unread

#### Scenario: Read acknowledgement races with new activity
- **WHEN** the client acknowledges `seenThroughCursor` and a newer session activity cursor already exists or arrives later
- **THEN** only activity through the acknowledged cursor is marked read
- **AND** the newer activity remains unread

### Requirement: Background sessions continue independently
Switching or creating a browser-local new session SHALL NOT cancel, pause, retry, or mutate a Task in another session. Affected-session controls SHALL enforce Task truth while allowing the user to navigate and work in other sessions.

#### Scenario: Switch away from a running turn
- **WHEN** the current session has a running turn and the user selects another session
- **THEN** the running Task continues on the server
- **AND** the workspace stops or parks only the selected-detail subscription, retains directory attention, and restores the turn from its durable cursor when revisited

#### Scenario: Switch away from unknown accept
- **WHEN** one session contains `unknown_accept` and the user opens another session
- **THEN** the affected session remains visibly marked and reconcile-only
- **AND** other sessions may submit their own authorized turns subject to normal runtime and gate constraints

#### Scenario: Duplicate send in the same session
- **WHEN** the selected session already has a submit request in flight or a same-session concurrency rule forbids another turn
- **THEN** the composer prevents a duplicate authoritative submission and explains the reason
- **AND** session switching remains available

### Requirement: One bounded session directory stream
The browser SHALL use at most one workspace-scoped session-directory stream plus the selected turn's detail stream. It SHALL NOT open one live connection per session, and disconnected or stale stream state SHALL be displayed truthfully.

#### Scenario: Background session updates over the directory stream
- **WHEN** a non-selected session advances to a gate, proposal, terminal, partial, failed, or unknown state
- **THEN** the directory stream emits a bounded safe update with resumable cursor semantics
- **AND** the client updates the rail without opening a turn-event stream for that session

#### Scenario: Directory stream disconnects
- **WHEN** the directory stream cannot resume immediately
- **THEN** the workspace shows the last-confirmed time and degraded/offline state and performs only bounded refresh attempts
- **AND** it does not claim that session attention or unread is real-time

### Requirement: Session directory supports bounded organization
The session directory SHALL support server-side cursor pagination, bounded search over safe session title/summary fields, and active, pinned, unread, and archived filters. The implementation SHALL avoid per-row Task/event/presentation queries.

#### Scenario: User opens the archived filter
- **WHEN** the current principal requests archived sessions
- **THEN** the client sends the explicit `archivedOnly` directory predicate and the server applies it before cursor pagination
- **AND** active sessions cannot consume or hide rows in an archived-only page

#### Scenario: User searches sessions
- **WHEN** the user enters a search term
- **THEN** the client sends a debounced bounded query over authorized safe title/summary projections
- **AND** no raw prompt, provider output, tool arguments, or Owner payload is searched or returned

#### Scenario: Large session directory page
- **WHEN** a page of up to the documented maximum size is requested
- **THEN** the service returns a stable cursor-ordered page with merged summary and current-principal presentation data
- **AND** verification shows no N+1 query pattern for the page

### Requirement: Context Pack remains explicit and immutable per turn
The workspace SHALL attach only a server-authorized `AgentContextPackV1` revision to a turn. Session selection, previous use, presentation intent, hover, focus, or background refresh SHALL NOT silently prepare, refresh, attach, or replace Context Pack state.

#### Scenario: User reuses the last context reference
- **WHEN** a session summary exposes a prior `contextPackRef` and the user chooses to reuse it
- **THEN** the service reauthorizes and refreshes or validates the pack explicitly before submission
- **AND** the UI shows the resulting revision, freshness, and any blocking reason

#### Scenario: Context Pack expires while viewing a session
- **WHEN** the current Context Pack becomes stale or expires
- **THEN** context-dependent submit and proposal acceptance are disabled with Refresh or Detach as explicit recovery
- **AND** the workspace does not substitute a newer selection or revision automatically

### Requirement: Timeline and composer preserve authoritative truth
The workspace SHALL group safe progress and output by accepted turn Task, deduplicate events by Task and sequence, and distinguish browser-local draft/submitting affordances from server-accepted turns. It SHALL NOT optimistically claim submitted, accepted, succeeded, cancelled, reconciled, read, or evidenced states.

#### Scenario: Turn submit outcome is not yet known
- **WHEN** a user submits a draft and the service has not returned an accepted Task identity or an idempotent replay result
- **THEN** the UI may show a clearly non-authoritative submitting affordance while retaining the same idempotency key
- **AND** it does not add a committed timeline turn or discard the draft as confirmed

#### Scenario: Cancel is requested
- **WHEN** the user requests Stop for a running turn
- **THEN** the UI shows `cancel_requested` or equivalent pending language
- **AND** it does not display `cancelled` until the server confirms the terminal state

#### Scenario: Event stream resumes
- **WHEN** the selected turn stream reconnects with `Last-Event-ID` or `afterSequence`
- **THEN** already applied task/sequence events are not duplicated
- **AND** safe findings, questions, proposals, handoffs, and receipts retain their source Task and context refs

### Requirement: Plugin Panes resolve through one versioned registry
Every Agent plugin Pane SHALL resolve through the approved Workbench versioned Pane registry and closed Pane plugin catalog using a closed pane type/version and closed safe parameters. Unknown pane types, versions, requested views, cross-scope refs, arbitrary props, URLs, selectors, dynamic imports, or mock-only facades SHALL fail closed.

#### Scenario: Registered Review pane opens
- **WHEN** the user opens `agent.review.v1` with an authorized output/proposal/task ref
- **THEN** the registry renders the registered Review pane using the same ActionDescriptor status and recovery presentation as other Workbench action surfaces
- **AND** opening it preserves the timeline position, composer draft, and selected Task subscription

#### Scenario: Multiple registered panes are visible
- **WHEN** the desktop layout contains several authorized registered Pane documents
- **THEN** every Pane is resolved independently through the same registry/catalog version and receives only its closed safe parameters
- **AND** no Pane can load a sibling's private state, bypass capability checks, or create a second registry/control plane

#### Scenario: Unsupported pane target is requested
- **WHEN** a pane request contains an unknown type/version, arbitrary prop map, URL, selector, unsafe ref, or cross-workspace target
- **THEN** the registry refuses to render or load it and returns a bounded safe unavailable reason
- **AND** no dynamic component, Owner fetch, authorization, or navigation occurs

#### Scenario: Operations pane lacks a real facade
- **WHEN** `agent.operations.v1` is opened without an approved typed Operations facade
- **THEN** the pane renders a truthful unavailable/needs-contract state
- **AND** production code does not fall back to mock data

### Requirement: Responsive and accessible workspace behavior
The workspace SHALL remain operable at desktop, tablet, mobile, keyboard-only, 200% zoom, and reduced-motion settings. It SHALL preserve semantic landmarks, focus restoration, text alternatives, and minimum touch targets.

#### Scenario: Tablet or mobile opens a pane
- **WHEN** a user opens the session rail or plugin Pane below the desktop breakpoint
- **THEN** the surface uses a labelled Sheet/Dialog with focus containment, Escape close, scroll lock, and focus restoration
- **AND** opening one overlay closes the conflicting overlay without losing session draft or timeline state

#### Scenario: Desktop pane is visible
- **WHEN** one or more plugin Panes are visible in a desktop layout
- **THEN** it uses complementary, non-modal semantics and does not trap keyboard focus
- **AND** the conversation keeps a readable minimum width

#### Scenario: Reduced motion and 200 percent zoom
- **WHEN** reduced motion or 200% zoom is active
- **THEN** state transitions remain understandable without transform-based motion and without page-level horizontal scrolling
- **AND** wide Operations content scrolls internally or becomes labelled record lists

### Requirement: Agent workspace persists only safe data
The session projection, presentation metadata, stream payloads, logs, tests, and evidence SHALL contain only approved safe summaries, opaque refs, digests, revisions, reason codes, timestamps, and state projections. Raw prompts, complete model responses, chain-of-thought, provider payloads, tool raw arguments, credentials, private paths, signed URLs, and artifact blobs SHALL NOT be persisted or exposed.

#### Scenario: Sensitive sentinel reaches an Agent payload
- **WHEN** a session summary, title, event, presentation update, pane target, or evidence payload contains a configured sensitive sentinel or forbidden field
- **THEN** validation/redaction fails closed before persistence or projection
- **AND** contract and integration evidence confirms the value is absent from database rows, logs, SSE, receipts, screenshots, and evidence bundles

#### Scenario: Hover or focus previews a session
- **WHEN** a user hovers or keyboard-focuses a session row
- **THEN** the UI may show only already-loaded safe labels and state summaries
- **AND** it does not fetch Owner data, authorize a Context Pack, resolve a paid action, or expose hidden history

