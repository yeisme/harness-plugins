# Ordo slash commands

English | [中文](ordo-slash-commands.zh.md)

The DSH command surface is a safe projection and owner handoff. Ordo remains
the owner of runs, tasks, leases, approvals, receipts, reconciliation, and
composition facts. The command plugin never creates a local ledger or retries
an uncertain action.

## Syntax

| Command | DSH behavior | Mutation |
| --- | --- | --- |
| `/ordo` / `help` | Show the four-line command contract | No |
| `/ordo status [safe-ref]` | Read the current owner snapshot | No |
| `/ordo capacity` | Read owner-provided capacity facts | No |
| `/ordo preview <safe-ref>` | Read composition preview when its owner contract is mounted | No |
| `/ordo qualify <preset-id>` | Return a preview-only handoff to the Ordo owner | No |
| `/ordo reconcile <safe-ref>` | Display a current server-authored reconcile descriptor | No |
| `/ordo approve <decision-ref>` | Forward the current decision ref and preview digest to the owner CAS boundary | Owner-confirmed only |
| `/ordo run launch\|cancel\|redispatch` | Explain that the DSH surface is not available for these operations | No |

Every successful response uses `Conclusion`, `Freshness / status`, `Safe refs /
summary`, and `Next action`. Unsafe refs, paths, URLs, credentials, control
characters, and extra arguments are rejected without echoing the input.

## Action staging

`reconcile` is available only when the owner snapshot is fresh, ready, and
explicitly marked `reconcile_required`. The descriptor must provide the exact
target, effect, owner, decision reference, expiry, preview digest, and contract
digest. DSH only renders this descriptor.

`approve` re-reads the current snapshot, checks the decision reference and
expiry, and forwards the decision reference, preview digest, and bound tenant /
workspace / principal context to the injected owner action source. An accepted
receipt is rendered as owner-confirmed. `still_unknown` and
`reconcile_required` are rendered as non-retryable outcomes; DSH never invents
a success or replacement action.

`qualify` reads only the mounted composition preview's safe envelope when that
owner is available, then returns the target, health/drift summary,
`capability_digest`, and exact owner CLI handoff. A missing, malformed, or
failed projection stays unavailable. Until the independent composition and
Ordo owners expose a complete typed action contract, it does not calculate
maturity, risk, qualification, approval, or receipt locally.

## Local verification

```bash
pnpm --filter @yeisme/dsh-ordo-agent-ops run typecheck
pnpm --filter @yeisme/dsh-ordo-agent-ops run test
pnpm --filter @yeisme/dsh-ordo-agent-ops run build
openspec validate dsh-ordo-command-interaction-v1 --strict --no-interactive
```

The real owner action source and DSH client popup / panel integration remain
owner-gated. Do not substitute a browser fetch, a local optimistic state, or a
second scheduler for those contracts.
