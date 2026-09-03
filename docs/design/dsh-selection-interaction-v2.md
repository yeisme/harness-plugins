# DSH Web 统一选区交互 V2

> 状态：设计完成，待按 `openspec/changes/dsh-selection-interaction-v2/` 实现。
> 本文是产品/交互摘要；V1 的历史合同见
> `dsh-selection-agent-review-v1.md`。

## 1. 要解决的问题

现有 V1 把“选中”当成“马上进入 Agent 工作流”：任何文本选区都可能显示一整条
浮动操作栏，并在一次交互内打开 Compact Composer。与此同时，Workbench、
Interaction Space、Selection Annotation 和领域 Pane 各自维护相似按钮、菜单、
快捷键和关闭规则。

这会让阅读、复制和普通编辑受到打断，也让扩展无法准确表达“这个动作适用于哪种
上下文、需要什么 capability、由谁执行、是否需要 preview”。V2 的目标不是再加
一层菜单，而是把选区变成一个可被明确接管的 context，统一动作解析和视觉表面。

## 2. 产品决策

| 决策 | V2 规则 |
| --- | --- |
| 触发 | 仅稳定且通过安全检查的 text/source/image/table/editor selection 进入交互层 |
| Composer | 选中时不自动打开；只有用户明确激活 ask/comment/edit 等动作才打开 |
| 表面 | 页面级 singleton；Pane 只提供 context，不创建私有 toolbar |
| 密度 | 桌面默认 1 primary + 2 secondary + More |
| 缺能力 | 不适用隐藏；适用但缺 capability 的动作只在 More 中 disabled 并解释原因 |
| 持久化 | 临时 Actions 自动关闭；只有显式 Pin 才成为可恢复入口 |
| 视觉 | IDE chrome + 克制内容，全部复用 `ui-visual-kit` / `ui-surface` |
| 扩展 | namespaced typed descriptor + owner dispatch；不允许 DOM/React callback |
| 偏好 | workspace > user > built-in，按 context 独立配置 |
| 兼容 | 新 bundle 默认 V2；旧宿主一个 release 走 V1 adapter，之后移除 |

## 3. 上下文与动作矩阵

### 3.1 进入交互层的 context

- `text`：对话或文档中的普通文本。
- `source`：文件源码或带 `data-source-*` 映射的 Markdown 渲染内容。
- `image-region`：图片中的点/矩形区域，复用 V1 归一化坐标。
- `table-range`：表格中的连续单元格范围。
- `editable-control`：input、textarea、contenteditable 和代码编辑器。

默认接管 editable control，但以下区域永远排除：password/token-like/private
字段、交互层和 Composer 自身、宿主标记了 `data-dsh-selection-optout` 的编辑器。
排除后必须保持原生选择、快捷键和焦点行为。

### 3.2 内置动作映射

| context | Primary | Secondary | More |
| --- | --- | --- | --- |
| text/source | 问 Agent | 评论、复制引用 | 编辑、加入批注组、完整工作台 |
| image-region | 评论 | 询问、加入批注组 | 完整工作台；有能力时编辑 |
| table-range | 分析 | 评论、复制引用 | 编辑、加入批注组、完整工作台 |
| editable-control | 编辑 | 问 Agent、评论 | 复制引用、加入批注组、完整工作台 |

动作只在适用且 owner/capability 可用时进入可执行槽位。旧 V1 action id 继续作为
alias（`ask`、`comment`、`edit`、`agent-edit`、`copy-quote`、`add-to-batch`、
`open-full`），但新的 registry 和 receipt 使用 namespaced canonical id。

## 4. 交互流程

```text
selectionchange
    │
    ├─ 不稳定 / 敏感 / opt-out ──► 不渲染
    │
    └─ 120ms 稳定 + viewport 检查
             │
             ▼
      singleton Actions
       1 + 2 + More
             │ 用户明确动作
       ┌─────┼──────────────┐
       ▼     ▼              ▼
    local  Composer      owner preview
    copy   ask/comment   edit/apply
             │              │
             └──────┬───────┘
                    ▼
             typed intent + receipt
```

生命周期为 `idle → candidate → stable → actions-visible → dispatching → surface →
dismissed/pinned`。

- candidate 阶段不显示浮层，避免拖选和快速复制造成闪烁。
- reselect、scroll、resize、Esc、outside click、context 失效都会关闭临时表面。
- 选区离开视口时可短暂显示边缘 affordance，但不保留可执行的陈旧 context。
- Composer、批注组、diff、审批等深度流程由明确动作升级到对应 owner surface。

## 5. 键盘、触控与响应式

| 环境 | 表面 |
| --- | --- |
| ≥960px | 选区附近 anchored Actions，1+2+More |
| 560–959px | 短工具条，More 使用 anchored popover |
| <560px 或 coarse pointer | 单一 Actions 入口，点击打开 Bottom Sheet |

默认 `Alt+Enter` 聚焦 Actions，快捷键可在 Workspace Designer 覆盖；检测到宿主或
编辑器冲突时，原生快捷键优先。所有 action hit target 在触控模式下至少 44px。

焦点规则：打开 Actions 时记住原节点；打开 More/Sheet/Composer 时使用 roving
tabindex 和可见 focus；Esc 按 nested surface → Actions 的顺序关闭；最终焦点回到
原节点。所有状态同时有文本或 aria 语义，不能只用颜色；`prefers-reduced-motion`
下禁用持续动画。

## 6. 扩展与自定义

扩展注册 `SelectionActionDescriptorV2`，至少描述：

- namespaced `id` / alias；
- 适用 context；
- required capabilities；
- priority、默认槽位和 danger；
- owner、presentation、bounded label 和可选 shortcut。

registry 按 context → user/workspace visibility → capability →
priority/install-order/id 排序。扩展 handler 不能通过 descriptor 注入 DOM、React
组件、任意 CSS、URL、patch 或 provider payload；激活后只发送 typed intent，由
声明的 owner 执行。

Workspace Designer 新增“Selection & Interaction”区，支持每种 context 独立设置：

- action 显示/隐藏；
- canonical action 顺序；
- shortcut；
- compact/comfortable density；
- default/review/edit/custom preset。

无效 id、快捷键冲突和越界配置回退到 built-in，并保留诊断。浏览器只保存有界 UI
偏好，不保存 anchor 内容、文件路径、URL、会话状态或 owner payload。

## 7. 视觉统一边界

Actions、More、Bottom Sheet、Composer handoff 和 disabled reason 都必须使用
`buildPanelStyles({ scope })` 与 `Surface` / `SurfaceActionBar` / `SurfaceContextBar`。
选择交互不得新增一套颜色、圆角、焦点环、reset 或 CSS-in-JS runtime。

V1 toolbar 中的白色/GitHub-style fallback、未 scoped selector 和局部状态色迁移到
`ui-visual-kit` canonical tokens；宿主主题只通过 alias 覆盖，不改变组件语义。

## 8. 迁移、回滚与版本节奏

### Canary

bundle 先探测 `selection.interaction.v2`。V2 可用时注册 singleton；只支持 V1 的
宿主由 adapter 投影旧行为。adapter 的 evidence 只记录版本、capability 和结果，
不记录选区原文、prompt、截图字节或 provider payload。

### Default V2

新安装默认 V2；已安装用户仍可通过 workspace policy/kill-switch 选择 V1。包名和
安装命令不变：

```bash
dsh plugin --profile web add @yeisme/dsh-selection-annotation
```

### Removal

V2 连续一个正式 release 通过浏览器、键盘、触控、HMR/dispose 和 owner 集成验收后，
关闭 rollback window；下一 removal release 删除 V1 adapter/runtime。旧 action id
不立即删除，继续作为 alias，避免扩展调用方断裂。

## 9. 验收与证据

- unit：context normalizer、descriptor 校验、确定性排序、preference merge、dismissal reducer。
- component：1+2+More、More disabled reason、Composer handoff、Bottom Sheet、focus return。
- integration：选择→稳定→动作→typed intent→owner receipt；V1 fallback；HMR/dispose。
- browser：360/560/960px、dark/reduced-motion、text/source/image/table/editor、scroll/reselect/Esc/outside。
- security：password/private/opt-out 排除，wire/DOM/evidence 无 raw path/URL/prompt/patch/provider payload。
- evidence：每次运行写入 `temp/integration-test-runs/<run-id>/`，并包含 `summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json` 和 `artifacts/`。

实现任务、依赖和退出条件以
[`openspec/changes/dsh-selection-interaction-v2/tasks.md`](../../openspec/changes/dsh-selection-interaction-v2/tasks.md)
为准。

## 10. Gate A 基线与迁移冻结（2026-09-02）

### 10.1 V1→V2 对照表（代码事实）

| 面 | V1 现状（代码事实） | V2 目标 |
| --- | --- | --- |
| 选区入口 | `ui-selection-annotation/src/client/index.ts` `handleSelectionChange`：`selectionchange` → 120ms debounce → `captureFromSelection` → toolbar.show | 同一入口改为发布 `SelectionContextV2` 给全局 singleton；Pane 不再 mount 私有 toolbar |
| 操作条 | `toolbar.ts` `SelectionToolbarController`：7 动作全量平铺（ask/comment/edit/agent-edit/copy-quote/add-to-batch/open-full）、role=toolbar、Esc 关闭、左右箭头/Tab 导航、窄面板图标化、滚出视口收缩为边缘锚点 | singleton Actions：1 primary + ≤2 secondary + More；缺 capability 动作只进 More disabled+reason；触控走 Bottom Sheet |
| Composer | `composer.ts` `CompactComposerController` + DOM overlay：仅动作激活后打开（`openComposer`），draft/anchor/preview-first 语义完整 | 保持"仅显式动作打开"；由交互层 action dispatch bridge 升级，焦点进入输入区 |
| 自动打开 Composer | V1 代码无选中即自动打开路径（防回归项） | 正式禁止（MODIFIED requirement） |
| 快捷键 | 无全局快捷键注册面；toolbar 内箭头/Esc 导航 | `Alt+Enter` 聚焦 Actions（可配置，冲突 fail-safe 原生优先） |
| 视觉 | `styles.ts` 注入 `--dsh-*` GitHub 白 fallback（`#ffffff`/`#d0d7de` 字面量）、未 scoped reset | `buildPanelStyles({ scope: 'dsh-selection-actions' })` + vk token 唯一 canonical fallback |
| dispose | index.ts 显式 dispose（timer/overlay 监听/selectionchange/keydown/toolbar/overlay.remove）+ G21 事件委托收口 | singleton effect-scoped disposer + HMR/重复 mount 对称释放测试 |
| pane-workbench | 无私有 selection toolbar（`selection` 命中均为 pane 项选择状态/quick-pick），不迁移面 | 保持不拥有；仅提供 Workspace Designer 配置区与 context handoff |
| 事件 | `dsh-selection-annotation:submit`、`dsh-selection-annotation:add-to-batch`（window CustomEvent） | 语义/字段不变，新增 `policyVersion`/`canonicalActionId`/`contextKind` 仅 optional additive |
| kill-switch | `browserPreferenceStorage` `'dsh-selection-annotation' === 'off'`（经 `probeCapability` 三态 seam） | 保留；新增 `policyVersion` workspace/user 策略层 |

### 10.2 capability/owner/receipt 对齐

- 新 capability：`selection.interaction.v2`（bundle probe；旧宿主缺席走 V1 adapter，不 client polyfill）。
- typed intent owner：`ask`/`comment`/`edit` → 宿主 Composer/会话 owner（V1 `dsh-selection-annotation:submit` 语义保持）；`copy-quote` 本地完成；`add-to-batch` → 批注组 owner 事件；`open-full` → 展开主输入。owner 缺席 = disabled + reason，不伪造 receipt。
- receipt seam：复用 `@yeisme/dsh-selection-host` `ApplyReceiptV1`/`preview-first`/`baseVersion` 合同；V2 intent 不另造第二 receipt。
- Workspace Designer 注册点：`ui-pane-workbench/src/workspace-designer(-ui).ts(x)`（pane 布局设计师）；仓内无通用设置区 registry——“Selection & Interaction” 区按 5.3 在 designer UI 本地新增（bounded canonical id 偏好），不伪造上游设置面。
- DSH host 侧缺位 seam：conversation user-actions slot 固化于 `upstream-prs/user-actions-slot/`（2026-08-20 Agent Note 草案）；未合入前 V2 Actions 层自渲染 scoped surface，不依赖官方 slot，也不声称官方合入。

### 10.3 V1 兼容窗口冻结

- Release 标识：`@yeisme/dsh-selection-annotation` 当前 `0.1.0-rc.1`（V1）；V2 以 `0.2.0-rc.1` canary 起、默认 V2 之后的 release 结束窗口。
- 默认 policy：canary 期新安装默认 V2（probe 到 capability 或 bundle 自带 runtime）；已安装用户可经 workspace/user `policyVersion=v1` 回退。
- kill-switch/rollback：复用 `'dsh-selection-annotation' === 'off'`（整体禁用）+ 新增 `policyVersion` 策略（v1/v2 切换不丢 context）；rollback 负责人 = harness-plugins maintainer。
- deprecation marker：V1 adapter 运行时打 `deprecated=true` 脱敏 evidence 标记（版本、capability、结果；无选区原文/prompt/payload）。
- removal 条件：V2 连续一个 release 通过浏览器/键盘/触控/HMR/owner 验收且 rollback window 关闭后，下一 removal release 删除 V1 runtime/adapter；安装包名与旧 action id alias 保持不变。

### 10.4 包/事件/快捷键消费者清单

- 包：`@yeisme/dsh-client-ui-selection-annotation`（deps：`dsh-plugin-contracts`、`dsh-selection-host`）、`@yeisme/dsh-client-ui-interaction-space`（deps：`ui-surface`、`dsh-selection-host`、zod）；bundle：`@yeisme/dsh-selection-annotation`、`@yeisme/dsh-interaction-space`。
- 事件消费者：`dsh-selection-annotation:submit` 与 `add-to-batch` 在本仓内仅 `ui-selection-annotation` 自身 dispatch；外部消费者为宿主桥接（不在本仓），字段兼容由 optional additive 保证。
- 快捷键消费者：全仓无 `Alt+Enter` 既有占用（仅本 V2 合同定义）；编辑器原生快捷键优先原则落地于 conflict 检测 fail-safe（不注册 Actions shortcut）。



## 11. 实现回写（2026-09-02）

实际交付与偏差决策：

- capability 名称：宿主协商 capability 为 `selection.interaction.v2`；内置动作
  依赖 `conversation.composer` / `selection.edit` / `annotation.batch` 三个
  capability 名（由 selection-annotation 客户端按 Composer owner 在位与否提供）。
- 偏差决策：桌面 More/触控 Bottom Sheet 由 DOM overlay + `buildPanelStyles`
  scoped vk token 实现（非 React `Surface` 组件）——Actions 是页面级浮层，
  不能假设宿主提供 React root；`ui-surface` 组件继续用于 pane 内表面
  （Workspace Designer 区）。语义与视觉 token 与设计一致。
- per-context 顺序经 built-in 偏好层（`BUILTIN_CONTEXT_ORDERS`）实现；
  descriptor.priority 仅作未覆盖场景回退，自定义顺序只重排可用动作，
  `danger=confirm` 永不进入 primary/secondary（registry 结构性承担）。
- V1 adapter 由 `policyVersion=v1`（偏好键 `dsh-selection-annotation-policy`）
  显式启用；运行时发出 `dsh-selection-interaction:evidence` 脱敏标记
  （仅版本/capability/结果，无选区原文）。
- 未实现项（如实）：4.4 组件截图基线与 7.3 Playwright journeys 属 V2 canary
  浏览器门（360/560/960px、dark/reduced-motion 截图），按 plugin-host-protocol
  不作为本仓插件完成条件，留待 canary 浏览器验证波次。

- 集成证据：`temp/integration-test-runs/selection-interaction-v2-20260902160748Z-883078/`（六件套脱敏，status passed）。

## 12. 三阶段发布清单（6.4）

- [x] Canary（本 release，`0.2.0-rc.1`）：V2 默认 + `policyVersion=v1` 回退通道；
  jsdom 集成/组件/registry/偏好证据齐备；安装命令不变
  `dsh plugin --profile web add @yeisme/dsh-selection-annotation`。
- [ ] Default V2：V2 canary 通过浏览器/键盘/触控/HMR/owner 验收后，下一 release
  对新安装默认 V2、已安装保留显式回退；一个 release 无阻断回归。
- [ ] Removal：rollback window 关闭且证据完整后，下一 removal release 删除
  V1 toolbar runtime 与 adapter；安装包名与旧 action id alias 保持不变。
