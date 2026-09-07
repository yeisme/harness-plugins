# workbench-cli-command-runtime Specification

## Purpose
Server-authored CLI command catalog, immutable prepared intents, TaskService execution, Host argv-only runtime, grants/proposals, and redacted evidence.

## Requirements
### Requirement: The command catalog SHALL be closed, sealed and server-authored

Workbench SHALL expose a versioned `CommandDescriptorV1` catalog derived only from sealed Operations and approved `HostCommandBindingV1` records. Every descriptor SHALL declare stable command identity/revision, stable `actionId`, target Operation where applicable, execution kind, effect/risk, closed argument schema, context bindings, role/scope, Agent policy, confirmation, event/cancel/reconcile support, resource ceilings, availability and recovery. Each runnable command SHALL resolve its CTA through the shared `ActionDescriptorV1`; command-specific metadata SHALL NOT create a second permission or action catalog. The client projection SHALL NOT contain executable path, argv template, cwd, env, secret, credential, raw URL or private path.

#### Scenario: A Host binding is incomplete
- **WHEN** a Host command lacks an argument encoder, output contract, permission policy, resource policy or runtime binding digest
- **THEN** catalog sealing SHALL fail or the descriptor SHALL remain `needs_contract`
- **AND** the command SHALL NOT become runnable through any transport or Pane

#### Scenario: A catalog consumer sees an unknown command
- **WHEN** the server returns a command ID or descriptor version unsupported by the client renderer
- **THEN** the client SHALL show a stable unavailable state
- **AND** SHALL NOT construct arguments, buttons, execution requests or fallback shell commands from the unknown descriptor

#### Scenario: Two surfaces render the same command action
- **WHEN** Context Menu, Inspector, Command Palette, Agent and CLI Pane expose one command
- **THEN** all surfaces SHALL resolve the same `actionId`, availability, reason and target Operation from `ActionDescriptorV1`
- **AND** no surface SHALL locally upgrade a disabled command to runnable

### Requirement: Prepared command intents SHALL be immutable, typed and short-lived

`PrepareCliCommandIntent` SHALL validate principal/scope, current descriptor revision, closed typed args, Context Pack revision, expected owner versions and bounded resources before creating `CliCommandIntentV1`. The intent SHALL be immutable, TTL-bound and addressed by opaque `intentRef`; it SHALL store only safe typed values/refs, redacted summary and canonical digests. Task input SHALL persist only the safe intent/context refs and bounded limits.

#### Scenario: An argument contains a raw path or unknown field
- **WHEN** a prepare request includes an absolute/private path, raw env value, executable name, control character, unknown property or value outside schema bounds
- **THEN** preparation SHALL fail before Task creation with a stable `invalid_argument` error
- **AND** the rejected value SHALL NOT enter logs, errors, evidence, intent storage or receipts

#### Scenario: An intent expires
- **WHEN** execution is requested after intent TTL or descriptor revision expiry
- **THEN** Workbench SHALL return `descriptor_stale` or `intent_expired`
- **AND** SHALL require a fresh preflight rather than dispatching cached arguments

### Requirement: Command execution SHALL use TaskService as the sole lifecycle authority

Operation-backed descriptors SHALL submit their declared sealed target Operation directly. Host-backed descriptors SHALL submit sealed Operation `workbench.cli.host.run.v1`, configured as an owner mutation with safe input persistence, permission/cost/idempotency gates, events/streaming, cancel and reconcile. No CLI service, Pane, Agent or Host adapter SHALL create a parallel run status or bypass TaskService transitions.

#### Scenario: An Operation-backed command runs
- **WHEN** a prepared descriptor maps to a sealed Workbench Operation
- **THEN** execution SHALL create that Operation's Task and preserve its schema, gates, adapter, expected-version, event and receipt semantics
- **AND** SHALL NOT spawn a subprocess merely to call the same Workbench API

#### Scenario: A Host-backed command runs
- **WHEN** a prepared descriptor maps to an approved Host binding
- **THEN** Workbench SHALL submit `workbench.cli.host.run.v1` with `inputRef`, context ref/revision and bounded resources
- **AND** the handler SHALL resolve the immutable intent server-side before dispatch

### Requirement: Host Runtime SHALL execute an allowlisted argv without a shell

The approved Host Runtime SHALL resolve a server-private executable binding and execute a fixed executable/subcommand with an argv array equivalent to `exec.CommandContext`. It MUST NOT invoke a shell, evaluate a command string, accept client executable/cwd/env, expand glob/pipe/redirection/substitution, or provide interactive PTY/stdin in v1. Workspace paths and secrets SHALL be resolved from opaque refs under server-authored mount/env policies.

#### Scenario: A value contains shell metacharacters
- **WHEN** a valid safe-text argument contains characters that a shell would interpret
- **THEN** the Host SHALL pass it as one argv value according to the descriptor encoder
- **AND** no shell parsing, splitting or expansion SHALL occur

#### Scenario: A client requests an arbitrary environment variable
- **WHEN** the intent contains an env key/value not declared by the Host policy
- **THEN** dispatch SHALL fail closed with a stable policy error
- **AND** the Host SHALL NOT inherit or expose the browser/user environment

### Requirement: Host Runtime SHALL enforce resource, process and shutdown ownership

Host Runtime SHALL enforce descriptor/tenant ceilings for duration, output bytes, event count, CPU, memory, process count, network policy and concurrency. It SHALL own every process/process group from start through exit/cancel/shutdown, propagate context cancellation, prevent orphan processes, and emit health/readiness plus structured call lifecycle diagnostics. The normal implementation SHALL remain pure Go and `CGO_ENABLED=0` compatible.

#### Scenario: A command exceeds its duration
- **WHEN** a process reaches the effective timeout
- **THEN** Host Runtime SHALL request termination of the owned process group, emit a typed timeout event and return a retryable/non-retryable disposition defined by the descriptor
- **AND** SHALL NOT leave an orphan process or report success

#### Scenario: The Host shuts down with active commands
- **WHEN** graceful shutdown begins
- **THEN** Host Runtime SHALL stop accepting dispatch, reconcile or terminate owned processes within the shutdown policy and persist safe receipts/events
- **AND** machine/protocol stdout SHALL remain free of diagnostic banners

### Requirement: Structured CLI output SHALL map to one canonical result projection

Non-streaming Host commands SHALL emit one valid `--json` envelope; streaming commands SHALL emit valid `--events` NDJSON with `start`, strictly increasing sequence events, and exactly one terminal `end` or `error`. stdout SHALL be reserved for the selected protocol mode and stderr for diagnostics. Workbench SHALL normalize the result to `CliCommandResultProjectionV1`; default human, `--agent`, JSON, events and explain representations SHALL be semantically consistent and SHALL NOT expose secrets or chain-of-thought.

#### Scenario: Structured output is malformed
- **WHEN** stdout violates the declared envelope/event schema, sequence or terminal-event contract
- **THEN** the Task SHALL fail or become partial with `output_contract_invalid`, preserve bounded redacted diagnostics and emit no fabricated result facts
- **AND** the Pane SHALL NOT parse human text to infer success

#### Scenario: stderr contains an error message but JSON reports success
- **WHEN** a valid canonical result reports success while stderr contains diagnostics
- **THEN** Task disposition SHALL follow the canonical result/exit contract and retain stderr only as bounded diagnostics
- **AND** stderr text alone SHALL NOT become product status or Agent facts

### Requirement: Agent execution SHALL require explicit delegated authority

Agent command calls SHALL execute as `system-agent` with an initiating principal ref and a verifiable delegation/grant ref; they SHALL NOT use ambient browser credentials. A grant MAY authorize only descriptors with `effectClass=read` and `agentPolicy=delegated_read`, and SHALL bind tenant/workspace/session/scope, command IDs/groups, expiry and resource ceiling. Agent-origin writes/dangerous commands SHALL require canonical proposal acceptance and all Task gates.

#### Scenario: A grant is outside scope
- **WHEN** Agent attempts a descriptor, project, runtime, resource limit or time outside the grant
- **THEN** Workbench SHALL return `delegation_required` or `permission_denied` before Task creation
- **AND** SHALL audit the denied attempt without logging raw arguments

#### Scenario: An Agent-origin dangerous proposal is accepted
- **WHEN** an authorized approver accepts the current canonical proposal revision
- **THEN** ProposalAuthority SHALL submit exactly one Task using the prepared intent and expected versions
- **AND** changed/expired intent or proposal data SHALL return conflict instead of executing

### Requirement: Idempotency, concurrency, cancellation and unknown acceptance SHALL be authoritative

Command execution SHALL compute an idempotency scope/digest including actor/delegation, workspace/project, command ID/revision, intent digest and expected owner version. Duplicate identical requests SHALL return the existing Task; changed payload under the same key SHALL return conflict. Concurrency ceilings SHALL be enforced server-side. Cancel SHALL remain `cancel_requested` until Host/Owner acknowledgement. `unknown_accept` SHALL only recover through explicit lookup/reconcile using original request/host session refs and SHALL never replay the command.

#### Scenario: A user double-submits Run
- **WHEN** two equivalent Run requests arrive with the same idempotency key and intent digest
- **THEN** Workbench SHALL return one Task/receipt lineage
- **AND** Host Runtime SHALL start at most one process or owner mutation

#### Scenario: Dispatch acknowledgement is lost
- **WHEN** Host may have accepted a command but Workbench cannot determine acceptance
- **THEN** Task SHALL enter `unknown_accept` with a safe receipt/event and no automatic retry
- **AND** explicit Reconcile SHALL query by original request/host session ref without spawning another command

### Requirement: Command metadata, output and audit SHALL be safely persisted and observable

Workbench SHALL persist only safe command intent metadata, Task/Attempt/Event indexes, redacted result/artifact/receipt refs and audit fields. It SHALL NOT persist credentials, raw secret values, Owner private payload, Host private path, unrestricted stdout/stderr, raw prompt or chain-of-thought. Redaction SHALL occur before persistence and again at API/evidence boundaries; redaction failure SHALL fail closed. Logs, TraceEvent, audit records, CLI protocol output and product artifacts SHALL remain separate and correlated by request/trace/task/call refs.

#### Scenario: Output contains a secret sentinel
- **WHEN** Host output, stderr, error or receipt contains an authorization/secret/private-path sentinel
- **THEN** the sentinel SHALL be absent from Task events, artifacts, receipts, API output, logs and integration evidence
- **AND** a redaction failure SHALL produce `redaction_failed` rather than unsafe fallback storage

#### Scenario: A privileged command is audited
- **WHEN** a bounded-write or dangerous command reaches a decision or dispatch boundary
- **THEN** audit SHALL record safe actor/delegation, scope, command/revision, risk/effect, intent digest, decision, Task/Attempt/receipt refs and timestamp
- **AND** SHALL NOT record secret/raw argument values

### Requirement: CLI catalog and intent methods SHALL preserve four-transport parity

`ListCliCommandDescriptors`, `GetCliCommandDescriptor`, `PrepareCliCommandIntent`, `GetCliCommandIntent`, `ListCliCommandRuns` and `GetCliCommandResult` SHALL be available through `WorkbenchClient` and equivalent HTTP, gRPC and JSON-RPC projections with the same schemas, permission, revisions, errors and pagination. Execution/events/artifacts/receipts/cancel/retry/reconcile SHALL reuse the existing Task APIs and cursor semantics; transport adapters SHALL NOT own command-specific execution logic.

#### Scenario: A descriptor is read through every transport
- **WHEN** the same authorized caller reads a descriptor catalog through SDK/HTTP, gRPC and JSON-RPC
- **THEN** each transport SHALL return the same catalog digest, descriptor revisions, availability and stable errors
- **AND** no transport SHALL expose Host-private binding fields

#### Scenario: A run event watcher reconnects
- **WHEN** a CLI Pane reconnects with a Task event cursor
- **THEN** the existing watch API SHALL replay the next strictly increasing safe events or return cursor expiry
- **AND** Workbench SHALL NOT create a Pane-specific event stream or duplicate event subscription per output tab

### Requirement: Integration evidence SHALL cover execution and redaction boundaries

Contract/component/integration/system/E2E verification for CLI command execution SHALL write redacted evidence under `temp/integration-test-runs/<run-id>/` and cover catalog seal, prepared intent validation, no-shell argv, permission/grant/proposal gates, duplicate submit, concurrency, timeout, cancel race, unknown-accept reconcile, malformed output, output truncation, secret redaction, Host shutdown and four-transport parity. Go concurrency-sensitive paths SHALL pass the race detector.

#### Scenario: A no-shell integration canary runs
- **WHEN** a test passes metacharacters and a secret sentinel through an approved canary descriptor
- **THEN** the captured argv SHALL contain the value as one argument, no unintended file/process/network side effect SHALL occur and the sentinel SHALL be redacted from evidence
- **AND** the run evidence SHALL retain the original test exit code and correlation refs
