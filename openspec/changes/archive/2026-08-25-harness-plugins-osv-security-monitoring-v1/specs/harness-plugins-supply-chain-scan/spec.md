# harness-plugins-supply-chain-scan

## ADDED Requirements

### Requirement: harness-plugins SHALL run weekly OSV-Scanner without failing pull requests
`.github/workflows/security.yml` SHALL run OSV-Scanner v2.5.1 on a weekly schedule and workflow_dispatch. The first wave MUST use `continue-on-error`.

#### Scenario: Monday schedule fires
- **WHEN** the weekly cron runs
- **THEN** the workflow SHALL produce a SARIF or table artifact under `temp/security/`
- **AND** SHALL NOT be required by the pull_request fast CI job

### Requirement: harness-plugins MUST NOT add govulncheck
This repository is Bun/TypeScript. CI MUST NOT install or run `govulncheck`.

#### Scenario: A maintainer copies the Go template
- **WHEN** the security workflow is added
- **THEN** it SHALL only run OSV-Scanner
- **AND** MUST NOT add a Go vulnerability scanner step
