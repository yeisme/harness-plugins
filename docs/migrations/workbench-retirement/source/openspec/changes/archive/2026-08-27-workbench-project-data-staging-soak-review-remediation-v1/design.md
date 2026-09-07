## Decisions

The API receives an operator-provided CA PEM as a single read-only bind mount
at `/run/workbench-secrets/identity-ca.pem`. The `identity-tls` proxy remains
the only service with the certificate/key directory.

Incident evidence v2 contains the task ref, normalized scope, and declared
observation start/finish instants. The evaluator and finalizable report require
that window to cover the full SLO window, while allowing a wider pre-published
coverage record. They reject any task/scope mismatch or coverage gap, so zero
P0/P1 cannot be transplanted from another run.

The soak run accepts one opaque authorized rotation attempt ID and persists it
in the SLO report. Finalization accepts the raw Identity receipt only when its
attempt ID equals that authorization and its rotation time is within the report
window. Action-output hashes remain the byte-level binding.

## Verification

- Focused Go tests cover a wider valid incident window, cross-task/cross-scope
  evidence, start/end coverage gaps, and foreign/historical rotation receipts.
- Bun compose contract verifies the API has no TLS-directory mount.
- Compose rendering remains static-only and does not create services.
