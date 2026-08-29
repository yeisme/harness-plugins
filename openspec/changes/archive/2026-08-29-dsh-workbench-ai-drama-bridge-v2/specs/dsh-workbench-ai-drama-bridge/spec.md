## ADDED Requirements

### Requirement: Bridge V2 MUST use a versioned directional contract
The DSH provider MUST emit `dsh.workbench_ai_drama_bridge.v2` only for the `dsh_to_workbench` direction and MUST NOT reuse that contract identity for Workbench-to-DSH traffic.

#### Scenario: Provider emits a V2 drama handoff
- **WHEN** an authorized DSH user requests a Workbench handoff and the target advertises V2 support
- **THEN** the provider emits contract version `dsh.workbench_ai_drama_bridge.v2`, direction `dsh_to_workbench`, and target surface `workbench.agent.spatial`

#### Scenario: Envelope declares the wrong direction
- **WHEN** a V2 envelope declares any direction other than `dsh_to_workbench`
- **THEN** the validator rejects it with a stable `contract_mismatch` reason and no launch is attempted

### Requirement: Bridge V2 MUST expose only a closed safe projection
The V2 envelope MUST use the closed schema defined by this capability, MUST carry only bounded opaque refs and versions, and MUST reject unknown keys, raw URLs, credentials, absolute paths, raw prompts, provider payloads, and private tool arguments.

#### Scenario: Valid safe projection receives an integrity digest
- **WHEN** all required refs are valid bounded opaque values and no unknown field is present
- **THEN** the host canonicalizes the schema-ordered V2 fields excluding `contractDigest`, attaches their SHA-256 digest, and returns a safe launch projection

#### Scenario: Unsafe or unknown field is present
- **WHEN** the handoff contains a raw URL, credential-like value, absolute path, private payload, or an unknown key
- **THEN** the host rejects the handoff before issuing a launch descriptor and records only a redacted stable reason code

### Requirement: Bridge V2 MUST normalize expiry and nonce validation
Each V2 handoff MUST include an epoch-millisecond expiry and a cryptographically random nonce of exactly 32 lowercase hexadecimal characters, and consumers MUST validate both before resolving owner data.

#### Scenario: Fresh handoff has a valid nonce
- **WHEN** a handoff is within its bounded TTL and its nonce matches `^[0-9a-f]{32}$`
- **THEN** expiry and nonce validation succeeds and processing may continue

#### Scenario: Handoff is expired or nonce is malformed
- **WHEN** the expiry is in the past or the nonce does not match the required format
- **THEN** the consumer returns `expired` or `contract_mismatch` respectively and performs no owner mutation

### Requirement: DSH Client MUST launch only through a host-approved descriptor
The DSH Client MUST activate Workbench through a host-approved launcher using an opaque short-lived `launchRef` and MUST NOT construct arbitrary origins, paths, query strings, or iframe bridges.

#### Scenario: Approved target is available
- **WHEN** the target registry and V2 capability probe are fresh and the host issues a launch descriptor
- **THEN** the Client invokes the approved launcher with the opaque `launchRef` and displays the declared target surface and presentation intent

#### Scenario: Target is unavailable or unapproved
- **WHEN** no approved target registry entry exists, the capability is stale, or the launcher is unavailable
- **THEN** the Client disables the launch action with a stable reason and does not guess or compose a fallback URL

### Requirement: Presentation intents MUST map deterministically to Workbench lenses
The bridge MUST use a closed presentation-intent enum and the Workbench consumer MUST map each intent to the specified `/agent` Spatial lens without route guessing.

#### Scenario: Creative Production intent is consumed
- **WHEN** the intent is `open_show`, `open_episode`, or `open_artifact`
- **THEN** Workbench opens the Creative Production lens focused on the referenced show, episode, or artifact

#### Scenario: Review or evidence intent is consumed
- **WHEN** the intent is `open_review` or `open_evidence`
- **THEN** Workbench opens the Review or Evidence lens focused on the authorized referenced context

#### Scenario: Unknown presentation intent is received
- **WHEN** the consumer receives an intent outside the closed enum
- **THEN** it returns `contract_mismatch` and does not approximate the intent with another lens

### Requirement: Workbench MUST reauthorize and refetch owner data
The Workbench server-side ingress MUST revalidate user, tenant, workspace, project, resource, version, and intent authorization and MUST refetch authoritative owner data before enabling display or mutation.

#### Scenario: Authorized current resource opens
- **WHEN** the current principal may access the referenced resource and the supplied version matches owner state
- **THEN** Workbench refetches the resource and opens the requested lens using owner-authored data and permissions

#### Scenario: Resource version is stale
- **WHEN** the referenced resource exists but `resourceVersion` or `contextRevision` differs from owner state
- **THEN** Workbench returns `reconcile_required`, exposes the version mismatch, and performs no silent overwrite

#### Scenario: Principal is unauthorized
- **WHEN** the current principal cannot access the tenant, workspace, project, or resource
- **THEN** Workbench returns `denied` without disclosing protected resource details

### Requirement: Consumption MUST be replay-safe and idempotent
The Workbench ingress MUST maintain a bounded replay record keyed by tenant, nonce, and contract version so identical retries return the same result and conflicting reuse is rejected.

#### Scenario: Identical envelope is submitted twice
- **WHEN** the same nonce and canonical payload are submitted more than once within the replay window
- **THEN** the ingress returns the original consumption result without duplicating owner mutation or creating a second domain record

#### Scenario: Nonce is reused with a different payload
- **WHEN** the same tenant, nonce, and contract version are submitted with a different canonical payload
- **THEN** the ingress returns `replay_conflict` and performs no owner mutation

### Requirement: Unknown and partial outcomes MUST require reconciliation
Unknown, partial, timeout, cancel-unknown, and stale-cursor outcomes MUST disable mutation and MUST NOT cause the browser to auto-retry, replace a writer, or synthesize terminal state.

#### Scenario: Launch outcome is unknown
- **WHEN** the launcher times out without a confirmed Workbench consumption result
- **THEN** the Client reports an unknown outcome, preserves the evidence reference, and requires an explicit status check or a newly issued handoff

#### Scenario: User requests a new handoff after an unknown outcome
- **WHEN** the user explicitly requests another handoff
- **THEN** the host issues a new nonce and launchRef while retaining the prior attempt as separate evidence

### Requirement: V2 MUST coexist with legacy bridge contracts during migration
The provider MUST preserve the existing V1 signer, validator, and explicit legacy adapter for at least two consecutive DSH plugin release windows and MUST NOT change legacy field meanings during that period.

#### Scenario: Consumer advertises V2 support
- **WHEN** a fresh capability probe advertises `dsh.workbench_ai_drama_bridge.v2`
- **THEN** DSH prefers V2 and records the selected contract version

#### Scenario: Consumer advertises only legacy support
- **WHEN** a fresh capability probe advertises only a supported legacy contract
- **THEN** DSH uses the explicit legacy adapter, labels the result `legacy_bridge`, and does not report V2 consumption

#### Scenario: No compatible consumer is advertised
- **WHEN** the target advertises neither V2 nor a supported legacy contract
- **THEN** DSH disables the launch action with a compatibility reason and does not issue an unusable handoff

### Requirement: Bridge evidence MUST be stable and redacted
DSH and Workbench MUST emit compatible bridge event categories and stable reason codes using only contract version, intent, target surface, timestamps, versions, and opaque evidence or correlation refs.

#### Scenario: Handoff is consumed successfully
- **WHEN** Workbench opens the authorized target lens
- **THEN** the systems record `bridge_issued`, `bridge_launch_requested`, and `bridge_consumed` evidence that can be correlated without exposing the nonce or full envelope

#### Scenario: Handoff fails validation or authorization
- **WHEN** the bridge is denied, expired, mismatched, replay-conflicted, or unavailable
- **THEN** the systems record the corresponding stable event and redacted reason without recording secrets, raw prompts, private payloads, or absolute paths

### Requirement: Cross-repository conformance MUST gate rollout readiness
The DSH provider MUST publish versioned canonical fixtures and expected results, and rollout readiness MUST require both the DSH provider and Workbench consumer to pass the matching fixture version.

#### Scenario: Provider-only tests pass
- **WHEN** DSH typed probes, bundle checks, and provider fixtures pass but no matching Workbench consumer evidence exists
- **THEN** the change may be reported as plugin-complete but MUST NOT be reported as cross-repository rollout-ready

#### Scenario: Both repositories pass matching fixtures
- **WHEN** DSH and Workbench pass the same fixture version for intents, validation, versions, replay, permissions, and capability fallback
- **THEN** the release evidence may mark the bridge cross-repository rollout-ready for canary enablement

### Requirement: The bridge MUST preserve domain ownership boundaries
The bridge MUST remain a safe projection and launch mechanism and MUST NOT create or own a scheduler, task ledger, writer lease, approval ledger, capacity reservation, terminal result, or browser-side domain store.

#### Scenario: Workbench opens from a DSH handoff
- **WHEN** a valid handoff is consumed
- **THEN** all run, task, lease, approval, verification, evidence, closeout, and creative resource state remains owned and authored by its existing server-side owner
