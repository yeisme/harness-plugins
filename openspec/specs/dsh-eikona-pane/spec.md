# dsh-eikona-pane Specification

## Purpose
TBD - created by archiving change dsh-eikona-pane-v1. Update Purpose after archive.
## Requirements
### Requirement: Eikona Pane implementation SHALL be owned by Harness Plugins
DSH-specific Host bridge, Client view registration, action admission, bundle wiring, lifecycle, and conformance tests SHALL live in `agent/harness-plugins`. Eikona SHALL remain the canonical owner of run, artifact, project, review, and receipt state.

#### Scenario: Plugin integration changes
- **WHEN** the DSH Eikona Pane requires a UI, Host, profile, or compatibility change
- **THEN** that implementation SHALL be changed and verified in Harness Plugins
- **AND** the plugin SHALL consume Eikona owner contracts instead of copying Eikona state or business rules

### Requirement: Eikona Pane SHALL consume owner run and artifact projections only
The Harness Plugins Host adapter SHALL project redacted run, artifact, gallery, compare, and review state from canonical Eikona records. The projection MUST NOT become a second image store. Default generate model_ref SHALL be `openai/gpt-5.4-image-2`.

#### Scenario: Gallery read
- **WHEN** the Pane opens an authorized Eikona project
- **THEN** Host SHALL emit a snapshot of opaque artifact refs, titles, status, freshness, and allowed_actions
- **AND** the payload SHALL NOT contain filesystem paths, tokens, raw prompts, or provider payloads

### Requirement: Generate and review mutations SHALL stay gated on Eikona
Generate preview, variant compare, accept, reject, and export SHALL use Eikona owner actions with preview, expected revision, idempotency, and receipt. Agent or Pane clients MUST NOT auto-accept canonical artifacts.

#### Scenario: Accept requires receipt
- **WHEN** a user accepts a generated candidate
- **THEN** Eikona SHALL return an owner receipt bound to the artifact version
- **AND** the Pane SHALL NOT mark success from a timeout or local UI state

### Requirement: Events SHALL be snapshot plus push with reconcile
After the first snapshot, the Host SHALL consume push events. Duplicate sequences MUST be ignored. Gap, expired cursor, or context revision SHALL enter `reconcile_required` and pause mutation. Client polling is forbidden.

#### Scenario: Cursor gap
- **WHEN** a sequence gap is observed
- **THEN** the Pane SHALL keep last safe state, show `reconcile_required`, and re-read snapshot
- **AND** SHALL NOT start a timer refresh

### Requirement: Artifact handoff SHALL use ArtifactRefV1
Export and cross-pane handoff SHALL emit `ArtifactRefV1` with owner `eikona`. Transform or attach intents MUST name `targetOwner`. Target owners re-run permission and version gates.

#### Scenario: Handoff image to Anatomia
- **WHEN** the user hands an accepted image to Anatomia
- **THEN** the intent SHALL carry eikona owner, opaque ref, version, and idempotencyKey
- **AND** Eikona canonical state SHALL remain unchanged
