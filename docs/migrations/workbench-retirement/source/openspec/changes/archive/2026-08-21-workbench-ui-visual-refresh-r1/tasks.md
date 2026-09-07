# 任务清单：workbench-ui-visual-refresh-r1

设计输入：本 change 的 `design.md`（参数表与 token 设计）+ `docs/design/agent-visual-language.md`（已修订的视觉语言）。

## 1. 阶段 0 · 规范立项（已完成）

- [x] 1.1 建 change 三件套 + spec delta
- [x] 1.2 修订 `docs/ui/agent-first-workbench.md` §8、`docs/design/agent-visual-language.md`、`docs/design/ui-controls-system.md` §3.4
- [x] 1.3 `openspec validate workbench-ui-visual-refresh-r1 --strict` 通过

## 2. 阶段 1 · Token 层

- [x] 2.1 L2 新增 radius 刻度（sm/control/panel/overlay/pill）+ 旧 radius token 别名映射
- [x] 2.2 elevation 改深色柔和多层阴影 + 新增 `--wb-border-elevated`
- [x] 2.3 新增 `--wb-accent-tint`、`--wb-surface-selected` 对齐参考图选中行
- [x] 2.4 L1 `@theme` 增补第 4 级 surface 物理色
- [x] 2.5 `tokens/contract.test.ts` 断言同步；foundation 门禁绿

## 3. 阶段 2 · 控件层 CSS 刷新（不改 API）

- [x] 3.1 Button：radius-control；primary 实心 accent 收敛 + hover 微亮；secondary 改 elevated 填充 + 细边；danger tint 化
- [x] 3.2 Input/TextArea/SearchBox/Select/MultiSelect/Combobox trigger：填充式（elevated 底 + 低透明边）+ focus accent tint 光晕
- [x] 3.3 Checkbox/RadioGroup/Switch/SegmentedControl：checked accent 填充、圆角对齐
- [x] 3.4 Dialog/Popover/DropdownMenu/Tooltip/CommandPalette：radius-overlay + 柔和投影 + `--wb-border-elevated`
- [x] 3.5 Tabs/PaneTabs active 态圆角 tint；StatusChip tint 底统一；列表行圆角选中态；icon-tile 模式落 PaneTabs/PaneChrome/CommandPalette
- [x] 3.6 对照 02 参考图截图迭代（gallery 路由 + Playwright 截图），确认观感达标

## 4. 阶段 3 · 主壳与全站跟随

- [x] 4.1 `/agent` 主壳四级表面分层；Pane 容器 radius-panel + 细边 + 投影；composer 填充式圆角；session 列表选中行圆角 tint
- [x] 4.2 导航 sidebar 与 orbit/gateway/workflow/pinax 控制台 token 级联 + 硬编码 `border-radius`/`box-shadow` 字面量清理
- [x] 4.3 studio/eikona/open-design legacy surface 级联（结构不动）+ `.studio-*` 作用域 token 右值同步
- [x] 4.4 dockview 主题圆角/边框跟随

## 5. 阶段 4 · 验证与证据

- [x] 5.1 gallery 4 张截图基线重生成（三视口 + reduced-motion）
- [x] 5.2 `/agent` 主壳/命令面板/Dialog/orbit 截图与 02 并排评审，写 `review-report.md`；旧 e2e 截图基线逐图签认更新
- [x] 5.3 黑名单过审（渐变/玻璃/emoji/嵌套卡片墙零违例）
- [x] 5.4 最终门禁：openspec validate --all --strict、typecheck、design-system 套件、foundation-contract、全量 vitest（容忍 3 例 HEAD 已知失败）、build、compose:i18n && check:i18n、e2e（容忍 61 例 HEAD 既有失败，不新增）
- [x] 5.5 文档收尾：ui-controls-system.md / design-system-unification.md / docs/README.md 状态同步
