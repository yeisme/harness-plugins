## ADDED Requirements

### Requirement: Project Workspace MUST remain composition metadata over an approved project

The system MUST create `ProjectWorkspace` only for a server-authorized tenant/workspace/project safe ref. A ProjectWorkspace MUST own dataset, schema, view, role-policy, automation-binding, layout and audit metadata, and MUST NOT create, rename, delete or copy canonical Owner project state.

#### Scenario: Project contract is unavailable
- **WHEN** the selected project safe ref is stale, unauthorized, tombstoned or lacks a promoted consumer contract
- **THEN** the Project Workspace Pane MUST show `stale`, `permission_required`, tombstone or `needs_contract` as appropriate
- **AND** the system MUST NOT create a local fallback project or call an arbitrary Owner endpoint

### Requirement: Project Dataset MUST use WorkItem as its first canonical record kind

Each v1 ProjectDataset MUST declare `work_item` as its record kind, and Table, Kanban, Todo and Canvas views MUST read and mutate the same WorkItem records through WorkItemService. Project views MUST NOT persist independent task status, assignee, due date, dependency or acceptance state.

#### Scenario: A WorkItem changes in Table view
- **WHEN** an authorized user updates a WorkItem through the Table view and the committed event is observed
- **THEN** Kanban, Todo and Canvas projections MUST converge to the same WorkItem version
- **AND** none of those views may require a second task mutation or maintain a conflicting local record

### Requirement: Project field schemas MUST be typed, versioned and bounded

The Project service MUST distinguish immutable system fields from configurable custom fields. V1 custom fields MUST be limited to `text`, `number`, `single_select`, `multi_select`, `date`, `checkbox`, `actor_ref`, `safe_ref` and `work_item_relation`, with size, count, option and value limits. Arbitrary JSON, HTML, script, URL, private path and Owner payload fields MUST be rejected.

#### Scenario: A manager changes a field kind
- **WHEN** a manager attempts to change an existing custom field to an incompatible kind
- **THEN** the service MUST require a replacement field and an explicit versioned migration plan or return `field_type_mismatch`
- **AND** it MUST NOT reinterpret existing values in place or advance the active schema revision partially

#### Scenario: A system field is archived
- **WHEN** a request attempts to archive or redefine `status`, `assignee`, `due_at`, `acceptance` or another system field
- **THEN** the service MUST reject the mutation with a stable disabled reason
- **AND** the WorkItem state machine and existing records MUST remain unchanged

### Requirement: Project views MUST share one typed server-side query contract

All ProjectView kinds MUST use a bounded `ProjectQueryV1` with allowlisted fields, operators, filters, sorts, groups, projections, page size and opaque cursors. Query authorization and row/field trimming MUST run on the server before filter and projection. Regex, raw SQL, dynamic code and browser-provided authority predicates MUST be rejected.

#### Scenario: A saved view cursor is replayed after schema change
- **WHEN** a cursor's tenant, dataset, schema revision, query digest, sort digest or index generation differs from the current request
- **THEN** the service MUST return `invalid_cursor` or `resync_required` with a safe latest revision hint
- **AND** it MUST NOT apply the old position to the new dataset generation or return unauthorized records

#### Scenario: Query complexity exceeds the budget
- **WHEN** predicate depth, condition count, field projection, group cardinality, page size or timeout exceeds the approved limit
- **THEN** the service MUST return `query_too_complex` or a stable limit error
- **AND** it MUST NOT execute an unbounded scan or expose an internal query plan

### Requirement: Table view MUST support conflict-safe record editing

Table view MUST provide typed cell editors, row and bulk selection, server pagination or virtualization, and visible field configuration. Every record mutation MUST use expected WorkItem version and idempotency; conflict UI MUST preserve the user's draft and expose reload, merge or reapply recovery.

#### Scenario: Two users edit the same cell
- **WHEN** two users submit edits based on the same WorkItem version
- **THEN** at most one edit may advance the canonical version and the other MUST receive `version_conflict` with the current safe projection
- **AND** the losing editor MUST retain its unsubmitted input without silently overwriting the winner

### Requirement: Kanban movement MUST resolve to a typed WorkItem action

Kanban MUST group records only by a server-approved status, single-select or assignee bucket. Pointer drag, keyboard move and context-menu move MUST create the same `ProjectDragIntentV1`, which the server resolves against role policy, WorkItem transition rules, WIP policy, current record version and view revision.

#### Scenario: A card is dragged across status columns
- **WHEN** a user drags a card to a status bucket that maps to an allowed WorkItem transition
- **THEN** the client MUST submit the server-authored action with expected version and idempotency
- **AND** the card MUST enter the canonical target column only after the receipt or committed event is observed

#### Scenario: WIP policy blocks the move
- **WHEN** the target bucket exceeds a server-authored WIP policy or requires an override approval
- **THEN** the service MUST return `wip_limit_reached`, `policy_blocked` or an approval action descriptor
- **AND** the client MUST restore the card to its canonical column and announce the reason through pointer and keyboard paths

### Requirement: Todo view MUST remain a principal-safe WorkItem projection

Todo view MUST derive sections from server-authorized WorkItems, due date, status, priority and the current principal. The browser MUST NOT select another actor by supplying a user ref as authority. Quick add MUST create a normal WorkItem, and completion MUST follow the WorkItem transition and acceptance rules.

#### Scenario: A user checks a blocked item
- **WHEN** a user activates completion for a WorkItem whose blockers, status or acceptance checks prevent `done`
- **THEN** the UI MUST show the server-authored next action or disabled reason
- **AND** it MUST NOT persist a local completed checkbox or move the item to Completed

### Requirement: Canvas view MUST use bounded BoardService projections

Canvas view MUST bind to an approved Board ref and use BoardService viewport, LOD, node, edge, version and event contracts. WorkItem nodes MUST store only safe refs and Board geometry; their record summaries MUST come from access-trimmed WorkItem projections. Canvas pan/zoom may feel unbounded, but queries, nodes, edges, overscan, payload size and execution time MUST remain bounded.

#### Scenario: A 10k-node canvas is opened
- **WHEN** a user pans and zooms a Canvas containing 10k nodes
- **THEN** the client MUST request only the current viewport/overscan and the appropriate far, medium or near projection
- **AND** it MUST NOT download all node details, keep one subscription per node or render hidden Owner content

#### Scenario: A user connects two nodes
- **WHEN** a user creates an allowed Board relation between two WorkItem or workflow nodes
- **THEN** the service MAY persist the typed organization relation or workflow draft binding
- **AND** it MUST NOT dispatch a workflow, transition a WorkItem or mutate an Owner solely because the edge was created

### Requirement: Project roles MUST be derived from R1 identity and closed project policies

The server MUST derive principal, tenant and membership from R1 and apply a versioned ProjectRolePolicy for record, field, view, schema, automation, role and export actions. ProjectRolePolicy MUST NOT issue identity, accept browser role claims or expose hidden field values through query, event, error, log, cache or evidence.

#### Scenario: Membership is revoked during an edit
- **WHEN** a membership or project role is revoked while a user has an open editor and event stream
- **THEN** new reads and mutations MUST fail closed, the old stream MUST terminate and tenant-bound cache MUST be cleared
- **AND** any already-dispatched Owner mutation MUST continue only through receipt/reconcile rather than the old browser authority

### Requirement: Batch project mutations MUST expose per-record outcomes

Batch WorkItem mutations MUST use a batch idempotency key plus per-record expected versions and MUST return stable ordered outcomes such as `changed`, `replayed`, `conflict`, `denied` or `invalid`. The UI MUST preserve successful results and expose retry only for the eligible failed subset.

#### Scenario: A bulk assignment is partially authorized
- **WHEN** a user submits a bulk assignment containing authorized, conflicted and unauthorized records
- **THEN** the service MUST return per-record outcomes and event refs without claiming whole-batch success
- **AND** the client MUST not retry changed, replayed or unknown records as though they were never processed

### Requirement: Project Workspace MUST compose inside the Agent-first Pane shell

Project Workspace, Schema, Automation and Automation Run MUST be registered versioned panes inside `/agent`. The Agent timeline and composer MUST remain the application anchor, desktop Pane count and split limits MUST be respected, and mobile MUST use a single accessible Sheet. No new top-level Project, Board or Canvas shell may be introduced.

#### Scenario: A user opens Canvas focus mode
- **WHEN** a desktop user expands the Project Workspace Canvas
- **THEN** the system MUST preserve the Agent session context and provide a deterministic restore path to the prior Pane layout and focus
- **AND** focus mode MUST NOT create an independent route, composer, task client or capability owner

#### Scenario: A mobile user opens the workspace
- **WHEN** the viewport is mobile-sized
- **THEN** Table, Kanban and Canvas MUST reduce to browse, review and lightweight action surfaces with focus trap, Escape/close and focus restoration
- **AND** complex schema or workflow graph editing MUST report `desktop_required` instead of presenting an unusable shrunken editor

### Requirement: Project interactions MUST be accessible and truthful

Every drag, connect, reorder, cell edit, bulk action and overlay MUST have keyboard and screen-reader behavior, visible focus, reduced-motion support and a non-drag equivalent. Loading, empty, stale, offline, permission, conflict, partial, unknown and contract-missing states MUST use the shared Workbench state vocabulary.

#### Scenario: A keyboard-only user moves a Kanban card
- **WHEN** the user invokes keyboard move mode, chooses a target bucket and confirms
- **THEN** the system MUST resolve the same action descriptor as pointer drag and announce pending, success or failure through a live region
- **AND** focus MUST return to the moved card or its canonical source location after conflict

### Requirement: Project contracts MUST keep four-transport parity

ProjectWorkspace, Dataset, Field, View, Role, Query, batch mutation and event operations MUST expose identical state, revision, pagination, error, idempotency, redaction and cursor semantics through HTTP, gRPC, JSON-RPC and TypeScript SDK, and all operations MUST enter the canonical registry and service.

#### Scenario: Four-transport project conformance runs
- **WHEN** the conformance suite creates a workspace, changes schema, creates a view, queries records, performs a batch mutation and resumes events through all four transports
- **THEN** safe results, revisions, errors, cursors and events MUST be equivalent
- **AND** no transport may bypass R1, ProjectRolePolicy, WorkItemService or the registry

### Requirement: Project Workspace MUST meet capacity and evidence gates

The system MUST validate at least 50k active WorkItems, 64 custom fields, 10k Canvas nodes, concurrent editors and bounded event streams with recorded query plans, latency, allocations, response sizes and browser rendering evidence. Integration and higher-layer runs MUST write redacted evidence under `temp/integration-test-runs/<run-id>/`.

#### Scenario: Production-like project performance run
- **WHEN** the approved PostgreSQL and browser performance suites execute the frozen dataset and concurrency profile
- **THEN** query, viewport, mutation and rendering budgets MUST pass or block promotion
- **AND** the evidence MUST include command, versions, environment, profiles, summary, artifacts and redaction status without claiming a production SLO from a toy fixture
