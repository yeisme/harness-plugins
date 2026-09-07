## Context

Workbench Web 前端的 design-system 已完成 token（`--wb-*` 语义层）、icons registry、motion recipes 与 composites 四层建设，但基础控件层空白：无 Button/Input/Select/Tabs/Dialog 等通用封装，功能域各自手写，已形成 7 处 tablist、3 套命令面板、10 处裸 Radix Dialog、8+ 处搜索框的重复实现。本 change 为控件层立项，完整设计规范见 `docs/design/ui-controls-system.md`（本文是其摘要与决策记录）。

上位约束：

- `openspec/specs/workbench-ui-foundation/spec.md`：shared controls 必须用 approved accessible primitives、定义键盘/focus/boundary 行为、提供确定性 gallery 证据。本 change 是其控件层细化，additive。
- `docs/ui/agent-first-workbench.md` §8/§12：视觉系统与验收标准；§8 视觉黑名单（嵌套卡片、无原因 disabled、假成功 toast 等）直接成为控件评审项。
- `docs/design/design-system-unification.md`：三层 token 架构与迁移纪律（替换与删除同 PR、诚实性状态不弱化）。
- `docs/design/agent-visual-language.md`（当前未提交，以入库版本为准）：去方块化、24px 行节奏、字级档位。
- `docs/design/pane-interaction-model.md`：Pane 布局/交互语义不在本 change 范围，本文只定义 PaneChrome 的控件组成。

## 决策

### D1 基座：扩展 Radix，不引入 shadcn/ui，不纯手写

| 选项 | 结论 | 理由 |
| --- | --- | --- |
| 扩展 Radix primitives + 自研 `wb-` 封装 | **采用** | 项目已装 `react-dialog`/`react-tooltip`/`cmdk`，foundation spec 要求 approved accessible primitives；无障碍、focus trap、定位、键盘由单一基座权威承载 |
| 引入 shadcn/ui | 否决 | 拷贝式源码引入第二套样式范式，需与 `--wb-*` 三层 token 重新对齐；项目已有自有 design-system 骨架 |
| 纯手写 | 否决 | 自实现 focus trap/键盘导航/定位的无障碍成本高，直接违反 foundation spec 的 approved primitives 要求 |

新增依赖：`@radix-ui/react-select`、`react-popover`、`react-dropdown-menu`、`react-tabs`、`react-checkbox`、`react-radio-group`、`react-switch`、`react-toggle-group`（按需）。全部与既有 Radix 依赖同源同风格，无额外运行时范式。

### D2 组件分层

```text
L0  Radix primitives + cmdk      只在 design-system 内部消费（contract test 强制）
L1  design-system/primitives/    本 change 新增约 16 个控件
L2  design-system/composites/    已有 6 个 + D3 的 DataRow；内部改用 L1 控件
L3  PaneChrome/PaneTabs/PaneToolbar   pane 交互合同归 pane-interaction-model.md
```

### D3 控件合同要点（细则见设计文档 §3/§4）

- API：受控 `value`/`onValueChange` 与非受控 `defaultValue` 命名与 Radix 对齐；`variant`/`size` 枚举代替 boolean 堆叠；业务导致的 `disabled` 必须带 `disabledReason`（i18n key）；`forwardRef` + 导出 props 接口；`clsx + tailwind-merge` 合并 className（激活两个已装未用的依赖）。
- 状态矩阵：default/hover/focus-visible/active/selected/disabled/loading/error/readonly 逐控件显式定义，token 全部来自 `--wb-*`。
- Token：控件 CSS 只允许 `var(--wb-*)`；禁物理层、字面量色值/间距/ms；密度遵循 24px 行节奏与 4px 基网。
- Motion：只消费 `motion/index.css` 既有 recipe class；禁 `scale(`；reduced-motion 双层降级自动获得。
- 无障碍：键盘行为以 Radix 原生为准；禁止业务代码手写 focus trap/定位/keydown 路由；浮层关闭回焦 trigger；状态不只靠颜色。

### D4 收敛策略

按设计文档 §5 映射表逐 PR 迁移：替换与删除旧实现同 PR；一个旧实现被完全吸收后才删其 CSS；`needs_contract`/`unknown_accept` 等诚实性状态不得弱化。Tabs 以 `agent-pane-dock.tsx` 两处为首批（主画布先行，与 D3 阶段顺序一致）。

### D5 门禁

新增 `design-system/primitives/contract.test.ts`（grep 式，模式同 `tokens/contract.test.ts`）：design-system 之外禁 L0 直接 import、禁手写 tablist、禁原生 `<select>`；豁免白名单随收敛清零后转硬断言。每个控件注册 gallery fixture，截图基线沿用 D3 §10.4 三视口 + reduced-motion。

## 风险与缓解

- **token 锚定依赖**：D3 阶段 1（`--wb-*` 重锚定深色）未完成前，新控件在真实页面可能渲染浅色 token 值。缓解：控件开发以 gallery 为首要证据面；与 D3 路线并行但不阻塞，token 重锚定完成后控件自动跟随。
- **迁移期双轨**：新旧控件短暂并存不可避免。缓解：contract test 白名单机制保证只减不增；每 PR 截图对比按黑名单过审。
- **SegmentedControl 投机**：阶段 C 前评估真实消费面，无消费者则不建。
