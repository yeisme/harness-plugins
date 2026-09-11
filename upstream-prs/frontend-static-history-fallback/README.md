# frontend-static-history-fallback

Additive SPA history fallback for `dsh-host-frontend-static` + a `web-app` config forward (dsh-url-session-v1 §5).

- Rebased onto upstream/release branch: `a66e470`（`dsh-v0.1.2-rc.1`；本仓 staging `temp/dsh-unified-host-source` 同基）
- 来源分支：`yeisme/deepseek-harness` `pr/frontend-static-history-fallback`
- Status: fork-ready（staging apply 验证绿；不开官方 PR——按仓规 `Upstream Seam Channel` 走 fork 分支 + compare，官方合入不是插件完成门）
- Verify: 对干净 `dsh-v0.1.2-rc.1` checkout 执行 `apply.sh <checkout>` 后
  `pnpm exec vitest run packages/host/frontend-static/tests/history-fallback.spec.ts`（7/7）
  + 本仓 staging 实测同绿（2026-09-11）。

## What it adds

1. `frontend-static` Config 新增 `historyFallback`（默认 **false**，存量部署语义零变化）。
2. `serveStatic` 增加可选 `shouldFallback` 决策回调：GET/HEAD 静态 miss 时按调用方判定改渲染
   认证后的 index（走同一 `renderIndex`/`authorizeIndex` 路径），否则保持既有 404。
3. 决策规则（`web-app` 组合层）：路径无扩展名（path route，如 `/s/<id>`）恒回退；带扩展名仅当
   `Accept` 含 `text/html` 才回退。非 GET/HEAD 405、越界 403、带扩展名未命中且非 html Accept 404
   ——全部维持原语义。
4. `web-app` Config 新增 `historyFallback` 并前传给组合的 frontend-static（默认 false；部署/profile
   层可 restate 为 true）。

## 判定矩阵（tests 覆盖）

| 方法 | 路径 | Accept | 结果 |
| --- | --- | --- | --- |
| GET/HEAD | 无扩展名 miss | 任意 | fallback 开→index；关→404 |
| GET/HEAD | 带扩展名 miss | 无 text/html | 404 |
| GET/HEAD | 带扩展名 miss | 含 text/html | fallback 开→index |
| 非 GET/HEAD | 任意 | 任意 | 405（调用方门，不变） |
| 任意 | 越界 traversal | 任意 | 403（不变，fallback 不豁免） |
| GET/HEAD | dist 根/index | 任意 | 认证 index（不触 fallback） |
| GET/HEAD | 存在资产 | 任意 | 资产（不触 fallback） |

## 应用通道

- 本仓 staging：`scripts/dsh-workbench.mjs` 幂等调用本系列 `apply.sh`（缺 `historyFallback` 标记即应用）。
- 上游：`https://github.com/deepseek-ai/deepseek-harness/compare/master...yeisme:deepseek-harness:pr/frontend-static-history-fallback`

## 与 dsh-url-session-v1 的关系

P1（`?s=` 别名）零服务器改动即可用；本系列是 P2 `/s/<id>` 硬刷新的判定矩阵层。Yeisme web
profile 默认保持 false（canonical 形式在 client 侧仍按 alias 生成），profile 层 restate
`web-app.historyFallback: true` 后 client 的 `hasHistoryFallback` 选项随之切 canonical。
