# Agent-first Workbench 视觉语言

本文定义 `/agent` 主壳的视觉语言。视觉基线为 Eikona 高保真参考图（`prompts/product/ui-reference/workbench-agent-pane/deliverables/`，02 为主基线）：圆润、分层、精致的深色开发者工具。优先级低于蓝图/接口合同的安全与真值约束，高于任何单个组件的临时审美。长期 UI 管理、route/Pane/Lens 分类、跨 DSH 语义与压力测试见 [Workbench UI 设计治理与一致性合同](workbench-ui-governance.md)；实施基线见 [设计系统统一工程方案](design-system-unification.md) 的 token 三层架构；radius/elevation 刻度由 `workbench-ui-visual-refresh-r1` 确立。

## 1. 表面规则（分层，而非卡片墙）

- 表面分四级：**canvas 底色** < **rail/sidebar** < **panel（Pane 容器/内容面板）** < **elevated/popover**，逐级微亮，由 `--wb-surface-*` token 表达。
- Pane 容器与独立面板：12px 圆角（`--wb-radius-panel`）+ 1px 低透明边框（`--wb-border-subtle`/`--wb-border-elevated`）；内容分区仍优先用留白与分隔线。
- 浮层（命令面板、Dialog、Popover、Sheet）：14px 圆角（`--wb-radius-overlay`）+ 细边 + 深色柔和投影（`--wb-elevation-*`）。
- 禁止"嵌套卡片墙"：面板内不再叠加 `border + 背景 + 圆角 + 阴影` 的子卡片；时间线/列表内容靠发丝线与 hover 浅底分区。
- 玻璃模糊（backdrop-filter）、径向渐变、装饰性彩色投影禁止出现在主壳常驻区域。

## 2. 圆角刻度

- `--wb-radius-sm` 6px：chip/badge/小标签。
- `--wb-radius-control` 10px：按钮、输入、下拉 trigger、开关、列表行。
- `--wb-radius-panel` 12px：Pane 容器、面板。
- `--wb-radius-overlay` 14px：Dialog、命令面板、Popover、Sheet。
- `--wb-radius-pill` 999px：仅限 Switch 与小徽章；不做大胶囊按钮。

## 3. 节奏与排版

- 行节奏：单行 24px（工具行/思考行），内容区 4px 基网。
- 字级：正文 13–14px；辅助 11–12px；badge/元信息 10–11px；mono 只用于 ID、路径、Task、receipt、version、事件 code。
- 字重：标题 600，正文 400，辅助 400 浅色；不用 700+ 大标题堆叠。

## 4. 色彩克制

- accent（`--color-accent`）的实心填充**仅限主 CTA**（如 Send）；其余场景用 tint（`--wb-accent-tint`，12–16% color-mix）：激活 tab/选中行、focus ring 光晕、链接、运行中转轮。
- 状态色以「tint 底色（~14% color-mix）+ 彩色文字」表达徽章/chip；行级状态用文字 + 小色点/细线，禁止大面积状态底色块。
- 文本三级：`--wb-text-primary` / `--wb-text-muted` / 更弱一级的元信息灰。
- 紫色（`--color-contract`）保留给 agent 身份与 `needs_contract`/`unknown_accept` 语义。

## 5. 图标

- 只用 design-system 图标注册表中的线性矢量图标（lucide，stroke 1.75），14px（行内）与 16px（操作）两档；禁止填充色块图标与 emoji 充当图标。
- 列表项/Pane/文件图标可放在 8px 圆角 tint 底瓦片（icon tile）中，瓦片底色用对应语义色的低透明 color-mix。

## 6. 动效

- 开合/聚焦 120–180ms fade/slide；`prefers-reduced-motion` 下全部禁用；运行中 shimmer 仅 `motion-safe`。

## 7. 组件形态映射

| 组件 | 旧形态 | 目标形态 |
| --- | --- | --- |
| Pane 容器 | 直角 + 发丝线 | 12px 圆角 + 细边 + 四级表面层次 |
| 命令面板/Dialog | 12px 圆角轻影 | 14px 圆角 + 细边 + 柔和投影 + 背景压暗 |
| 按钮 | 平涂/细描边 | 10px 圆角；primary 实心 accent（仅主 CTA），secondary elevated 填充 + 细边 |
| 输入/下拉 trigger | 描边空底 | 10px 圆角填充式（elevated 底 + 低透明边），focus 带 accent tint 光晕 |
| 徽章/chip | 描边 pill | tint 底 + 彩色文字，6px 圆角 |
| run/提案/结果区段 | rounded-xl border+bg+shadow 方块 | 面板内发丝线区段；语义左侧 2px 色条 |
| thinking/tool 行 | 带边框底的行盒 | 无边框单行，hover 浅底 |
| 会话 rail 行 | 圆角选中块 | 10px 圆角 + accent tint 选中底 |
| header 按钮 | 带边框按钮 | 幽灵按钮，hover 显底 |
| 列表/Pane 图标 | 裸图标 | 8px 圆角 tint 底瓦片 |
| 空状态 | dashed 大框 | 居中品牌位 + 一行说明 + 单 CTA |
| composer 卡片 | 贴底描边输入条、拉满 canvas | elevated 填充底（不靠描边区分）+ 近隐形低透明边 + 柔和投影浮起；dock 14px（`--wb-radius-overlay`）、hero 16px 圆角；hero/dock 统一 720px 限宽居中；textarea 无边无背景融入卡片，placeholder 顶左；底栏稀疏——左簇「+」圆钮 + ghost 动作，右簇能力指示（仅非常备时）+ 圆形 icon-only 实心 accent 发送（44px 触控盒内画 32px 视觉圆），Enter/Shift+Enter 提示入发送钮 tooltip 不占底栏文字 |

## 8. 验收

- 截图基线对照 Eikona 02 参考：四级表面层次清晰、圆角刻度一致、accent 无大面积平涂、无渐变/玻璃、行节奏一致。
- 所有 aria/data 选择器不变；全量组件测试与 e2e 通过。
- token contract / foundation contract / 视觉黑名单测试通过。
