# @yeisme/dsh-selection-annotation

Installable DSH Web bundle for Selection & Annotation Agent Interaction. The
current `0.1.0-rc.1` line is the V1 baseline; V2 migration is specified in
`openspec/changes/dsh-selection-interaction-v2/`.

```
dsh plugin --profile web add @yeisme/dsh-selection-annotation
# or from this checkout
dsh plugin --profile web add ./packages/bundle/dsh-selection-annotation
```

One profile row (`cordis.patch.yml`) grafts the selection toolbar and compact
composer overlay from `@yeisme/dsh-client-ui-selection-annotation` onto the
conversation DOM. Kill-switch:
`localStorage['dsh-selection-annotation'] = 'off'`（`apply` 直接 no-op）。

V2 default behavior is a short-lived singleton Actions surface after a stable
safe selection. It uses 1 primary + 2 secondary + More and opens Composer only
after an explicit action. A V1-only host may use the compatibility adapter for
one release; the package name and install command stay unchanged.

## 桥接契约

bundle 自身不拥有会话/文件/截图状态；宿主通过两个 CustomEvent 接入：

| 事件 | detail | 用途 |
|---|---|---|
| `dsh-selection-annotation:submit` | `{ intent: 'ask'\|'comment'\|'edit', text, anchor, approvalPolicy: 'preview-first' }` | 把锚点+意图交给宿主 Composer/annotation service；`edit` 永远 preview-first |
| `dsh-selection-annotation:add-to-batch` | `{ anchor }` | 把当前锚点加入 Review Batch（多点联合提交） |

文件修改必须经 File Host 版本围栏（`baseVersion` → 冲突
`reconcile_required`，禁止静默覆盖）；系统窗口/完整桌面截图属于 Desktop
Client owner，Web 侧入口不渲染（capability probe unavailable）。

## 验证

`pnpm test` = build + 真实产物冒烟（ModuleLoader banner id、选区后工具条
可见、overlay 挂载、kill-switch、dispose 干净）。仓库级
`pnpm run check:bundles` 校验 client.js 无外部 workspace require。

V1 archive: `openspec/changes/archive/2026-08-28-dsh-selection-agent-review-v1/`；仓库级摘要：
`docs/design/dsh-selection-agent-review-v1.md`。V2 设计与迁移：
`docs/design/dsh-selection-interaction-v2.md`、
`openspec/changes/dsh-selection-interaction-v2/`。
