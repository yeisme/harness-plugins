# pane-subagent-monitor Specification

## Purpose
TBD - created by archiving change dsh-pane-subagent-monitor-v1. Update Purpose after archive.
## Requirements
### Requirement: Subagent Monitor SHALL keep the main conversation as orchestrator

The Subagent Monitor SHALL render the current session's subagent tree inside the Pane Workbench without automatically calling `openSubagent()`. Opening a child in the main conversation SHALL require an explicit user action.

#### Scenario: Open subagent pane does not replace main session

- **WHEN** the user opens the Agents pane
- **THEN** the current main conversation SHALL remain the active session
- **AND** the pane SHALL show the subagent tree for that session

#### Scenario: Open in Main is explicit

- **WHEN** the user selects an explicit "Open in Main" action on a subagent node
- **THEN** the client SHALL call `sessions.openSubagent(address)`
- **AND** no other pane interaction SHALL switch the main session automatically

### Requirement: Projection SHALL be safe and bounded

The pane SHALL consume a `SubagentPaneProjectionV1` derived from DSH-owned sessions and subagent projections. It MUST NOT include absolute paths, credentials, raw prompts, provider payloads, private tool arguments, module URLs, or arbitrary script/iframe fields.

#### Scenario: Projection rejects unsafe fields

- **WHEN** a projection candidate contains an absolute path or raw prompt key
- **THEN** the projection selector SHALL reject or drop the unsafe value
- **AND** the view SHALL NOT render it

#### Scenario: Tree update preserves local expansion

- **WHEN** a subagent status update arrives
- **THEN** the tree SHALL update the affected node by opaque id
- **AND** unrelated nodes and local expansion state SHALL be preserved

### Requirement: Subagent status SHALL be truthful

The Monitor SHALL show only DSH-provided lifecycle facts. It SHALL distinguish running and inactive states; completed, failed, cancelled or interrupted states SHALL appear only when a DSH-owned outcome projection supplies them. The client MUST NOT infer terminal outcomes from absence of activity.

#### Scenario: No outcome projection available

- **WHEN** DSH provides only `running | inactive` activity
- **THEN** the pane SHALL show running or inactive
- **AND** it SHALL NOT label an inactive child as completed or failed

### Requirement: Mutation actions SHALL use official DSH seams and receipts

Send follow-up and interrupt SHALL call `ctx.connection.api.subagents.prompt` / `subagents.interrupt` for continuable subagents. The pane SHALL render accepted/rejected receipts and MUST NOT optimistically mark a subagent as succeeded or stopped.

#### Scenario: Interrupt accepted

- **WHEN** the user interrupts a running continuable subagent and DSH returns accepted
- **THEN** the pane SHALL show the receipt
- **AND** the running status SHALL remain until the DSH projection changes

#### Scenario: One-shot subagent mutation denied

- **WHEN** the user tries to send follow-up or interrupt a one-shot subagent
- **THEN** the pane SHALL disable the action with a readable reason
- **AND** it SHALL NOT call the mutation API

### Requirement: Parallel mode SHALL be steering, not scheduling

A Parallel/Swarm switch SHALL wrap the next main-session prompt with a fixed bounded steering directive when enabled. It MUST NOT create a client scheduler, task ledger, or subagent start protocol.

#### Scenario: Parallel mode wraps prompt

- **WHEN** the user enables Parallel and sends a main-session prompt
- **THEN** the prompt boundary SHALL append the fixed steering directive
- **AND** the local transcript SHALL keep the user's original text

#### Scenario: Parallel mode disabled

- **WHEN** Parallel is disabled
- **THEN** the main-session prompt SHALL be sent unchanged
- **AND** no steering text SHALL enter the projection or transcript

### Requirement: Pane absence SHALL degrade to existing catalog

When the Pane Workbench or Subagent Monitor bundle is not installed, the existing `ui-subagent` header catalog SHALL remain available and unchanged.

#### Scenario: Bundle removed

- **WHEN** the `@yeisme/dsh-pane-subagent` bundle is removed
- **THEN** the Agents pane view and header action SHALL be disposed
- **AND** the existing subagent header catalog SHALL continue to work

