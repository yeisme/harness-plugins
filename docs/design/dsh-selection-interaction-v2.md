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
