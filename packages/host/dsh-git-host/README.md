# @yeisme/dsh-git-host

Typed Git action host for DSH Git Manager. Arbitrary argv is rejected. Missing
`GitTypedActionsCapabilityV1` is `contract_mismatch`. `worktree.remove` never
maps to Ordo `lease.release`.

```bash
pnpm --filter @yeisme/dsh-git-host run typecheck
pnpm --filter @yeisme/dsh-git-host run test
pnpm --filter @yeisme/dsh-git-host run build
```
