# git-typed-actions

`GitTypedActionsCapabilityV1` 封闭 action 集。任意 argv 拒绝；`worktree.remove` 不释放 Ordo lease。

- Rebased onto upstream/master: `b150a551b8d`
- 来源分支：`yeisme/deepseek-harness` `pr/git-typed-actions`（commit `28ec98cc5`）
- Fork review PR：https://github.com/yeisme/deepseek-harness/pull/9
- 上游 compare：https://github.com/deepseek-ai/deepseek-harness/compare/master...yeisme:deepseek-harness:pr/git-typed-actions
- Status: fork-ready（不向 deepseek-ai 开官方 PR）
- Verify: `vitest run packages/host/git/tests/typed-actions.spec.ts` 3/3
