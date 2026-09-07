# 设计系统统一工程方案（D3）

> 状态：基础 token/primitives/composites 已部分落地；本文同时保留迁移决策与剩余债务。下文“现状/目标值”表中的历史数值用于解释迁移来源，不是复制新代码的值；当前值以 `apps/web/src/styles.css`、`apps/web/src/design-system/tokens/index.css` 和 [治理文档](workbench-ui-governance.md) 的最新盘点为准。

## 0. 文档定位

本文是 Workbench Web 前端设计系统统一的实现层设计文档，面向执行迁移的实现者。

- UI 管理、route/Pane/Lens 分类、跨宿主语义和长期门禁以 [Workbench UI 设计治理与一致性合同](workbench-ui-governance.md) 为真源；本文保留 token、组件、图标和 motion 的工程迁移细节。
- 产品与视觉决策真源是 [Agent-first Pane Workspace UI Spec](../ui/agent-first-workbench.md) §8（视觉系统）与 §12（验收标准）；本文不重述产品决策，只给出 token、组件、图标、动效四个方面的工程收敛方案。
- 视觉基线为 `prompts/product/ui-reference/workbench-agent-pane/deliverables/` 三张 Eikona 高保真图，其中 `02-plugin-pane-workspace.png` 是主基线（深色 smoked-graphite shell、紧凑 icon rail、Agent 对话主画布、右侧 1–3 个 Pane dock）。图片只决定构图与体验方向，不决定合同可用性。
- 本文只覆盖 `apps/web/src` 内的样式与组件资产。浏览器安全红线不变：不直连 owner、不加载任意第三方代码/URL/iframe；`needs_contract` 等不可用状态必须诚实显示，迁移不得降级这些表达。
- 所有新增/修改文案走 i18n：`api/locale/source/{zh-CN,en-US}/agent/*.json` + `api/locale/source/catalog-policy.json`，改后必须运行 `bun run compose:i18n && bun run check:i18n`。

## 1. 现状盘点与问题

### 1.1 并存的多套 token 家族（2026-09-04 复查）

| 家族 | 定义位置 | 作用域 | 值域 | 消费者 |
| --- | --- | --- | --- | --- |
| `--color-*` 核心 16 个 | `apps/web/src/styles.css:40-55`（`@theme`） | 全局，Tailwind 4 同时生成 utility | 深色（canvas `#0a0d11`、ink `#e7edf4`、accent `#58a6ff`） | `.eikona-*`、`.gateway-*`、`.workflow-*`、`workbench/agent/**` 的 Tailwind arbitrary `var()` |
| `--color-spatial-*` 19 个 | `apps/web/src/styles.css:51-69`（`@theme`） | 全局 | 独立的 zinc 深色系 + 橙色 primary `#ff7a45` | `.agent-ops-*`（styles.css 中 58 个 `agent-*` 块）、`.spatial-board-*`、React Flow attribution |
| `--studio-*` 10 个 | `apps/web/src/styles.css:119` 与 `:149`（`.studio-shell` 作用域，不在 `@theme`） | 仅 `.studio-shell` 子树 | 又一套深色值（bg `#0b0e12`、blue `#58a9ff`） | 54 个 `.studio-*` 块 |
| `--wb-*` 语义层 | `apps/web/src/design-system/tokens/index.css` | `:root` + `[data-wb-surface]` alias | 已重锚定到核心深色 palette | 126 个 CSS/TS/TSX 文件，已成为主要语义入口 |

核心问题：

1. **核心语义层已完成深色重锚定，但兼容 alias 仍携带私有 fallback**：`tokens/index.css` 中 spatial/studio alias 仍保留独立色值，意味着局部 surface 可以继续绕过核心 palette。
2. **`[data-wb-surface]` alias 机制仍无直接 TSX 消费者**：`rg -l --glob '*.tsx' 'data-wb-surface=' apps/web/src` 为 0。若后续 Pane 嵌入仍不需要该作用域，应删除机制和 contract test，而不是永久保留第四层主题入口。
3. **`--color-danger` 仍有 3 处未定义引用**：`styles.css` 中 backend/workflow 状态引用该 token，而 `@theme` 只有 `--color-destructive`。迁移应改用 `--wb-status-danger` 或 `--color-destructive`。
4. **物理值同义重复仍存在**：排除 tests 后仍有 10 个文件消费 `--color-spatial-*`、2 个文件消费 `--studio-*`。这些家族只作为可删除的兼容层，不再接受新消费者。
5. **状态与图标仍未完全收敛**：`styles.css` 有 146 个颜色字面量匹配；design registry 外仍有 30 个非测试文件直接导入 `lucide-react`。优先迁移 active Agent、Review/Evidence、Owner Pane 和高价值 Lens，不以一次性全仓替换制造大 diff。

以上数字是复查基线，不是永久事实。执行迁移前按 [治理文档](workbench-ui-governance.md) §9.2 的命令重新生成盘点并更新日期。

### 1.2 组件层双轨

- legacy CSS 类：`.state-badge` + `.state-succeeded/.state-degraded/.state-stale/.state-unknown_accept`（`styles.css:104`、`:107`）、`.backend-state-badge/.approval-state-badge/.activity-kind-badge` + `.state-*` 修饰（`:214`）、`.workflow-state`（`:229`）、`.empty-state`（`:272`）、`.data-row/.data-head/.task-row/.timeline-row/.health-row/.evidence-row`（`:104`）、`.agent-ops-status`（`:307-312`）。
- design-system composites：`StatusChip`、`DataState`（11 种 kind）、`EvidenceBlock`、`ActionRecovery`（12 种 state）、`ContextDeck`、`InspectorLayout`（pinned/overlay/sheet，基于 Radix Dialog），全部只消费 `--wb-*`。

两套表达同一批状态语义，但视觉、可访问性和文案走线不同。因为 1.1 的问题 1，composites 目前无法直接替换 legacy 类——**先修正 token 锚定，composites 才具备吸收条件**，这是本文的阶段顺序依据。

> 控件层交叉引用：表单/选择与浮层控件这条线的分层、逐控件合同、收敛映射与硬断言门禁已由 [统一 UI 控件体系设计规范](ui-controls-system.md) 定义，并由 `workbench-ui-controls-r1` 完成落地（17 个 L1 控件 + gallery 截图基线 + R1/R2/R3 零违例硬断言）；本文不再重复定义控件层内容。
>
> 视觉刷新交叉引用：圆角刻度（6/10/12/14px + pill）、四级表面分层、深色柔和 elevation、accent tint 用法与 chip/icon-tile 模式已由 `workbench-ui-visual-refresh-r1` 落地（token 刻度 + 17 控件 CSS 刷新 + 全站级联 + gallery 基线重生成），细则见 [Agent 主壳视觉语言](agent-visual-language.md)。

### 1.3 图标双轨

`design-system/icons/registry.ts` 已有 37 个语义名（`nav.*`/`resource.*`/`state.*`/`action.*`/`layout.*`），显式 named import 保证 tree-shaking 并阻止服务端数据选择任意组件。2026-09-04 复查时，design-system icons 目录与 tests 之外仍有 30 个文件直接导入 `lucide-react`；`workbench/agent/panes/agent-pane-icon.tsx` 还存在一层私有 pane 图标映射，需与 registry 对齐。

### 1.4 动效散落

- design-system motion contract 已就绪：`--wb-motion-fast 120ms / normal 180ms / slow 240ms`、ease-standard/emphasized、7 个 recipe class（popover/menu/dialog/sheet/inspector/disclosure/list-feedback）、双层 reduced-motion 降级（token 层 `tokens/index.css:122-130` + recipe 层 `motion/index.css:81-87`），`policy.test.ts` 已禁止 `infinite` 与 `scale(`。
- 但 recipe 目前只有 `InspectorLayout` 消费；legacy 侧散落 `@keyframes fade-in/inspector-in/sidebar-peek-in`（`styles.css:112`、`:334`）与各家族 150–180ms 字面量 transition（如 `.rail-button` 160ms `:96`、`.studio-rail` 180ms `:119`）。

## 2. 目标架构：三层 token

```text
L1 物理层  --color-*          styles.css @theme；唯一的 hex/rgba 真源，深色
   ↑ 只被 L2 引用
L2 语义层  --wb-*             design-system/tokens/index.css；不得出现字面量色值，
                              全部 var(--color-*) 或 color-mix 派生
   ↑ 组件/业务代码只消费这一层
L3 组件槽  data 属性作用域     [data-wb-surface]、[data-tone]、组件级覆盖；
                              稀有、按需、必须回落到 L2
```

规则：

1. 业务组件（含 `workbench/agent/**` 的 Tailwind arbitrary 写法）只允许 `var(--wb-*)`；禁止直接 `var(--color-*)`。
2. L2 禁止字面量 hex/rgba（motion/space/type 等非颜色 token 除外）；颜色必须引用 L1 或 `color-mix` 派生。
3. 新物理色只允许先进 L1 `@theme`，再被 L2 锚定；禁止在组件 CSS 里新增"私有 palette"（`--studio-*` 是反例）。
4. L3 只承载真正的表面级差异（如未来的 owner 嵌入投影槽），不得成为第四套平行 token。

## 3. `--wb-*` 重锚定完整映射表（已落地的历史迁移）

阶段 1 的唯一改动对象：`tokens/index.css` 的 `:root` 颜色块与 `styles.css` `@theme` 的增补。间距、字号、radius、motion token 无语义问题，保持不变。

### 3.1 L1 增补（`styles.css` `@theme`）

| 新 token | 值 | 取值来源 |
| --- | --- | --- |
| `--color-hover` | `#15202b` | 现 `.data-row:hover`（`styles.css:104`） |
| `--color-selected` | `#17283a` | 现 `.rail-button-active` 背景（`styles.css:96`） |
| `--color-line-strong` | `rgba(173,191,211,.22)` | 现 `.project-inspector`/`.panel-manager` 边框（`:102`、`:111`） |
| `--color-contract` | `#a78bfa` | 现 `--color-spatial-contract`（`:68`），`needs_contract`/`unknown_accept` 是一等产品状态，提升为核心色 |

### 3.2 L2 颜色 token 重锚定（`tokens/index.css`）

| token | 迁移前历史值 | 目标语义 | 说明 |
| --- | --- | --- | --- |
| `--wb-canvas` | `#f8fafc` | `var(--color-canvas)` | `#0b1117` |
| `--wb-surface` | `#ffffff` | `var(--color-panel)` | `#11171e` |
| `--wb-surface-elevated` | `#ffffff` | `var(--color-elevated)` | `#19212a` |
| `--wb-surface-hover` | `#f1f5f9` | `var(--color-hover)` | 新增 L1，§3.1 |
| `--wb-surface-selected` | `#e0f2fe` | `var(--color-selected)` | 新增 L1，§3.1 |
| `--wb-text-primary` | `#0f172a` | `var(--color-ink)` | `#e7edf4` |
| `--wb-text-muted` | `#475569` | `var(--color-muted)` | `#8995a3` |
| `--wb-text-disabled` | `#94a3b8` | `color-mix(in srgb, var(--color-muted) 55%, transparent)` | 不新增 L1；与 legacy `opacity:.25–.5` 的 disabled 习惯一致 |
| `--wb-border-subtle` | `#e2e8f0` | `var(--color-line)` | `rgba(151,170,191,.16)` |
| `--wb-border-strong` | `#94a3b8` | `var(--color-line-strong)` | 新增 L1，§3.1 |
| `--wb-focus-ring` | `#2563eb` | `var(--color-accent)` | 全局 `:focus-visible` 已用 `#58a6ff`（`styles.css:81`） |
| `--wb-accent-primary` | `#2563eb` | `var(--color-accent)` | 同上 |
| `--wb-status-success` | `#15803d` | `var(--color-success)` | `#63bd83` |
| `--wb-status-info` | `#2563eb` | `var(--color-accent)` | info 与 accent 同色是有意收敛 |
| `--wb-status-warning` | `#b45309` | `var(--color-warning)` | `#e9b949` |
| `--wb-status-danger` | `#b91c1c` | `var(--color-destructive)` | `#de6f6a`；同时修复 `--color-danger` 未定义 bug（引用处改指本 token，见 §6） |
| `--wb-status-unknown` | `#6d28d9` | `var(--color-contract)` | `unknown_accept`/`needs_contract` 统一紫色 |

status 底色不新增 `--wb-*-surface` token：需要徽章背景时派生 `color-mix(in srgb, var(--wb-status-*) 14%, transparent)`，与 02 基线的低噪 border+text 徽章一致。

### 3.3 Elevation 深色化（`tokens/index.css`）

浅色阴影在深色背景上不可见，按 legacy 深色等价值替换：

| token | 现状 | 目标值 | 取值来源 |
| --- | --- | --- | --- |
| `--wb-elevation-raised` | `0 1px 2px rgb(15 23 42 / 8%)` | `0 1px 2px rgba(0,0,0,.32)` | 深色等价 |
| `--wb-elevation-popover` | `0 12px 28px rgb(15 23 42 / 14%)` | `0 12px 30px rgba(0,0,0,.42)` | `.tooltip-content`（`styles.css:97`） |
| `--wb-elevation-modal` | `0 24px 56px rgb(15 23 42 / 20%)` | `0 28px 80px rgba(0,0,0,.5)` | `.project-inspector`（`:102`） |

### 3.4 `[data-wb-surface]` alias 的处置

- 阶段 1 保留机制（contract test 正在断言四个 surface 名），但把 `spatial`/`studio` alias 体改为只引用 §4 收敛后的 token；`console`/`eikona` alias 值与 `:root` 重锚定后相同，退化为 no-op。
- 阶段 4 裁决：若届时仍无 tsx 消费者，删除 `[data-wb-surface]` 机制并同步 `tokens/contract.test.ts`。不提前删除——避免与正在进行的 Pane 嵌入设计冲突。

## 4. `--color-spatial-*` 与 `--studio-*` 收敛路径

**第一阶段原则：只换 `var()` 源，不动结构。** 不改任何类名、选择器、布局、断点、组件文件；只改 token 定义体的右值。视觉漂移由 Playwright 截图基线裁决（§10.4）。

### 4.1 `--color-spatial-*` 逐 token 映射

| token | 现值 | 目标右值 | 漂移评估 |
| --- | --- | --- | --- |
| `--color-spatial-canvas` | `#09090b` | `var(--color-canvas)` | 微漂移（`#0b1117`），可接受 |
| `--color-spatial-shell` | `#0b0c0e` | `var(--color-canvas)` | 微漂移，截图裁决 |
| `--color-spatial-panel` | `#111113` | `var(--color-panel)` | 微漂移 |
| `--color-spatial-elevated` | `#18181b` | `var(--color-elevated)` | 微漂移 |
| `--color-spatial-ink` | `#f4f4f5` | `var(--color-ink)` | 微漂移 |
| `--color-spatial-muted` | `#a1a1aa` | `var(--color-muted)` | 微漂移 |
| `--color-spatial-border` | `#27272a` | `var(--color-line)` | 实色→半透明，叠加在不同底色上有差异，截图裁决 |
| `--color-spatial-primary` | `#ff7a45` | `var(--color-accent)` | **有意的视觉变化**（橙→低饱和蓝），依据 UI Spec §8「Primary：低饱和 cyan/blue」；必须经截图评审签认 |
| `--color-spatial-primary-surface` | `#3a1c15` | `color-mix(in srgb, var(--color-accent) 14%, var(--color-panel))` | 随 primary 收敛，有意变化 |
| `--color-spatial-focus` | `#79a6ff` | `var(--color-accent)` | 微漂移 |
| `--color-spatial-focus-surface` | `#172638` | `var(--color-selected)` | 微漂移（`#17283a`） |
| `--color-spatial-success` | `#63bd83` | `var(--color-success)` | 同值，无漂移 |
| `--color-spatial-success-surface` | `#143022` | `color-mix(in srgb, var(--color-success) 12%, var(--color-panel))` | 派生替换 |
| `--color-spatial-warning` | `#e9b949` | `var(--color-warning)` | 同值 |
| `--color-spatial-warning-surface` | `#392b12` | `color-mix(in srgb, var(--color-warning) 14%, var(--color-panel))` | 派生替换 |
| `--color-spatial-destructive` | `#de6f6a` | `var(--color-destructive)` | 同值 |
| `--color-spatial-destructive-surface` | `#391c1d` | `color-mix(in srgb, var(--color-destructive) 14%, var(--color-panel))` | 派生替换 |
| `--color-spatial-contract` | `#a78bfa` | `var(--color-contract)` | 同值，改名 |
| `--color-spatial-contract-surface` | `#2d254a` | `color-mix(in srgb, var(--color-contract) 16%, var(--color-panel))` | 派生替换 |

阶段 4 在所有消费者改指 `--wb-*` 后，删除 `--color-spatial-*` 物理 token（先删定义、跑 contract test 与构建确认零引用）。

### 4.2 `--studio-*` 逐 token 映射

`--studio-*` 定义在 `.studio-shell` 作用域（不在 `@theme`），Tailwind 不生成 utility；同样只改右值不换名：

| token | 现值 | 目标右值 |
| --- | --- | --- |
| `--studio-bg` | `#0b0e12` | `var(--color-canvas)` |
| `--studio-surface` | `#15191f` | `var(--color-panel)` |
| `--studio-raised` | `#20242a` | `var(--color-elevated)` |
| `--studio-line` | `rgba(213,222,234,.14)` | `var(--color-line)` |
| `--studio-muted` | `#8b929c` | `var(--color-muted)` |
| `--studio-blue` | `#58a9ff` | `var(--color-accent)` |
| `--studio-void` / `--studio-glass` / `--studio-glass-strong` / `--studio-rim` | `#05080c` 等 | **保留不动**：玻璃/void 是 Studio legacy surface 的特有装饰，不进核心 palette，随 Studio 退役路线自然消亡 |

### 4.3 明确不做

- 不重命名 `--color-spatial-*`/`--studio-*` 的 token 名（改名属于结构变更，留给阶段 4 删除时一次性处理）。
- 不动 `.agent-ops-*`/`.studio-*`/`.spatial-board-*` 的任何选择器与布局。
- 不为 studio/spatial 引入 `--wb-*` 消费（它们的 surface 不是 composites 的吸收目标，见 §9）。

## 5. `workbench/agent` 消费面迁移（Tailwind arbitrary `var()`）

现状：`workbench/agent/**` 使用 Tailwind arbitrary value 直引物理 token，实测频次前列为 `text-[var(--color-muted)]`（71）、`border-[var(--color-line)]`（60）、`bg-[var(--color-elevated)]`（32）、`text-[var(--color-warning)]`（14）、`text-[var(--color-ink)]`（13）、`bg-[var(--color-panel)]`（13）。

迁移是**纯机械换名**，逐个文件提交、逐文件过截图：

| 现状 | 目标 |
| --- | --- |
| `var(--color-muted)` | `var(--wb-text-muted)` |
| `var(--color-ink)` | `var(--wb-text-primary)` |
| `var(--color-line)` | `var(--wb-border-subtle)` |
| `var(--color-elevated)` | `var(--wb-surface-elevated)` |
| `var(--color-panel)` | `var(--wb-surface)` |
| `var(--color-canvas)` | `var(--wb-canvas)` |
| `var(--color-accent)` | `var(--wb-accent-primary)`（focus ring 场景用 `var(--wb-focus-ring)`） |
| `var(--color-warning)` / `--color-success` / `--color-destructive` | `var(--wb-status-warning)` / `--wb-status-success` / `--wb-status-danger` |

规则与注意：

- 保持 arbitrary `var()` 形式，不切换到 `@theme` 生成的 `text-ink`/`bg-panel` 等物理 utility——业务代码不依赖物理层是 §2 的硬规则，也避免 Tailwind 对 `var()` 透明度修饰（如 `border-[var(--color-warning)]/40`）的行为差异。
- 带 `/40`、`/5` 等透明度修饰的写法只换 token 名，不动修饰符。
- 阶段 2 完成后，`workbench/agent/**` 中 `var(--color-` 的出现应为 0，由 contract test 固化（§10.1）。

## 6. Composites 吸收映射

前置条件：阶段 1 完成（composites 已渲染深色）。每行迁移独立成 PR，附截图对比。

| legacy 选择器 | 位置 | 目标 composite | 状态/tone 映射要点 |
| --- | --- | --- | --- |
| `.state-badge` + `.state-succeeded/.state-degraded/.state-stale/.state-unknown_accept` | `styles.css:104`、`:107`；消费者为 task/workspace 页 | `StatusChip` | `succeeded→ready`、`degraded→stale`（info）、`stale→stale`、`unknown_accept→unknown_accept`；`label` 走 i18n，不再 `text-transform:uppercase` 硬编码英文 |
| `.backend-state-badge/.approval-state-badge/.activity-kind-badge` + `.state-healthy/.state-approved/.state-degraded/.state-pending/.state-down/.state-rejected/.state-expired` | `styles.css:214`（Gateway Console） | `StatusChip` | `healthy/approved→ready`、`degraded/pending→stale`、`down/rejected/expired→failed`；**迁移同时把 `var(--color-danger)` 引用修到 `--wb-status-danger`，闭合现存 bug** |
| `.workflow-state` + `.state-published/.state-ready/.state-succeeded/...` | `styles.css:229` | `StatusChip` | 同上族映射；`.state-needs_intervention→permission_required` |
| `.agent-ops-status[data-availability]` | `styles.css:307-312` | `StatusChip` | `data-availability` 与 `WorkbenchStatus` 已一一对应，机械替换 |
| `.empty-state` | `styles.css:272`；消费者 `workbench/panels.tsx`、`panes/workitems/workitem-pane.tsx`、`panes/assets/asset-library-pane.tsx`、`panes/daily-ops/daily-ops-pane.tsx` | `DataState state="empty"` | 保留各 Pane 现有文案，只换容器；文案 key 迁入 `agent/*.json` |
| `.workflow-pane-state/.workflow-preview-state`（含 `.is-error`） | `styles.css:229` | `DataState`（`empty`/`error`/`unavailable`） | `is-error` 同样闭合 `--color-danger` bug |
| `.data-row/.data-head`、`.task-row/.timeline-row/.health-row/.evidence-row` | `styles.css:104` | 新增 `DataRow` composite | design-system 暂无对应物；阶段 3 新增：props 为 `title/sub/trailing/status?: WorkbenchStatus/selected/disabled`，样式 token 全部走 L2；timeline 的 `.timeline-dot` + `.timeline-*` 状态色由 `StatusIcon` 承载 |
| `.timeline-running/.timeline-succeeded/.timeline-failed/...` 状态色 | `styles.css:104` | `icons/status.ts` 的 `resolveWorkbenchStatus` | 状态字符串已在 SDK 层有稳定枚举，对齐即可 |

吸收纪律：

- 一个 legacy 类被完全吸收后才删除其 CSS；删除与替换同 PR，避免双轨渲染。
- composites 的默认英文文案（如 `dataStateDefinitions`）是 fallback；页面级文案一律走 i18n key，参照 `design-system/guidance/copy-keys.ts` 的 `icon.*.label/.tooltip` 模式扩展，改后跑 `bun run compose:i18n && bun run check:i18n`。
- 不可用/未确认状态（`needs_contract`、`unknown_accept`、`offline`、`partial`）的显示语义不得因迁移弱化；这是诚实性红线，不是视觉自由裁量。

## 7. 图标注册表迁移策略

目标：design-system 之外 `from "lucide-react"` 归零，全部经 `WorkbenchIcon`/`ActionIcon`/`StatusIcon` + `registry.ts`。

分三批，每批流程固定：**扩展 `icon-name.ts` 与 `registry.ts`（缺名补名）→ 机械替换 import 与 JSX → 跑 registry 测试与 typecheck → 截图**。

1. 批次 1（阶段 2）：`workbench/agent/**`（10 个文件），主画布必须先行；同时把 `panes/agent-pane-icon.tsx` 的私有映射并入 registry 语义名。
2. 批次 2（阶段 3–4）：`workbench/` 其余、`pages/`、`features/`（17 个文件），随 composites 吸收同批做。
3. 批次 3（阶段 4，可选）：`studio/`、`eikona/`、`open-design/`（10 个文件）。这些属 legacy surface，换 registry 是同组件换源、零视觉变化；若届时 Studio 退役排期已定，可跳过直接随退役删除。

约束：

- registry 保持显式 named import（现状注释已说明：tree-shakable + 防止服务端数据选择任意组件）；禁止 `import * as Lucide` 或动态名查找。
- 图标语义名复用现有分组（`nav./resource./state./action./layout.`）；新增分组需在 PR 描述说明。
- 防回潮：新增 icons contract 测试（grep 式断言 design-system 之外无 `lucide-react` 直接 import，模式同 `tokens/contract.test.ts` 的 `readFileSync` 断言）。
- 图标的 `aria-label`/tooltip 文案走 `guidance/copy-keys.ts` 既有 key 体系。

## 8. Motion 配方接线

现有 contract（`motion/contract.ts` + `motion/index.css`）已覆盖 overlay 类；接线点按任务面分四类：

| 场景 | 现状 | 接线目标 | 时长 |
| --- | --- | --- | --- |
| rail | `.rail-button` transition 160ms 字面量（`styles.css:96`）；`.studio-rail` 180ms（`:119`）；`@keyframes sidebar-peek-in`（`:334`） | hover/press 用 `--wb-motion-fast` + `ease-standard`；rail 层 peek 进出复用 `wb-motion-disclosure` | hover 120ms，peek 180ms |
| pane | Pane dock 插入/关闭/聚焦/reorder 无统一配方 | **新增 recipe `wb-motion-pane`**：enter = fade + `translateY(var(--wb-motion-distance))` normal；exit = fade fast；加入 `contract.ts`、`index.css`、`policy.test.ts` 断言 | enter 180ms，exit 120ms |
| dialog | `@keyframes fade-in` 160ms（`styles.css:112`）用于 `.dialog-overlay`；`.gate-dialog`/`.command-dialog`/`.panel-manager` | `wb-motion-dialog`（backdrop fade fast + content enter normal）；Radix `data-state` 已对齐 | enter 180ms，exit 120ms |
| sheet | `.agent-ops-sheet`（`styles.css:315`）、移动端全屏 Sheet、`InspectorLayout` sheet 模式 | `wb-motion-sheet`（已实现 side-aware 进出），`InspectorLayout` 已消费，扩展到 `.agent-ops-sheet` | enter 240ms，exit 180ms |

规范：

- 全部时长落在 120–240ms 预算（fast/normal/slow 三档），新代码禁止 ms 字面量，必须 `var(--wb-motion-*)`。
- 位移预算：`--wb-motion-distance 4px`（内容）、`--wb-overlay-distance 8px`（overlay/sheet）；禁止 `scale(`（policy test 已强制）。
- reduced-motion 双层降级已就绪（token 归零 + recipe 层 `animation/transition-duration: 0ms`、`transform: none`）；新接线的组件只需消费 recipe class 即自动获得降级。legacy 各家族的 `@media (prefers-reduced-motion:reduce)` 块（`styles.css:116`、`:123`、`:178`、`:220` 等）保留到对应家族收敛完成。
- `.project-inspector` 的 `inspector-in` 180ms 直接换 `wb-motion-inspector`，删除同名 keyframes。

## 9. Legacy surface 不动的边界

- **Studio（`.studio-*`、`open-design/`）**：结构、类名、布局、响应式断点、组件一律不动；唯一允许的改动是 §4.2 的 token 右值重锚定。依据：`docs/README.md` 已声明旧 Apple Spatial 与 Open Design Studio 视觉包退役、不再作为设计输入，但 surface 仍在运行，收敛只降 token 熵、不碰回归面。
- **Eikona（`.eikona-*`、`eikona/`）**：`styles.css:3` 已声明「composes existing Workbench tokens; does not introduce global tokens」，它会随 L1/L2 重锚定自动跟随，无需单独迁移；不动其类与结构。
- **Gateway/Workflow/Pinax KB/Asset 等控制台家族**：token 已走 `--color-*`，随 L1 自动跟随；仅 §6 列出的 badge/state 类参与吸收，结构不动。
- **旧主壳（`.workbench-shell`/`.floating-rail`/`.constellation`/`.owner-orbit` 等）**：已不再是默认产品入口（UI Spec §3），不投入 composite 化；只做 §6 中 `--color-danger` 级别的最小维护，退役评估留到阶段 4。
- 全程不动 dockview 主题结构（`.dockview-theme-abyss` 只随 L1 跟随）与 React Flow attribution 覆盖。

## 10. 验收标准

### 10.1 Token contract tests（扩展 `design-system/tokens/contract.test.ts`）

- L2 颜色 token 右值不得出现字面量 hex/rgb（允许 `var(--color-*)`、`color-mix`）；非颜色 token 豁免。
- §3.2 全表每个 token 存在且锚定正确。
- `styles.css` 与 `tokens/index.css` 中所有 `var(--color-*)` 引用都有定义（闭合 `--color-danger` 类回归）。
- `workbench/agent/**` 在阶段 2 后不得出现 `var(--color-`（grep 式断言）。
- `[data-wb-surface]` 四个 alias 在阶段 1 保留、阶段 4 裁决后同步更新断言。

### 10.2 Foundation contract 门禁

`apps/web/test/foundation-contract.test.ts` 是已存在的 foundation-contract 套件（当前断言：tokens/motion CSS 在应用入口恰好各加载一次、owner availability 词表无损），阶段 1 在其中扩展「L2 引用的每个物理 token 都有深色 `@theme` 定义」的引用闭合断言。它与 design-system 目录下四个 vitest 套件共同构成统一 foundation 门禁：

- `apps/web/test/foundation-contract.test.ts`（应用边界 + 词表 + 引用闭合）
- `design-system/tokens/contract.test.ts`（token）
- `design-system/motion/policy.test.ts`（动效预算与降级）
- `design-system/icons/registry.test.ts`（图标注册表完整性）+ 新增 lucide 防回潮断言
- `design-system/gallery/foundation-gallery.test.tsx`（composites 渲染 fixture：control/data-state/evidence/action/context-deck/inspector）

聚焦运行命令（根 vitest 配置的 include 只覆盖 `test/**`，design-system 套件用目录自带配置，两条都要跑）：

```bash
bun run --cwd apps/web vitest run test/foundation-contract.test.ts
bun run --cwd apps/web vitest run --config src/design-system/tokens/vitest.config.ts
```

### 10.3 视觉黑名单

沿用 UI Spec §8 黑名单（Hero、KPI 卡片墙、无意义渐变、厚玻璃、随机 emoji、全屏空 Canvas、假实时、假成功 toast、provider logo 导航、嵌套卡片、无原因 disabled）。落实方式：

- 每个迁移 PR 的截图对比按黑名单逐项过审；
- 新增 `linear-gradient`/`radial-gradient`、新增阴影、新增动画必须引用 token 并在 PR 描述说明去处（Eikona 图基线允许的背景氛围除外）。

### 10.4 Playwright 截图基线

- 基线对象：`/agent` 主画布、Pane dock（1/2/3 Pane）、Pane command palette、limit_reached 横幅；视口 1440×960、1024×768、390×844，外加 reduced-motion 变体。`e2e/agent-first.spec.ts` 已有 fullPage 截图与 evidence 落盘，在此基础上固化为 `toMatchSnapshot` 基线（参考 `eikona-independent-client.spec.ts-snapshots` 的既有模式）。
- 阶段 0 先锁**现状**基线；阶段 1（token 重锚定）必须附逐视口 before/after 对比，`--color-spatial-primary` 橙→蓝等「有意的视觉变化」逐条签认。
- 基线更新（`--update-snapshots`）只允许随对应阶段 PR 提交，评审人必须能看到 diff 图。
- 失败截图/trace 留在 `apps/web/playwright-results/`，不提交（AGENTS.md 既有约定）。

### 10.5 通用验证命令

```bash
bun install
bun run typecheck
bun run --cwd apps/web vitest run test/foundation-contract.test.ts                     # foundation-contract
bun run --cwd apps/web vitest run --config src/design-system/tokens/vitest.config.ts   # design-system 套件
bun run compose:i18n && bun run check:i18n            # 涉及文案时
bun run --cwd apps/web e2e                            # 截图基线相关阶段
```

## 11. 分阶段任务清单

每阶段独立可回滚；进入阶段 1 前在子项目 `openspec/changes/` 建立对应 change（proposal/design/tasks，中文），本文作为其设计输入。

### 阶段 0 · 基线与门禁骨架（0.5–1 天）

1. 固化 `/agent` 现状 Playwright 截图基线（三视口 + reduced-motion）。
2. 扩展 `tokens/contract.test.ts` 断言骨架（L2 无 hex、引用闭合），对现状允许豁免清单。
3. 验收：foundation 门禁绿；基线入库。

### 阶段 1 · Token 重锚定（1–2 天；只改 2 个 CSS 文件 + 测试）

1. `@theme` 增补 `--color-hover/--color-selected/--color-line-strong/--color-contract`（§3.1）。
2. `tokens/index.css` 按 §3.2/§3.3 全表换锚；`[data-wb-surface]` alias 体同步修正（§3.4）。
3. `--color-spatial-*` 按 §4.1、`--studio-*` 按 §4.2 重定向右值；`.state-*` 中 `var(--color-danger)` 三处改指 `var(--color-destructive)`（最小 bug 修复，composite 吸收前先行闭合）。
4. 移除 contract test 豁免清单，转为硬断言。
5. 验收：`bun run typecheck` + foundation 门禁 + 逐视口截图对比签认（重点：spatial-primary 橙→蓝、border 实色→半透明）。

### 阶段 2 · Agent 主画布消费面（2–3 天）

1. `workbench/agent/**` Tailwind arbitrary `var()` 按 §5 表机械换名，逐文件提交。
2. 图标批次 1：`workbench/agent/**` 12 文件 → registry，合并 `agent-pane-icon.tsx` 私有映射。
3. Motion 接线：新增 `wb-motion-pane` recipe；rail/dialog/sheet 按 §8 接线；删除 `fade-in`/`inspector-in` keyframes。
4. 验收：`workbench/agent/**` 中 `var(--color-` 归零（contract test）；foundation 门禁；`/agent` 截图与阶段 1 基线一致或差异签认。

### 阶段 3 · Composites 吸收（3–5 天）

1. 新增 `DataRow` composite（含 `StatusIcon` 状态点），先 gallery fixture 后消费者。
2. 按 §6 表逐个吸收 `.state-badge`/`.empty-state`/`.data-row` 族/gateway 与 workflow badges；每类一个 PR，替换与删除 CSS 同 PR。
3. 文案迁 i18n（`agent/*.json` + `copy-keys.ts` 模式），跑 `bun run compose:i18n && bun run check:i18n`。
4. 验收：被吸收类零引用；foundation 门禁；Gateway/Workflow/Pane 页面截图对比。

### 阶段 4 · 收敛与退役评估（2–3 天）

1. 图标批次 2、批次 3（可选）完成，lucide 防回潮 contract test 转硬断言。
2. `--color-spatial-*` 物理 token 删除（消费者归零后）；`[data-wb-surface]` 机制裁决删除或保留并更新文档与测试。
3. 旧主壳 CSS（`.workbench-shell`/`.constellation` 等）退役评估：输出保留/删除清单，不在本阶段执行大删除。
4. 验收：foundation 门禁全绿；`bun run build` 通过；最终截图基线更新并归档。

### 阶段 5 · Text Development 纵向组件收敛（随 owning change 推进）

本阶段由 `workbench-text-development-studio-v1` 拥有，不是新的全仓重写：

1. Text Development 只复用现有 Surface、Pane、状态、恢复、控件与 icon registry；touched files 不得增加 direct Radix/Lucide、私有 token、font stack 或 raw modal。
2. `WorkingCopyStatusStrip`、`TextSelectionActionBar`、`TextVersionLedger`、`TextTeamPlanSurface` 默认留在 feature 目录；只有第二个真实领域共享同一状态和交互时才晋级 composite。
3. 先清点 Screenplay、CLI、Replica 和 Studio 的 diff 语义；至少两个消费者可归一时再创建无 owner state 的 `DiffView`，支持 inline/split/unified、keyboard 与非颜色表达。
4. CodeMirror 必须 lazy load，未打开 Text Development 时不进入首屏 chunk；EditorView 独占 buffer/undo，React 不复制正文 state。
5. Text Development 进入 gallery/Playwright 的 state、viewport、locale 与 reduced-motion 矩阵；snapshot 更新必须附规则与 diff 理由。

该阶段不得等待全部历史 token/icon 债务清零才开始，但不得增加债务，并应在触碰文件内完成局部收敛。

## 附录 A · 实测命令（本文数据出处）

```bash
# 直接 lucide 消费文件数（排除 tests 与 design-system icons）
rg -l --glob '*.{tsx,ts}' --glob '!**/*.test.*' "from ['\"']lucide-react['\"']" apps/web/src | grep -v '/design-system/icons/' | wc -l

# --color-danger 只被引用、从未定义
rg -n -- '--color-danger\s*:' apps/web/src          # 无命中
rg -n -- 'var\(--color-danger' apps/web/src         # styles.css 中 3 处引用

# [data-wb-surface] 在 tsx 中零消费者
rg -n --glob '*.tsx' 'data-wb-surface=' apps/web/src

# --wb-* 在 design-system 之外的消费者
rg -l --glob '*.{css,tsx,ts}' 'var\(--wb-' apps/web/src

# agent 域 Tailwind arbitrary 用法频次
rg -o --no-filename '\b(bg|text|border)-\[var\(--color-[a-z-]+\)\]' apps/web/src/workbench/agent | sort | uniq -c | sort -rn
```
