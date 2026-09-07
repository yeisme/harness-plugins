# Workbench UI 设计治理与一致性合同

> 状态：Workbench Web UI 管理真源
> 适用范围：`apps/web/src`、注册 Pane、Spatial Lens、兼容 route 与设计系统证据
> 产品姿态：Agent-native instrumental workbench；克制、高密度、低饱和、可信、非营销

## 1. 文档职责

本文回答“Workbench 的 UI 如何被持续管理”：谁能定义视觉规则、每个 route/Pane 如何分类、共享什么、领域内容允许怎样不同、怎样阻止平行设计系统重新出现。

它不替代以下事实源：

1. [Agent-first 应用 Blueprint](../product/agent-workbench-blueprint.md)：产品、页面、Pane 与 owner 边界。
2. [Agent-first Pane Workspace UI Spec](../ui/agent-first-workbench.md)：主壳、布局、控件、状态与响应式。
3. [Agent workspace 接口合同](../interfaces/agent-pi-workspace.md)：Browser/BFF/service/Owner 信任链。
4. [Agent 视觉语言](agent-visual-language.md)：表面、圆角、排版、颜色、图标和动效。
5. [设计系统统一工程方案](design-system-unification.md)：token、组件、图标和 motion 的迁移细节。
6. [统一 UI 控件体系](ui-controls-system.md)：primitives/composites 与控件状态合同。

跨 Workbench/DSH 的共享语义和 handoff 验收由根仓库 `docs/architecture/workbench-dsh-ui-governance.md` 管理。Workbench 不依赖 DSH 的 React/CSS runtime。

后续由其他模型执行时，使用根仓库 `docs/architecture/workbench-dsh-ui-delivery-dag.md` 的角色、路径租约、分波和验收合同；Workbench writer 仍只受本子项目 `AGENTS.md`、OpenSpec 与本文约束。

## 2. 治理决策

### 2.1 唯一视觉权威

Workbench 使用本地 design system 作为唯一 aesthetic direction。Eikona 参考图、外部产品、Open Design 输出、截图转代码结果和 Owner 品牌资产都只是输入，必须先翻译为现有 token、组件、状态和布局合同。

冲突优先级：

1. 产品 owner、安全和 server-authored truth。
2. Agent-first Blueprint/UI Spec/接口合同。
3. 本文的 UI 管理规则。
4. design-system token、primitives、composites、icons、motion 实现。
5. Pane/Lens/route 局部样式。

局部实现不得通过更具体的 selector、inline style、私有 token 或视觉 fixture 反向覆盖上层决策。

### 2.2 Owner-fit

| UI 能力 | 决策 | Owner | 说明 |
|---|---|---|---|
| Trusted Chrome、product rail、Agent shell | `fit` | Workbench | 全应用唯一主壳 |
| Pane/document dock、layout reducer、responsive Sheet | `fit` | Workbench | 只拥有 UI composition |
| 通用 token、primitives、composites、icons、motion | `fit` | Workbench design system | 不保存业务状态 |
| Spatial Lens、Review/Evidence/Owner Pane 呈现 | `split-owner` | Workbench UI + domain owner | Workbench 只消费 typed safe projection/action |
| DSH 插件 Surface | `split-owner` | Harness Plugins + DSH host | 只共享语义，不共享 runtime UI 包 |
| Owner 私有页面/组件直接嵌入 | `reject-now` | 无 | 不加载任意 iframe、URL、component 或 private state |
| 新的并列 Studio/Orbit/Owner 主壳 | `reject-now` | 无 | 迁入 registered Pane、advanced route 或 deep link |

## 3. 视觉方向：Instrumental Graphite

Workbench 不是“深色 dashboard”，而是持续工作的工具环境：

- smoked graphite 中性底色；色彩只解释状态、选择和主动作。
- 主要层级由区域、对齐、间距、边界与内容密度建立。
- 首屏优先呈现真实工作、阻塞和下一步，不使用 Hero、欢迎页或 KPI 卡墙。
- 对话采用连续 timeline 和 structured Blocks，不铺满聊天气泡。
- 媒体、Canvas、代码、diff 和时间线可以成为高视觉内容；它们的外围 chrome 仍使用同一系统。
- 空态安静但不能空洞：一个明确问题、一句上下文、一个真实起步动作。

主构图参考继续使用：

1. `02-plugin-pane-workspace.png`：区域、Pane 插入和密度。
2. `01-agent-conversation.png`：对话、工具、审批和进度。
3. `03-agent-review.png`：Review、Evidence 和恢复。

参考图只定义构图方向，不能授予 capability 或替代运行证据。

## 4. UI 管理对象

UI 治理按七层管理，不按 route 各自管理：

```text
Physical palette
  -> Semantic tokens
    -> Primitives
      -> Composites
        -> Page/Pane patterns
          -> Route/Lens compositions
            -> State + visual evidence
```

| 层 | Canonical owner | 禁止事项 |
|---|---|---|
| Physical palette | `styles.css @theme` | 业务组件直接消费 hex/rgba |
| Semantic tokens | `design-system/tokens` | Pane 创建私有 palette |
| Primitives | `design-system/primitives` | 手写第二套 Button/Input/Dialog/Menu |
| Composites | `design-system/composites` | 自定义同语义 header/status/recovery |
| Icons | `design-system/icons` registry | 业务数据选择任意 React icon；route 直引新图标家族 |
| Motion | `design-system/motion` | 无限动画、装饰性 glow/scale、忽略 reduced motion |
| Evidence | Playwright/component contracts | 只看单张 happy-path 截图 |

## 5. Shell 与 Surface 语法

### 5.1 唯一主壳

```text
AgentWorkbenchShellV2
├─ TrustedChrome
├─ CompactNavigationRail
├─ AgentSessionDrawer
├─ AgentChatRail
├─ AgentDocumentDock
├─ SharedContextRail
├─ PaneCommandPalette
└─ ResponsiveOverlayLayer
```

不可协商：

- `/agent` 是默认入口；timeline 与 composer 不可被 Pane/Lens 关闭。
- Canvas 与 registered Pane 同属 document dock，不是 route-owned sibling app。
- Detail、Inspector、Review、Evidence 共用一个 context rail。
- 一个区域只有一个主要标题；Pane 不重复宿主 tab title。
- Session/Context 在中窄屏转为互斥 Sheet，不继续压缩成不可用侧栏。
- 旧 route 只允许 `advanced/legacy-compatible` 或 Owner deep link 身份，不得重新进入主导航。

### 5.2 Unified Surface

所有可复用工作面使用相同槽位：

```text
UnifiedSurfaceFrame
├─ SurfaceHeader(title, status, technicalMeta, actions)
├─ SurfaceToolbar(viewActions, search, commandPalette)
├─ SurfaceBody(LoadingSkeleton | EmptyState | StatusBlock | ReadyContent)
└─ SurfaceFooter(optional freshness, cursor, evidence)
```

- Header 只回答“这是哪里、当前对象是什么”。
- Toolbar 只承载当前 view 的操作，不复制全局导航。
- Body 默认只有一个主滚动 owner。
- Footer 仅显示真正需要持续可见的 freshness/cursor/evidence，不成为第二状态栏。

## 6. Route 与 Lens 分类

每个 Web surface 必须属于以下一种类型：

| 类型 | 适用对象 | 视觉责任 |
|---|---|---|
| `core-shell` | `/agent`、Plugins、Activity、Settings | 完整遵循主壳和 design system |
| `registered-pane` | Context、Run、Review、Evidence、Operations、Assets 等 | 使用 Unified Surface 与同一状态组件 |
| `domain-lens` | Creative、Workflow、Screenplay、Replica 等 | 内容可专业化，外围 chrome 不变 |
| `advanced-compatible` | 旧 Overview、Orbit、Gateway、Studio 等稳定链接 | 标注高级/兼容，逐步迁移；不得定义新视觉标准 |
| `owner-deep-link` | 需要完整专业编辑器的 Owner 产品 | Workbench 只显示 safe summary 与 launch descriptor |
| `internal-evidence` | foundation gallery、fixture、visual route | 不进入产品导航，不宣称 capability ready |

新增 route 时必须说明为何 registered Pane、Lens 或 deep link 不能满足。没有 owner 决策的 route 不得进入实现。

### 6.1 Active change 的 UI 归属

最新 OpenSpec 不能各自重新发明一套壳和组件。当前主要 change 按以下边界接入：

| Change | Surface 分类 | 必须复用 | 当前真实门 |
| --- | --- | --- | --- |
| `workbench-agent-chat-canvas-convergence-v2` | `core-shell` | Shell、Chat、Document dock、Context、Profile、Sheet | fixture/e2e 已绿；真实 Pi/Aigora 仍按 owner readiness blocked |
| `workbench-auctra-screenplay-room-v1` | `domain-lens` | Creative host、Surface header/toolbar、Context rail、Review/Evidence | UI 已实现；Playwright、真实 Auctra canary 与文档 closeout pending |
| `workbench-text-development-studio-v1` | `domain-lens` | 同一 Shell、editor document、四个 Context deck、candidate/version/Team composition | Working Copy、Runtime、Ordo 分别 default-off、capability-scoped 晋级 |
| `workbench-harness-studio-v1` | `registered-pane/advanced-compatible` | Tabs、状态/恢复、typed projection | canary 之外真实 owner/catalog/iframe 证据 pending |
| `workbench-dsh-ai-drama-bridge-consumer-v1` | `handoff consumer` | safe ingress、status/reconcile、target Lens | canary 签收是外部门，不能由 UI 完整度代替 |
| `workbench-spatial-canvas-experience-v3` | `domain-lens` | document registry、Context rail、状态与 responsive fallback | approved GPU performance evidence pending |

新 change 若触碰以上同一责任，必须引用现有 owner change 并说明“复用、扩展或迁移”，不能另起同义 Shell、状态 owner、diff、Profile 或 Team 控制面。

## 7. 领域差异规则

领域 Lens 可以改变：

- 内容布局：画布、时间线、表格、列表、媒体墙、代码/diff。
- 内容图形：节点、轨道、缩略图、波形、关系线、状态标记。
- 一个受控领域 accent，用于内容对象识别；不能覆盖全局 focus/primary action。
- 内容区必要的独立滚动、缩放或测量几何。

领域 Lens 不能改变：

- Trusted Chrome、product rail、Pane header/toolbar/overlay。
- spacing/radius/type/icon/motion 刻度。
- ready/running/warning/blocked/stale/unknown 的含义。
- action admission、approval、receipt 和 reconcile 语义。
- 通用 Button、Input、Tabs、Dialog、Sheet、Tooltip、StatusChip、DataState、ActionRecovery。

Studio 的星空、厚玻璃、独立品牌 chrome，Eikona 的独立导航和大卡片首页，Spatial 的橙色主 palette 都只能作为迁移期兼容表现，不能作为新 UI 的参考来源。

## 8. 状态与 action 合同

### 8.1 状态角色

| 状态 | 视觉 tone | 保留内容 | 主动作 |
|---|---|---|---|
| ready | neutral/positive | 当前内容 | 当前任务的真实 primary action |
| running | info | 已确认 Block/事件 | Stop/Cancel request，仅合同允许时 |
| permission_required | warning | 当前上下文 | 请求或完成权限 |
| cost_required | warning | 成本与影响 | 明确批准或取消 |
| needs_contract | authority unknown | 可读 fallback | 查看合同/连接要求 |
| stale | warning | last-confirmed | Refresh/Re-authorize |
| offline | critical | last-confirmed | Retry read，仅安全读取 |
| partial | warning | 成功部分 + 缺失范围 | 修复失败子项 |
| unknown_accept | authority unknown | 原 attempt 与 correlation | Reconcile only |
| conflict | critical/warning | current server state | 重新审阅后再决定 |
| limit_reached | neutral/warning | 当前 Pane | 关闭或显式替换 |

状态块固定顺序：用户影响 → 一个真实主动作 → 可展开 technical details。状态不能只靠颜色；ready 时不显示多余警告；unknown 不得出现 retry。

### 8.2 Agent provenance

Agent/AI 标识用于回答“哪些内容由 Agent 生成、使用了什么 runtime/profile、如何查看解释与证据”。它不能作为生成、重试、批准或自动执行按钮。详细内容进入 popover/Inspector：来源、runtime/model profile、授权 scope、revision、evidence/receipt 和限制。

## 9. Token 与组件演进

### 9.1 三层 token

```text
L1 --color-*       唯一物理色值
L2 --wb-*          业务组件使用的语义 token
L3 data slots      稀有 surface/context 覆盖，只引用 L2
```

- 业务组件只能使用 L2；L1 只为 L2 提供值。
- L2 不出现组件专属 hex/rgba；需要透明状态底色时用语义 token 派生。
- L3 不得保留长期私有 palette；兼容 alias 必须有删除条件和消费者清单。
- 新增 token 必须说明语义、所有主题映射、消费者、回退和验证。

### 9.2 当前债务基线（2026-09-04）

以下是重新执行源码扫描得到的迁移输入，不是永久数字：

| 项目 | 当前观察 | 方向 |
|---|---:|---|
| `var(--wb-*)` 消费文件 | 126 | 保持为默认语义入口 |
| spatial 私有 token 消费文件（排除 tests） | 10 | 迁移到 `--wb-*` 后删除兼容族 |
| studio 私有 token 消费文件（排除 tests） | 2 | 仅保留明确兼容期 |
| `data-wb-surface=` TSX 消费 | 0 | 若无真实需求，删除 no-op alias 机制 |
| `--color-danger` 未定义引用 | 3 | 改用 `--wb-status-danger`/`--color-destructive` |
| design registry 外直接 `lucide-react` 文件 | 30 | 按语义 icon registry 迁移 |
| `styles.css` 颜色字面量匹配 | 146 | 先迁移状态、表面和 active route |
| `AgentConversationWorkspace` | 2140 行 | 按 UI Spec 组件树拆分，不复制状态 owner |

复查命令：

```bash
cd client/yeisme-workbench
rg -l --glob '*.{css,tsx,ts}' 'var\(--wb-' apps/web/src | wc -l
rg -l --glob '*.{css,tsx,ts}' --glob '!**/*.test.*' 'var\(--color-spatial-' apps/web/src
rg -l --glob '*.{css,tsx,ts}' --glob '!**/*.test.*' 'var\(--studio-' apps/web/src
rg -n -- '--color-danger' apps/web/src/styles.css
rg -l --glob '*.{tsx,ts}' --glob '!**/*.test.*' "from ['\"']lucide-react['\"']" apps/web/src
```

数字变化时更新本节的日期和证据，不把旧盘点继续写成现状。

### 9.3 组件准入决策

新增 UI 组件依次通过：

```text
现有 primitive/composite 能表达？
  ├─ 能：直接复用或薄组合
  └─ 不能：是否只有一个领域使用？
      ├─ 是：留在 feature 目录，禁止进入 design-system
      └─ 否：至少两个真实消费者 + 相同状态/交互语义
          └─ 才能晋级 design-system composite
```

| 层级 | 合格条件 | 例子 | 禁止事项 |
| --- | --- | --- | --- |
| Primitive | 单一可访问交互，跨领域稳定 | Button、Dialog、Tabs、Popover | 持有 owner/query/business state |
| Composite | 至少两个真实 surface 共享同一语义 | PaneChrome、StatusBlock、EvidenceBlock、候选 `DiffView` | 为一个页面预先抽象；boolean props 模拟状态机 |
| Feature composition | 一个领域的对象与布局 | TextSelectionActionBar、Screenplay timeline | 自建 token、atoms、focus trap、全局 CSS |
| Page/Lens | 组合现有组件并消费 typed owner | Text Development、Screenplay、Replica | 反向定义 design-system 规则 |

复用不是追求所有页面长得一样。统一的是 chrome、状态、action、overlay、密度刻度和恢复；差异留给正文、图谱、媒体、timeline、diff 等内容本身。

## 10. UI Contract 模板

每个包含新 UI 或显著视觉调整的 OpenSpec `design.md` 至少记录：

```markdown
## UI Contract

- Surface classification: core-shell | registered-pane | domain-lens | advanced-compatible | owner-deep-link | internal-evidence
- Primary user question:
- First / second / third visual priority:
- Page/Pane pattern:
- Shared primitives/composites reused:
- Cards that earn existence:
- Primary scroll owner:
- Domain-specific visual allowance:

### State Matrix

| Feature | Loading | Empty | Ready/Running | Error/Offline | Partial/Stale | Permission/Cost | Unknown |
|---|---|---|---|---|---|---|---|

### Responsive

| >=1440 | 1024–1439 | <1024 | 200% zoom |
|---|---|---|---|

### Accessibility

- Keyboard path:
- Focus owner and return:
- Visible labels and accessible names:
- Reduced motion and coarse pointer:

### Visual Exceptions

- None, or: rule + reason + affected surfaces + rollback + validation
```

“保持现代”“移动端自适应”“使用现有风格”不算设计决策。

## 11. 视觉压力测试

每轮统一迁移至少覆盖：

- 空 session 与 active turn。
- structured answer + Run detail。
- Pane catalog open 与 `limit_reached`。
- Review permission/cost gate。
- Evidence/receipt。
- Owner offline/needs_contract。
- stale、partial、conflict、unknown_accept。
- 一个高密度 Lens 和一个媒体/Canvas Lens。
- 1440×960、1024×768、390×844、200% zoom。
- zh-CN、en-US、pseudo、keyboard、Axe、reduced motion。

评审顺序固定为：区域/阅读路径 → 状态/主动作 → 密度/滚动 → token/组件 → 字体/图标 → motion/polish。结构未通过时不先微调阴影与颜色。

## 12. 迁移顺序

1. **Shell first**：Trusted Chrome、rail、headers、Pane frame、overlay。
2. **State first**：替换 legacy badge/banner/empty/recovery，修复 undefined token。
3. **High-value active surfaces**：Agent timeline、Review、Evidence、Owner Pane、Creative/Workflow Lens。
4. **Compatibility routes**：Overview、Connections、Gateway、Studio、Eikona 独立壳逐步降级或迁移。
5. **Icon/motion cleanup**：完成 registry 与 recipe 收敛。
6. **Delete aliases**：只有消费者和视觉基线清零后删除 spatial/studio/route 私有家族。

迁移按 vertical slice 进行：一个 surface 同时完成结构、状态、响应式、a11y、token、截图和回滚，不进行只改颜色但保留平行组件的“半迁移”。

## 13. 验收与命令

文档与合同：

```bash
cd client/yeisme-workbench
openspec validate --all --strict
git diff --check
```

UI 实现最终验证：

```bash
cd client/yeisme-workbench
bun run typecheck
bun run web:test
bun run web:build
bun run web:e2e
bun run check:i18n
```

截图变更必须说明目标规则、受影响 state/viewport 和 diff 原因。不能用更新 baseline 代替设计评审；fixture/reference 证据不能提升 real Owner readiness。

## 14. 非目标

- 不建立跨仓 React/CSS component package。
- 不把 Workbench 变成 DSH、Eikona、Scaena、Auctra、Anatomia 或 Ordo 的 canonical UI owner。
- 不因视觉统一修改 Task、Proposal、Owner、approval 或 receipt 状态机。
- 不要求兼容 route 一次性删除；先降级导航权重并保持稳定深链。
- 不把单一深色 palette 当作设计系统完成。
- 不在本文件中宣称迁移、真实 provider、Owner canary 或 production ready。
