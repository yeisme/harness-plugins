# url-session-web-resume

`dsh --profile web --resume <session-id>` for `dsh-web-app`（dsh-url-session-v1 §6.1）。

- 依赖：先应用 `frontend-static-history-fallback`（本系列的 canonical 形式依赖其开关；未应用时
  `--resume` 退化为 `?s=` 别名，不失效）。
- Base：`a66e470`（`dsh-v0.1.2-rc.1`）+ frontend-static-history-fallback 系列。
- 来源分支：`yeisme/deepseek-harness` `pr/url-session-web-resume`；Status: fork-ready
  （staging 链式 apply 验证绿；不开官方 PR，按仓规 Upstream Seam Channel 走 fork 分支）。
- Verify：`apply.sh <checkout>` 后 `pnpm exec vitest run packages/bundle/web-app/tests/resume-url.spec.ts`（5/5），
  连同 history-fallback 矩阵 12/12（2026-09-11 staging 实测）。

## What it adds

1. `web-app/startup.ts`：`--resume <session>` flag（session 字面量校验，非法即 usage error），
   `WebStartupValues.resumeSession`。
2. `web-app/src/index.ts`：Config `resumeSession` + 纯函数 `resumeUrlSuffix(id, historyFallback)`
   ——historyFallback 开→`/s/<id>` canonical，关→`/?s=<id>` 别名；非法/缺省不追加。
   URL 行与浏览器 handoff（含 LAN 候选 URL）都拼接该后缀；`--no-open` 时打印的完整 URL 即可分享。
3. `web-app/cordis.patch.yml`：web-runtime 行前传 `resumeSession: !!js ctx.webStartup.resumeSession ?? undefined`。

## 安全

URL 只含 origin + SessionId（校验后的字面量，一次 encodeURIComponent）；不携带 token——
authenticatedUrl 包装保持原语义。

## 与 dsh-url-session-v1 的关系

§6.1 交付；§6.2（会话内 `/url` 命令）与 §6.3（handoff 只读字段）待各自 seam/切片。
