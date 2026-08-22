# fs-watch

Additive `FileWatchCapabilityV1`：opaque entry refs，禁止绝对路径。

- Rebased onto upstream/master: `b150a551b8d`
- 来源分支：`yeisme/deepseek-harness` `pr/fs-watch`（commit `9e2e85a35`）
- 上游 compare：https://github.com/deepseek-ai/deepseek-harness/compare/master...yeisme:deepseek-harness:pr/fs-watch
- Status: fork-ready（分支 + compare；不开官方 PR，也不在 fork master 上开审查 PR）
- Verify: `vitest run packages/fs/fs/tests/watch.spec.ts` 3/3
