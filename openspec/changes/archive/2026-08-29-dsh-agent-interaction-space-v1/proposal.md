# dsh-agent-interaction-space-v1

## Why

dsh web 的预览面（`MediaPreviewPane` 格式矩阵、`desktop.file`、creator 面板）是被动的查看器：用户看到 CSV/DOCX/XLSX/PDF 后，与 agent 的协作必须切回主对话，丢失工件上下文。selection-annotation V1 已把「选区→锚点→composer→提案→审批→应用」跑通，但它只嫁接在 conversation DOM 上；side-chat 已证明 pane 内 attach/fork session 不动主选择的可行性；media/ref 已示范 conversation 事件→chat 节点渲染。缺的是把这些能力**组装成以工件为中心的原生交互空间**：预览面本身成为 agent 与人协作的操作面，而不是截图式的只读视图。

准入结论 `split-owner`：Harness Plugins 拥有交互空间 shell、锚点/directive/proposal 合同与渲染；工件的 canonical state、变更鉴权与多模态输入仍归 DSH/领域 owner；run/审批/receipt 真相仍归 Ordo。

## What Changes

- 新增 `@yeisme/dsh-client-ui-interaction-space` + `dsh-interaction-space` bundle：在 pane-workbench 注册 `interaction.space` view（resourceKey `space:<owner>:<ref>@<version>`，单 region tab，Tier 0 可折叠）。
- 锚点层：`SelectionAnchorV1` 家族 additive 新增 `table-range`（sheet/行/列区间 + digest）；格式渲染器（表格网格、文本行号视图、图片、PDF 页）标注 `data-source-*` 提示，锚点映射复用 selection-annotation 的「不伪造行号/坐标」纪律。
- 对话层：空间内嵌 side-chat 模式的 session attach/fork（`ISessions.binding` / `fork`，主选择不变量以计数测试钉死）；composer adapter 合同复用 selection-annotation（`send {intent, text, anchorIds, approvalPolicy}`），锚点作为结构化 context 附着而非拼进 prompt 文本。
- 指令层：agent→空间只走 typed directive（`space.focus` / `space.highlight` / `space.propose` / `space.request-input` / `space.progress`），经 conversationEvents `space/ref` 节点族投影；agent 无 DOM 权限，渲染真值在空间。
- 提案层：proposal 以 selection-host `ProposalV1`/`ProposalHunkV1` 为基，扩展 per-format diff 投影（行级 hunk / cell 变更矩阵 / 图片 before-after 对比）；应用走 owner adapter preview-before-mutate（creator-studio gateway 模式：snapshot freshness → descriptor 匹配 → dispatch → receipt），receipt 回写空间时间线；工件 version bump 触发空间重渲染（preview 平台既有 version fencing）。
- 失败诚实矩阵：无 composer adapter→本地评论不调模型；无 owner adapter→只读 diff + 复制 patch 文本出口；无 conversation events seam→directive 面板禁用并给出原因。

## Interaction Loop（目标闭环）

```
人选中工件区域 ──selectionToAnchorDraft──▶ typed anchor（带 version+digest）
      │                                          │
      ▼                                          ▼
空间锚点栏（批注组）──composerAdapter.send({anchorIds})──▶ agent（附着 session，主选择不动）
                                                         │
                              ◀── space.propose {typed patch} ─┘
                                     │
                        diff 投影（hunk/cell/图片对比）+ 逐位置审批（复用 approval 合同）
                                     │
                        owner adapter dispatch（preview-before-mutate）→ receipt → version bump → 重渲染
```

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| 交互空间 shell（view/布局/时间线） | required | Harness Plugins | deliver-now | view 注册测试 + bundle 合同 |
| 锚点合同（含 table-range） | required | Harness Plugins | deliver-now | anchor 校验/negative fixtures |
| 空间内 agent 对话（attach/fork） | required | Harness Plugins + DSH sessions | deliver-now | 主选择不变量计数测试 |
| agent→空间 typed directive | required | Harness Plugins | deliver-now | 事件合同 + 节点渲染测试 |
| 提案/diff/审批/应用 | required | Harness Plugins + 领域 owner | P3 分期 | owner adapter receipt e2e（jsdom） |
| 工件 canonical state/变更鉴权 | required | DSH/领域 owner | moved behind contract | owner OpenSpec |
| run/审批/receipt 真相 | required | Ordo | moved behind contract | Ordo 投影（既有） |

## Capabilities

### New Capabilities

- `agent-interaction-space`: 工件锚定交互空间的视图、锚点、对话、指令与提案合同及诚实降级。

### Modified Capabilities

无。锚点/directive 均为 additive 字段与事件族；既有 selection-annotation、side-chat、rich-media、creator-studio 合同不变。
