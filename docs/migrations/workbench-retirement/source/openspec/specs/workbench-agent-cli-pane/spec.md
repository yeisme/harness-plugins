# workbench-agent-cli-pane Specification

## Purpose
First-party Agent CLI Pane for catalog-driven command draft, Task-derived run history, bounded result views, and suggestion-first Agent collaboration.

## Requirements
### Requirement: Workbench SHALL register one bounded first-party CLI Pane

Workbench SHALL register `agent.cli.v1` through the existing versioned Pane registry and closed manifest. The Pane SHALL accept only safe refs for session, runtime, scope, project and selected Task, SHALL use a canonical document key derived from tenant/workspace/session/runtime/scope, and SHALL obey the existing desktop default limit 3, hard limit 4 and split depth 2. The Pane SHALL NOT load remote code, iframe, URL, shell, executable path or credential.

#### Scenario: The same CLI session is opened twice
- **WHEN** a user or Agent presentation suggestion opens `agent.cli.v1` with the same canonical session/runtime/scope identity
- **THEN** Workbench SHALL focus the existing Pane instance
- **AND** SHALL NOT create a duplicate Pane or reset its draft, selected run or scroll position

#### Scenario: The Pane limit is reached
- **WHEN** opening a CLI Pane would exceed the current visible Pane limit
- **THEN** Workbench SHALL return `limit_reached` and offer explicit close or replace choices
- **AND** an Agent suggestion SHALL NOT silently replace another Pane or the conversation surface

### Requirement: The CLI Pane SHALL use a structured command draft instead of an editable shell prompt

The CLI Pane SHALL select commands from the server-authored `CommandDescriptorV1` catalog and render typed, labeled argument controls from its closed schema. It SHALL show a read-only, redacted command preview only as secondary information. The Run request SHALL submit an immutable prepared intent ref, not a command string, argv string, executable path, cwd, env map or terminal input.

#### Scenario: A user prepares an approved command
- **WHEN** the user selects a ready descriptor and enters values accepted by its typed schema
- **THEN** the Pane SHALL request server preflight and display scope, effect, risk, permission, cost, version and runtime readiness
- **AND** Run SHALL be enabled only for the current `intentRef` and descriptor revision

#### Scenario: A user pastes a shell command
- **WHEN** text resembling `bash -c`, a pipe, redirection or an arbitrary executable is pasted into the Pane
- **THEN** the Pane SHALL NOT treat it as executable input or construct a Task from it
- **AND** SHALL direct the user to select a registered command or show `needs_contract`

### Requirement: Agent command operations SHALL remain suggestion-first and authority-safe

Agent SHALL be able to discover visible descriptors, prepare a typed suggestion from an explicit Context Pack, request open/focus/select presentation, and observe safe command results. By default Agent SHALL NOT execute a command. Agent MAY submit a read-effect command only when the descriptor permits `delegated_read` and a current session/scope/command-bound grant is valid. Agent-origin bounded-write or dangerous commands MUST use canonical ProposalAuthority and user/approver acceptance before Task creation.

#### Scenario: Agent proposes a write command
- **WHEN** Agent prepares a command whose `effectClass` is `bounded_write` or `dangerous`
- **THEN** the conversation and CLI Pane SHALL render a canonical pending proposal with command label, scope, safe args summary, risk and expected effects
- **AND** no Task SHALL be created until an authorized decision accepts the current proposal revision

#### Scenario: Agent has no delegated read grant
- **WHEN** Agent prepares a low-risk read command without a valid grant
- **THEN** the Pane SHALL remain in review-ready state and require the user to Run or grant the bounded capability
- **AND** Agent SHALL NOT inherit the browser session or silently execute the command

#### Scenario: Agent observes a completed run
- **WHEN** a command Task emits a terminal result
- **THEN** Agent MAY receive safe summary, facts, result/artifact/receipt refs and revisions for subsequent reasoning
- **AND** raw stdout, stderr, secret values, private paths and credentials SHALL NOT enter Agent context

### Requirement: CLI run history SHALL be Task-derived and survive Pane closure

The CLI Pane SHALL group related command Tasks into a paginated `CommandSessionProjectionV1` without creating a second execution state machine. Closing the Pane SHALL NOT cancel, retry, delete or alter a Task. Reopening SHALL restore safe run history, selected run and available event/artifact/receipt projections from server truth; browser-local draft SHALL remain non-authoritative and bounded.

#### Scenario: A running command Pane is closed
- **WHEN** the user closes the CLI Pane while its selected Task is running
- **THEN** the Task SHALL continue under TaskService and session/timeline attention SHALL continue to show progress
- **AND** reopening from the run card SHALL show the current authoritative state

#### Scenario: A descriptor changes while a draft is open
- **WHEN** catalog refresh returns a different descriptor revision for the current draft
- **THEN** the prepared intent SHALL become `stale`, Run SHALL be disabled and the user SHALL be asked to preflight again
- **AND** the old intent SHALL NOT be submitted

### Requirement: The CLI Pane SHALL render one canonical result through bounded views

For a selected run, the Pane SHALL render Summary, Facts, Events, Artifacts, Explain and technical Details from the stored `CliCommandResultProjectionV1`, Task event log and safe refs. Changing views SHALL NOT rerun the command. Raw Console SHALL be a permission-gated secondary disclosure that strips terminal control sequences, is redacted and bounded, and never determines business status.

#### Scenario: A streaming command completes
- **WHEN** a command emits ordered structured events and a terminal result
- **THEN** the Events view SHALL preserve sequence/cursor semantics and the Summary/Facts views SHALL show the same terminal status
- **AND** switching to JSON or Explain SHALL NOT invoke the command again

#### Scenario: Output exceeds the live buffer
- **WHEN** output exceeds the configured line, event or byte limit
- **THEN** the Pane SHALL retain a safe summary and bounded tail and link to a permission-checked Artifact with size/checksum/evidence refs
- **AND** SHALL mark `outputTruncated=true` instead of silently dropping data or freezing the UI

### Requirement: CLI actions SHALL expose truthful gate and recovery states

The Pane SHALL distinguish `needs_contract`, `permission_required`, `cost_required`, `stale`, `offline`, `conflict`, `queued`, `running`, `cancel_requested`, `partial`, `failed`, `unknown_accept`, `cancelled` and `succeeded`. Each blocked state SHALL provide its descriptor-authored reason and allowed recovery. Cancel SHALL remain `cancel_requested` until authoritative acknowledgement, and `unknown_accept` SHALL expose only explicit Reconcile.

#### Scenario: Host acceptance is unknown
- **WHEN** dispatch or cancel acknowledgement cannot be determined
- **THEN** the Pane SHALL show `unknown_accept`, preserve Task/Attempt/receipt refs and offer Reconcile to an authorized user
- **AND** Agent and UI SHALL NOT auto-retry, auto-reconcile or show success/cancelled

#### Scenario: Runtime is unavailable
- **WHEN** the descriptor or Host readiness reports offline or contract mismatch
- **THEN** the Pane SHALL disable Run, preserve the safe draft and show the stable diagnostic/recovery action
- **AND** SHALL NOT fall back to browser execution or a copied shell string

### Requirement: CLI Pane interaction SHALL remain usable across keyboard, zoom and responsive modes

On desktop the CLI Pane SHALL use the shared Pane chrome and may occupy a bounded right region without reducing the conversation below its minimum readable width. At tablet and mobile sizes it SHALL render as the existing single Pane Sheet/full-screen Sheet. Command search, argument controls, history, tabs, Run, Cancel and Reconcile SHALL be keyboard reachable; dialogs/Sheets SHALL trap and restore focus; status SHALL not rely on color alone; 200% zoom SHALL avoid page-level horizontal scrolling.

#### Scenario: A keyboard user runs a ready command
- **WHEN** focus is outside a multiline input and the current intent is ready with no unresolved confirmation
- **THEN** `Cmd/Ctrl+Enter` MAY activate Run and focus SHALL move to the new run status heading or remain on the Run control according to the shared focus policy
- **AND** the shortcut SHALL NOT bypass permission, cost, proposal or confirmation UI

#### Scenario: A command is reviewed on mobile
- **WHEN** the viewport is below 768px
- **THEN** the CLI Pane SHALL use a full-screen Sheet with single-column arguments, a history drawer and sticky state-aware actions
- **AND** Escape/back/close SHALL restore focus without cancelling an active Task

