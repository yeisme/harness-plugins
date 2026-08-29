# Design: Agent 交互空间（Artifact Interaction Space）

## Context

预览平台（file-preview-formats）+ selection-annotation V1 + side-chat + creator-studio gateway + media/ref 节点先例已经各自落地。本 change 是**组装层**：不新造选区模型、对话通道、审批状态机或变更网关，只造「以工件为中心把它们钉在一起」的空间 shell 与两个新合同（table-range 锚点、space directive 事件族）。

## Goals / Non-Goals

- Goals: 预览面原生交互化（选区→锚点→agent→提案→应用闭环在 pane 内完成）；agent 可驱动空间但不碰 DOM；所有跨 owner 动作 fail-closed。
- Non-Goals: 不建第二 scheduler/审批账本（Ordo 是真相）；不改 DSH core；不接管领域工件 state；不做实时多人协作。

## 概念模型：三层一壳

```
┌─ interaction.space view（pane-workbench，resourceKey=space:<owner>:<ref>@<version>）
│   ┌─ 锚点层 anchors ── 选中→typed anchor（含 digest+version）→ 批注组栏
│   ├─ 对话层 session ── side-chat 模式 attach/fork（主选择不动）+ composer 锚点附着
│   └─ 提案层 proposals ── directive 时间线 + diff 投影 + 逐位置审批 + owner dispatch
└─ 壳：时间线（directives+receipts 有界滚动）、版本围栏、诚实降级条
```

## Decisions

### D1: 空间是 pane view，不是新侧栏
注册 `interaction.space` view kind（`role: content`、`preferredRegion: right`、`retention: snapshot`、`singleton: false`、resourceKey 同构 preview resource key）。Tier 0 单 region 下折叠为 tab；与 desktop.media/desktop.file 平级互斥路由：**同一工件从预览「升级」为空间（打开即 space view），预览 view 不被删除**。

### D2: 锚点 = 既有家族 + table-range
`SelectionAnchorV1` additive 新增 `kind: 'table-range'`（`sheetId`、`rowFrom/rowTo`、`colFrom/colTo`、`digest`）。格式渲染器补 `data-source-*` 提示（网格单元格行列号、文本行号、PDF 页码），映射复用 `selectionToAnchorDraft`：有提示→精确 anchor，无提示→`dom-region` + `unmappedReason`，**绝不伪造行列号**。图片区域复用 image-region 归一化坐标。

### D3: 对话层继承主选择不变量
空间内 agent 对话走 side-chat 同款官方面：`ISessions.binding(id)`（prompt/steer/queue/cancel）+ `fork`；**永不调用 `sessions.open()/openSubagent()/clear()`**，controller 不持有这些引用，计数测试钉死。composer adapter 直接复用 selection-annotation 合同（`send {intent, text, anchorIds, approvalPolicy}`），锚点以结构化 `anchorIds` 附着，宿主决定如何进 prompt/tool args。

### D4: agent→空间只走 typed directive
经既有 conversationEvents seam 发 `space/ref` 事件族（media/ref 同构）：

| directive | 载荷 | 空间行为 |
| --- | --- | --- |
| `space.focus` | resourceKey | 切换空间目标工件（人确认前只高亮不自动切） |
| `space.highlight` | anchorIds | 锚点栏+渲染面高亮（渲染真值在空间） |
| `space.propose` | typed patch（per-format） | 提案卡 + diff 投影，进入审批 |
| `space.request-input` | prompt + options | 空间内问题卡（数字选项） |
| `space.progress` | runRef + stage | 时间线进度行（Ordo 投影对账） |

agent 无法操作 DOM；directive 校验失败（unknown kind/越界 anchor/超预算）丢弃并显示 typed 原因。

### D5: 提案应用走 owner，receipt 回写时间线
复用 selection-host `ProposalV1`/`ProposalHunkV1`/`PatchRangeV1`/`ApplyReceiptV1` 与 creator-studio gateway 的 preview-before-mutate 语义：dispatch 前 snapshot freshness + descriptor 匹配；unknown/partial/stale 不自动重试，要求 reconcile。per-format diff 投影：text→行级 hunk（既有）；table→cell 变更矩阵（旧值→新值，`table-range` 锚点引用）；image→before/after 对比（复用 `MediaCompareView`）；docx→sanitized 片段对比。无 owner adapter 时提案卡降级为只读 diff + 复制 patch 文本出口。

### D6: 版本围栏与预算
锚点/提案携带工件 version；version bump（owner 发布）→ 锚点 digest 校验失败者标记 `drifted`，要求重新协调（selection-annotation 漂移协调复用）。空间内：锚点 ≤200（对齐 AnnotationCanvas maxMarkers）、directive 时间线 ≤200 条滚动、diff 载荷 ≤256KB、单工件同时活跃提案 ≤16。retention snapshot 保证 pane 关闭重开不丢审批中的提案。

### D7: 降级矩阵（fail-closed）

| 缺席 seam | 行为 |
| --- | --- |
| composerAdapter | 评论本地保存不调模型；询问 blocked（`composer-adapter-unavailable`） |
| ISessions binding/fork | 对话层显示 needs_contract，锚点栏/提案层不受影响 |
| conversationEvents `space/ref` | directive 面板禁用 + 原因；提案只能由人从锚点栏发起 |
| owner adapter（dispatch） | 提案只读 + 复制 patch 文本；应用按钮禁用 + `owner-adapter-unavailable` |
| 锚点映射提示缺失 | `dom-region` + unmappedReason，不参与需要精确坐标的提案 |

## 风险与权衡

- **空间 vs 主对话上下文割裂**：锚点只进附着 session，不污染主对话；跨空间复用锚点组需要未来跨空间锚点命名空间（retain-next）。
- **table-range 与分页网格的坐标稳定性**：网格是分页+虚拟化的，锚点存绝对行列号（owner 数据坐标）而非视口坐标；分页/排序由 owner query 决定时锚点跟随数据坐标（owner-provided rowKeys）。
- **docx diff 粒度粗**：sanitized 片段对比先行，精确 XML 级 diff 留给领域 owner。
- **agent 滥用 directive（高频 focus/highlight）**：directive 节流（同 anchor 1s 合并）+ 预算上限。

## 分期

- P0 合同：`table-range` 锚点 + `SpaceDirectiveV1`/`SpaceProposalV1` 校验（零依赖 headless + 测试）。
- P1 空间壳：`interaction.space` view 注册、锚点栏、时间线骨架、格式渲染器 `data-source-*` 提示。
- P2 对话层：session attach/fork + composer 锚点附着 + 主选择不变量测试。
- P3 提案层：directive 渲染、per-format diff 投影、审批、owner dispatch + receipt 时间线。
- P4 收口：预算/围栏/漂移协调、preset、README、bundle。
