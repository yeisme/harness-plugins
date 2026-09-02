## Context

本仓已经有 `ui-visual-kit`、`ui-surface`、`ui-pane-workbench`、
`ui-interaction-space` 和 `ui-selection-annotation`。问题不是缺少更多按钮，
而是多个 owner 都在局部表达“选中之后能做什么”。V2 需要把 selection context、
动作解析、视觉表面和 owner 执行拆开，避免再形成一个新的大而全 Pane。

用户选择的产品姿态是：IDE chrome + 克制内容；选中不是强制进入 Agent 工作流的
信号，而是可被 Actions 明确接管的上下文。默认表面必须轻、短、可退出；复杂流程
（Composer、批注组、diff、审批）才升级到对应 owner surface。

## Goals / Non-goals

**Goals**

- 只用一个全局交互层协调文本、源码、图片、表格和编辑控件选择。
- 以稳定选区 + 明确动作作为进入 Agent/批注/编辑流程的门槛。
- 用 typed descriptor 让动作可发现、可解释、可扩展、可禁用，而不把执行权交给浏览器。
- 在桌面、窄面板、触控、键盘、reduced-motion、HMR/dispose 下保持相同语义。
- 给个人用户保留有限偏好，同时允许 Workspace Designer 做 workspace override。

**Non-goals**

- 不重写 Conversation Composer、File Host、Annotation Service 或 Workbench reducer。
- 不让插件 descriptor 注入 DOM/React callback、任意 CSS、URL、patch 或远程脚本。
- 不在本变更内实现桌面捕获、跨会话评论、多人协作和 auto-apply。

## Product model

```text
DOM / editor / image / table selection
                │
                ▼
     selection context normalizer
      (stable + source + safety)
                │
                ▼
       global Interaction Layer
       ┌────────────────────────┐
       │ 1 primary · 2 secondary│
       │ More · dismiss · pin   │
       └───────────┬────────────┘
                   │ explicit action
        ┌──────────┼───────────┐
        ▼          ▼           ▼
   local action  Composer   owner preview
   (copy)        (ask)      (comment/edit/apply)
                   │           │
                   └─────┬─────┘
                         ▼
                 typed intent + receipt
```

Selection Annotation、Interaction Space 和 Pane Workbench 仅负责把自己的上下文
提交给 normalizer，不能各自 mount toolbar。交互层是页面级 singleton，实例由
effect-scoped controller 管理；重复安装、profile 切换、HMR 和 dispose 后只能留下
一套 DOM、事件监听器、observer 和 style contribution。

## Selection context contract

V2 复用 V1 anchor 字段和 owner 边界，新增只存在于 client interaction layer 的
bounded context：

```ts
type SelectionContextKindV2 =
  | 'text'
  | 'source'
  | 'image-region'
  | 'table-range'
  | 'editable-control'

interface SelectionContextV2 {
  contextId: string
  kind: SelectionContextKindV2
  anchor: SelectionAnchorV1
  source: 'conversation' | 'file' | 'markdown' | 'image' | 'table' | 'editor'
  stableForMs: number
  capabilities: readonly string[]
  hostOptOut?: boolean
  sensitive: boolean
}
```

`contextId` 只用于当前页面生命周期；持久化仍通过 V1 anchor/annotation owner。
`stableForMs` 由 normalizer 计算，不能由调用方伪造为稳定。`sensitive` 或
`hostOptOut` 的 context 不进入 Actions。密码输入框、token-like field、交互层
自身、Composer 和带 `data-dsh-selection-optout` 的祖先节点是强制排除项。

## Action descriptor and registry

扩展只注册安全描述，不注册渲染回调或执行函数：

```ts
interface SelectionActionDescriptorV2 {
  id: `${string}:${string}`
  aliases?: readonly string[]
  label: LocalizedLabel
  shortLabel?: LocalizedLabel
  contexts: readonly SelectionContextKindV2[]
  requires?: readonly string[]
  priority: number
  defaultSlot: 'primary' | 'secondary' | 'more'
  visibility: 'default' | 'optional'
  danger: 'safe' | 'preview-first' | 'confirm'
  owner: 'client' | 'dsh' | 'host'
  presentation: 'local' | 'composer' | 'popover' | 'pane'
  shortcut?: ShortcutDescriptor
  disabledReason?: LocalizedLabel
}
```

`SelectionActionRegistryV2` 负责校验 namespaced id、去重、dispose 和 capability
revision；action handler 只由 owner adapter 通过 `SelectionActionIntentV2` 接收。
客户端本地动作（如 copy）可以同步完成；comment/edit/apply 必须交给 owner，并
保留 preview-first、baseVersion 和 receipt。

### Deterministic resolution

1. 过滤 context 不匹配的动作。
2. 过滤 `visibility=optional` 且用户关闭的动作。
3. 能力缺失的动作不进入 primary/secondary，只进入 More 的 disabled 行并显示 reason。
4. 对可用动作按 `priority DESC`、安装顺序、`id ASC` 稳定排序。
5. primary 取第一项；secondary 取接下来两项；其余进入 More。
6. 同一动作不可同时出现在 primary/secondary 和 More；alias 只解析为 canonical id。

首批 built-in map：

| context | primary | secondary | More |
| --- | --- | --- | --- |
| text/source | 问 Agent | 评论、复制引用 | 编辑、加入批注组、在完整工作台打开 |
| image-region | 评论 | 询问、加入批注组 | 在完整工作台打开；有 capability 时编辑 |
| table-range | 分析 | 评论、复制引用 | 编辑、加入批注组、在完整工作台打开 |
| editable-control | 编辑 | 问 Agent、评论 | 复制引用、加入批注组、在完整工作台打开 |

## Lifecycle and dismissal

```text
idle
  → candidate (selectionchange)
  → stable (120ms debounce + viewport/safety check)
  → actions-visible
  → action-dispatching
  → composer/owner-surface
  → dismissed | pinned
```

- `candidate` 不渲染浮层；只有 stable 后才显示 Actions。
- 新 selection、滚动、resize、Esc、pointerdown outside 或 context 失效均 dismiss。
- 选区滚出视口时不强行保留完整工具条；可在边缘显示短暂 anchor affordance，随后 dismiss。
- Pin 是唯一把临时交互提升为可恢复 entry 的动作，不能由普通 selection 自动 pin。
- Composer 只在用户点击/键盘激活某个需要 Composer 的动作后打开，焦点进入输入区。
- Esc 依次关闭 nested More/Bottom Sheet、Composer/owner surface、Actions，并把焦点还给原触发节点。

## Responsive and accessibility

- `>= 960px`：选区附近 anchored Actions，默认 1+2+More。
- `560–959px`：保持短工具条，More 使用 anchored popover，避免横向溢出。
- `< 560px` 或 coarse pointer：只显示 Actions 入口，点击打开 Bottom Sheet；每项 hit target ≥44px。
- 默认 `Alt+Enter` 聚焦 Actions；宿主/Workspace Designer 可改快捷键，冲突时保留原生编辑器快捷键。
- 使用 `aria-label`、`aria-expanded`、`aria-controls`、roving tabindex；状态不能只靠颜色。
- 遵守 `prefers-reduced-motion`，浮层切换只保留 opacity/instant layout，不依赖持续动画。

## Preferences and customization

Workspace Designer 新增“Selection & Interaction”区，设置按 context 分组：

- action visibility（builtin/optional）；
- action order（只记录 canonical id）；
- shortcut；
- density（compact/comfortable）；
- preset（default/review/edit/custom）。

合并顺序为 `workspace > user > built-in`。无效 id、未知 context、冲突快捷键和
超出数量的自定义项 fail-closed，保留内置默认。浏览器只保存有界 UI preference，
不保存 anchor 内容、文件路径、URL、provider payload 或会话状态。

## V1 migration and rollback

| 阶段 | bundle 行为 | 宿主要求 | 退出条件 |
| --- | --- | --- | --- |
| canary | probe V2；旧宿主走 V1 adapter | V2 capability 可选 | V2 component/integration/visual 全绿 |
| default V2 | 新安装默认 V2；旧已安装 bundle 可显式回退 | 宿主发布 V2 capability | 一个 release 无阻断回归 |
| removal | 删除 V1 adapter/runtime | 仅支持 V2 | rollback window 关闭且 evidence 完整 |

回滚不改包名：通过 workspace kill-switch/capability policy 选择 `policyVersion=v1`
并重新加载旧 toolbar contract。回滚期间所有 V1 事件继续使用 canonical action id，
并标记 `deprecated=true`；不做 client polyfill，不在浏览器推断 V2 capability。

## Visual system integration

所有 Actions、More、Bottom Sheet 和 disabled reason 使用 `buildPanelStyles` 与
`Surface`/`SurfaceContextBar`/`SurfaceActionBar`。不新增颜色、radius、focus ring
或全局 reset；selection annotation 的旧白色/GitHub fallback 必须迁移为 scoped
visual-kit tokens。允许插件通过 alias 接入宿主主题，但 canonical fallback 只有
`ui-visual-kit` 一份。

## Risks and mitigations

| 风险 | 缓解 |
| --- | --- |
| 用户找不到动作 | 保留 `Alt+Enter`、context-aware primary、More 内可解释列表与 Workspace Designer preset |
| 旧宿主行为变化 | 一个 release adapter、kill-switch、migration evidence 与 removal gate |
| 扩展动作冲突 | namespaced id + priority/install order/id deterministic tie-break |
| 编辑器快捷键被抢 | 原生编辑器/敏感区域 opt-out；快捷键冲突时不注册 Actions shortcut |
| 多 Pane 重复挂载 | global singleton、effect-scoped disposer、HMR/conformance 测试 |
| 能力缺失造成死按钮 | applicable-but-unavailable 只在 More disabled，并显示 owner reason |

## Verification matrix

| 维度 | 必须覆盖 |
| --- | --- |
| Unit | context normalization、descriptor validation、sorting、preference merge、dismissal reducer |
| Component | desktop 1+2+More、disabled reason、Composer handoff、Bottom Sheet、focus return |
| Integration | selection→stable→action→typed intent→owner receipt；V1 adapter fallback；HMR/dispose |
| Browser | 360/560/960px，dark/reduced-motion，text/image/table/editor，scroll/reselect/Esc/outside |
| Security | password/private/opt-out exclusion；no raw path/URL/prompt/patch/provider payload |
| Evidence | 每次 integration/e2e 运行写 `temp/integration-test-runs/<run-id>/summary.json` 等脱敏文件 |
