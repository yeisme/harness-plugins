# login-token-auth

dsh login token remote access (--token CLI auth + client token-auth + web-app wiring)

- Archived: 2026-08-20T15:44:01Z
- Base commit: `141eb6fef83422698aef7a981029e843e8161534` (deepseek-harness, dsh 0.1.0-rc.8 merge)
- `changes.patch`: diff of tracked files (includes staged additions).
- `new-files/`: untracked source files to copy in (apply.sh handles this).
- Apply: `./apply.sh <clean-checkout>` then run the package tests listed below.

## Files
```
 apps/cli/README.md                                 |  3 ++
 apps/cli/src/args.ts                               | 21 ++++++++-
 apps/cli/src/bin.ts                                |  5 ++
 apps/cli/tests/args.spec.ts                        |  9 ++++
 packages/bundle/web-app/README.md                  |  2 +-
 packages/bundle/web-app/cordis.patch.yml           |  2 +
 packages/bundle/web-app/src/index.ts               | 13 +++++-
 packages/bundle/web-app/src/startup.ts             | 12 +++--
 packages/bundle/web-app/tests/startup.spec.ts      | 35 +++++++++++++-
 packages/client/connection/README.md               | 10 +++-
 packages/client/connection/src/index.ts            | 52 ++++++++++++++++++++-
 .../client/connection/tests/node-half.host.spec.ts | 54 +++++++++++++++++++++-
 packages/client/connection/tsconfig.host.json      |  1 +
# untracked additions:
.agents/notes/proposed/architecture/2026-08-19-dsh-login-token-remote-access.md
apps/cli/src/auth-store.ts
apps/cli/src/auth.ts
apps/cli/tests/auth-store.spec.ts
packages/client/connection/src/token-auth.ts
packages/client/connection/tests/token-auth.host.spec.ts
```
