# 任务清单：workbench-ui-controls-r1

设计输入：`docs/design/ui-controls-system.md`（控件合同、收敛映射、门禁的全部细则以该文档为准）。

## 1. 阶段 A · 基座与骨架

- [x] 1.1 安装新增 Radix 依赖：`@radix-ui/react-select`、`react-popover`、`react-dropdown-menu`、`react-tabs`、`react-checkbox`、`react-radio-group`、`react-switch`、`react-toggle-group`（后者按需）
- [x] 1.2 建立 `design-system/primitives/contract.test.ts` 骨架：design-system 之外禁 L0 直接 import、禁手写 tablist、禁原生 `<select>`；现状违例进入白名单豁免清单
- [x] 1.3 建立 `design-system/index.ts` 根 barrel 统一出口
- [x] 1.4 验证：`bun install`、`bun run typecheck`、既有 foundation 门禁全绿

## 2. 阶段 B · 表单控件

- [x] 2.1 `Button`（variant/size/loading/disabledReason）+ 单测 + gallery fixture
- [x] 2.2 `IconButton`：收敛 `TooltipIconButton`（保留别名导出至消费者迁完）+ 单测 + fixture
- [x] 2.3 `Input`（size/invalid/leading/trailing 槽）+ 单测 + fixture
- [x] 2.4 `TextArea`（autoResize/minRows/maxRows）+ 单测 + fixture
- [x] 2.5 `SearchBox`（清除按钮/loading/可选 hotkey 注册 guidance/shortcuts）+ 单测 + fixture
- [x] 2.6 `Checkbox`（含 indeterminate）+ 单测 + fixture
- [x] 2.7 `RadioGroup` + 单测 + fixture
- [x] 2.8 `Switch`（含异步 loading 约定）+ 单测 + fixture
- [x] 2.9 控件文案 key 进 `api/locale/source/{zh-CN,en-US}/agent/*.json`，跑 `bun run compose:i18n && bun run check:i18n`

## 3. 阶段 C · 选择与浮层

- [x] 3.1 `Select`（react-select 封装：分组/禁用项/invalid）+ 单测 + fixture
- [x] 3.2 `MultiSelect`（已选摘要/全选清空/可搜索）+ 单测 + fixture
- [x] 3.3 `Combobox`（cmdk + popover；异步 loading/empty/error 显式 props）+ 单测 + fixture
- [x] 3.4 `Popover` + 单测 + fixture
- [x] 3.5 `DropdownMenu`（destructive 项/分组/快捷键提示/disabledReason）+ 单测 + fixture
- [x] 3.6 `Dialog`（尺寸档位/alertdialog 确认语义/`wb-motion-dialog`）+ 单测 + fixture
- [x] 3.7 `Tooltip`（信息提示唯一入口，禁原生 `title`）+ 单测 + fixture
- [x] 3.8 评估 `SegmentedControl` 真实消费面；有消费者则实现，无则记录不建

## 4. 阶段 D · Tabs 与 PaneChrome

- [x] 4.1 `Tabs`（react-tabs 封装：line/pill variant、automatic/manual 激活、溢出菜单）+ 单测 + fixture
- [x] 4.2 `PaneChrome`/`PaneTabs`/`PaneToolbar`（pane 交互语义归 pane-interaction-model.md，本任务只做控件组成与 token 消费）+ 单测 + fixture
- [x] 4.3 收敛 `workbench/agent/panes/agent-pane-dock.tsx:273` 与 `:572` 两处手写 tablist → `PaneTabs`（主画布先行）
- [x] 4.4 收敛其余 5 处手写 tablist（`studio/shell.tsx:429`、`eikona/reuse/reuse-workspace.tsx:25`、`workbench/harness/harness-route.tsx:271`、`workbench/panes/workflows/workflow-console.tsx:38`、`workbench/panes/pinax-kb-review/pinax-kb-review-route.tsx:102`），每处一个 PR，替换与删除同 PR

## 5. 阶段 E · CommandPalette 与搜索/浮层收敛

- [x] 5.1 新增 `CommandPalette` composite（`Dialog + Combobox`），统一 `workbench/shell.tsx:117`、`eikona/components/command-palette.tsx`、`workbench/agent/panes/pane-command-palette.tsx` 三套实现
- [x] 5.2 手写搜索框迁 `SearchBox`（`localization-pane.tsx:160`、`shell.tsx:138`、`orbit/receipt-evidence.tsx:219`、`orbit/work-chart-table.tsx:208`、`asset-library-pane.tsx:110`、`agent/conversation/session-rail.tsx:85` 等，以实测为准）
- [x] 5.3 10 处裸 Radix Dialog 与 `.gate-dialog`/`.reconcile-dialog` 纯 div 假 dialog 迁 `Dialog` 封装
- [x] 5.4 原生 `<select>` 迁 `Select`（`.focus-lens select`、`.eikona-filter-row select`、`.reconcile-dialog select`）
- [x] 5.5 L2 composites 内部控件换源（如 `ActionRecovery` 按钮走 `Button`）
- [x] 5.6 迁移涉及文案走 i18n，跑 `bun run compose:i18n && bun run check:i18n`

## 6. 阶段 F · 门禁收尾

- [x] 6.1 contract test 白名单清零，转硬断言（design-system 之外零 L0 import、零手写 tablist、零原生 select）
- [x] 6.2 gallery 覆盖全部控件状态矩阵 + 移动端/reduced-motion 变体；按 D3 §10.4 固化 Playwright 截图基线（1440×960、1024×768、390×844 + reduced-motion）
- [x] 6.3 迁移 PR 截图对比按 UI Spec §8 视觉黑名单逐项过审并归档
- [x] 6.4 同步 `docs/design/ui-controls-system.md` 与 `docs/design/design-system-unification.md` 状态；`docs/README.md` 索引保持最新
- [x] 6.5 最终验证：`openspec validate --all --strict`、`bun run typecheck`、`bun run --cwd apps/web vitest run test/foundation-contract.test.ts`、`bun run --cwd apps/web vitest run --config src/design-system/tokens/vitest.config.ts`、`bun run --cwd apps/web e2e`
