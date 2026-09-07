# Shared slot / selector / aria / i18n compatibility inventory

任务 2.1 交付物：现有可复用槽位清点 + 本 change 新增共享组件的兼容合同。迁移只改组合与文案，不改 aria 语义、`data-*` 契约、layout reducer 与 Pane data/action owner。

## 1. 既有可复用槽位（不动，继续作为唯一实现）

| 组件 | 槽位 | 稳定钩子 | aria | 消费方 |
| --- | --- | --- | --- | --- |
| `PaneChrome` | title/eyebrow/status/actions/close/body | `.wb-pane-chrome`、`.wb-pane-chrome-actions` | h2 标题、close `IconButton` 可访问名 | AgentPaneDockFrame、AgentPaneSheetFrame（r1 D2 已统一） |
| `PaneToolbar` | actions[]/overflow | `.wb-pane-toolbar`、role=toolbar | 每个 action 持久可访问名 + disabledReason | pane 帧（本 change 未新增调用方） |
| `StatusChip` | label/description/nextAction | `data-wb-status-chip`、`data-status`、`data-tone` | role=status + sr-only description | DataState/ActionRecovery/Composer 能力分组/本 change 新增 header status 槽 |
| `DataState` | state→title/description/nextAction | `data-wb-data-state`、`data-tone` | role=alert(error/blocked/unknown)/status | ActionRecovery 内嵌 |
| `ActionRecovery` | DeclaredActionSlot/UnknownActionSlot | `data-wb-action-recovery={state}` | unknown_accept 仅 query/reconcile | action descriptor 面 |
| `PaneTabs` | tabs/onClose/onValueChange | `data-agent-pane-tab` | role=tab 语义 | pane dock/sheet |
| primitives（Button/IconButton/SegmentedControl/SearchBox/TextArea/Popover/Tooltip） | — | 各自 data-* | — | 全部区域 |

## 2. 本 change 新增共享组件（design-system/composites）

| 组件 | 槽位 | 稳定钩子 | aria | 说明 |
| --- | --- | --- | --- | --- |
| `UnifiedSurfaceFrame` | surface 容器 | `data-wb-surface-frame` | section + aria-label | 呈现层 only |
| `SurfaceHeader` | leading/title/technicalMeta/status/actions | `data-wb-surface-header`、`data-wb-surface-technical-meta` | 单个 h2 标题（标题只出现一次；eyebrow 双标签禁用） | ConversationHeader、SpatialSurface header 已迁移 |
| `SurfaceToolbar` | toolbar 组 | `data-wb-surface-toolbar` | role=toolbar + 持久 aria-label | modebar 等工具组 |
| `SurfaceFooter` | footer | `data-wb-surface-footer` | — | 可选通知/新鲜度行 |
| `StatusBlock` | status/statusLabel/impact/reason/recovery(≤1)/technical(折叠) | `data-wb-status-block={status}`、`data-wb-status-block-technical`、调用方 `dataAttributes` | role=status；「影响 → 一个主动作 → 技术明细」顺序固定 | agent-route fallback/ingress 拒绝、SpatialUnavailable 已迁移 |
| `StatusBlockCompact` | label/description/action | `data-wb-status-block-compact={status}` | inline 指示 | 跨区域去重的次级形态（主说明唯一 owner） |
| `SurfaceEmptyState` | icon/description/action(≤1) | `data-wb-surface-empty`、调用方 `dataAttributes` | 图标 aria-hidden + 单行说明 | `PaneEmptyState` 委托（`data-agent-pane-state=empty` 保留） |
| `SurfaceSkeleton` | label/rows/shimmer | `data-wb-surface-skeleton`、调用方 `dataAttributes` | role=status + aria-busy（reduced-motion 无 shimmer） | `PaneContentSkeleton` 委托（`data-agent-pane-state=loading` 保留）；SpatialUnavailable loading 态 |

## 3. 调用方兼容合同（迁移不变量）

- `data-agent-workspace-fallback-reason`、`data-spatial-ingress-error`、`data-agent-pane-state`、`data-agent-pane-host`、`data-agent-session-rail`、modebar `aria-pressed` 组、rail tab `role=tab` 语义全部保留（组件测试逐项断言）。
- `PaneEmptyState`/`PaneContentSkeleton` 变为共享实现的薄包装：DOM 语义（role=status/aria-busy/图标+一行+≤1 CTA）不变，`agent-pane-state.test.tsx` 全绿。
- ConversationHeader：sessionRef 从标题行降级为 mono technicalMeta；runtime 状态从手写 icon+text 升级为共享 StatusChip；诊断保留为 title tooltip（不再作为隐藏文本重复朗读）。
- SpatialSurface header：`Spatial Surface` eyebrow + boardRef 双标签收敛为单标题 boardRef；revision/freshness/worker/renderer 为次要 mono meta；capability 单 chip；`data-lens-summary` 移至 chip。unavailable 不再与 header 状态双写。
- Session rail header：`Agent core` eyebrow 删除，单标题 `Threads`。

## 4. i18n 规则

- 新增文案全部进入 `api/locale/source/zh-CN/**` 与 `en-US/**` 并登记 `catalog-policy.json`（含 placeholders 元数据）；生成目录经 `compose:i18n --write` 刷新，`check:i18n` 全绿（3575 keys）。
- 本 change 顺带清偿了 130 个存量未登记 key（login-methods/project-data/canvas/spatial-review 各 lane 的 agentText 文案），全部双语登记；技术 ref（sessionRef/revision/code）保留英文 mono。
- 组件不持 inline 文案主路径；`agentText(t, key, fallback)` fallback 仅作未注册兜底。
