## Why

Final review found three follow-on staging-soak trust-boundary gaps: the API
could read the Identity TLS directory, incident evidence was not bound to its
run, and raw Identity rotation receipts could be historical or foreign.
Re-review found the initial incident-window equality rule unusable because the
run's completion time is unknown when evidence is prepared.

## What Changes

- Mount only the Identity JWKS CA PEM into the Workbench API; retain the proxy
  certificate and key exclusively in the TLS proxy.
- Version and bind incident evidence to the exact task and normalized scope,
  with a declared coverage window that contains the complete SLO observation
  window.
- Record the run-authorized Identity rotation attempt in the SLO report and
  accept the raw owner receipt only for that attempt within that window.

## Impact

- Local-only staging compose, soak policy, command parsing, and redacted
  artifacts change. No owner source, container execution, secret value, or
  staging/production call is introduced.
