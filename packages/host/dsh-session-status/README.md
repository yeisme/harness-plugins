# @yeisme/dsh-session-status-host

Host owner of `session.status.snapshot.v1alpha1`.

- Snapshot is the current specified session only: identity, lifecycle,
  optional runtime labels, context remaining, and at most 4 Provider
  limit windows.
- Context used/limit/remaining come from official tokenMeter or an
  explicit owner projection. The process token-usage ledger is not a
  substitute and is never divided into a remaining ratio.
- Provider limit windows come from registered adapters. Balance amounts
  are not converted into remaining ratios.
- Missing sources stay `unavailable` / `unsupported` with a safe
  message. The host never fills 0, 100%, or a invented reset time.
- Wire rejects credential-shaped keys, URLs, absolute paths, and
  unknown fields.

```bash
pnpm --filter @yeisme/dsh-session-status-host test
pnpm --filter @yeisme/dsh-session-status-host typecheck
```
