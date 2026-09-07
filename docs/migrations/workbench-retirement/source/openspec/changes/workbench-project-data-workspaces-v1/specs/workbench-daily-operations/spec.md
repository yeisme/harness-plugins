## ADDED Requirements

### Requirement: WorkItem project extensions MUST preserve the centralized lifecycle authority

WorkItem MAY add `projectRef`, `datasetRef`, `schemaRevision` and typed custom field values, but status, priority, assignee, due date, blockers, acceptance, dependencies and safe links MUST continue to be validated by the existing WorkItemService domain rules. A custom field MUST NOT shadow or override a system field or cause Task success to imply WorkItem completion.

#### Scenario: A custom field is named status
- **WHEN** a schema mutation attempts to create a custom field that collides with a reserved system field identity or semantic alias
- **THEN** the service MUST reject it with a stable schema error
- **AND** existing WorkItem lifecycle state and views MUST remain unchanged

### Requirement: WorkItem custom field mutations MUST be atomic with version and event changes

Creating or updating WorkItem custom values MUST validate the active dataset schema, field visibility/write permission, value kind, limits and expected WorkItem version inside the WorkItem application transaction. The canonical WorkItem version, typed values, audit record and outbox event MUST commit or roll back together.

#### Scenario: One custom field value is invalid
- **WHEN** a record mutation contains valid system field updates and one invalid or unauthorized custom field value
- **THEN** the entire single-record mutation MUST fail without advancing the WorkItem version or emitting a committed change event
- **AND** the error MUST identify the safe field ref and reason without echoing hidden or oversized values

### Requirement: WorkItem project queries MUST be typed, scoped and access-trimmed

WorkItemService MUST support project/dataset/schema-scoped list queries with bounded field predicates, sort, group, projection, page size and opaque cursor semantics required by Project views. The server MUST apply R1 and ProjectRolePolicy access trimming before filtering and MUST NOT download all records to the browser for production filtering.

#### Scenario: A user filters on a hidden field
- **WHEN** a query references a field the current principal cannot read
- **THEN** the service MUST return `permission_denied`, a safe unknown-field result or an access-trimmed response according to policy
- **AND** it MUST NOT reveal whether matching hidden values or records exist

### Requirement: WorkItem batch mutations MUST be idempotent and conflict-explicit

WorkItemService MUST support bounded batch updates with a batch idempotency key and per-item expected versions. The service MUST return stable per-item outcomes and MUST NOT repeat changed or possibly accepted work when a client retries after timeout.

#### Scenario: A batch request is retried
- **WHEN** the same batch idempotency key and request digest are submitted again after the client loses the response
- **THEN** the service MUST return the recorded per-item outcomes or safely continue only unfinished items
- **AND** it MUST reject a different request digest using the same idempotency key

### Requirement: WorkItem project events MUST expose safe changed-field metadata

WorkItem events used by Project views and automation MUST include tenant/workspace/project/dataset scope, WorkItem ref/version, event ref/cursor, actor/trace/audit refs, system transition summary and changed custom field refs. Events MUST NOT include complete descriptions, hidden values, Owner payloads or arbitrary cell content.

#### Scenario: An automation consumes a WorkItem field change
- **WHEN** a committed WorkItem event reports that an allowed field ref changed
- **THEN** ProjectAutomationService MAY re-read the current access-trimmed projection and evaluate eligible bindings
- **AND** it MUST NOT treat the event body as an authoritative raw input payload or leak the field value into logs/evidence
