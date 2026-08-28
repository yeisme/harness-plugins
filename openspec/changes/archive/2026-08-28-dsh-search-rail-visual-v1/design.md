# Design: 搜索框与双侧边栏视觉统一

## Context

用户给出可直接执行的 UI Spec。工作树已存在一批未治理的 CSS 覆盖（region-chrome.ts 尾部「Unified sidebar and pane-search polish」块，含弹窗/右栏/官方折叠侧栏/响应式），但无 OpenSpec change 承载，且遗留四处缺口：占位文案未精简、右栏图标视觉尺寸仍 16px、`chrome-tokens.spec` 括号启发式被 `color-mix(var())` 合法嵌套误报打红、视觉基线未更新。Modal 原语（primitives）的 CSS module 为空对象，`.pwr-management-center` section 即可见对话框卡片——宽度/圆角直接作用于 section，无双层边框问题。

## Goals / Non-Goals

- Goals：把 UI Spec 正式化为能力合同；收编既有 CSS 覆盖；补齐四处缺口；全门绿。
- Non-Goals：不改 JSX 结构与交互逻辑；不动展开态官方侧栏；不引入新依赖或动画库；不改工作区几何合同（栏宽、region 尺寸、拖拽）。

## Decisions

### D1 纯 CSS 覆盖层，不改 JSX

所有视觉统一通过 REGION_STYLES 尾部覆盖块实现（后到优先），不触碰组件树。理由：与官方 host 及并行 lane 的结构改动解耦、可整体回滚、conformance 的 dynamic-style 面保持不变。`.pwr-management-center` 即对话框卡片（Modal CSS module 为空），无需向 Modal 传 className。

### D2 官方折叠侧栏的作用域锚点

只在我们自己发布到官方 footer 的公共 launcher（`[data-subagent-monitor-sidebar]`、`[data-creator-studio-launcher]`）存在时，经 `:has()` 向上作用到官方侧栏容器；不匹配任何 build hash class 名。所有覆盖颜色带 `--vk-*` 变量与 rgba 回退，官方变量缺失时不产生裸样式。

### D3 状态与动效语义

四态（默认/Hover/Active/Pressed）+ focus 环统一：hover = 轻表面填充 + 1px inset 细边框；active = 品牌色 color-mix 弱填充（≈12–18% 透明度）+ 细边框 + 轻投影，替代旧 `inset 2px 0 0 accent` 粗侧边条；pressed = `transform:scale(.96)`；动效 120–160ms ease-out。键盘选中（focus-visible）保留 2px 品牌焦点环并叠加行级轻背景，确保明显但不满行蓝。

### D4 测试与基线

`chrome-tokens.spec` 的「无 `var(--vk-x))` 残留」启发式改为真实括号配平（扫描配对计数，允许 `color-mix()`/`calc()` 等合法嵌套），token adoption 断言不变。视觉变更后 Playwright 基线经 `pnpm run test:visual -- --update-snapshots`（即 `test:visual:update`）重生成并保留证据目录；三档宽度验收引用证据。

### D5 范围边界

官方展开态侧栏、workspace 几何、键盘合同、搜索/管理逻辑均不动；`dsh-pane-center-descriptions` 等已归档能力的 Requirement 不受影响。

## Risks / Trade-offs

- `:has()` 兼容性：目标 DSH Web 运行时为现代 Chromium；不支持时选择器整体不命中，官方侧栏保持原样（安全回退）。
- color-mix 同理：不支持时声明无效回落到前一条基线规则，视觉回到旧版但可用。
- 覆盖块与基线规则并存增加样式体积；接受（可整体回滚是明确换来的收益）。

## Migration Plan / Rollback

纯 CSS + 文案层变更。回滚 = 删除覆盖块 + 还原占位文案 + 还原基线快照；无数据/合同迁移。

## Open Questions

无。
