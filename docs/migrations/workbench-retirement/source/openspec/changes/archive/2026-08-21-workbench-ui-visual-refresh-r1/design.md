## Context

控件统一（workbench-ui-controls-r1）完成后，用户评审开发预览认为视觉与 Eikona 参考图差距过大，要求全站对齐。本 change 只改视觉层：token、CSS、视觉规范文档与截图证据；控件 API、Radix 基座、三层 token 架构、诚实性状态表达全部不变。

视觉基线：`prompts/product/ui-reference/workbench-agent-pane/deliverables/02-plugin-pane-workspace.png`（01/03 为辅助）。

## 从 02 参考图提取的设计参数

| 维度 | 参数 |
| --- | --- |
| 控件圆角 | 8–10px（取 10px） |
| 面板/Pane 容器 | 12px 圆角 + 1px 低透明边框 |
| Dialog/浮层 | 14px 圆角 + 柔和投影 + 背景压暗 |
| chip/badge | tint 底（status 色 ~14% color-mix）+ 彩色文字 + 6px 圆角 |
| icon tile | 8px 圆角方块 + 语义色低透明 tint 底 |
| 表面层次 | 四级：canvas < rail/sidebar < panel < elevated/popover，逐级微亮 |
| accent | 实心填充仅限主 CTA；选中/聚焦用 tint（12–16% color-mix） |
| 选中/hover 行 | 圆角行 + tint/elevated 底 |

## 决策

- **D1 新增 capability 而非 MODIFIED foundation**：项目无 MODIFIED delta 先例，视觉参数合同以新 capability `workbench-ui-visual-language` 承载，对 foundation/controls additive。
- **D2 修订而非另立视觉文档**：`agent-visual-language.md` 的「卡片禁令」改写为「分层而非卡片墙」——允许圆角面板与柔和投影，继续禁止嵌套卡片墙/渐变/厚玻璃；UI Spec §8 radius/surfaces 条款同步更新。黑名单保留。
- **D3 只改 CSS 不改 API**：17 个控件与 composites 的 props/行为/aria 全部不变，本轮纯视觉；既有单测不应需要行为性修改。
- **D4 legacy surface 只级联不动结构**：studio/eikona/open-design 跟随 token 与硬编码清理，符合 D3「不动结构」约定。
- **D5 accent 色值不动**：`--color-accent #58a6ff` 与参考图蓝色接近，差距在用法（平涂 vs tint），不在色相。

## Token 设计（阶段 1 实施对象）

L2 新增/调整（`design-system/tokens/index.css`）：

- `--wb-radius-sm: 6px` / `--wb-radius-control: 10px` / `--wb-radius-panel: 12px` / `--wb-radius-overlay: 14px` / `--wb-radius-pill: 999px`；既有 `--wb-radius-*` 保留别名映射避免断链。
- `--wb-elevation-raised/popover/modal` 改为深色柔和多层阴影（参考档：`0 8px 24px rgba(0,0,0,.4)` 量级）。
- `--wb-border-elevated`：浮层面板用的稍强 1px 边框。
- `--wb-accent-tint: color-mix(in srgb, var(--color-accent) 14%, transparent)`；`--wb-surface-selected` 向参考图选中行靠拢。
- L1（`styles.css` @theme）增补第 4 级 surface 物理色（popover 更亮一档）。

`tokens/contract.test.ts` 同步断言新 token。

## 验证

- token/icons/motion/gallery/primitives 全部 design-system vitest 套件 + `test/foundation-contract.test.ts`。
- gallery 4 张截图基线重生成；`/agent` 主壳、命令面板、Dialog、orbit 页面截图与 02 参考图并排评审，结论写 `review-report.md`。
- 全量 vitest 容忍 3 个 HEAD 已知失败；e2e 容忍 61 例 HEAD 既有失败（归因见 workbench-ui-controls-r1/review-report.md），不得新增失败。
- `openspec validate --all --strict`、`bun run typecheck`、`bun run build`、`compose:i18n && check:i18n`。
