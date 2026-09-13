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

## Pipeline gateway (`./pipeline-gateway`)

`CreativePipelineGateway` (service key `creativePipeline`, exported only from
the `./pipeline-gateway` subpath — never from the barrel, so the browser client
bundle that inlines the barrel never sees the host-only typert protocol) serves
the creative pipeline workbench a fail-closed snapshot envelope
(`dsh.creative-pipeline-workbench-snapshot.v1alpha1`). Layout, drafts and safe
references are read through the shared Creator Studio canvas storage seam
(same domain spec and `[tenantRef, workspaceRef, projectRef, documentId]` key);
the reader is read-only and never becomes a second canvas writer. Run
projections come from an optional `creativePipelineRunOwner` face; when it is
missing or violates the contract the run layer degrades to `needs_contract` /
`contract_mismatch` with empty collections — a `running` state is never
fabricated. The tenant/workspace/project context arrives via the server-provided
`creativePipelineExpectedContext` service and is re-fenced after every await;
without it every method fails closed.
