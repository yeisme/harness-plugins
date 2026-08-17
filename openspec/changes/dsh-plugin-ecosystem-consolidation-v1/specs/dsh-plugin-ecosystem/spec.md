## ADDED Requirements

### Requirement: Ecosystem SHALL compose independent owner rows

The supported DSH profile composition SHALL keep Ordo Agent Ops, composition preview, and Pane Workbench as independently identifiable package rows. The composition MUST NOT create a second scheduler, canonical task state, approval ledger, receipt owner, or browser domain store.

#### Scenario: Unified Ordo profile

- **WHEN** a clean web profile installs the unified Ordo bundle
- **THEN** the profile SHALL contain one unified Ordo root contribution and an independently identifiable composition preview contribution
- **AND** legacy leaf packages SHALL not be required for the new profile path

### Requirement: Ecosystem SHALL preserve owner boundaries

Harness Plugins SHALL expose only typed safe projections, package contracts, Pane lifecycle, and bundle composition. DSH core/client SHALL own official CLI, shell slots, `ui-agent-preset`, and client rendering. Ordo SHALL remain the owner of run, task, action, approval, receipt, and reconciliation facts.

#### Scenario: Composition facts are unavailable

- **WHEN** the composition preview row is absent, stale, or schema-incompatible
- **THEN** Ordo consumers SHALL return `unavailable` or `needs_contract`
- **AND** no consumer SHALL read preset files, browser state, host paths, or private registry state as a fallback

### Requirement: Official plugin manifest commands SHALL be additive

The DSH CLI SHALL expose manifest authoring and validation through the official plugin namespace without changing the existing profile plugin management behavior. Machine-readable metadata SHALL be created by the CLI or owning service.

#### Scenario: Manifest lifecycle

- **WHEN** a developer runs `dsh plugin manifest init --path <package-dir>`, `dsh plugin manifest validate --path <package-dir>`, or `dsh plugin manifest pack --path <package-dir> --out-dir <directory>`
- **THEN** the CLI SHALL validate four-face, compatibility, permission, and package file contracts
- **AND** the existing `dsh plugin --profile web add <package>` and remove commands SHALL remain compatible

### Requirement: Profile conformance SHALL preserve lifecycle safety

The ecosystem conformance suite SHALL cover install, load, unload, HMR/generation reset, duplicate contribution detection, browser safe projection, and redacted integration evidence.

#### Scenario: Unload and reload

- **WHEN** the profile unloads the Ordo, composition, and Pane contributions and then reloads a new generation
- **THEN** subscriptions, registries, pending requests, focus traps, temporary DOM nodes, and client module residue SHALL be absent before the new generation is accepted
- **AND** the evidence SHALL contain no secrets, tokens, raw prompts, provider payloads, private tool arguments, or absolute paths
