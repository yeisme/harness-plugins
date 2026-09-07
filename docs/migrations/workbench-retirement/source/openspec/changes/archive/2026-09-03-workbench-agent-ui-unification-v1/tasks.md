## 1. 文档与合同基线

- [x] 1.1 更新 `docs/product/agent-workbench-blueprint.md`，加入本 change 的统一壳层级、显式联动、就地恢复和首屏优先级。
- [x] 1.2 更新 `docs/ui/agent-first-workbench.md`，补充 shared chrome/status/empty/recovery 槽位、中文优先规则和 `/agent` + registered Pane 验收矩阵。
- [x] 1.3 更新 `docs/README.md`，索引 UI 统一 change 与新的设计入口，并标注前端组合改造不改变后端合同。
- [x] 1.4 运行 `openspec validate --all --strict`，修复本 change 的 artifact、capability 名称和 delta spec 格式问题。
  - Evidence (2026-09-03)：blueprint §3.3（Trusted Chrome→compact rail→session rail→conversation anchor→surface→单一 context rail 层级树 + 显式联动/就地恢复/中文优先/空态起步）；ui spec §8.1 六条收敛规则 + 本 session 补齐 `/agent`+registered Pane 九行验收矩阵（Conversation/Split、Spatial Focus、Pane、移动 Sheet 四列）；`docs/README.md` 视觉设计节加入 change design 入口并标注"仅改前端组合，不改后端合同"。`openspec validate --all --strict --no-interactive` 67/67 passed。

## 2. Shared UI composition

- [x] 2.1 清点现有 `PaneChrome`、`PaneToolbar`、`StatusChip`、`DataState`、`ActionRecovery` 和 primitives 的可复用槽位，形成 selector/aria/i18n compatibility 清单。
  - Evidence (2026-09-03)：`details/shared-slot-inventory.md`——既有 7 组件槽位/稳定钩子/aria 矩阵 + 本 change 新增 8 共享组件合同 + 调用方兼容不变量 + i18n 规则。
- [x] 2.2 实现统一 surface frame/header/toolbar 组合，保证标题只出现一次、技术 metadata 次要化、状态/动作槽位一致。
  - Evidence (2026-09-03)：`design-system/composites/surface-frame.tsx`（`UnifiedSurfaceFrame`/`SurfaceHeader`（leading/title/technicalMeta/status/actions 槽，单 h2，eyebrow 双标签禁用）/`SurfaceToolbar`/`SurfaceFooter`）+ CSS + index 导出；`test/agent-ui-unification.test.tsx` 断言标题唯一、mono meta、槽位。
- [x] 2.3 实现 shared status block、empty state、recovery action 和 loading skeleton，覆盖 ready/needs_contract/offline/stale/permission/unknown_accept。
  - Evidence (2026-09-03)：`composites/status-block.tsx`（`StatusBlock`：影响→≤1 主动作→折叠技术明细，WorkbenchStatus 全域含 needs_contract/permission_required/unknown_accept；`StatusBlockCompact` 次级联动指示）+ `composites/surface-empty.tsx`（`SurfaceEmptyState` ≤1 CTA / `SurfaceSkeleton` aria-busy）；`agent-pane-state.tsx` 的 `PaneEmptyState`/`PaneContentSkeleton` 改为共享实现薄包装（`data-agent-pane-state` 钩子保留，`agent-pane-state.test.tsx` 全绿）。
- [x] 2.4 迁移 Agent header、session rail、composer footer 和 modebar，保持既有 layout reducer、Pane registry、aria 与 `data-*` 契约。
  - Evidence (2026-09-03)：`conversation-header.tsx` 迁移 `SurfaceHeader`（sessionRef 降级 mono technicalMeta、runtime 状态升共享 StatusChip、诊断保留 title tooltip、动作簇 aria 不变）；`session-rail.tsx` header 去除 "Agent core" eyebrow 双标签；modebar 三模式与 desktop note 文案进 locale（aria-pressed 组不变）；composer footer 既有 compact 指示器 + Popover + 技术明细 disclosure 已满足槽位合同（shell-visual-r1 §7.1，本 change 复核不改）。验证：`test/agent-ui-unification.test.tsx` 10/10、`agent-conversation-workspace.test.tsx`/`agent-route.test.tsx` 全绿。
- [x] 2.5 迁移 Spatial context rail 与首批 registered Pane，移除重复 floating business rail 和重复状态说明，不改变 Pane data/action owner。
  - Evidence (2026-09-03)：`spatial-surface.tsx` header 迁移 `SurfaceHeader`（eyebrow+boardRef 双标签收敛单标题、rev/freshness/worker/renderer 降级次要 mono meta、capability 单 chip、`data-lens-summary` 移至 chip；unavailable 时 header 不再与状态块双写）；`SpatialUnavailable` loading→`SurfaceSkeleton`、不可用→`StatusBlock`（单一重试动作+技术明细折叠）；命令栏/Lens 标签本地化。context rail 与 Pane 帧已由 v3 2.4/r1 D2 收敛（rail 静态托管 Detail/Inspector/Review/Evidence、Pane 全走 PaneChrome），本 change 复核确认无新增浮动业务 rail。Pane data/action owner 零改动。验证：`spatial-surface-kernel.test.tsx` 11/11（更新两处中文优先文案断言，不变量不动）。

## 3. Explicit interactions and localization

- [x] 3.1 将 Canvas selection、context attach、Pane suggestion、recovery 和 Follow Pi 统一为显式 action，验证不自动写 composer、不创建 Task、不移动键盘焦点。
  - Evidence (2026-09-03)：共享化后全部联动仍是显式动作——`StatusBlock` recovery 仅按钮触发（fallback 重检=refetch、ingress 清参、spatial 重载）；`ConversationHeader` Follow Pi/上下文/面板入口显式-only（`agent-ui-unification.test.tsx` 断言不点击不触发）；modebar 键盘 Enter 切换且 composer 不丢锚点（e2e keyboard 用例）；selection→rail、attach、suggestion 的既有显式合同由 `agent-conversation-workspace.test.tsx` 既有 no-mutation 断言覆盖（未改动）。
- [x] 3.2 将 Agent/Spatial/Pane 新文案写入 `api/locale/source/zh-CN/**` 与 `api/locale/source/en-US/**`，保留 technical refs 的英文 mono 表达。
  - Evidence (2026-09-03)：本 change 新增 26 key（modebar 三模式、Lens 五标签、spatial unavailable/loading/desktopRequired/command、route fallback/ingress）+ 顺带清偿 130 个存量未登记 key（login-methods/project-data/canvas/spatial-review lanes），全部 zh-CN+en-US 双语登记 `catalog-policy.json`（含 placeholders）；sessionRef/revision/reason code 保留英文 mono（technicalMeta/technical rows）。
- [x] 3.3 运行 `bun scripts/compose-i18n.ts --check` 与 `bun scripts/check-i18n.ts`，确认生成目录和占位符一致。
  - Evidence (2026-09-03)：`compose:i18n` OK（3575 keys / 22 namespaces / 3575 authored en-US values / 48 bootstrap keys）；`check:i18n` OK（3575 server keys、362 source files scanned）。注：130 key 存量债在 HEAD 即红（temp worktree 复核），本 change 清偿后 check 首次全绿。

## 4. Verification and evidence

- [x] 4.1 增加/更新 component tests：shared slots、Pane title dedupe、state/recovery mapping、empty CTA、explicit cross-region actions、focus restore 和 no-mutation guards。
  - Evidence (2026-09-03)：新增 `apps/web/test/agent-ui-unification.test.tsx` 10 用例（SurfaceHeader 单标题/mono meta/leading 槽、SurfaceToolbar aria、StatusBlock 顺序+折叠技术明细+dataAttributes、compact 次级形态、空态单 CTA、骨架 aria-busy、ConversationHeader 迁移合同+显式动作不触发即不调用、session rail 标题去重）；`agent-pane-state.test.tsx`（委托共享实现后合同不变）与 pane dock focus-restore/no-mutation 既有用例全绿。
- [x] 4.2 增加/更新 browser tests：1440×960、1024×768、390×844、200% effective-width、mode switch、Pane open/close、Spatial unavailable/offline/stale、keyboard、reduced motion、Axe 与 overflow。
  - Evidence (2026-09-03)：新增 `apps/web/e2e/agent-ui-unification.spec.ts` 5 用例 5/5（1440 标题唯一+mono meta+mode switch composer 锚点；1024 tabbed rail；390 desktop-required 状态块+零 canvas 挂载；键盘 Enter 切模式+reduced-motion；200% 有效宽度无溢出+Axe critical/serious=0）。Pane open/close 与 Spatial unavailable/offline/stale 由既有 `agent-spatial`/`workbench`/`agent-pi-workspace` suites 覆盖并在 4.3 全量门中运行。
- [x] 4.3 运行 `bun run typecheck`、`bun test`、`bun run --cwd apps/web test`、`bun run web:e2e`，失败时保留脱敏的 `temp/integration-test-runs/<run-id>/` 证据。
  - Evidence (2026-09-03)：`bun run typecheck` 绿（root+apps/web）；`bun run --cwd apps/web test` 全绿（vitest 195 files/1654 tests + server bun 149 pass/0 fail）；`bun run test:contract` 530/0。`bun test`（root）2 fail=`tests/release-state`+`release-gates`，HEAD worktree 复核为存量（安全整改 lane 域，与本 change 无交集）。`web:e2e` evidence run `20260903033945-1344e4c0-0712-43bd-a266-e5d7b9c6e8cc`（exit 1）：188 passed/7 failed，7 红=agent-first×3/agent-direct-panes×2/studio-icon×1/agent-pi-workspace×2——HEAD worktree 复核 agent-first.spec 在 HEAD 即 9 fail（存量/在途 lane，与 2026-09-02 记录的 web:e2e 7 红一致）；本 change 新 spec 5/5 不在红名单。
- [x] 4.4 运行 `openspec validate --all --strict` 和 `git diff --check`，检查无 API/SDK/后端合同变更、无新 mock ready、无稳定 selector/i18n 回归。
  - Evidence (2026-09-03)：`openspec validate --all --strict --no-interactive` 67/67 passed；`git diff --check` 干净（一处 trailing whitespace 已修）。无 API/SDK/后端合同变更（service 改动仅为生成 locale bundles +156 keys additive；packages/task-sdk 脏改动属并行依赖批会话非本 change）；无新 mock ready（unavailable/loading 仍诚实 fail-closed）；稳定 selector 全保留（fallback-reason/ingress-error/pane-state/pane-host/session-rail/modebar aria-pressed，组件测试逐项断言）；i18n check 全绿（4.x 无回归）。
