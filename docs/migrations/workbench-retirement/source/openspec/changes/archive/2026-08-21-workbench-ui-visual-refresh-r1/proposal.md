## Why

`workbench-ui-controls-r1` 完成了控件统一，但视觉仍是「扁平发丝线、6px 圆角、零 elevation、accent 大面积平涂」的初版语言，与项目认定的视觉主基线——Eikona 高保真参考图（`prompts/product/ui-reference/workbench-agent-pane/deliverables/02-plugin-pane-workspace.png`）差距明显：参考图是圆润（控件 10px/面板 12px/浮层 14px 圆角）、四级表面分层、柔和投影、accent 以 tint 精用的精致深色界面。用户在开发预览中确认当前效果不可接受，要求全站对齐参考图。`docs/design/agent-visual-language.md` 的「卡片禁令/扁平发丝线」条款与该基线冲突，需要随本 change 修订。

## What Changes

- 新增 capability `workbench-ui-visual-language`：定义圆角刻度、四级表面分层、elevation 投影、accent tint 用法、chip/icon-tile 模式的视觉合同。
- Token 层：`tokens/index.css` 新增 `--wb-radius-sm/control/panel/overlay/pill` 刻度、深色柔和多层 elevation、`--wb-accent-tint`、`--wb-border-elevated`；`styles.css` `@theme` 增补第 4 级 surface 物理色。
- 控件层（不改 API，只改 CSS）：Button 收敛实心 accent 仅限主 CTA、secondary 改 elevated 填充；输入类控件改填充式 + 10px 圆角 + focus tint 光晕；Dialog/Popover/Menu/CommandPalette 14px 圆角 + 柔和投影；chip 统一 tint 底 + 彩色文字；列表行/Pane 图标落 icon-tile 模式。
- 主壳与全站：`/agent` rail/sidebar/panel/popover 四级分层，Pane 容器 12px 圆角 + 细边 + 投影；orbit/gateway/workflow/pinax 等控制台 token 级联跟随；studio/eikona/open-design legacy surface 结构不动、视觉随 token 级联；清理全站 `border-radius`/`box-shadow` 字面量改指 token。
- 修订视觉真源文档：`docs/ui/agent-first-workbench.md` §8（radius/surfaces 条款）、`docs/design/agent-visual-language.md`（表面规则/圆角刻度/组件形态映射，改为 Eikona 基线）、`docs/design/ui-controls-system.md` §3.4。
- 保留红线：无意义渐变/厚玻璃/emoji/嵌套卡片墙黑名单继续有效；诚实性状态表达不弱化；三层 token 架构与 Radix 基座不变。

## Capabilities

### New Capabilities

- `workbench-ui-visual-language`: 定义 Workbench UI 的圆角刻度、表面分层、elevation、accent tint 用法与 chip/icon-tile 模式合同，要求全部共享控件与主壳表面经 `--wb-*` token 消费该视觉语言，并以截图基线与黑名单评审为证据。

### Modified Capabilities

无。对 `workbench-ui-foundation`/`workbench-ui-controls` 保持 additive：本 capability 只定义视觉参数合同，不改变控件行为、状态语义或既有 Requirement。

## Impact

- 预计影响 `apps/web/src/styles.css`、`apps/web/src/design-system/tokens/index.css`、`design-system/primitives/*.css`、`design-system/composites/*.css`、`workbench/agent/**`、`workbench/navigation/**`、legacy surface 的硬编码视觉值清理、gallery 与 e2e 截图基线。
- 文档：`docs/ui/agent-first-workbench.md`、`docs/design/agent-visual-language.md`、`docs/design/ui-controls-system.md`、`docs/design/design-system-unification.md`（交叉引用）。
- 全站 token 级联会产生大面积截图 diff，这是本 change 的既定目标；基线更新随 change 提交并逐图签认（D3 §10.4 纪律）。
- 不做：不改控件 API/行为、不动 legacy surface 结构、不修 HEAD 既有 e2e 失败（61 例已归因，另开 change）、不引入渐变/玻璃。
- 验证：`openspec validate --all --strict`、`bun run typecheck`、design-system vitest 套件、`test/foundation-contract.test.ts`、全量 vitest、`bun run build`、`compose:i18n && check:i18n`、e2e（不新增失败）。
