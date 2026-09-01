# @yeisme/dsh-session-manager

Self-maintained DSH session manager host. DSH remains the canonical owner;
this package adapts official DSH services into safe projections for the
desktop workbench.

## Layout

- `src/index.ts` — `SessionManagerHostV1` contract, placeholder, host-context
  key (`dsh.sessionManagerHost`), late-binding resolvers, and the optional
  Cordis host plugin (default export) that mounts the production adapter.
- `src/adapter.ts` — production adapter over the official
  `sessionPersistence` / `workspaceRegistry` / `agents` seams (plus optional
  `sessionQuery` title folds). `listSessions` folds the header corpus with
  workspace grouping, the archive set, and live agent status; `archiveSession`
  goes through the durable workspace registry; `forkSession` uses the official
  agent factory with a balanced turn-boundary seed. Faces without an official
  seam (restore/trash/purge/labels/pause/resume) return typed
  `not_implemented` receipts with the reason — never fabricated data.

The plugin probes the official seams dynamically (terminal-host precedent):
when they are live it binds the real host and provides it on
`SESSION_MANAGER_HOST_CONTEXT_KEY`; when absent, consumers keep the honest
placeholder default (empty list, disabled actions).

## Development

```bash
pnpm --filter @yeisme/dsh-session-manager run typecheck
pnpm --filter @yeisme/dsh-session-manager run test
pnpm --filter @yeisme/dsh-session-manager run build
```
