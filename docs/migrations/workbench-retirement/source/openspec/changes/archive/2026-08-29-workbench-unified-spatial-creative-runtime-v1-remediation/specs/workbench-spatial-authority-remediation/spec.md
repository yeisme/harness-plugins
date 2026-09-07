## ADDED Requirements

### Requirement: Spatial proposal acceptance SHALL be TaskService-gated
An accepted spatial change-set, including every user-acceptable layout proposal, MUST create a canonical ProposalAuthority decision and exactly one TaskService task before Board mutation. The Board executor MUST load frozen facts from the accepted proposal and MUST emit the canonical task, snapshot and Board receipt; the browser MUST NOT invoke a direct Board mutation path.

The public `orbit.proposal.accept` catalog entry MUST remain unavailable unless the ProposalAuthority flag and at least one real sealed target contract are both bound. `spatial.change_set.apply` MUST be internal-only: direct TaskService submission is rejected before persistence, while the accepted canonical task may dispatch it from frozen facts.

#### Scenario: User accepts a layout proposal
- **WHEN** a current spatial proposal is accepted
- **THEN** ProposalAuthority records the decision and TaskService creates the mutation task before the Board executor commits atomically
- **AND** the UI shows decision, task and Board receipt as separate non-atomic authority steps

#### Scenario: Direct sealed-target submission
- **WHEN** a browser, CLI or ordinary TaskService caller submits `spatial.change_set.apply`
- **THEN** the request MUST fail closed before any Task or Board mutation is persisted
- **AND** only the existing accepted `orbit.proposal.accept` Task may dispatch the sealed target

### Requirement: Spatial apply replay SHALL remain identity-safe
Apply success and idempotent replay MUST include the original task ref, post-commit canonical snapshot and receipt. Conflict, decision_unknown and unknown_accept MUST expose only the original reconcile identity and MUST NOT create a replacement Task or Board mutation.

#### Scenario: Accept response is lost
- **WHEN** an accept request may have completed but its response is unavailable
- **THEN** a retry with the same idempotency identity returns the original task/snapshot/receipt or a reconcile-only result
- **AND** no second Board revision is committed
