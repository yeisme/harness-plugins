# @yeisme/dsh-client-ui-session-tags

DSH 会话标签的 Client 面：generation-aware list controller、
`yeisme.session-tags` 分组 provider、可访问的标签编辑器 overlay。

- 不建第二份 canonical store：标签权威值在 Host sidecar
  （`@yeisme/dsh-session-tags-host`），本包只缓存最近一次权威 `list` 应答。
- mutation 只走 `sessionTags.set`（完整目标集合 + `ifVersion`）；
  unknown/partial/冲突只禁用写入并要求 reconcile，绝不自动重试。
- capability probe：运行时没有 `ctx.sessionGroupings`（上游
  `SessionGroupingProviderV1Alpha1` seam）时不注册 provider、不注入任何
  slot、不做 DOM fallback——旧 DSH 上零死按钮。

## 模块

- `./client` 的 `createSessionTagsController`：单飞 + generation 丢弃的
  快照控制器（reset/focus/own-write 刷新）。
- `createSessionTagsProvider`：多标签多组、locale 排序、末尾“未标记”、
  仅标签文本的 searchTerms。
- `createTagEditorController` + `TagEditorOverlay`：CAS 冲突 reconcile、
  取消零写入、Escape/焦点还原、aria-live 错误播报。
- `registerSessionTagsClient`：probe + provider 注册 + `shell.overlay`
  编辑器 seat。

## 开发

```bash
pnpm --filter @yeisme/dsh-client-ui-session-tags run typecheck
pnpm --filter @yeisme/dsh-client-ui-session-tags run test
pnpm --filter @yeisme/dsh-client-ui-session-tags run build
```
