# workbench-agent-pane-interfaces Specification

## Purpose
TBD - created by archiving change workbench-agent-pane-direct-interfaces. Update Purpose after archive.
## Requirements
### Requirement: Direct-interface panes SHALL register through the existing versioned pane registry

Workbench SHALL register the pane kinds `agent.assets.v1`、`agent.work-items.v1`、`agent.workflows.v1`、`agent.daily-ops.v1`、`agent.identity.v1`、`agent.gateway.v1`、`agent.cli.v1` and `project.workspace.v1` through the existing versioned Pane registry and closed manifest with closed params, a required read capability, session-scoped singleton document identity and the existing desktop default limit 3, hard limit 4 and split depth 2. Direct-interface panes SHALL NOT load remote code, URL, dynamic component or credential, and SHALL NOT introduce a new backend Operation or execution state machine. Thin transport projections over existing domain services are permitted and governed by the transport-projection requirement below.

#### Scenario: The same pane is opened twice in one session
- **WHEN** a user opens `agent.work-items.v1` with the same `sessionRef` twice
- **THEN** Workbench SHALL focus the existing pane instance and SHALL NOT create a duplicate pane or reset its selection or scroll position

#### Scenario: Unknown params are rejected
- **WHEN** a pane open request carries a param outside the kind's closed params or a value outside the closed `requestedView` enum
- **THEN** resolution SHALL fail closed and no pane SHALL open

### Requirement: Pane availability SHALL be derived from transport truth and real server projections

Direct-interface pane availability SHALL be derived in two honest layers and never from browser guesses. First, a pane whose SDK method has no registered browser transport projection (no HTTP route and no served JSON-RPC namespace) SHALL be fail-closed in the palette as disabled `needs_contract` with a transport reason; enabling such an entry before the projection lands would fabricate availability. Second, panes whose transport projection exists SHALL be gated by real server projections: `agent.identity.v1` by the identity readiness state and `agent.gateway.v1` by the gateway overview capability state, each disabled entry carrying an honest reason key; a data-facing pane without a dedicated readiness projection (for example `agent.workflows.v1`) SHALL be palette-enabled and report loading, empty, unavailable or ready states inside the pane from typed query results with `retry: false`. `agent.cli.v1` SHALL remain a disabled `needs_contract` entry that does not open a pane until the CLI pane contracts registered by `workbench-agent-cli-pane-v1` are ready, per the modified fail-closed requirement in `workbench-agent-pane-composition`.

#### Scenario: The transport projection is not registered
- **WHEN** the palette lists a direct-interface pane kind whose client methods have no browser transport projection (assets and daily ops as of the Phase 2 flip, or any other kind before its transport lands)
- **THEN** the entry SHALL be disabled with the transport needs-contract reason
- **AND** selecting it SHALL NOT open a pane

#### Scenario: The transport projection lands
- **WHEN** a later change registers the browser transport projection for a gated kind
- **THEN** flipping the static transport map SHALL enable the existing palette entry without re-registering the pane kind
- **AND** server-side failures SHALL then surface as in-pane four-state content instead of a disabled palette entry

#### Scenario: Identity readiness is unavailable
- **WHEN** `identity.getReadiness()` reports `unavailable`, `needs_contract` or `contract_mismatch`
- **THEN** the identity palette entry SHALL be disabled with the matching reason
- **AND** selecting it SHALL NOT open a pane

#### Scenario: A data interface fails
- **WHEN** a palette-enabled data pane (for example `agent.workflows.v1`) is open and its query fails or returns no projection
- **THEN** the pane SHALL render the unavailable or empty state with the typed reason
- **AND** SHALL NOT fabricate rows or cache a guessed state

### Requirement: Direct-interface panes SHALL implement the four-state matrix through shared chrome

Every direct-interface pane SHALL render loading, empty, unavailable and ready content through the shared pane state primitives and shared chrome, expose the `data-agent-pane-state` attribute, reuse the existing dock tabs, resize, Sheet fallback and keyboard/a11y behavior, and lead with human-readable labels with technical refs as secondary disclosure.

#### Scenario: The pane renders inside the mobile sheet
- **WHEN** a direct-interface pane is open on a tablet or mobile viewport
- **THEN** it SHALL render through the existing single-pane Sheet fallback without pane-specific chrome or a second dock

### Requirement: Mutations from direct-interface panes SHALL use existing typed clients only

Work item create/update/transition and daily-ops inbox/approval actions from these panes SHALL be submitted only through the existing typed SDK methods that enter TaskService with idempotency and expected-version semantics. Version or idempotency conflicts SHALL surface typed recovery, SHALL preserve the user's selection and draft, and SHALL NOT auto-retry. The identity and gateway panes SHALL be read-only.

#### Scenario: A work item transition conflicts
- **WHEN** a kanban move or todo completion submits `transitionWorkItem` with a stale expected version
- **THEN** the pane SHALL show the typed conflict hint, keep the current selection and local view state
- **AND** SHALL NOT silently retry or mutate the work item again without the user's action

### Requirement: The pane palette SHALL group direct-interface panes with bilingual copy

The palette SHALL expose the new `workspace` group alongside the existing groups as a closed flat list, assign each new pane kind to one group, and provide every new title, description, group label and disabled reason in both zh-CN and en-US locale sources without relying on inline production fallbacks.

#### Scenario: A user browses the palette
- **WHEN** the palette renders with zh-CN and en-US locales
- **THEN** all new entries and their groups and disabled reasons SHALL be localized
- **AND** disabled entries SHALL remain visible with their reasons instead of being hidden

### Requirement: Direct-interface panes SHALL share query cache semantics with workspace panes

Agent-shell direct panes SHALL use query keys consistent with the existing workspace panes for the same domain so both surfaces converge on one cache, SHALL scope keys by tenant/workspace, and SHALL clear derived cache on tenant switch. Server truth SHALL live only in the query cache; panes SHALL NOT mirror canonical records into durable browser storage.

#### Scenario: A work item event arrives while two surfaces are open
- **WHEN** a `watchWorkItemEvents` event invalidates the shared work item queries
- **THEN** the agent work-items pane and the project first views SHALL converge on the refreshed projection within one event cycle
- **AND** neither surface SHALL keep a stale local copy of the changed record

### Requirement: Project first views SHALL run on existing work item interfaces as a pre-slice

`project.workspace.v1` SHALL provide table, kanban and todo views over the existing work item list, mutation and event interfaces: server-paginated table with row selection, status-grouped kanban with typed transitions and keyboard or menu moves, and due-date sectioned todo with server-authored completion. Blocked or acceptance-gated work items SHALL show why they cannot be completed locally. Canvas, automation, custom field schema, saved views and batch mutation SHALL remain in `workbench-project-data-workspaces-v1` and SHALL NOT be fabricated by the pre-slice.

#### Scenario: A blocked todo item
- **WHEN** a work item with unresolved blockers is displayed in the todo view
- **THEN** its completion control SHALL be disabled with the honest reason
- **AND** no local completion state SHALL be recorded in the browser

#### Scenario: Views switch without refetch storms
- **WHEN** the user switches between table, kanban and todo
- **THEN** the views SHALL reuse the shared query cache and one event stream
- **AND** SHALL NOT duplicate subscriptions or resubmit mutations

### Requirement: Transport projections SHALL expose existing domain services without duplicating rules

When a direct-interface pane's SDK method lacks a browser transport projection, Workbench MAY deliver that projection as a thin wire layer over the existing domain service. The wire layer SHALL NOT duplicate business rules: scope validation, authorization, version CAS and acceptance gates remain in the domain service, and mutations SHALL require an idempotency key with replay results marked `replayed` and crash-safe fallback to the version-conflict guard. Wire views SHALL match the SDK normalizer field-for-field and SHALL NOT fabricate fields the domain does not own.

#### Scenario: A work item transition is replayed with the same idempotency key
- **WHEN** the same transition request with the same `Idempotency-Key` is submitted again within the replay window
- **THEN** the response SHALL return the first mutation result with `replayed=true`
- **AND** the work item SHALL NOT be transitioned a second time

#### Scenario: The replay cache is lost after a restart
- **WHEN** a replay arrives after the process-local cache is gone
- **THEN** the stale expected-version guard SHALL return `version_conflict`
- **AND** the mutation SHALL NOT be silently duplicated

#### Scenario: A field outside the update field mask
- **WHEN** an update payload carries fields not listed in its `fieldMask`
- **THEN** those fields SHALL NOT be applied
- **AND** the response SHALL reflect the unchanged values

#### Scenario: The wire omits fields the domain cannot truthfully provide
- **WHEN** a domain relation lacks a timestamp the SDK contract requires (for example work item blockers)
- **THEN** the wire view SHALL omit the relation instead of fabricating a timestamp

