# @yeisme/dsh-client-ui-session-status

Client mirror of `session.status.snapshot.v1alpha1`.

- Capsule, Popover, Pane, and `/status` share one view model.
- Context remaining is never inferred from the token-usage process ledger.
- Missing Host remotes degrade to unavailable with a safe message.
- Existing `token-usage-open` / `workspace.token-usage` stay the Tokens owner.

```bash
pnpm --filter @yeisme/dsh-client-ui-session-status test
pnpm --filter @yeisme/dsh-client-ui-session-status typecheck
```
