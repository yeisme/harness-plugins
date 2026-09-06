# session-trajectory-locator

会话轨迹定位 seam 请求（proposal-only，无源码 patch）：让插件能把统计 Pane 中的请求行定位到既有 session Pane 内的官方 Trajectory。

- Date: 2026-09-05
- 基线：upstream/master `b150a551b8d`（dsh 0.1.1-rc.2，沿用同仓既有 seam 系列的登记基线）
- 目标分支：`yeisme/deepseek-harness` `pr/session-trajectory-locator`（staging worktree 内验证后登记 compare）
- Status: proposal（probe-first；不开官方 PR，也不在 fork master 上开审查 PR；官方未合入前插件侧禁用入口并说明原因）
- Apply: `./apply.sh <deepseek-harness-checkout>`（占位，待 seam 合同确认后生成 changes.patch）
- 来源 openspec change：`dsh-session-insights-and-status`（本仓 openspec/changes/）

## Rationale

`dsh-session-insights-and-status` 的统计 Pane 请求行只携带 opaque `sessionRef`、`runRef`、`requestRef`/`attemptRef` 或 owner 提供的 `eventRef`。点击后应定位同一 session Pane 内的官方 Trajectory，而不是新建脱离 session 的轨迹账本。只读检查发现：官方已发布 `.d.ts` 中不存在任何 trajectory 定位入口（全量 dsh-* 类型检索无 `trajectory`），插件无法在不读原始路径、不扫 DOM 的前提下完成导航。因此提出本增量 seam：安全 opaque ref 输入，导航结果输出；不暴露文件路径，不创建第二轨迹视图。

## Proposed contract sketch

```ts
// packages/host/.../trajectory-locator.d.ts（建议草稿，最终归属由上游决定）

/** 定位目标：全部为本仓已使用的安全 opaque ref，不含原始路径。 */
export interface TrajectoryLocateTargetV1 {
  readonly sessionRef: string
  readonly runRef?: string
  readonly requestRef?: string
  readonly attemptRef?: string
  readonly eventRef?: string
}

export type TrajectoryLocateResultV1 =
  | { readonly ok: true; readonly sessionRef: string; readonly focusedRef: string }
  | { readonly ok: false; readonly reasonCode: 'not_found' | 'unsupported' | 'forbidden'; readonly safeMessage: string }

/** 官方会话 renderer 提供的只读定位 seam；导航发生在既有 session Pane 内。 */
export interface SessionTrajectoryLocatorV1 {
  locate(target: TrajectoryLocateTargetV1): Promise<TrajectoryLocateResultV1>
}
```

约束：目标不存在或 seam 不支持时返回明确 reasonCode，调用方保留统计位置并显示原因；不得跳转到其他活动会话；结果与日志不包含原始路径、正文或凭据。

## Focused verification（staging worktree 内，待实现后执行）

```bash
pnpm install --frozen-lockfile
pnpm exec tsc -p <seam 包 tsconfig> --noEmit
pnpm exec vitest run <seam 包聚焦测试>
```

验证点：合法 ref 定位到同 session Trajectory；未知/跨会话/已删除 ref 返回 `not_found`/`forbidden` 且不导航；seam 缺席时结构探测返回 unsupported，插件入口禁用并说明原因。

## Stance

不开官方 PR；发布版未合入前插件继续 capability probe，缺失即禁用轨迹跳转并给出原因。本地同路径跟进：`scripts/upstream-canary.sh {resolve|install-smoke|overrides-test}` 与 `.github/workflows/pr-rebase.yml`。
