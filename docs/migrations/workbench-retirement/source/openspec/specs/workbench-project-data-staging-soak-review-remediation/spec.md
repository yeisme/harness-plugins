# workbench-project-data-staging-soak-review-remediation Specification

## Purpose

Staging-soak 收口评审整改：收紧本地 staging soak 的信任边界——API 只挂载
Identity JWKS CA PEM、incident evidence 绑定到具体 run 与完整 SLO 窗口、
Identity rotation 原始回执仅接受 run 授权的 attempt。

## Requirements

### Requirement: API Identity trust material MUST be CA-only

The staging API SHALL mount only the configured Identity JWKS CA PEM at its
fixed client path. The pinned Identity TLS proxy SHALL retain exclusive access
to its certificate and private key directory.

#### Scenario: Compose is inspected
- **WHEN** the staging compose file is statically inspected
- **THEN** the API MUST have a single CA-file mount for its JWKS client
- **AND** it MUST NOT mount the Identity TLS directory or key path

### Requirement: Incident evidence MUST bind the full soak run

The incident-evidence schema SHALL include the exact task ref, normalized
scope, and declared observation start/finish instants. A passing SLO SHALL
require task and scope equality and require the declared evidence window to
cover the complete evaluated run: evidence start at or before soak start and
evidence finish at or after soak finish.

#### Scenario: Evidence window covers the run
- **WHEN** incident evidence has the exact task/scope and a declared window
  wider than the SLO observation window
- **THEN** the evidence MUST be accepted

#### Scenario: Evidence belongs to another run
- **WHEN** task or scope differs from the soak run, or the evidence start is
  later than soak start, or evidence finish is earlier than soak finish
- **THEN** evaluation MUST fail closed with incident evidence required

### Requirement: Identity rotation evidence MUST be run-authorized

The soak configuration and SLO report SHALL contain one opaque authorized
Identity rotation attempt ID. Finalization SHALL accept the raw owner receipt
only if its `attempt_id` equals that ID and `rotated_at` is inside the SLO
observation window.

#### Scenario: Rotation receipt is historical or foreign
- **WHEN** the raw receipt has another attempt ID or a timestamp outside the
  SLO window
- **THEN** finalization MUST fail without creating a passing staging receipt
