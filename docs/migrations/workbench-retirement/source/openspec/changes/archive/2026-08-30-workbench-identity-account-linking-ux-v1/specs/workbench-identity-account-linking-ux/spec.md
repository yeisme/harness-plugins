## ADDED Requirements

### Requirement: Typed account-linking consumer contract is closed and fail-closed
Workbench SHALL consume the Identity Platform account-linking capability only through a typed SDK/BFF sub-contract (`workbench.identity.accountlinking.v0.1`) covering discovery, list, start link, finalize, unlink, and status. Closed decode, bounded responses, closed request shapes, idempotency keys, and expected versions SHALL fail closed to `needs_contract`/`contract_mismatch` states; no local success is ever synthesized.

#### Scenario: Contract drift fails closed
- **WHEN** discovery/list responses carry an unsupported contract version, unknown fields, duplicate refs, or oversized payloads
- **THEN** the client returns `needs_contract`/`null` projections and no mutation entry point is enabled

#### Scenario: Capability is default-off
- **WHEN** the provider reports `enabled:false` or the capability is not wired
- **THEN** the pane hides link/unlink mutations and shows an honest read-only/needs_contract state

### Requirement: Browser never touches provider credentials or the owner directly
The browser SHALL only call the Workbench BFF over the same-origin typed transport; provider tokens, authorization codes, and raw payloads SHALL never enter browser state, URLs, logs, or evidence. BFF-to-owner requests SHALL carry opaque session/subject references only.

#### Scenario: No credential material in the browser surface
- **WHEN** the login methods pane renders, starts, finalizes, or unlinks
- **THEN** no provider token/code, email, subject, issuer, or tenant key appears in the DOM, request URLs, or status regions

### Requirement: Link/unlink UX follows the explicit state machine
The pane SHALL implement the frozen state model: explicit confirmation before link/unlink, pending owner receipt with opaque transaction reference, owner-authoritative re-auth projection, success receipts with server-side refresh, and guard states (`identity_conflict`, `last_login_method`, `session_expired`, `needs_contract`, `callback_replayed`, `rate_limited`) rendered as recovery guidance without moving bindings or implying auto-merge.

#### Scenario: Destructive unlink requires explicit confirmation
- **WHEN** a user removes a linked login method
- **THEN** the pane requires a separate confirmation that states data and tenant membership are unaffected, and the request carries the server-fresh expected version

#### Scenario: Last login method is protected
- **WHEN** the only active binding would be unlinked
- **THEN** the entry is disabled with guidance to link another method first, and the owner guard renders as a stable outcome

### Requirement: Unknown outcomes reconcile without replay
Unknown finalize outcomes SHALL enter `unknown_outcome` and converge only through the read-only status/reconcile channel; mutations SHALL never auto-replay, including after timeouts, dual-tab usage, or stale projections. Returning to the pane SHALL refresh the projection from the server rather than trusting browser history.

#### Scenario: Callback finalize is single-shot
- **WHEN** the provider callback lands with opaque transaction/receipt URL parameters
- **THEN** finalize runs exactly once with a transaction-derived idempotency key, the URL is cleaned, and the list refreshes from the server

#### Scenario: Unknown outcome does not replay
- **WHEN** finalize returns `unknown_outcome`
- **THEN** no further mutation is issued automatically and reconciliation uses the status channel only

### Requirement: Accessibility and safe projection in the settings surface
All outcomes and pending states SHALL be exposed through focusable `role="status"` regions; provider names and guidance SHALL come only from the allowlisted discovery projection; server error strings SHALL never be rendered raw; keyboard, screen-reader status, and narrow-screen responsive layouts SHALL be covered by component and browser tests.

#### Scenario: Status regions are screen-reader reachable
- **WHEN** any outcome or pending state is active
- **THEN** it renders inside a `role="status"` region that is attached and observable in component and browser journeys
