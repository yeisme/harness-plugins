# @yeisme/dsh-session-tags

可安装 bundle：`dsh plugin --profile web add ./packages/bundle/dsh-session-tags`。
组合 `@yeisme/dsh-session-tags-host`（sidecar + `sessionTags` Remote）与
`@yeisme/dsh-client-ui-session-tags`（provider + 编辑器）；规格见
`openspec/changes/dsh-session-tags-grouping-v1/`。

## 能力矩阵

| Surface | 状态 | 说明 |
| --- | --- | --- |
| Host sidecar（`yeisme.session-tags.v1` + `sessionTags.list/set`） | 可用 | 不依赖分组 seam，任何 DSH Host 均可挂载 |
| 按标签分组（`yeisme.session-tags` provider） | probe-gated | 需要上游 `ctx.sessionGroupings`（`SessionGroupingProviderV1Alpha1`）|
| 管理标签编辑器（`shell.overlay`） | probe-gated | 同上；未标记/归档过滤归 DSH Browser |

## 兼容性

- peer 锚点：首个包含分组 seam 的 DSH 发布版（`@deepseek-ai/dsh-client-ui-workspace >= 0.1.0-next.0`，
  seam 由 `upstream-prs/session-grouping-provider/` 跟进；截至 0.1.1-rc.2 未发布）。
- **INCOMPATIBLE（明确不兼容）**：不含 seam 的 DSH 版本不提供“按标签”分组与
  “管理标签”入口——Client probe 检测到缺失即零注册、零 slot、零 DOM fallback；
  Host sidecar 保持可加载（数据保留，重装恢复）。
- 回滚：`dsh plugin --profile web remove @yeisme/dsh-session-tags` 后 DSH 回退
  内建 `workspace`/`flat` 分组，sidecar 数据保留。

## 开发

```bash
pnpm --filter @yeisme/dsh-session-tags run typecheck
pnpm --filter @yeisme/dsh-session-tags run test
pnpm --filter @yeisme/dsh-session-tags run build
```
