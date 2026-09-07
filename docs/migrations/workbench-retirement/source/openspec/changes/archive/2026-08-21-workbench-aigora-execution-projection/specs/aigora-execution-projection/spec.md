## ADDED Requirements

### Requirement: Workbench SHALL expose independent domain and Aigora execution projections

Workbench SHALL expose an experimental `AigoraOperationExecutionProjection` only through a typed Workbench facade. The projection SHALL contain separate `domain` and `execution` objects, each with its own `observed_at` and safe version/cursor reference. `domain` SHALL expose only `operation_ref`, `admission_state`, `domain_state`, `observed_at`, and `version_ref`; `execution` SHALL expose only `binding_ref`, `job_ref`, `execution_state`, `observed_at`, `cursor_ref`, and `reconcile_state` plus approved safe summary fields. `operation_ref`, `binding_ref`, and `job_ref` SHALL be opaque safe refs issued or approved by their owner.

The projection SHALL NOT create or persist a third canonical job state. Workbench Task records, service caches, SDK caches, and UI state SHALL remain derived projections and SHALL NOT replace either owner’s canonical truth. An Aigora `succeeded` execution SHALL NOT imply domain `admission_state=admitted`, domain success, artifact availability, settlement, or any other domain completion.

#### Scenario: Aigora execution succeeds before domain admission
- **WHEN** the Aigora public facade returns `execution_state=succeeded` and the domain owner returns `admission_state=pending`
- **THEN** Workbench SHALL display `execution_state=succeeded` and `admission_state=pending` as separate values
- **AND** Workbench SHALL NOT promote the domain projection or a Task to admitted or succeeded.

### Requirement: Projection access SHALL be typed, facade-only, and permission-first

Browser clients SHALL access the projection and explicit reconcile action only through approved typed `WorkbenchClient` facade methods. Browser code SHALL NOT call an owner private API, database, CLI, local file, direct provider endpoint, or owner credential/session token. Workbench transport handlers SHALL only authenticate, decode, encode, and invoke the unified service; owner calls SHALL be made only through approved public facades.

Before an owner lookup, Workbench SHALL verify caller identity, tenant/workspace/project scope, capability, and the relation among `operation_ref`, `binding_ref`, and `job_ref`. Missing refs, unauthorized refs, cross-scope refs, and invalid relations SHALL return the same safe `not_found` result without revealing existence through fields, status distinctions, timing-sensitive fallback, logs, or events.

#### Scenario: Caller guesses another workspace job reference
- **WHEN** a caller supplies a syntactically valid `job_ref` outside its authorized operation/binding scope
- **THEN** Workbench SHALL return the same safe `not_found` result used for an absent `job_ref`
- **AND** Workbench SHALL NOT call a private owner endpoint or reveal the other workspace, binding, or job existence.

### Requirement: Uncertain and degraded states SHALL fail closed with explicit UX

The typed projection SHALL preserve safe status states `unknown`, `reconcile_required`, `stale`, `offline`, and `contract_mismatch`. An unknown enum, event, incomplete binding, invalid safe ref, or unrecognized public response SHALL map to `unknown` or `contract_mismatch`, never to a success or terminal state. `stale` SHALL identify a projection older than its public freshness window and retain only its previous safe summary; `offline` SHALL state that no current owner observation is available; `contract_mismatch` SHALL disable projection-dependent actions and conceal raw owner errors.

When either owner returns `unknown` or `reconcile_required`, Workbench SHALL show that confirmation is pending and SHALL NOT automatically retry, replay a mutation, create a job, or infer a terminal result. A reconcile action SHALL only be shown when the capability is enabled and the caller is authorized.

#### Scenario: Aigora result cannot be confirmed
- **WHEN** Workbench receives an incomplete or unrecognized Aigora execution response
- **THEN** it SHALL expose `execution.reconcile_state=unknown` or `reconcile_required` with a safe summary
- **AND** it SHALL not display the execution or domain state as succeeded or submit another operation.

### Requirement: Reconcile SHALL read canonical owner truth without side effects

`ReconcileAigoraExecution` SHALL require `operation_ref`, `binding_ref`, `job_ref`, corresponding safe version/cursor refs, and an expected Workbench projection version. It SHALL query only the approved public domain and Aigora facades, refresh independent safe snapshots, and preserve the observed time for each side. It SHALL NOT create an idempotency key, replay a mutation, submit another execution, modify domain admission, delete data, or manufacture an owner acknowledgement.

If an owner is offline, stale, unauthorized, missing, or contract-incompatible, reconcile SHALL update only the affected safe state and SHALL NOT overwrite the other owner’s last safe projection with inferred data.

#### Scenario: Aigora is offline during explicit reconcile
- **WHEN** an authorized caller requests reconcile and the Aigora public facade is offline
- **THEN** Workbench SHALL preserve the latest safe domain projection and mark the execution projection `offline` or `stale`
- **AND** it SHALL not issue a new Aigora job or change domain admission.

### Requirement: Capability SHALL be additive, experimental, default-disabled, and reversible

`aigora_execution_projection` SHALL be an additive experimental capability and SHALL default to `disabled`. Workbench SHALL expose it only after public contract/version/schema checks, safe-ref validation, and owner capability checks pass. Contract-version or schema-digest incompatibility SHALL produce `contract_mismatch` and SHALL NOT start a read consumer, reconcile action, or mutation path.

Disabling the capability or rolling back the feature SHALL hide the projection and related UI/action from catalogs and clients. Rollback SHALL NOT alter, delete, migrate, or replay domain Operations, Aigora jobs, Workbench Tasks, owner canonical states, or safe refs. Workbench SHALL NOT store raw receipt, provider payload, credential, private ref/path, artifact blob, or full owner response to implement this capability; logs, events, and integration evidence SHALL contain only redacted safe data.

#### Scenario: Capability is disabled after a projection has been observed
- **WHEN** `aigora_execution_projection` is disabled or the experimental feature is rolled back
- **THEN** Workbench SHALL hide the projection and reconcile action from new client responses and UI
- **AND** it SHALL leave the domain owner and Aigora canonical states unchanged without replaying or deleting any job.
