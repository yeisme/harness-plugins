## ADDED Requirements

### Requirement: Auctra connector SHALL negotiate exact screenplay room capabilities

Workbench SHALL add a loopback-only Auctra connector that validates `auctra.workbench.owner.v1`, schema/event digests, auth audience and selected Screenplay Room operation schemas before enabling reads, events or mutations. Capability promotion MUST be per operation, not all-Auctra.

#### Scenario: Read capability is approved but mutation is not

- **WHEN** room read/events have provider and consumer evidence but structure mutation lacks receipt/reconcile proof
- **THEN** Workbench SHALL expose current read projections while mutation remains `needs_contract`
- **AND** the UI SHALL keep edit controls unavailable with one truthful explanation.

#### Scenario: Auctra URL is not loopback-safe

- **WHEN** `WORKBENCH_AUCTRA_URL` contains a remote host, userinfo, query, fragment or redirect
- **THEN** Workbench MUST reject connector startup/configuration
- **AND** no request or credential SHALL be sent to that target.
