# session-history-usage-identity

全历史用量身份与覆盖 seam 请求（proposal-only，无源码 patch）：为完整 session 消费聚合提供跨 retry/fork/子 Agent 的权威 request/attempt 身份，以及历史覆盖保证。

- Date: 2026-09-05
- 基线：upstream/master `b150a551b8d`（dsh 0.1.1-rc.2，沿用同仓既有 seam 系列的登记基线）
- 目标分支：`yeisme/deepseek-harness` `pr/session-history-usage-identity`（staging worktree 内验证后登记 compare）
- Status: proposal（probe-first；不开官方 PR，也不在 fork master 上开审查 PR；官方未合入前插件对整段消费标记 partial/unknown）
- Apply: `./apply.sh <deepseek-harness-checkout>`（占位，待 seam 合同确认后生成 changes.patch）
- 来源 openspec change：`dsh-session-insights-and-status`（本仓 openspec/changes/）

## Rationale

`dsh-session-insights-and-status` 要求按 session/run/range 聚合完整历史消费，且：重发事件幂等、同一 attempt 流式增量与最终累计不双计、不同 retry attempt 各计实际消费、fork 继承历史不作为新消费重复计费、子 Agent 消费默认分列。只读检查发现：官方 token-meter 有投影与流式/最终用量测试，但没有已证实的跨 retry/fork/子 Agent 权威 request identity，也没有全历史覆盖（complete/partial/unknown）合同。没有这两项 owner 证据，本仓只能把整段消费标记 partial/unknown，不能用进程观察数据冒充 complete。因此提出本增量 seam。

## Proposed contract sketch

```ts
// packages/host/.../history-usage-identity.d.ts（建议草稿，最终归属由上游决定）

/** 权威请求身份：跨重试/分叉/子 Agent 稳定，可用于去重。 */
export interface RequestIdentityV1 {
  readonly sessionRef: string
  readonly requestRef: string
  readonly attemptRef: string
  readonly parentSessionRef?: string   // fork/子 Agent 来源
  readonly rootRequestRef?: string     // 跨来源去重锚点
  readonly occurredAt: string          // ISO 时间，用于 range/today/week 归属
}

/** 历史覆盖保证：只有 owner 确认范围完整且请求已归一化时为 complete。 */
export interface HistoryCoverageV1 {
  readonly state: 'complete' | 'partial' | 'unknown'
  readonly knownRequests?: number
  readonly missingUsageRequests?: number
  readonly availableRange?: { readonly from: string; readonly to: string }
  readonly reasonCode?: string
  readonly safeMessage?: string
}

/** 官方历史/用量 owner 提供的只读 seam。 */
export interface SessionHistoryUsageIdentityV1 {
  resolveIdentity(ref: { readonly sessionRef: string; readonly requestRef: string }): Promise<RequestIdentityV1 | null>
  coverage(query: { readonly sessionRef: string; readonly from?: string; readonly to?: string }): Promise<HistoryCoverageV1>
}
```

约束：身份与覆盖均为只读事实；unknown 不填零；无归属证明时不提供合并总数；结果与日志不含正文、provider payload、凭据或绝对路径。

## Focused verification（staging worktree 内，待实现后执行）

```bash
pnpm install --frozen-lockfile
pnpm exec tsc -p <seam 包 tsconfig> --noEmit
pnpm exec vitest run <seam 包聚焦测试>
```

验证点：同 attempt 重放返回同一身份；不同 retry attempt 身份可分；fork 继承请求带 parentSessionRef 且不计入子会话新消费；历史缺口时 coverage 返回 partial/unknown 及安全原因，绝不伪造 complete。

## Stance

不开官方 PR；发布版未合入前插件继续 capability probe，本仓 query 合同在缺 owner 证据时只报 partial/unknown。本地同路径跟进：`scripts/upstream-canary.sh {resolve|install-smoke|overrides-test}` 与 `.github/workflows/pr-rebase.yml`。
