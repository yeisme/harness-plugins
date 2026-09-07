## Why

`apps/web` 的 design-system 已建立 token 三层架构、图标注册表、motion 配方与 6 个 composites，但**表单与浮层基础控件完全缺失**，各功能域长期手写分叉实现：手写 tablist 7 处、命令面板 3 套（各自组合 cmdk + Radix Dialog）、Radix Dialog 在 10 个文件中裸用另有 2 处纯 div 假 dialog、手写搜索框 8+ 处、原生 `<select>` 各处单独样式、无通用 Button/Input/Checkbox/Radio/Switch。同一交互在视觉、键盘行为、focus 管理与 disabled 表达上各有分叉，无障碍质量取决于各功能域自觉，新页面继续复制分叉。`docs/design/design-system-unification.md`（D3）覆盖了 token/图标/动效/composites 四条收敛线，控件层是唯一未立项的缺口。

## What Changes

- 新增 capability `workbench-ui-controls`：定义统一的 L1 基础控件库合同，覆盖 Button/IconButton/Input/TextArea/SearchBox/Select/MultiSelect/Combobox/Checkbox/RadioGroup/Switch/SegmentedControl/Tabs/Dialog/Popover/DropdownMenu/Tooltip 约 16 个控件。
- 技术基座为扩展 Radix primitives + 自研 `wb-` 封装层：新增 `@radix-ui/react-select`、`react-popover`、`react-dropdown-menu`、`react-tabs`、`react-checkbox`、`react-radio-group`、`react-switch`、`react-toggle-group`（按需），cmdk 继续承载 Combobox/CommandPalette；不引入 shadcn/ui 或其他带样式组件库。
- 每个控件定义统一合同：props API（受控/非受控、variant/size 枚举、disabled 必须带 disabledReason）、状态矩阵、键盘与无障碍、token 消费（只允许 `var(--wb-*)`）、motion（只消费既有 recipe class）、gallery fixture 与同目录单测。
- 定义重复实现收敛映射：7 处手写 tablist → `Tabs`（含 `PaneTabs`）、3 套命令面板 → 统一 `CommandPalette` composite（Dialog + Combobox）、裸 Dialog/假 dialog → `Dialog` 封装、手写搜索框 → `SearchBox`、原生 select → `Select`；替换与删除同 PR，诚实性状态（needs_contract/unknown_accept）不得弱化。
- 新增 `design-system/primitives/contract.test.ts` 防回潮门禁：design-system 之外禁止直接 import L0 Radix、禁止手写 tablist 与原生 `<select>`，白名单随收敛清零后转硬断言。
- 完整设计规范见 `docs/design/ui-controls-system.md`（本 change 的设计输入）。

## Capabilities

### New Capabilities

- `workbench-ui-controls`: 定义 Workbench 统一基础控件库（按钮、文本输入、搜索、选择、勾选、单选、开关、标签页、浮层、菜单、提示与 Pane chrome）的唯一实现、API/状态/无障碍/token/motion 合同、重复实现收敛纪律与确定性证据门禁。

### Modified Capabilities

无。本 change 对 `workbench-ui-foundation` 保持 additive：foundation 已规定 shared controls 必须使用 approved accessible primitives、定义键盘/focus/boundary 行为并提供确定性 gallery 证据，本 capability 是其控件层细化，不改变 foundation 的任何既有 Requirement。

## Impact

- 预计影响 `apps/web/src/design-system/primitives/**`（新增）、`design-system/composites/**`（内部改用 L1 控件）、`design-system/gallery/foundation-gallery.tsx`（fixture 扩展）、`apps/web/package.json`（新增 Radix 依赖）、`api/locale/source/{zh-CN,en-US}/agent/*.json`（控件文案 key）。
- 迁移期触及重复实现调用点：`workbench/agent/panes/agent-pane-dock.tsx`、`workbench/shell.tsx`、`eikona/components/command-palette.tsx`、`workbench/harness/harness-route.tsx`、`workbench/panes/**`、`studio/shell.tsx`、`eikona/reuse/reuse-workspace.tsx` 等（以收敛映射表实测为准）。
- 不改变 `workbench-ui-foundation` 既有 Requirement，不动 token 定义（token 重锚定属 D3 路线），不改变 Pane 布局语义（归 `docs/design/pane-interaction-model.md`），不引入浏览器直连 owner 或任何新数据通道。
- 验证：`openspec validate --all --strict`、`bun run typecheck`、design-system 既有四套 vitest 套件 + `test/foundation-contract.test.ts`、涉及文案时 `bun run compose:i18n && bun run check:i18n`、截图基线阶段 `bun run --cwd apps/web e2e`。
