# 统一 UI 控件体系设计规范（workbench-ui-controls）

## 0. 文档定位

本文是 Workbench Web 前端**基础控件层**的设计规范，是 `openspec/changes/workbench-ui-controls-r1/` 的设计输入与实现依据。

真源层级（上位优先，本文不与任何上位文档冲突）：

- 产品结构与视觉决策：[Agent-first Pane Workspace UI Spec](../ui/agent-first-workbench.md) §8（视觉系统）与 §12（验收标准）。
- 视觉语言细则：[Agent 主壳视觉语言](agent-visual-language.md)（扁平、发丝线分隔、卡片禁令、24px 行节奏 / 4px 基网、字级 13–14/11–12/10–11px；该文件当前为未提交状态，以其入库版本为准）。
- Token 与迁移工程：[设计系统统一工程方案（D3）](design-system-unification.md) 的三层 token 架构与验收门禁。
- Pane 布局与交互：[Pane 交互模型](pane-interaction-model.md)。
- 上位能力 spec：`openspec/specs/workbench-ui-foundation/spec.md`（shared controls 的 approved primitives、键盘/focus/boundary、确定性证据要求）。

本文只定义**控件层合同**：有哪些控件、每个控件的 API/状态/无障碍/token/motion 合同、文件规范、重复实现收敛映射与验收门禁。不重述产品决策，不改 token 定义，不定义 Pane 布局语义。

浏览器安全红线不变：控件不直连 owner、不加载任意第三方代码/URL；`needs_contract`、`unknown_accept` 等不可用状态的诚实表达不得因控件替换而弱化。

## 1. 现状问题（控件层）

D3 文档已盘点 token/图标/动效/composites 四条线的双轨问题；本文补齐**表单与浮层控件**这条缺失线：

| 问题 | 证据 |
| --- | --- |
| 手写 tablist 7 处，无共享 Tabs | `studio/shell.tsx:429`、`eikona/reuse/reuse-workspace.tsx:25`、`workbench/harness/harness-route.tsx:271`、`workbench/agent/panes/agent-pane-dock.tsx:273` 与 `:572`、`workbench/panes/workflows/workflow-console.tsx:38`、`workbench/panes/pinax-kb-review/pinax-kb-review-route.tsx:102` |
| 命令面板 3 套，各自组合 cmdk + Radix Dialog | `workbench/shell.tsx:117`、`eikona/components/command-palette.tsx`、`workbench/agent/panes/pane-command-palette.tsx` |
| Radix Dialog 在 10 个文件中裸用，无封装 | 另有 `.gate-dialog`/`.reconcile-dialog` 两处纯 div 假 dialog（`workbench/shell.tsx`，样式 `styles.css:108-110`） |
| 手写搜索框 8+ 处 | `localization-pane.tsx:160`、`shell.tsx:138`、`orbit/receipt-evidence.tsx:219`、`orbit/work-chart-table.tsx:208`、`asset-library-pane.tsx:110`、`agent/conversation/session-rail.tsx:85` 等 |
| 原生 `<select>` 各处单独样式 | `.focus-lens select`、`.eikona-filter-row select`、`.reconcile-dialog select` |
| 无通用 Button/Input/Checkbox/Radio/Switch | `design-system/primitives/` 仅 `TooltipIconButton`、`ContextualHelp` |

后果：同一交互在视觉、键盘行为、focus 管理、disabled 表达上各有分叉；无障碍质量取决于各功能域自觉；新页面继续复制分叉。

## 2. 组件分层与清单

```text
L0 基座    Radix UI primitives + cmdk（无障碍、focus trap、定位、键盘的唯一权威）
  ↑ 只在 design-system 内部消费
L1 控件    design-system/primitives/   本文新增 17 个 wb- 封装控件（已全部落地）
L2 组合    design-system/composites/   已有 6 个 + D3 规划的 DataRow
L3 布局壳  PaneChrome/PaneTabs/PaneToolbar（pane 交互合同归 pane-interaction-model.md）
```

### 2.1 L0 基座依赖

已安装：`@radix-ui/react-dialog`、`@radix-ui/react-tooltip`、`cmdk`。

本方案新增（均为 Radix 官方 primitive，与已有依赖同源同风格）：

| 依赖 | 承载控件 | 选型理由 |
| --- | --- | --- |
| `@radix-ui/react-select` | `Select` | 原生 `<select>` 样式不可控且无搜索/分组能力；Radix Select 提供完整键盘与 typeahead |
| `@radix-ui/react-popover` | `Popover`、`MultiSelect`、`Combobox` 的浮层锚定 | 统一的浮层定位/ dismiss 层行为 |
| `@radix-ui/react-dropdown-menu` | `DropdownMenu`、Pane/行内溢出菜单 | roving tabindex 与子菜单能力 |
| `@radix-ui/react-tabs` | `Tabs` | 收敛 7 处手写 tablist 的键盘合同 |
| `@radix-ui/react-checkbox` | `Checkbox` | indeterminate 状态与表单集成 |
| `@radix-ui/react-radio-group` | `RadioGroup` | roving tabindex 组导航 |
| `@radix-ui/react-switch` | `Switch` | 即时生效开关的语义与键盘 |
| `@radix-ui/react-toggle-group` | 分段控件（`SegmentedControl`，按需） | 视图切换类单选/多选按钮组 |

`cmdk` 继续承载 `Combobox`/`CommandPalette` 的列表过滤与键盘导航，不新增替代品。

明确不引入：shadcn/ui（拷贝式范式与 `--wb-*` token 三层架构需二次对齐，且本项目已有自有 design-system 骨架）、Headless UI 或其他重复基座、任何带样式的组件库。

### 2.2 L1 控件清单（`design-system/primitives/`）

| 控件 | 基座 | 说明 |
| --- | --- | --- |
| `Button` | 原生 button | variant：primary/secondary/ghost/danger；size：sm/md；loading 态 |
| `IconButton` | 原生 button | 由现有 `TooltipIconButton` 收敛改名而来；aria-label 必填；disabledReason 必填 |
| `Input` | 原生 input | 单行文本；size sm/md；error/disabled/leading/trailing 槽 |
| `TextArea` | 原生 textarea | 多行；auto-resize 可选；composer 之外的通用多行 |
| `SearchBox` | `Input` | 搜索专用：清除按钮、可选快捷键聚焦（注册进 guidance/shortcuts）、防抖合同、loading 态 |
| `Select` | react-select | 单选下拉；分组、禁用项、空态、error 态 |
| `MultiSelect` | react-popover + checkbox 列表 | 多选下拉；已选摘要、全选/清空、搜索过滤 |
| `Combobox` | cmdk + react-popover | 可搜索单选；大列表/异步选项的唯一入口 |
| `Checkbox` | react-checkbox | checked/unchecked/indeterminate |
| `RadioGroup` | react-radio-group | 单选组；横向/纵向密度 |
| `Switch` | react-switch | 即时生效开关；异步确认时配合 loading |
| `SegmentedControl` | react-toggle-group | 视图/模式切换（已建：阶段 C 评估确认真实消费面，如 eikona reuse 工作区） |
| `Tabs` | react-tabs | 收敛全部手写 tablist；variant：line/pill |
| `Dialog` | react-dialog | 统一 overlay/内容结构、尺寸档位、确认类 footer 合同 |
| `Popover` | react-popover | 非模态浮层容器 |
| `DropdownMenu` | react-dropdown-menu | 动作菜单；destructive 项、快捷键提示、分组分隔 |
| `Tooltip` | react-tooltip | 信息性提示唯一入口；禁原生 `title`（icon guidance spec 既有要求） |

命名固定，别名只允许在 composites 层组合产生（如 `CommandPalette`，归 composites，不在本清单；实现组合备注见 §5 表后）。

### 2.3 L2/L3 引用关系

- L2 composites（`StatusChip`、`DataState`、`EvidenceBlock`、`ActionRecovery`、`ContextDeck`、`InspectorLayout`、规划中 `DataRow`）继续由 D3 §6 的吸收映射推进；本文不重复定义，只要求它们内部改用 L1 控件（如 `ActionRecovery` 的按钮走 `Button`）。
- L3 `PaneChrome`/`PaneTabs`/`PaneToolbar`：Pane 的打开/关闭/聚焦/拖拽/上限语义归 `pane-interaction-model.md`；本文只定义 chrome 的控件组成——标题区、溢出菜单（`DropdownMenu`）、tab 条（`Tabs`）、工具区（`IconButton` 组）——及其 token 消费。`agent-pane-dock.tsx` 的两处手写 tablist 是 `PaneTabs` 的首批消费者。

## 3. 控件统一合同模板

§4 每个控件按以下模板定义；此处先固定全局规则，各控件节只写增量。

### 3.1 API 约定

- 受控/非受控：支持受控（`value` + `onValueChange`）；非受控用 `defaultValue`。命名与 Radix 对齐，不发明第二套。
- 枚举 props：`variant`、`size`、`tone` 用字符串字面量联合类型，导出对应 TS 类型；禁止 boolean prop 堆叠（如 `isPrimary && isDanger`）。
- `disabled` 为 boolean；交互类控件的 `disabled` 若由业务状态导致，必须同时提供 `disabledReason: string`（走 i18n key），tooltip 展示原因——沿用 `TooltipIconButton` 既有约定与 UI Spec §8「无原因 disabled」黑名单。
- `className` 永远最后合并：`clsx` + `tailwind-merge`（激活这两个已在 package.json 但未使用的依赖），消费者可以覆盖布局类（margin/width），不得覆盖 token 类。
- 全部控件 `forwardRef`，ref 指向可聚焦元素（复合控件指向 trigger）；props 接口导出并带 JSDoc。
- 事件回调命名 `onValueChange`/`onOpenChange`/`onSelect`，与 Radix 一致；不包裹成项目私有名词。

### 3.2 状态矩阵（全局）

每个交互控件必须显式处理：

| 状态 | 表达 | token |
| --- | --- | --- |
| default | 发丝线边框或无边框（按视觉语言去方块化） | `--wb-border-subtle`、`--wb-text-primary` |
| hover | 浅底或边框增强 | `--wb-surface-hover` |
| focus-visible | 统一 focus ring，不用 outline 默认值 | `--wb-focus-ring` |
| active/pressed | 下沉色，不用 scale | `--wb-surface-selected` |
| selected | 选中底 + 状态图标 | `--wb-surface-selected` |
| disabled | 降透明度 + `disabledReason` tooltip | `--wb-text-disabled` |
| loading | spinner 或骨架 + 防重复提交 | `--wb-text-muted` |
| error | 错误描边/文案，不只靠颜色 | `--wb-status-danger` |
| readonly | 与 disabled 区分：可复制、可聚焦 | `--wb-text-muted` |

### 3.3 键盘与无障碍（全局）

- 键盘行为以 Radix primitive 原生实现为准（roving tabindex、typeahead、Escape 分层 dismiss）；**禁止在业务代码手写 focus trap、定位或 keydown 路由**。
- 图标专属控件必须有稳定 accessible name；tooltip 只做补充，不做唯一名称来源。
- 浮层关闭后 focus 回到 trigger（Radix 默认），页面不得再自行 `focus()` 打乱。
- 对比度：文本/边框对 `--wb-canvas` 满足 WCAG AA；状态不只靠颜色区分（配合图标或文案）。
- touch target ≥ 24px（桌面高密度）/44px（触屏断点），与 icon guidance spec 对齐。

### 3.4 Token 与密度（全局硬规则）

- 控件 CSS 只允许 `var(--wb-*)`；禁止 `var(--color-*)`、字面量 hex/rgba、字面量 px 间距（4px 基网上的 4/8/12/16/24/32 除外，且优先用 `--wb-space-*`）、字面量 ms。
- 字级：正文/控件 13–14px，辅助 11–12px，meta 10–11px；行高落在 24px 行节奏（`agent-visual-language.md`）。
- radius：走 `--wb-radius-*` 刻度（chip 6px / 控件 10px / 面板 12px / overlay 14px，见 `agent-visual-language.md` §2，由 workbench-ui-visual-refresh-r1 确立）。
- 密度档位由 `--wb-*` 间距 token 表达，不为控件发明私有 spacing 常量。

### 3.5 Motion（全局）

- 只消费 `design-system/motion/index.css` 的 recipe class：popover/menu/dialog/sheet/inspector/disclosure/list-feedback；时长预算 120/180/240ms。
- 禁止 `scale(`（motion policy test 已强制）；位移只用 `--wb-motion-distance`(4px)/`--wb-overlay-distance`(8px)。
- reduced-motion 双层降级已由 token 层 + recipe 层提供，控件只消费 recipe class 即自动获得降级。

## 4. 逐控件合同

### 4.1 Button

- Props：`variant: 'primary'|'secondary'|'ghost'|'danger'`（默认 secondary）、`size: 'sm'|'md'`（默认 md）、`loading?: boolean`、`disabledReason?: string`、`icon?: IconName`（经 icons registry，不直接收 lucide 组件）、标准 button 属性透传。
- 状态：全量 §3.2 矩阵；`loading` 时 `disabled` 且保留宽度不抖动（图标位替换为 spinner）。
- 语义：`danger` 仅用于不可逆/destructive 动作；异步 mutation 的 pending/回执表达归 `ActionRecovery` composite，Button 不伪造成功态。
- 键盘：原生 button 行为；无增量。

### 4.2 IconButton

- 由现有 `TooltipIconButton` 收敛：`label`（aria-label，必填）、`icon: IconName`、`disabledReason`、`tooltip` 可选补充、`size: 'sm'|'md'`。
- 迁移：`TooltipIconButton` 保留一个别名导出直至消费者迁完，随后删除（防双轨）。

### 4.3 Input

- Props：`value`/`defaultValue`、`size`、`invalid?: boolean`、`leading?: ReactNode`（仅 `WorkbenchIcon`）、`trailing?: ReactNode`。
- `invalid` 时必须有 `aria-describedby` 指向错误文案（由调用方用 `FormField` 模式或手动提供）；不做内置表单库。

### 4.4 TextArea

- Props：同 Input 增量 `autoResize?: boolean`、`minRows/maxRows`。
- 不承载 composer 的 submit 快捷键语义（composer 是 agent 域组件，可消费本控件）。

### 4.5 SearchBox

- 组合 Input 的合同 + 固定件：搜索图标、清除按钮（有值时出现，`aria-label` 走 i18n）、`loading` 指示。
- Props：`value`、`onValueChange`、`debounceMs?: number`（默认 0，防抖由调用方声明而非内置魔法）、`hotkey?: string`（必须注册进 `design-system/guidance/shortcuts.ts`）、`placeholder` 走 i18n。
- 键盘：Escape 清空并保持焦点；有 hotkey 时全局聚焦由注册表统一管理，控件不自行绑定 window keydown。

### 4.6 Select

- 基座 react-select。Props：`options: { value, label, disabled?, disabledReason? }[]` 或 children 分组、`placeholder`、`invalid`、`size`。
- 浮层消费 `wb-motion-popover`；typeahead、Home/End、Escape 由 Radix 承载。
- 选项超过 ~10 个或需搜索时引导用 `Combobox`，Select 不自加搜索框。

### 4.7 MultiSelect

- 基座 react-popover + 列表（项内用 `Checkbox`）。
- Props：`options`、`value: string[]`、`onValueChange`、`summary?: (selected) => string`（默认 `已选 N 项` 走 i18n）、`searchable?: boolean`。
- 全选/清空内置于浮层头部；已选项在 trigger 上以摘要文本表达，不用 chip 墙（卡片禁令）。

### 4.8 Combobox

- 基座 cmdk + react-popover；单选可搜索。
- 异步选项：`loading`/`empty`/`error` 三态显式 props，不从 Promise 状态猜测。
- 这是大列表选择（如 pane catalog、owner 资源）的唯一入口；`CommandPalette` composite 复用它。

### 4.9 Checkbox / 4.10 RadioGroup / 4.11 Switch

- Checkbox：`checked: boolean | 'indeterminate'`，`label` 可 children；组场景由调用方布局。
- RadioGroup：`options` 或 children，`orientation: 'vertical'|'horizontal'`；roving tabindex 由 Radix 承载。
- Switch：仅用于即时生效设置；需要确认或异步的动作用 Checkbox + Button。异步写入期间 `loading` 态禁重复切换，失败回滚由调用方按 receipt/投影处理，控件不伪造已生效。

### 4.12 SegmentedControl（按需）

- 基座 react-toggle-group；用于视图/密度/模式切换。`type: 'single'|'multiple'` 与 Radix 对齐。
- 阶段 C 实施前评估真实消费面；无消费者则不建（避免 speculative 控件）。

### 4.13 Tabs

- 基座 react-tabs。Props：`value`/`onValueChange`、`variant: 'line'|'pill'`（默认 line，发丝线选中指示，遵循去方块化）、`size`。
- 键盘：方向键 roving、Home/End、激活策略 `activation: 'automatic'|'manual'`（默认 automatic；手动用于重内容面板）。
- 溢出：tab 数超宽时滚动 + 溢出菜单（`DropdownMenu`），不挤压省略。
- 收敛目标：§5 表中 7 处手写 tablist 全部替换；`PaneTabs` 是它的 L3 包装。

### 4.14 Dialog

- 基座 react-dialog 的项目唯一封装。Props：`open`/`onOpenChange`、`title`、`description?`、`size: 'sm'|'md'|'lg'`、footer 槽。
- 确认类（destructive/不可逆）必须 `role="alertdialog"` 语义 + 明确的确认/取消按钮；非模态需求走 `Popover`/`InspectorLayout`。
- backdrop fade fast + content enter normal（`wb-motion-dialog`）；Escape/外点关闭、focus trap、关闭回焦 trigger 均由封装保证。
- 收敛目标：10 处裸 Radix Dialog + `.gate-dialog`/`.reconcile-dialog` 纯 div 假 dialog。

### 4.15 Popover / 4.16 DropdownMenu / 4.17 Tooltip

- Popover：非模态容器；`side`/`align` 透传；消费 `wb-motion-popover`。
- DropdownMenu：动作列表唯一入口；`destructive` 项样式 + 分隔/分组/快捷键提示；禁用项必须 `disabledReason`。
- Tooltip：信息提示唯一入口；禁原生 `title`；delay 与动画走 token；不承载交互内容（交互内容用 Popover）。

## 5. 重复实现收敛映射表

迁移纪律沿用 D3 §6：替换与删除旧实现同 PR；一个旧实现被完全吸收后才删其 CSS；诚实性状态显示不得弱化。

| 旧实现 | 位置 | 目标控件 | 状态 |
| --- | --- | --- | --- |
| 手写 tablist ×7 | `studio/shell.tsx:429`、`eikona/reuse/reuse-workspace.tsx:25`、`workbench/harness/harness-route.tsx:271`、`workbench/agent/panes/agent-pane-dock.tsx:273` 与 `:572`、`workbench/panes/workflows/workflow-console.tsx:38`、`workbench/panes/pinax-kb-review/pinax-kb-review-route.tsx:102` | `Tabs`（agent-pane-dock 两处经 `PaneTabs`） | 已收敛 |
| 命令面板 ×3 | `workbench/shell.tsx:117`、`eikona/components/command-palette.tsx`、`workbench/agent/panes/pane-command-palette.tsx` | `CommandPalette` composite | 已收敛 |
| 裸 Radix Dialog ×10 | 各功能域（实测为准） | `Dialog` | 已收敛 |
| 纯 div 假 dialog ×2 | `workbench/shell.tsx`（`.gate-dialog`/`.reconcile-dialog`） | `Dialog`（alertdialog 语义） | 已收敛 |
| 手写搜索框 ×8+ | `localization-pane.tsx:160`、`shell.tsx:138`、`orbit/receipt-evidence.tsx:219`、`orbit/work-chart-table.tsx:208`、`asset-library-pane.tsx:110`、`agent/conversation/session-rail.tsx:85` 等 | `SearchBox` | 已收敛 |
| 原生 `<select>` 多处 | `.focus-lens select`、`.eikona-filter-row select`、`.reconcile-dialog select` | `Select` | 已收敛 |
| 手写按钮/图标按钮散点 | 各功能域（实测为准） | action 使用 `Button`/`IconButton`；可选择 row 可保留语义 `<button>` 但必须消费统一 token/focus recipe | R1 基础收敛完成；兼容 route 与新增业务面仍需按源码复查 |

实现备注（阶段 F 补记，与上文设想的偏差）：

- `CommandPalette` composite 最终**未复用 `Dialog` primitive 与 `Combobox` primitive**，而是直接组合 `@radix-ui/react-dialog` + `cmdk`：面板需要把 `Command.Input`（autoFocus）、分组 `Command.List` 与 footer 槽一体编排在 dialog content 内，复用现有 primitive 反而要为这一次性布局在 `Dialog`/`Combobox` 上开 props 口子。L0 使用仍被 §7.2 的 R1 硬断言约束在 design-system 内部，不构成合同漏洞。

Text Development 的编辑器 canvas 属第三方受控内容面，不要求用 `TextArea` 替代 CodeMirror；但编辑器之外的 toolbar、selection actions、profile form、review decision、Sheet/Dialog、status 和 recovery 必须使用本控件体系。CodeMirror extension 不得定义第二套 Button/Menu/Tooltip/Dialog 或全局主题。

## 6. 文件与代码规范

- 每个控件一个文件组：`design-system/primitives/<name>.tsx` + `<name>.css`（`wb-` 前缀类名）+ `<name>.test.tsx`，沿用 `TooltipIconButton` 既有模式。
- 样式首选同名 `.css` 文件 + `wb-` 类名（与既有 primitives 一致）；不引入 CSS-in-JS；Tailwind 只用于布局微调（经 `className` 合并）。
- `design-system/` 根新增 barrel `index.ts` 统一出口（现状无根 barrel，消费者深路径导入；控件达 16+ 后统一出口成为必要）。
- 测试：Vitest + Testing Library 同目录单测（状态矩阵、键盘、aria）；每个控件注册进 gallery fixture（§7）。
- i18n：控件内任何用户可见文案（清除、占位、空态、已选摘要）走 `copy-keys.ts` 模式 + `api/locale/source/{zh-CN,en-US}/agent/*.json`；改后必须 `bun run compose:i18n && bun run check:i18n`。

## 7. 验收与门禁

1. **Gallery 证据**：每个控件在 `design-system/gallery/foundation-gallery.tsx` 注册 fixture，覆盖 §3.2 状态矩阵 + 移动端/reduced-motion 变体；fixture 用安全静态数据，不依赖 owner/provider。gallery 同时经内部路由 `/design-system/foundation-gallery`（query：`viewport=mobile`、`motion=reduced`）在浏览器渲染，供截图基线使用。
2. **新增 `design-system/primitives/contract.test.ts`**（grep 式防回潮，模式同 `tokens/contract.test.ts`）：
   - design-system 之外禁止 `from "@radix-ui/react-dialog"` 等 L0 直接 import；
   - design-system 之外禁止 `role="tablist"` 手写模式与原生 `<select>`；
   - 控件 CSS 中禁止字面量 hex/rgba/ms（复用 token contract 的扫描器）。
   - 阶段 F 状态：豁免白名单已随阶段 E 清零并移除，R1/R2/R3 均为**零违例硬断言**，报错列出违例文件与行号。
3. **既有门禁保持绿**：`tokens/contract.test.ts`、`motion/policy.test.ts`、`icons/registry.test.ts`、`gallery/foundation-gallery.test.tsx`、`apps/web/test/foundation-contract.test.ts`。
4. **视觉基线**：`e2e/foundation-gallery.spec.ts` 已对 gallery 固化 `toHaveScreenshot` 基线（1440×960、1024×768、390×844 + reduced-motion 变体，基线图入库于 `e2e/foundation-gallery.spec.ts-snapshots/`）；迁移旧实现时逐 PR 附 before/after 对比。基线已随 `workbench-ui-visual-refresh-r1` 按新视觉语言（圆角刻度/填充式控件/chip tint/overlay 投影）重生成并复跑稳定 4/4 绿，并排评审与签认见 `openspec/changes/workbench-ui-visual-refresh-r1/review-report.md`。全量 e2e 经 `e2e/global-setup.ts` 预热 Vite transform 缓存（冷启动首导航约 48s，否则首个测试的 `goto` 超 30s 测试超时被中止）；既有失败分类与归因见 `openspec/changes/workbench-ui-controls-r1/review-report.md`「e2e 收尾」一节。
5. **黑名单**：每个迁移 PR 按 UI Spec §8 视觉黑名单逐项过审（嵌套卡片、无原因 disabled、假成功 toast 等）。阶段 F 审查报告：`openspec/changes/workbench-ui-controls-r1/review-report.md`。

聚焦运行命令：

```bash
bun run typecheck
bun run --cwd apps/web vitest run test/foundation-contract.test.ts
bun run --cwd apps/web vitest run --config src/design-system/tokens/vitest.config.ts
bun run compose:i18n && bun run check:i18n   # 涉及文案时
bun run --cwd apps/web e2e                   # 截图基线相关阶段
```

## 8. 分阶段路线

每阶段独立可回滚；对应 `openspec/changes/workbench-ui-controls-r1/tasks.md`。

- **阶段 A · 基座与骨架**（完成）：安装 §2.1 新增依赖；建立 `primitives/contract.test.ts` 骨架（白名单豁免现状）；design-system 根 barrel。
- **阶段 B · 表单控件**（完成）：`Button`、`IconButton`（收敛 TooltipIconButton）、`Input`、`TextArea`、`SearchBox`、`Checkbox`、`RadioGroup`、`Switch` + 单测 + gallery fixture。
- **阶段 C · 选择与浮层**（完成）：`Select`、`MultiSelect`、`Combobox`、`Popover`、`DropdownMenu`、`Dialog`、`Tooltip`、`SegmentedControl`（评估后有真实消费面，已建）+ 单测 + fixture。
- **阶段 D · Tabs 与 PaneChrome**（完成）：`Tabs`、`PaneChrome/PaneTabs/PaneToolbar`；收敛 7 处手写 tablist（每处一个 PR，agent-pane-dock 先行）。
- **阶段 E · CommandPalette 与搜索收敛**（完成）：`CommandPalette` composite 统一 3 套面板；8+ 处搜索框迁 `SearchBox`；裸 Dialog/原生 select 迁移。
- **阶段 F · 门禁收尾**（完成）：contract test 白名单清零转硬断言；gallery 截图基线固化（`e2e/foundation-gallery.spec.ts` + snapshots）；视觉黑名单过审（`review-report.md`）；本文与 D3 文档状态同步。
