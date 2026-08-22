# login-token-auth

dsh login token remote access (`--token` CLI auth + client token-auth + web-app wiring)

- Archived: 2026-08-20T15:44:01Z
- Rebased onto upstream/master: `b150a551b8d`（dsh 0.1.1-rc.2）
- 来源分支：`yeisme/deepseek-harness` `pr/login-token-auth`（commit `50e5e85e5`）
- Fork review PR：https://github.com/yeisme/deepseek-harness/pull/2
- 上游 compare（当前 token 不能对 `deepseek-ai/deepseek-harness` 开 PR）：https://github.com/deepseek-ai/deepseek-harness/compare/master...yeisme:deepseek-harness:pr/login-token-auth
- `changes.patch`：相对 upstream/master 的 tracked diff（CLI flags、web-app wiring、connection token gate）。
- `new-files/`：auth-store/token-auth 源码 + 聚焦 spec + proposed Agent Note。
- Apply: `./apply.sh <clean-checkout>`；验证：聚焦 vitest 38/38 + `tsc -b packages/client/connection/tsconfig.host.json` + `verify-agent-note-format` 绿。

## Files

```
 apps/cli/README.md                                 | CLI token commands
 apps/cli/src/args.ts                               | --token / --host gate
 apps/cli/src/bin.ts                                | auth command family
 apps/cli/tests/args.spec.ts                        | CLI flag coverage
 packages/bundle/web-app/**                         | tokenAuth wiring
 packages/client/connection/src/index.ts            | tokenAuth config + gate
 packages/client/connection/src/token-auth.ts       | DshTokenGate
 packages/client/connection/tests/**                | token + node-half specs
 .agents/notes/proposed/architecture/2026-08-19-dsh-login-token-remote-access.md
```
