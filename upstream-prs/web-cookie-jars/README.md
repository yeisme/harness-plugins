# web.cookieJars

Host-owned cookie jar apply/switch/clear。插件只交换 profile ref 与 receipt。

- Rebased onto upstream/master: `b150a551b8d`
- 来源分支：`yeisme/deepseek-harness` `pr/web-cookie-jars`（commit `ef5a1cf55`）
- 上游 compare：https://github.com/deepseek-ai/deepseek-harness/compare/master...yeisme:deepseek-harness:pr/web-cookie-jars
- Status: fork-ready（分支 + compare；不开官方 PR，也不在 fork master 上开审查 PR）
- Verify: `vitest run packages/web/web/tests/cookie-jars.spec.ts` 3/3
