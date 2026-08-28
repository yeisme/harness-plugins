# Tasks

## 1. 收编既有覆盖与合同化

- [x] 1.1 [Owner: `packages/client/ui-pane-workbench`] 盘点并收编工作树既有「Unified sidebar and pane-search polish」CSS 覆盖块（弹窗/右栏/官方折叠侧栏/响应式）为本 change 合同内实现。Acceptance: 覆盖块全部条目能映射到 spec Requirement；无 build hash 依赖。Validation: 代码审阅 + `pnpm run check:surfaces` 本包零发现。 Evidence (2026-08-28): 覆盖块七组规则逐条映射 R1–R8（弹窗 720/78vh/18px、48px 搜索框四态、32px 分段、筛选标签、四列网格+媒体查询、48px 行 hover 边框、右栏 34/10/8/四态/字体缩放分隔线、官方折叠侧栏 `:has()` 公共 launcher 锚点+36/10/四态/logoRow/footArea、<760/<600 响应式）；注释明确「scope through our public footer launchers, not a build hash」；check:surfaces 失败清单中无 ui-pane-workbench（现存 6 项均为并行 lane 的 side-chat/selection-annotation/semantic-file-editor/ui-desktop-workbench/dsh-terminal）。
- [x] 1.2 修复 `chrome-tokens.spec` 括号配平启发式：从「无 `var(--vk-x))` 字面计数」改为真实括号配平解析，允许 `color-mix()`/`calc()` 合法嵌套；token adoption 断言不变。Validation: `tests/chrome-tokens.spec.ts` 绿且 HEAD 基线版本同样绿。 Evidence (2026-08-28): 改为括号深度扫描（负深度即失败）；全套 283/283 绿；HEAD 版本无 `))` 嵌套天然满足配平。

## 2. 代码缺口补齐

- [x] 2.1 占位文案精简：zh「搜索窗格、标签页、标题或历史记录」/ en 'Search panes, tabs, titles, or history'，同一 key 同时服务 placeholder 与 aria-label。Validation: `tests/locale-qa.spec.ts` 绿。 Evidence (2026-08-28): zh/en 词典同步更新，全套 283/283 含 locale-qa 22/22 绿。
- [x] 2.2 右栏图标视觉尺寸统一 18px（17–19 区间）与键盘选中行轻背景强化（不满行蓝）。Validation: 组件/样式测试不回归。 Evidence (2026-08-28): 覆盖块新增 `.pwr-rail svg{width:18px;height:18px}` 与 `.pwr-management-row:focus-within` 轻背景（focus 环沿用基线规则，无整行蓝）；全套 283/283 绿。
- [x] 2.3 响应式与 token 复核：<760 两列、<600 边距/隐藏提示/footer 换行、`--vk-*`+回退覆盖全部新声明。Validation: CSS 审阅 + 既有媒体查询断言。 Evidence (2026-08-28): 覆盖块含 `@media(max-width:760px)`（两列+弹窗高调整）与 `@media(max-width:600px)`（100vw-16px 边距、`.pwr-management-scope` 隐藏、footer wrap）；官方侧栏作用域规则每条 `--vk-*` 均带 rgba 回退。

## 3. 验证与验收

- [x] 3.1 全门：ui-pane-workbench 全套测试 + typecheck + `openspec validate dsh-search-rail-visual-v1 --strict --no-interactive` 绿。 Evidence (2026-08-28): 283/283 + tsc 绿 + strict validate exits 0 + `git diff --check` 干净。
- [x] 3.2 视觉验收：`pnpm run test:visual` 基线复核；证据写入 `temp/integration-test-runs/`。 Evidence (2026-08-28): 27/27 通过，证据 `temp/integration-test-runs/ui-visual-2026-08-28T16-15-09-993Z-2593522/summary.json`。说明：27 张基线 fixture 为通用 surface，不渲染管理中心/右栏/官方侧栏，故无需重生成基线；1239/1438/窄屏三档实机截图验收留给官方 `dsh web` 宿主环境（本仓插件完成门不依赖官方宿主，见 AGENTS.md）。
- [x] 3.3 验收对照清单逐项勾验。 Evidence (2026-08-28): 左右栏尺寸/圆角/状态统一→R5/官方锚点块；搜索框默认/Hover/Focus/输入态→R1；四列高级筛选→R2；结果行边界化→R3；无重叠椭圆底板→官方折叠态 logoRow/footArea 覆盖；深色边框→全部 --vk-* 低对比分隔线；键盘完整/焦点可见→focus ring 保留+Esc/Arrow 合同未动（dsh-pane-center-descriptions 主 spec）；逻辑不变→纯 CSS 覆盖零 JSX 改动；几何不变→覆盖块未触碰栏宽/region 尺寸。
