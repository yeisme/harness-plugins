# DSH 面板统一视觉系统（dsh-unified-panel-visual-system-v1）

插件侧 web 面板的统一 token registry、scoped chrome 与交互底线。官方 `dsh web` host 仍是主题与 slot 的 owner；本系统只在 host 变量缺失时提供 canonical fallback，并消除插件之间的视觉/交互分歧。

> 状态：项目级 Web UI 设计事实源，适用于 `packages/client/ui-*` 与 bundle 自有 React/Web surface。
> 产品分类：APP UI。目标是安静、紧凑、可扫描的工程工作台，不是营销页、品牌展示页或卡片仪表盘。
> 创作交互：画布与五个专业 Pane 遵循本仓八份创作 OpenSpec；独立 Workbench 的历史联邦设计不再约束 active UI，当前边界见 §17。

## 0. 权威、范围与规范用语

### 0.1 权威顺序

发生冲突时按以下顺序处理，不允许由包内局部 CSS 静默覆盖上层决策：

1. 官方 DSH host 的主题、slot、Pane 几何与官方 UI primitives。
2. 稳定 OpenSpec：`dsh-panel-visual-system`、`dsh-web-surface-system` 及具体业务 surface spec。
3. 本文档定义的项目级视觉、布局、响应式、交互与验收规则。
4. `ui-visual-kit`、`ui-surface` 的实现和测试。
5. 单个 package 的 scoped 扩展样式。

本文中的 `MUST/SHALL` 表示合入前必须满足；`SHOULD` 表示默认遵循，偏离时必须在所属 design.md 记录理由；`MAY` 表示允许但不是默认。

### 0.2 覆盖范围

- `adopted`：完整 Pane、workspace、navigator、inspector、dialog、overlay、dock，MUST 使用 `Surface` composition。
- `embed`：Mermaid、Markdown table、structured content、终端画布等嵌入 renderer，不强制包裹完整 Surface，但 MUST 消费统一 token、焦点和排版规则。
- `excluded`：纯状态、projection 或 controller 包不渲染 UI；必须在 surface catalog 中显式登记，不能因“当前没有页面”而漏分类。
- 新增或修改 UI 的 OpenSpec `design.md` MUST 引用本文档；不得复制一份局部 token 表或另建“临时设计系统”。

### 0.3 已有事实源

| 能力 | 事实源 | 用途 |
|---|---|---|
| token、状态 tone、基础 class | `packages/client/ui-visual-kit` | 唯一 fallback 与基础 chrome |
| 页面 composition | `packages/client/ui-surface` | Surface、ContextBar、Section、State、ActionBar |
| 官方原子控件 | `@deepseek-ai/dsh-client-ui-primitives` | Button、Input、Modal、Menu、Pill、StateDot、DiffBlock |
| 稳定 UI 合同 | `openspec/specs/dsh-panel-visual-system/`、`openspec/specs/dsh-web-surface-system/` | 行为与兼容验收 |
| 全仓静态门 | `scripts/check-ui-surface-contracts.mjs` | 分类、token、field、inline style、scope 回归 |
| 截图门 | `tests/ui-visual/` | 360/560/960px 确定性视觉回归 |

## 1. 现状审计（2026-08-25，file:line 证据）

### 1.1 同一 token 的 fallback 分歧

| token | 出现的 fallback 字面量 | 证据（源码） |
|---|---|---|
| `bg-elevated` | `#1c1c1f` / `#202024` / `#222226` / `#242429`（单文件 4 值） | `packages/client/ui-pane-workbench/src/region-chrome.ts:99,108,110,113` |
| `bg-base` | `#171719` / `#151517` | `region-chrome.ts:78,96` vs `ui-creator-studio/src/styles.ts:3`、`ui-desktop-workbench/src/client/desktop-workbench-styles.ts` |
| `bg-layer-1` | `#1f1f22` / `#1e1e21`（creator 单文件双值）/ `#29292d` / `#232324` | `ui-creator-studio/src/styles.ts:7,13,26`、`ui-pane-subagent/src/view.ts`、`desktop-workbench-styles.ts` |
| `label-primary`（=text-primary） | `#ececf1` / `#f2f2f4` / `#fff` | `ui-pane-subagent/src/view.ts`、`desktop-workbench-styles.ts` |
| `label-tertiary` | `#8d8d96` / `#92929b`；creator 又用 `text-tertiary #96969f` | 同上 + `ui-creator-studio/src/styles.ts` |
| `text-secondary` | `#b8b8c0` / `#aaaab2` / `#c2c2c8` / `#bdbdc5` / `#c6c6cc` | `region-chrome.ts:81,98,103`、creator `styles.ts` |
| `border-l2` | `rgba(255,255,255,.10/.11/.12/.14)` | 全部含样式面板 |
| `fill-hover` | `rgba(255,255,255,.05/.08)`；desktop 另名 `interactive-bg-hover` | `ui-pane-subagent/src/view.ts` 等 |

### 1.2 两套同义词汇并存

- `text-*`/`fill-*`/`accent`：`ui-pane-workbench`、`ui-creator-studio`。
- `label-*`/`state-business-primary`/`state-error-secondary`/`interactive-bg-hover`/`button-ghost-active-fill`：`ui-pane-subagent`、`ui-desktop-workbench`。
- 同名异值 + 异名同义并存；无任何上游文档定义该词汇（skills/docs 均无 `dsw-alias` 出处），归属本仓库插件自造。

### 1.3 布局度量分歧

- 圆角：6/7/8/9/10/11/12px 混用（creator 卡片 11px、行 8/9px；chrome 菜单 10px、picker 12px、tab 6px）。
- 控件高度：icon 28/32px、按钮 30px、输入 34px、picker 行 42px。
- 字号：10/11/12/13/14/16px；正文 13px（creator）vs 14px（chrome `--dsh-wb-font-size`）。

### 1.4 交互底线分歧

- focus-visible：creator/chrome 有；subagent/desktop 部分有；domain panes 无。
- `prefers-reduced-motion`：creator 有；其余多数无。
- empty/loading/error：creator 有 `.cs-empty/.cs-alert`；domain panes 空态只有一行裸文本 `No owner projection.`；多数面板无 skeleton。
- 状态仅颜色表达：creator status-dot 有文本伴随；domain panes 状态只有 `role="status"` 一行字（无 tone）；各面板状态色各异。

### 1.5 完全无样式的高价值面

- `packages/client/ui-pane-domain/src/view.ts`：六个创作工具（Eikona/Scaena/Sonora/Auctra/Pinax/Anatomia）+ Ordo Team 的 domain pane 输出裸 DOM，仓库内无任何 CSS 命中 `[data-pane-domain]`（全仓 grep 仅 view.ts:32 自身）。
- 样式注入方式：各面板在 React 树内渲染 `<style>{…}</style>`（如 `ui-creator-studio/src/views.tsx:274`）；`ui-mermaid-render` 用 observer 注入。creator 旧样式大多数 `.cs-*` 选择器未加 scope 前缀，规则实为文档级全局。

## 2. Canonical 决策

### 2.1 Registry（`packages/client/ui-visual-kit/src/tokens.ts`）

| token | canonical fallback | 依据 |
|---|---|---|
| `bg-base` | `#171719` | Pane chrome 容器值（面板居住的框架底色） |
| `bg-layer-1` | `#1e1e21` | creator 卡片/chrome 通用层 |
| `bg-layer-2` | `#242429` | chrome 菜单/elevated 族归并，保持单调色阶 |
| `bg-elevated` | `#2a2a2f` | 高于 layer-2，浮层可辨 |
| `text-primary` | `#ececf1` | chrome 根 + label-primary 众数 |
| `text-secondary` | `#c6c6cb` | label-secondary 众数 |
| `text-tertiary` | `#92929b` | label-tertiary 众数 |
| `text-quaternary` | `#6f6f78` | `#676770/#777780` 中点 |
| `text-link` | `#8fc5ff` | chrome |
| `border-l1/l2` | `rgba(255,255,255,.06/.12)` | chrome/desktop 值 |
| `border-focus` | `#79b8ff` | 全仓一致 |
| `fill-hover` | `rgba(255,255,255,.08)` | 众数（`.05` 弃） |
| `fill-selected` | `rgba(101,166,255,.18)` | chrome |
| `fill-active` | `#343438` | desktop ghost-active |
| `accent` | `#79b8ff`（creator 可覆写 `#9bcbff`） | chrome accent |
| `state-positive/info/warn/error/neutral` | `#51c58b/#6aa8ff/#f0b45a/#ee6b72/#8b8b94` | creator 已发布语义，词表见 §2.3 |

同义词映射：`label-*`→`text-*`、`interactive-bg-hover`→`fill-hover`、`button-ghost-active-fill`→`fill-active`、`state-business-primary`→`accent`、`state-error-secondary`→`state-error`。

### 2.2 注入结构（`buildPanelStyles`）

- 面板根 `[data-<scope>]` 单点声明 `--vk-*: var(--dsw-alias-<name>, canonical)` —— 结构上杜绝"单文件多 fallback"。
- 规则三层：base（reset/字色/焦点环/reduced-motion/coarse 44px）、chrome（header/toolbar/btn/icon-btn/field/card/row/badge/dot/progress）、state（empty/alert/skeleton）。
- 全部选择器限定 scope；keyframes 以 scope 命名（`vk-shimmer-<scope>`）；`extra` 由调用方自带 scope。
- 纯函数、零依赖、逐字节幂等；样式串随各插件 bundle 内联一份（接受重复，换取零共享 runtime）。

### 2.3 状态 tone 词表（`statusTone`）

- positive：ready/completed/done/success
- info：running/active/queued
- warn：pending/partial/stale/approval_required/reconciling
- critical：offline/failed/error/contract_mismatch/reconcile_required/unknown
- 词表外 → neutral（不抛错、不伪装 ready）；状态永远配文本/aria，不只靠颜色。

### 2.4 诚实恢复语义

domain pane 空态不提供手动重试按钮：`DomainOwnerSourceBridge.reread()` 的合同限定"除 open 与 transport 恢复外不得调用"（`owner-source.ts` 注释），且仓库纪律禁止 unknown/offline 自动 retry。空态文案解释"通道恢复时自动权威重读"。未来若 host 提供 owner reconcile action，可作为 recovery 入口接入。

### 2.5 结构与密度规则（2026-09-04 补充）

- Pane 顶部只保留一层 `SurfaceContextBar`；筛选器、生命周期或会话切换放入其 `nav/status/actions` 区，不再另建一套高标题栏。
- `SurfaceState` 与 `.vk-empty` 共享 92px 最小高度、16px 内边距、`radius-md`、低对比边框与 layer-1 背景；错误、过期、部分成功等通知使用紧凑左对齐 strip。
- 按钮、输入、图标、字号、间距与圆角优先消费 `--vk-ctrl-*`、`--vk-font-*`、`--vk-gap-*`、`--vk-radius-*`，禁止用近似字面量复制另一套比例。
- 导航、状态和普通列表保持紧凑；只有终端、编辑器、diff、媒体预览、时间线等内容画布可以保留业务所需最小高度和独立滚动区域。
- 卡片仅用于可独立选择、比较或操作的对象；说明、空投影和普通列表不通过多层大圆角容器制造层级。

## 3. 信息架构与首屏层级

### 3.1 标准 Pane 骨架

每个完整 Pane MUST 能在 3 秒内回答：这是哪里、当前是什么状态、我下一步能做什么。标准结构如下：

```text
Surface
├─ SurfaceContextBar
│  ├─ title + context/description
│  ├─ status
│  ├─ actions
│  └─ nav（仅存在同级视图或筛选时）
├─ SurfaceState（仅在需要全局说明时）
├─ ys-body
│  ├─ primary workspace / list / tree
│  └─ secondary detail / composer（仅 wide 可双栏）
└─ SurfaceActionBar（仅有明确提交动作时）
```

视觉阅读顺序 MUST 是：

1. 标题、当前上下文和 freshness。
2. 当前内容或推荐下一动作。
3. 次级详情、历史、诊断与辅助操作。

Pane MUST NOT 重复宿主 tab title，也 MUST NOT 在 `SurfaceContextBar` 下再建一层同等权重的大标题栏。筛选、生命周期、会话选择和同级视图切换 SHOULD 放入 `nav/status/actions`。

### 3.2 区域职责

- 一个 section 只做一件事。标题说明“这里是什么”或“用户能做什么”，不写氛围文案。
- 主内容与次级详情最多形成两列；禁止三列以上等权卡片墙。
- 列表、树、时间线、diff 和资源浏览器使用真实布局关系表达层级，不用重复外框制造层级。
- 高风险 action 不因空间不足而隐藏；compact 模式可移动位置或折叠进官方 Menu，但 admission 结果保持不变。

## 4. Surface 类型与密度合同

| kind | 默认内容模式 | 默认密度 | 允许的宽屏变化 | 禁止模式 |
|---|---|---|---|---|
| `navigator` | list/tree/master | 最紧凑 | 可增加 detail，但主列表仍优先 | 卡片首页、长说明段落 |
| `workspace` | 主任务区 | 紧凑可读 | MAY 主内容 + detail/composer 双栏 | 三列 dashboard mosaic |
| `inspector` | diagnostics/metadata | 紧凑 | MAY 分组表格或 list-detail | 把每个指标做成大卡片 |
| `dialog` | 单一集中任务 | 标准 | 由官方 Modal/Menu 管 overlay 与焦点 | 自制全屏遮罩、第二套 modal |
| `micro` | 一个建议、重试或行内动作 | 最小 | 无 | ContextBar、嵌套 section |

### 4.1 Canonical 刻度

| 类别 | 刻度 | 使用规则 |
|---|---|---|
| gap | 4 / 6 / 8 / 10 / 14px | 优先 `--vk-gap-*`；14px 只用于大区块分隔 |
| radius | 6 / 8 / 10 / 12px | 行与控件用 sm/md；可独立卡片用 lg；xl 仅 overlay |
| control | icon 28 / button 30 / input 34 / touch 44px | pointer coarse 时所有关键点击目标至少 44px |
| type | 10 / 11 / 12 / 13 / 14 / 16px | micro/small/body/strong/heading/title；不得自造 15/17/18px 层级 |
| border | l1 / l2 / focus | l1 分组、l2 控件与外框、focus 专用于焦点 |

包内扩展 CSS MUST 使用 `--vk-radius-*`、`--vk-ctrl-*`、`--vk-font-*`、`--vk-gap-*`。只有业务画布的测量几何、终端字体或代码排版 MAY 使用独立数值。

## 5. 组件使用合同

| 需求 | MUST 使用 | MAY 使用 | MUST NOT |
|---|---|---|---|
| Pane 根 | `Surface` + 唯一 `data-*` scope | 旧 class 作为兼容钩子 | 裸 DOM 根、自建 reset |
| 顶部上下文 | `SurfaceContextBar` | `nav/status/actions` slot | 双标题栏、重复 tab title |
| 内容分组 | `SurfaceSection` 或语义 section | divider、list heading | 每组都套卡片 |
| 状态 | `SurfaceState` 或 `.vk-empty/.vk-alert/.vk-skeleton` | owner 发布的 recovery action | 空白、伪数据、无原因死按钮 |
| 提交动作 | `SurfaceActionBar` + 官方 Button | sticky，仅 wide 且不遮挡内容 | 浮动大 CTA、无 receipt mutation |
| 表单 | `.ys-field` / `.vk-field` + 官方 primitive | 原生 `select/textarea` 置于 field 内 | placeholder 作为唯一 label |
| 列表/树 | `.ys-list/.ys-row` 或既有虚拟列表 | hover/focus/selected fill | 每行独立厚边框卡片 |
| modal/menu | 官方 Modal/Menu | Surface 负责内部内容 | 自制 focus trap、任意 portal |
| 图标 | 官方图标或现有语义 wrapper | 文本首字母 marker | emoji 装饰、新图标库 |

### 5.1 卡片必须“挣到”存在

只有以下对象 MAY 使用 card：

- 可被选择、打开或操作的独立任务入口。
- 媒体、版本化产物、可比较快照。
- 必须作为一个整体移动或聚焦的 composer/receipt。

普通状态、Owner、审批、run、文本资源、说明与列表项 SHOULD 使用 row/list/section。一个区域内可见容器边框默认不超过一层；普通卡片不使用阴影，阴影只归官方 overlay/elevated primitive。

## 6. 交互状态覆盖

新增或修改 Pane 时，所属 `design.md` MUST 填写下表对应行为，描述用户看到的内容，不只写后端状态：

| phase | 用户看到什么 | 数据策略 | action 规则 |
|---|---|---|---|
| initial loading | 有界 skeleton 或 92px loading state，标题说明正在读取什么 | 不伪造内容 | 通常无 action |
| refresh loading | 最后安全内容继续可见，顶部显示轻量 busy | 保留 snapshot | 禁止重复提交 |
| empty | 简短标题、产生空态的上下文、可行的下一步 | 明确“尚无”与“不可用”的区别 | owner 有安全 action 才显示 |
| error | 紧凑左对齐 strip，显示可理解原因 | 不泄漏 token、raw payload、绝对路径 | retry/reconcile 必须来自真实 owner 能力 |
| stale | 保留最后安全内容并显示 freshness | 禁止把 stale 当 ready | mutation 默认禁用 |
| partial | 标明缺失范围或不完整原因 | 只展示已确认字段 | 不自动补造或静默 retry |
| success | receipt/结果摘要，必要时短暂 success strip | 保留可审计 ref | 提供下一步而非庆祝动画 |
| disabled | 控件可见且有 `title/aria` 原因 | 不隐藏能力边界 | 不渲染无解释死按钮 |
| unknown/reconcile | critical/warn 文本状态 | fail closed | 等待 owner reconcile，不自动重试 |

状态 MUST 同时具有可见文本或 ARIA 表达，不允许只靠颜色、圆点或图标。空态的“温度”来自明确上下文和真实下一步，不来自插画、emoji 或虚假示例数据。

## 7. 用户旅程与反馈节奏

| 步骤 | 用户动作 | 目标感受 | UI 必须提供 |
|---|---|---|---|
| 1 | 打开 Pane | 立即知道位置 | title、context、freshness |
| 2 | 扫描内容 | 重点明确、没有噪声 | 主内容优先，次级信息降权 |
| 3 | 选择对象 | 选择可见且可恢复 | hover/focus/selected 三态 |
| 4 | 发起动作 | 风险和结果可预期 | disabled reason、preflight 或 action description |
| 5 | 等待结果 | 系统仍在工作且不会重复执行 | busy、保留上下文、禁重复提交 |
| 6 | 成功或失败 | 知道发生了什么、下一步是什么 | receipt、error/reconcile、真实 recovery |
| 7 | 再次打开 | 熟悉且连续 | 保留 view kind、selection/persistence 兼容 |

首 5 秒优化识别和下一动作；前 5 分钟优化稳定操作和错误恢复；长期使用优化一致的键盘路径、状态语义与持久化连续性。

## 8. 响应式与容器行为

布局 MUST 依据 Pane 容器而不是浏览器 viewport：

| 密度 | 容器宽度 | 布局要求 |
|---|---|---|
| compact | `<=420px` | 单栏；ContextBar 分行；actions 可横向滚动或官方 Menu；主操作不得被裁切 |
| standard | `421–720px` | 单栏为默认；列表与 detail 顺序切换；避免固定宽度侧栏 |
| wide | `>720px` | MAY 使用 master-detail 或 resource-composer 双栏；最多两个主列 |

- compact 不等于删除功能。布局可以重排，能力、数据、风险和 admission 语义不得变化。
- 长标题、47 字符名称、pseudo locale 和 200% zoom MUST 不遮挡主操作；次级文本可 ellipsis，但完整值需通过 title、detail 或可访问名称获得。
- terminal、editor、diff、media 和 timeline MAY 独立滚动；普通 Pane 默认只有一个主滚动容器，禁止 body、section、card 三层同时滚动。
- pointer coarse 时关键目标至少 44×44px；不得依赖 hover 才暴露唯一操作。

## 9. 可访问性合同

- 键盘：所有 action、tab、tree、menu、dialog 和 selectable row MUST 可用键盘完成；focus-visible 必须清晰，不能只改变背景。
- 焦点：Modal/Menu 的 trap、Escape、return focus 交给官方 primitive；Pane 切换后焦点落到标题、主内容或用户触发的目标。
- 语义：使用正确 landmark、heading 顺序、`role=tablist/tab/tree/treeitem/status/alert`；ARIA 只补语义，不替代可见文案。
- 颜色：正文、控件与状态文案满足 WCAG AA；状态不得只靠红绿区分。
- 动效：普通 hover/open/selection 反馈为 120–180ms；`prefers-reduced-motion: reduce` 关闭 shimmer、位移和非必要过渡。
- 表单：可见 label、错误原因和 disabled reason 与控件建立关联；输入后 label 仍可见。

## 10. 文案、图标与视觉语气

- 文案使用工具语言：位置、状态、动作、原因、下一步。禁止“欢迎使用”“释放潜能”“一站式”等营销句式。
- 中文与英文进入现有 locale；新增核心 UI 必须覆盖 zh/en/pseudo，不留下 inline English fallback。
- 标题尽量为名词或动宾短语；按钮使用明确动词；危险动作描述具体对象与影响。
- 一个 surface 默认只有一个 accent。positive/info/warn/critical 只表达状态，不用作任务分类装饰色。
- Pane 局部 CSS 继承 host 字体；不得再次声明 `system-ui`、`-apple-system`、Inter、Roboto 等独立 UI font stack。代码、终端、diff MAY 使用现有 monospace stack。
- 图标只承担识别或空间压缩，不替代关键文字。禁止 emoji、彩色圆形图标和无语义装饰图形。

## 11. 禁止模式与例外流程

以下模式视为设计回归：

1. 首屏由等权大卡片矩阵构成。
2. Pane 中重复宿主标题、再叠一层产品标题和一层 section 标题。
3. 所有内容都使用相同大圆角、阴影和厚边框。
4. 普通说明或空态占据大块居中留白。
5. colored left border、紫蓝渐变、玻璃拟态、发光和装饰性动画。
6. 用随机领域颜色区分文字、图像、音频、Agent 或任务类别。
7. 只有 hover 时才显示唯一 action，或在 compact 直接隐藏能力。
8. package-local `--dsw-alias-*` fallback、业务色 hex、未 scope CSS 或非白名单顶层 inline style。
9. 自建 Button/Input/Modal/Menu/Pill/StateDot/DiffBlock，形成第二套 atoms。

确需偏离时，所属 OpenSpec `design.md` MUST 记录：用户问题、偏离规则、为何共享组件不能满足、影响 surface、响应式与 a11y 处理、回退方案和验证命令。例外不得通过注释或永久 allowlist 静默存在。

## 12. 新增或修改 UI 的设计模板

每个包含 UI 的 `design.md` 至少写明：

```markdown
## UI Contract

- Surface classification: adopted | embed | excluded
- Surface kind: navigator | workspace | inspector | dialog | micro
- First / second / third visual priority:
- Existing components reused:
- Cards that earn existence:
- Primary scroll owner:

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|

### Accessibility

- Keyboard path:
- Focus owner/return:
- Visible labels and accessible names:
- Reduced motion and coarse pointer:

### Visual Exceptions

- None, or: rule + reason + rollback + validation
```

“clean/modern/consistent”“移动端堆叠”“后续补空态”不算设计决策，不能通过 review。

## 13. 验收与自动门

### 13.1 合入前检查清单

- [ ] package 已在 Web surface catalog 标记 `adopted/embed/excluded`。
- [ ] adopted UI 使用 `Surface`，顶部只有一个 `SurfaceContextBar`。
- [ ] package-local CSS 全部 scope，且只消费 `--vk-*`/host token。
- [ ] Button/Input/Modal/Menu 等复用官方 primitive。
- [ ] raw `select/textarea` 位于 `.ys-field` 或 `.vk-field`。
- [ ] loading/empty/error/stale/partial/disabled 的适用状态已测试。
- [ ] 360/560/960px 或对应自然容器宽度无横向溢出和主操作裁切。
- [ ] 键盘、focus-visible、ARIA、coarse pointer、reduced motion 已覆盖。
- [ ] 动态 inline style 仅用于测量几何，并登记文件与用途。
- [ ] 旧 view kind、command、data attribute 与 persistence 兼容未破坏。

### 13.2 验证命令

```bash
pnpm --filter <package-name> run test
pnpm --filter <package-name> run build
pnpm run check:surfaces
pnpm run test:visual
pnpm run check:plugins
```

更新视觉基线只能在确认变化符合本文档后执行：

```bash
pnpm run test:visual:update
```

不得用更新 snapshot 掩盖未解释的布局漂移。全局门失败时先分类为 introduced、pre-existing、concurrent 或 environmental，再决定是否修复；不得修改无关业务逻辑只为清除并行工作红灯。

## 14. 采纳状态

1. `ui-pane-domain`（六个创作工具 pane，零样式 → 统一 chrome）✅ 3.1
2. `ui-creator-studio`（token 归一 + 状态色入 tone + 规则 scope 化）✅ 3.2
3. `ui-pane-workbench` chrome fallback 归一（region-chrome/explorer/git）✅ 3.3（2026-08-26：34 处 fallback 并入 `.pwr-root` 单点声明）
4. `ui-session-tags`/`ui-session-cookie-manager`（A 档全量采纳）+ `ui-next-step-suggestions`/`ui-conversation-rewrite`/`ui-agent-preset`（B 档守卫：currentColor 继承/宿主类名委派，零硬编码色断言）✅ 3.4
5. `ui-desktop-workbench`/`ui-pane-subagent` 同义词与结构密度迁移 ✅ 3.5（2026-09-04：工具栏、侧栏、行、空态和状态组件统一）
6. 其余高价值 Surface 消费者收敛 ✅ 3.6（2026-09-04：`ui-mcp-inspector`、`ui-devtools`、`ui-token-usage`、`ui-pane-side-chat`、desktop terminal/Git 使用共享 chrome 与状态语言）
7. `dsh-rich-media` client token 归一 ✅（2026-09-04：废除漂移 `--dsw-alias-*` 字面量与外来 `--dsh-color-*` 词表，Surface 外根经 `embed-tokens.ts` 单点声明 `--vk-*`；toolchain token-rate 37%→78%，余量为媒体业务画布独立数值）

## 15. 非目标

- 不定义 host 主题、不写 `--dsw-alias-*` 到宿主根、不 fork DSH core。
- 不修改 DSH AppFrame 几何、Pane split/dock owner 或官方 overlay/focus 实现。
- 不引入 CSS-in-JS runtime、Tailwind、Storybook、Chromatic 或新动画依赖。
- 不改 Owner 投影、mutation admission、审批账本、terminal state 或真实外部集成。
- 不删除现有 view kind、command、DOM data attribute、旧 class 或兼容字段。
- 官方 `dsh web` 实机验收可作为 canary 证据，但不是本仓插件协议完成门。

## 16. 未决设计事项

当前无阻塞性视觉决策。新增 token、Surface kind、官方 primitive 替代或长期例外必须通过新的 OpenSpec change 演进，不能在消费包内先斩后奏。

## 17. DSH 画布与专业 Pane 的视觉对齐

2026-09-07 的退役决定取代旧的双宿主方案。独立 `client/yeisme-workbench` 不再是交互目标；历史材料仅供迁移追溯。DSH 自身的 Pane Workbench、预览命令和布局能力继续保留。

### 17.1 同一对象，多种视图

项目画布和 Eikona、Anatomia、Scaena、Auctra、Sonora 专业 Pane 使用本规范的 token、控件与状态语言。同一成果的明确版本、采用事实和来源必须一致；视图切换不得复制领域状态，也不得静默换成更新版本。

- 画布承担素材组织、引用关系、执行连接和节点快捷操作。
- 专业 Pane 承担完整参数、编辑器、播放器、候选比较及领域审阅，可独立打开。
- 复杂内容通过并排、放大和按需展开组织；空间不足时重排布局，保留核心能力的可访问入口。
- 新成果默认提示；除用户明确导航外，不抢走当前阅读位置。

### 17.2 直接操作与交接

多候选图片、镜头时间线、项目画布、文本 Diff 和跨项目引用属于已确认的 DSH 创作体验，不再签发到独立 Workbench。Scaena 负责镜头级编排和交付，不新增通用多轨剪辑器。

专业 Pane 可独立交付；画布或跨领域编排未就绪不能阻塞已具备 owner 合同的直接操作。采用候选、写回源文件、正式版本确认和最终交付分别呈现。跨 Pane 交接显示目标对象、固定版本、目标项目和访问状态，接收方重新核验权限；缓存、URL 参数和当前选中状态不构成执行授权。

### 17.3 Host 与 owner 边界

- 官方 DSH host 拥有 AppFrame、主题、slot、Pane geometry、overlay 和 focus primitive。
- `ui-surface` 拥有插件内部 composition；`ui-visual-kit` 只在 host token 缺失时提供 fallback。
- 插件拥有内容和 scoped extension，不声明第二套全局样式、主壳或调度器。
- Host 仅持久化布局、草稿和安全引用；领域正文、媒体、正式版本及执行事实归对应 owner。
- 单领域执行使用该 owner；跨领域编排使用 Ordo。关闭 Pane 不取消任务，恢复界面不自动恢复执行。

## 18. DSH 插件 UI archetype

新增或重构插件前先选择一个 archetype，不能从“做一个漂亮面板”开始：

| Archetype | Surface classification/kind | 第一视觉优先级 | 第二优先级 | 常见包 | 禁止模式 |
|---|---|---|---|---|---|
| Context navigator | adopted / navigator | 当前 workspace、session、resource | freshness/selection | Pane Workbench explorer、resource panes | 卡片首页、长说明 |
| Attention console | adopted / inspector | primary blocker/approval/unknown | owner reason + next action | Ordo Agent Ops、Daily/Activity | KPI 卡墙、庆祝状态 |
| Conversation companion | adopted / workspace | 当前对话/引用/composer | run/proposal details | Side Chat、conversation rewrite | 第二 conversation owner、重复 composer |
| Creator workspace | adopted / workspace | 当前产物/候选/媒体 | context + review | Creator Studio、AI Drama | 三列等权 dashboard、领域主题覆盖 host |
| Diagnostics inspector | adopted / inspector | failing checks/current selection | technical details/evidence | MCP Inspector、DevTools、Token Usage | 每个指标一个大卡片 |
| Terminal/editor/diff | embed | 原始工作内容 | minimal toolbar/status | Terminal、Git、semantic editor | 外层多层 card、抢占 host shortcuts |
| Selection micro-surface | adopted / micro 或 embed | 被选对象 + 1–2 个动作 | More/解释 | Selection Annotation、next-step | 大标题、ContextBar、永久侧栏 |
| Focused decision | adopted / dialog | 影响、选择、owner | receipt/recovery | Approval/confirmation | 自制 modal/focus trap、隐藏风险 |

### 18.1 Archetype 共用规则

- 一个 Pane 只有一个主 archetype；次级区域不能再创建同权重小应用。
- 同一功能在 compact/standard/wide 间只重排，不改变 admission、action identity 或数据集合。
- ToolView 和 embed renderer 不套完整 Surface 时，仍需消费 token、排版、focus、状态和 overflow 规则。
- 终端、diff、媒体与编辑器可以高密度，但外围 toolbar、empty/error 和 disabled reason 必须回到共享语法。

## 19. UI Contract 补充字段

除 §12 模板外，多个 DSH surface 共享能力时，所属 `design.md` 还必须记录：

```markdown
### Cross-host Semantics

- Canonical data/action/receipt owner:
- Same capability in other DSH surface: none | Pane/route identifier
- DSH role: primary | compact companion | handoff-only
- Shared states and wording:
- Handoff trigger and target:
- Semantic differences allowed:
- Pixel differences intentionally ignored:
```

`DSH role` 描述当前 surface 的职责，不得用它删除已确认的专业 Pane 能力。若两个 surface 都能提交同一 action，必须消费同一 decision/action identity，并证明只生成一个 owner receipt。

## 20. 插件视觉压力测试矩阵

每轮 UI 迁移不能只保留一个满数据 desktop 截图。至少覆盖：

| 维度 | 必测集合 |
|---|---|
| 容器 | 360、560、960px；200% zoom；长标题与 pseudo locale |
| 状态 | loading、empty、ready、running、stale、partial、offline/error、disabled、unknown/reconcile |
| 交互 | keyboard、focus return、coarse pointer、reduced motion、唯一 action 不依赖 hover |
| 内容 | 最短、典型、47 字符名称、长 technical ref、零数据、溢出数据 |
| 宿主 | fallback token、host token override、相邻两个不同插件同时挂载 |
| Handoff | target available、needs_contract、stale ref、consumer unavailable、返回后 receipt refresh |

优先压力测试的 surface：Pane Workbench、Side Chat、Ordo Agent Ops、Creator Studio、MCP Inspector、desktop Terminal/Git、Selection Annotation。低频设置和示例包不能替代这些主工作面。

### 20.1 评审顺序

1. Owner/authority 是否正确。
2. 3 秒内能否识别位置、状态和下一步。
3. Surface/archetype 和主滚动 owner 是否正确。
4. loading/empty/error/stale/partial/unknown 是否保留真实内容与恢复。
5. compact 是否重排而非删能力。
6. token、primitive、scope、icon、type、motion 是否合规。
7. 最后才评审阴影、微间距与视觉 polish。

验证继续使用：

```bash
pnpm run check:surfaces
pnpm run test:visual
pnpm run check:plugins
```

画布与专业 Pane 共享 capability 时，额外核对对应创作 OpenSpec 的版本、选择、运行范围和 handoff 验收；独立 Workbench 不再是验收端。

后续实施按本仓当前 OpenSpec 和 `AGENTS.md` 执行：先分类 visual diff，确认变化符合设计后再更新 snapshot；不得借统一 UI 修改无关并行工作、归档 change 或官方 host chrome。
