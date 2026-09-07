## ADDED Requirements

### Requirement: AI drama exceptions MUST render in the Spatial Review Lens
Candidate conflict、rights/cost gate、stale refs、unknown/partial settlement and repair proposals MUST render as bounded exception overlays and Review rows associated with their spatial safe refs. Ordinary success MUST remain in Creative Production or Run projection.

#### Scenario: Candidate conflict is selected on the surface
- **WHEN** the user selects a projected candidate conflict
- **THEN** the Review Lens MUST show server-authored comparison, target/version, impact, rights/cost/risk, reversibility and confirmation
- **AND** no accept/reject/repair control MAY be enabled without a current action descriptor

### Requirement: Review decisions MUST retain ProposalAuthority and Task receipts
Accept、reject and repair decisions from the Spatial Review Lens MUST use the existing ProposalAuthority/TaskService contract. Hover、focus、Lens open、Agent highlight and repeated input MUST NOT decide a proposal.

#### Scenario: Review descriptor expires while open
- **WHEN** the user submits a decision after descriptor expiry or target version drift
- **THEN** Workbench MUST reject the submission, reread the projection and require a new explicit confirmation
- **AND** MUST NOT reuse the stale decision as a mutation basis
