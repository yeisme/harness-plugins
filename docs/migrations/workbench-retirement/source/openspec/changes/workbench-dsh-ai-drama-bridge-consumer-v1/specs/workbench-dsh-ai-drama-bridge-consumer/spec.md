## ADDED Requirements

### Requirement: Workbench ingress MUST consume only host-exchanged V2 envelopes
The Workbench server-side ingress MUST accept `dsh.workbench_ai_drama_bridge.v2` envelopes only through the approved host/launcher exchange and MUST reject raw route or URL input composed by the browser.

#### Scenario: Approved exchange delivers a V2 envelope
- **WHEN** the trusted launcher exchange delivers a closed-schema V2 envelope with a valid canonical digest
- **THEN** ingress validation proceeds with direction `dsh_to_workbench` and target surface `workbench.agent.spatial`

#### Scenario: Browser submits a composed route or URL
- **WHEN** a request carries a raw `/agent?...` route, origin, or URL instead of the exchanged envelope
- **THEN** ingress rejects it with `malformed` and no lens opens

### Requirement: Ingress MUST validate the closed schema with unified nonce semantics
The ingress MUST validate the closed V2 schema and MUST enforce the `^[0-9a-f]{32}$` nonce pattern and bounded epoch-millisecond expiry identically across the Task SDK and the Go service.

#### Scenario: Nonce fails the unified pattern
- **WHEN** an envelope nonce does not match 32 lowercase hexadecimal characters
- **THEN** the ingress returns `contract_mismatch` and performs no owner lookup

#### Scenario: Expiry is in the past
- **WHEN** `expiresAtUnixMs` has passed
- **THEN** the ingress returns `expired` and records only the redacted stable reason

### Requirement: Consumption MUST be replay-safe under a bounded record
The ingress MUST keep a bounded replay record keyed by tenant, nonce, and contract version so identical retries return the original result and conflicting reuse is rejected.

#### Scenario: Identical envelope resubmitted
- **WHEN** the same canonical payload is submitted again inside the replay window
- **THEN** the original consumption result is returned without duplicating owner reads or writes

#### Scenario: Same nonce with a different payload
- **WHEN** the tenant, nonce, and contract version match but the canonical payload differs
- **THEN** the ingress returns `replay_conflict` with no owner mutation

### Requirement: Ingress MUST reauthorize and refetch owner data
The ingress MUST revalidate the current principal against tenant, workspace, project, and resource authorization and MUST refetch authoritative owner data before enabling display or mutation.

#### Scenario: Authorized matching version
- **WHEN** the principal may access the resource and `resourceVersion`/`contextRevision` match owner state
- **THEN** the requested lens opens with owner-authored data and permissions

#### Scenario: Version drift
- **WHEN** the handoff version differs from owner state or the resource no longer exists
- **THEN** the ingress returns `reconcile_required`, exposes the mismatch, and performs no silent overwrite

#### Scenario: Unauthorized principal
- **WHEN** the principal cannot access the tenant, workspace, project, or resource
- **THEN** the ingress returns `denied` without disclosing protected resource details

### Requirement: Presentation intents MUST map to fixed `/agent` lenses
The ingress MUST map the closed intent enum deterministically — `open_show`/`open_episode`/`open_artifact` to Creative Production, `open_review` to Review, `open_evidence` to Evidence — and MUST NOT approximate an unknown intent with a nearby lens.

#### Scenario: Unknown intent arrives
- **WHEN** the intent is outside the closed enum
- **THEN** the ingress returns `contract_mismatch` and no lens opens

### Requirement: Workbench MUST pass the published DSH conformance fixtures
The Workbench consumer MUST execute the consumer and both actor cases of the published fixtures (fixtureVersion `2026-08-29.1`) and MUST record conformance evidence separately from DSH plugin-complete evidence.

#### Scenario: Fixtures pass at the matching version
- **WHEN** all consumer and both actor cases pass at the same fixture version DSH published
- **THEN** the bridge may be marked consumer-conformant and proposed for canary enablement

#### Scenario: Fixture version mismatch
- **WHEN** the fixtures executed do not match the DSH-published version
- **THEN** cross-repository rollout readiness MUST NOT be claimed
