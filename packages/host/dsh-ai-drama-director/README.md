# @yeisme/dsh-ai-drama-director

AI Drama Director Pack host contracts: current-context resolution, typed
`/drama` handlers, snapshot+push events, Workbench handoff, Director preset,
single-show control projections, and redacted evidence.

`DramaShowControlOwnerAdapterV1` is an additive owner boundary for episode,
review, asset and delivery projections. The gateway binds tenant, workspace,
principal, show and runtime generation; enforces bounded pages/cursors and safe
refs; and returns only owner-issued action descriptors and receipts. It does
not own Show, Episode, Review, Approval, Run or Delivery state.

If no domain adapter is registered, clients receive an honest
`needs_contract`/`partial` projection and stable unlock reason. Unknown action
settlement is returned for owner reconciliation and is never automatically
retried by this package.

```bash
pnpm --filter @yeisme/dsh-ai-drama-director run test
```

This package does not own show/episode state. Missing owner seams stay disabled.
Official DSH decorate, CLI-authored bundle metadata, and live Workbench receipt
paths stay out of this package.
