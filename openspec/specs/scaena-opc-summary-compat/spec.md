# scaena-opc-summary-compat Specification

## Purpose
TBD - created by archiving change dsh-scaena-opc-summary-compat-v1. Update Purpose after archive.
## Requirements
### Requirement: DSH SHALL consume the Scaena canonical OPC summary additively
DSH SHALL expose a typed read-only adapter for `scaena.opc.scene_package_summary.v1alpha1` while preserving the existing `scaena.opc-scene-package-summary.v1alpha1` public surface unchanged. The canonical adapter MUST accept snake_case and camelCase ingress, MUST ignore unknown additive fields, and MUST fail closed when required identity fields are missing or unsafe.

#### Scenario: Canonical summary is valid
- **WHEN** DSH receives a redacted Scaena canonical OPC summary with a valid package revision, human gates, and owner action
- **THEN** the adapter MUST return the canonical package, action, gate receipt, receipt, and reconcile identities without renaming or enum translation
- **AND** the legacy schema constant, validator, fixture, and exported types MUST remain unchanged

#### Scenario: Canonical summary is unsafe or incomplete
- **WHEN** the payload carries a forbidden credential/prompt/provider field or omits a required package/action identity value
- **THEN** the adapter MUST reject the payload as a contract mismatch
- **AND** DSH MUST NOT synthesize readiness, receipts, reconcile refs, or an idempotency key

### Requirement: Cross-entry verification SHALL use one canonical package revision
The DSH verifier SHALL accept an explicit conformance fixture path and compare its canonical package revision through the DSH adapter against the fixture-authored expectations. The comparison MUST cover action id, target ref, expected version, side-effect class, confirmation requirement, idempotency requirement, gate receipt identity, receipt identity, and reconcile identity when supplied.

#### Scenario: Workbench fixture is verified by DSH
- **WHEN** the verifier reads the Workbench OPC conformance fixture for one package revision
- **THEN** DSH output MUST match the fixture expectations field-for-field
- **AND** the verifier MUST exit non-zero on any semantic mismatch
- **AND** neither consumer may persist or mutate Scaena production state
