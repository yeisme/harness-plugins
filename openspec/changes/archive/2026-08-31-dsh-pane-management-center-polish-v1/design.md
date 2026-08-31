## Context

`PaneManagementCenter` 已由 `Modal` + `Surface` 承载，并复用同一 controller、registry、管理持久化与可选 Host 搜索。当前组件把 source 和七个 advanced filter 同时常驻，open mode 始终显示创建分组 footer，manage mode 始终显示完整批量工具栏；共享样式已有 token 化 polish，但仍保留横向筛选和窄屏小弹窗。实现必须保留当前详情面板、虚拟列表、Shift+Enter target、搜索 Abort 与安全关闭语义。

## Goals / Non-Goals

**Goals:**

- 在同一组件和状态 owner 内建立标题、模式、搜索、来源、结果的稳定层级。
- 让高级筛选、分组创建和批量操作按需出现，消除首屏横向溢出。
- 完成本地化标题、状态、区域与内置 Agents 元数据，同时保持用户/资源标题不被误翻译。
- 在严格结果为空时提供确定、有界、无远端副作用的相近结果。
- 复用现有测试栈和 integration evidence runner。

**Non-Goals:**

- 不新增搜索服务、索引、第三方 fuzzy dependency 或浏览器侧对话缓存。
- 不修改 Host capability、workspace state、管理 persistence、历史 envelope 或详情合同。
- 不重做全局主题、字体、Modal primitive 或所有第三方 provider 的词典。

## Decisions

### D1：所有新增 UI 状态保持 React 会话态

`filtersOpen`、`createGroupOpen` 只存在于当前 dialog；active filter count 从现有 filter state 派生，manage footer 从 `selected.size` 派生。关闭 dialog 即丢弃这些展示状态，不增加 persistence 字段或 controller action。

备选把折叠偏好写入 profile 会污染稳定 envelope，且用户价值不足，拒绝。

### D2：严格搜索不变，相近推荐使用同一过滤边界

保留 `filterAndRankPaneEntries` 的子串匹配与现有排序。新增 `suggestSimilarPaneEntries`：先应用完全相同的 filters，再对 NFKC + lowercase 后的 title/kind/description/keywords 计算双字符片段覆盖率；查询少于两个字符或最佳覆盖率低于三分之一时不推荐。候选按覆盖率、active/open/pinned/recent、order、title 稳定排序，最多返回三条。

推荐仅在本地严格结果为零、当前/all workspace、本地 query 非 `@conversation`、远端搜索不在 loading 时显示。它不调用 Host、不写 persistence/log/evidence。

备选 Levenshtein 或搜索库增加代码与依赖，没有足够收益，拒绝。

### D3：本地化只翻译已声明的 provider 默认标签

管理中心基于 registry registration 计算展示标题：只有 registration 使用 `paneWorkbench` namespace，且条目是 pane launcher 或实例标题等于 descriptor fallback label 时，才解析 `i18n.labelKey`。资源标题、文件名、分支、用户组名和远端 Host 标题保持原值。

状态 token 使用 `state.<token>` 安全 fallback，region 使用现有 `region.*`。`ui-pane-subagent` 仅为 `subagent.monitor` 补 `paneWorkbench/rail.agents` 元数据，不建立跨包翻译 runtime。

### D4：现有详情入口保留，新增 chevron 专门打开 target

行主按钮继续直接打开；现有 info/more 继续展开详情。新增 trailing `chevron-right` 仅对 pane launcher 打开 target picker，使“打开位置”可发现，同时保留 Shift+Enter。这样不改变现有详情键盘合同。

### D5：CSS 通过共享 chrome extra 覆盖，不建第二样式文件

继续在 `chrome/shared.ts` 的 scoped `REGION_EXTRA_STYLES` 中调整管理中心。桌面维持 640px/70vh 合同；600px 以下 `inset:0`、100vw/100dvh、零圆角，顶部 controls sticky、结果 flex scroll、footer 使用 safe-area padding。所有 icon 使用 `currentColor`，focus-visible 和 reduced-motion 沿用 visual-kit。

### D6：公开类型仅增量扩展

`WorkbenchIconName` 与 `WORKBENCH_ICON_NAMES` 追加 `filter`、`message`、`chevron-right`、`chevron-down`，运行时 guard 同步接受。现有值、glyph 和 consumer 继续工作；无弃用窗口。`suggestSimilarPaneEntries` 是 additive exported helper，沿用现有 entry/filter 类型。

## Risks / Trade-offs

- [双字符相似度对一字符查询无效] → 查询少于两个字符不推荐并显示普通空态。
- [相近结果可能误导] → 三分之一阈值、最多三条、独立“你可能在找”标题且严格结果始终优先。
- [中文标题误翻译用户数据] → 仅解析本地 registration labelKey，并要求实例标题等于 descriptor fallback 才翻译。
- [移动端多层滚动] → dialog 变为固定 flex 容器，只有结果列表滚动；advanced filter 在同一顶部区域展开。
- [公开 icon/helper 扩展影响消费者] → 只增量、更新 frozen-set contract test，包级 typecheck/build 与 consumer `ui-pane-subagent` 测试共同验证。

## Migration Plan

1. 增量加入 locale key、icon 名与纯搜索 helper，不改变默认 UI。
2. 重排管理中心 DOM 与派生状态，保留已有 test selectors、详情和 target 行为。
3. 更新共享 scoped CSS 与 390px 断言。
4. 更新 Subagent registration i18n 元数据与消费者测试。
5. 运行 focused/package/integration/OpenSpec gates。

回滚为撤销本 change 的 package 与 OpenSpec diff；没有新持久化数据、schema 或远端合同，旧 UI 可立即恢复。

## Open Questions

无。
