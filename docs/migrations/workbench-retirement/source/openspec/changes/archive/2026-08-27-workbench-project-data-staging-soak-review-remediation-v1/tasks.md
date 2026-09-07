## 1. Implementation

- [x] 1.1 Restrict the API Identity mount to the CA PEM and add compose coverage.
- [x] 1.2 Bind incident evidence to task and normalized scope, with coverage of the full SLO window.
- [x] 1.3 Bind raw Identity rotation receipts to the authorized attempt and window.
- [x] 1.4 Accept only incident evidence whose declared window covers the actual SLO window; retain task/scope equality.

## 2. Verification

- [x] 2.1 Run focused Go and Bun contracts, static compose render, strict OpenSpec validation, and diff check.
- [x] 2.2 Re-run the focused gate for the coverage-window remediation.
