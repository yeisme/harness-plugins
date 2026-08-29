# login-token-auth

dsh digest-only token-store remote access (`dsh auth token` + POST exchange + opaque browser session)

- Archived: 2026-08-28T06:36:48Z
- Base commit: `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` (deepseek-harness, dsh 0.1.0-rc.8 merge)
- `changes.patch`: diff of tracked files (includes staged additions).
- `new-files/`: untracked source files to copy in (apply.sh handles this).
- Apply: `./apply.sh <clean-checkout>` then run the package tests listed below.

## Security contract

- Taught remote command: `dsh --profile web --host 0.0.0.0 --auth token-store --no-open`.
- `dsh auth token create/list/revoke` persists hashes only; plaintext is emitted once at create time.
- Browser login uses `POST /api/auth/token`; the access token never enters a URL or Cookie.
- Browser Cookie contains a random in-memory session. The gate reloads the digest store, so revoke invalidates existing sessions on their next request.
- Inline `--token`/`DSH_ACCESS_TOKEN` remains a deprecated one-minor compatibility ingress and is not the production path.

## Verification

From a clean checkout at the recorded base after running `apply.sh`:

```bash
pnpm install --frozen-lockfile
pnpm exec vitest run \
  apps/cli/tests/auth-store.spec.ts \
  apps/cli/tests/args.spec.ts \
  packages/client/connection/tests/token-auth.host.spec.ts \
  packages/client/connection/tests/node-half.host.spec.ts \
  packages/bundle/web-app/tests/startup.spec.ts \
  packages/bundle/web-app/tests/web-app.spec.ts
pnpm exec tsc -b packages/client/connection/tsconfig.host.json
```

Current focused result: 6 files / 52 tests passed; host TypeScript build passed.

## Files
```
 apps/cli/README.md                                 |  4 +
 apps/cli/src/args.ts                               | 21 +++++-
 apps/cli/src/bin.ts                                |  5 ++
 apps/cli/tests/args.spec.ts                        |  9 +++
 packages/bundle/web-app/README.md                  |  2 +-
 packages/bundle/web-app/cordis.patch.yml           |  3 +
 packages/bundle/web-app/src/index.ts               | 26 ++++++-
 packages/bundle/web-app/src/startup.ts             | 21 +++++-
 packages/bundle/web-app/tests/startup.spec.ts      | 47 +++++++++++-
 packages/client/connection/README.md               | 10 ++-
 packages/client/connection/src/index.ts            | 85 +++++++++++++++++++++-
 .../client/connection/tests/node-half.host.spec.ts | 73 ++++++++++++++++++-
 packages/client/connection/tsconfig.host.json      |  1 +
# untracked additions:
.agents/notes/proposed/architecture/2026-08-19-dsh-login-token-remote-access.md
apps/cli/src/auth-store.ts
apps/cli/src/auth.ts
apps/cli/tests/auth-store.spec.ts
packages/client/connection/src/token-auth.ts
packages/client/connection/tests/token-auth.host.spec.ts
```
