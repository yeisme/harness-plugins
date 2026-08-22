# session.forkBeforeMessage

Additive host RPC for first-round Edit/Retry (`seedLength: 0`).

- Rebased onto upstream/master: `b150a551b8d`（dsh 0.1.1-rc.2）
- 来源分支：`yeisme/deepseek-harness` `pr/session-fork-before-message`（commit `c9ee55272`）
- 上游 compare：https://github.com/deepseek-ai/deepseek-harness/compare/master...yeisme:deepseek-harness:pr/session-fork-before-message
- Status: fork-ready（分支 + compare；不开官方 PR，也不在 fork master 上开审查 PR）
- Apply: `./apply.sh <clean-checkout>`
- Verify: `vitest run packages/host/apiproxy/tests/api-proxy-fork.spec.ts packages/client/runtime/tests/sessions-service.client.spec.ts` 54/54 + note-format + pairing

语义：定位 `atMessageSeq`；seed 取该 seq 之前最近一次已完成 `turn/end`；没有则 `seedLength: 0`。cwd / parentSession / workspace 与 `session.fork` 相同。未知 seq 返回 `fork-unavailable`。
