# git-typed-actions

`GitTypedActionsCapabilityV1` 封闭 action 集。任意 argv 拒绝；`worktree.remove` 不释放 Ordo lease。

- Rebased onto upstream/master: `b150a551b8d`
- 来源分支：`yeisme/deepseek-harness` `pr/git-typed-actions`（commit `28ec98cc5`）
- 上游 compare：https://github.com/deepseek-ai/deepseek-harness/compare/master...yeisme:deepseek-harness:pr/git-typed-actions
- Status: fork-ready（分支 + compare；不开官方 PR，也不在 fork master 上开审查 PR）
- Verify: `vitest run packages/host/git/tests/typed-actions.spec.ts` 3/3
