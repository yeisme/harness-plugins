# Tasks

## 1. 条目模型与搜索链路

- [x] 1.1 [Owner: `packages/client/ui-pane-workbench`] `management.ts`：`PaneManagementEntryV1` 增加 additive `description?`/`updatedAt?`；`buildPaneManagementEntries` 按 i18n descriptionKey → `presentation.description` 链解析（pane/tab/history 共享注册描述）；`PaneWorkspaceSearchItemV1` 增加 optional `description`。Acceptance: pane/tab/history/workspace/conversation 条目描述来源正确，缺省字段缺席。Validation: `tests/management.spec.ts`。 Evidence (2026-08-28): 新用例「carries pane descriptions through entries…」覆盖 pane/tab 共享描述、i18n key 优先、无来源缺席、history 描述+closedAt 戳记；`pnpm exec vitest run tests/management.spec.ts` 绿。
- [x] 1.2 [Owner: `packages/client/ui-pane-workbench`] `filterAndRankPaneEntries` 把 `description` 纳入匹配面且不改变 score 构成。Acceptance: 仅描述命中可检索。Validation: `tests/management.spec.ts`。 Evidence (2026-08-28): 单元断言 `filterAndRankPaneEntries(entries, 'PDF')` 全部命中 media.gallery；组件级「renders pane descriptions…」验证搜索 'PDF' 只剩媒体库；score 函数未改。

## 2. 窗格中心 UI

- [x] 2.1 [Owner: `packages/client/ui-pane-workbench`] `management-center.tsx`：结果行渲染省略描述行（title 全文提示）；locale revision 进 entries 依赖。Acceptance: 有描述才渲染描述行。Validation: `tests/management-center.spec.tsx`。 Evidence (2026-08-28): 描述行 `.pwr-management-row-desc` 仅在有描述条目渲染；`localeRevision` 进入 entries useMemo 依赖。
- [x] 2.2 [Owner: `packages/client/ui-pane-workbench`] 详情条：info 按钮 + ArrowRight 展开 / ArrowLeft、关闭按钮收起；展示完整描述与元数据（来源/提供方/类型/角色/区域/状态/关键词/工作区/关闭时间/片段/更新时间）；无描述诚实空态；query 变化清除；240 字符截断。Acceptance: 单一面板在列表外，键盘导航与虚拟滚动不变。Validation: `tests/management-center.spec.tsx`。 Evidence (2026-08-28): 用例「opens pane details from the info button or ArrowRight…」覆盖按钮展开/收起、ArrowRight/ArrowLeft、query 变化清除、无描述空态、keywords/kind 元数据；workspace 远端条目 description+工作区标签在既有用例扩展中断言；既有虚拟滚动用例（>50 tab）不回归。
- [x] 2.3 [Owner: `packages/client/ui-pane-workbench`] `region-chrome.ts` 样式与 `i18n/locale.ts` zh/en 新键（pseudo 自动派生）。Acceptance: 无散落硬编码 copy。Validation: `tests/locale-qa.spec.ts` + typecheck。 Evidence (2026-08-28): 15 个 `management.details.*`/`designer.description`/`capabilities.description` 键 zh/en 成对新增（pseudo-long 由 EN 派生）；`tests/locale-qa.spec.ts` 22/22 绿；包 typecheck 绿。

## 3. 内置窗格真实描述

- [x] 3.1 [Owner: `packages/client/ui-pane-workbench`] core-pane designer 与 capabilities 注册 `descriptionKey` 并补词典。Validation: 包测试。 Evidence (2026-08-28): 两处注册各加 `descriptionKey`，zh/en 词典补 `designer.description`/`capabilities.description`；全包 277/277 绿。
- [x] 3.2 [Owner: `packages/bundle/dsh-desktop-workbench`] apply.ts 内置 descriptor（files/file/documents/git/terminal/media/sessions）additive 补 `presentation.description`。Validation: 包测试 + typecheck。 Evidence (2026-08-28): 7 个内置 descriptor 各补一条中文 `presentation.description`；包 typecheck 绿 + 22/22 测试绿。

## 4. 验证与收口

- [x] 4.1 聚焦测试绿：ui-pane-workbench `management.spec.ts`/`management-center.spec.tsx`/`locale-qa.spec.ts` + desktop-workbench 既有套件不回归；`pnpm run typecheck` 相关包绿。 Evidence (2026-08-28): ui-pane-workbench 全套 277/277 + tsc 绿；dsh-desktop-workbench 22/22 + tsc 绿；依赖包（bundle/pane-workbench、ui-creator-studio、ui-desktop-workbench）在重建 ui-surface lib 后 typecheck 绿。根 typecheck/`check:surfaces` 仅剩并行 lane 的 `ui-selection-annotation` 与 ui-desktop-workbench docx/file-open-pane 发现，与本 change 无关（本 change 包零发现）。
- [x] 4.2 `openspec validate dsh-pane-center-descriptions-v1 --strict --no-interactive` 全绿；review 本 change 无实现日志混入。 Evidence (2026-08-28): strict validate exits 0；tasks.md 只记录验证证据，无实现日志入 specs/proposal/design。

## 5. spec 完善（第二轮）

- [x] 5.1 spec 补强：R1 补 locale 热切换场景；新增 Requirement「对话与远端工作区结果 SHALL 以宿主摘要作为行描述」（片段行+updatedAt、无描述无行）；R3 补 `aria-expanded`/labelled region、Escape 嵌套收起、收起后焦点回归、history 关闭时间场景；proposal 与 design D5 同步。 Evidence (2026-08-28): strict validate 补强后仍 exits 0。
- [x] 5.2 实现 Escape 嵌套收起与焦点回归：Esc 先收详情条再进 target/关闭链；Hide/Esc 收起后焦点回到触发行 info 按钮。修复预存 bug：Modal 原语在 document 级无条件响应 Esc，原有 target 链被击穿，现由管理中心 `stopPropagation` 完整接管。 Evidence (2026-08-28): 组件测试断言 Esc 后对话框保持打开、二次 Esc 才关闭、焦点回归 info 按钮；新增 target picker Esc 回归测试。
- [x] 5.3 补齐 spec↔实现映射测试：locale 热切换刷新描述（en→zh）、conversation 片段行+详情更新时间、history 详情关闭时间、workspace 行描述行、missing descriptionKey 回落 presentation.description。 Evidence (2026-08-28): ui-pane-workbench 283/283 绿 + typecheck 绿。
- [x] 5.4 关闭核验遗留 SUGGESTION：远端工作区无描述条目的负向断言（行渲染但无描述行）；详情条展开时 ArrowUp/Down 导航一致性断言。 Evidence (2026-08-28): management-center 12/12 绿。注：全包 283 中唯一红是 `chrome-tokens.spec` 括号启发式误报并行会话新增的 color-mix 样式（HEAD 0 处、本 change 样式块 0 处），非本 change 引入。
