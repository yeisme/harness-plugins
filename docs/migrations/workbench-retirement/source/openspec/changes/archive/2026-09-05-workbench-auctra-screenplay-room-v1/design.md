## Context

Workbench 的 `/agent` 已冻结为 Agent-first shell：conversation/composer 是锚点，Spatial Focus 提供中央专业 surface 与单一 context rail，TaskService/ProposalAuthority 负责 mutation/decision/receipt。Auctra owner 目前在 `owner-backend-integrations` 中保持 `needs_contract`，`AuctraScreenplayPane` 只能显示 metadata/fixture，不具备正式编剧室投影。

Auctra 新 change `cli/auctra/openspec/changes/auctra-screenplay-room-v1` 将发布 `auctra.screenplay_room.v1alpha1`、exact owner discovery、双时间轴、Scene Card、Context Graph、structure/story-time mutation、receipt/status/reconcile 和只读 Viewer。本 change 只消费这些公开合同，不解析 Auctra 私有 DB/文件，也不复制 screenplay/Story Graph/review 状态机。

用户与成功行为已经确认：个人编剧/OPC 在桌面完成一个 Scene 的结构重排、Scene Card/Beat 编辑、全量可达图谱检查、单场正文保存和 review submit；短剧与电影是首批 reference profiles。移动端只承担浏览与审阅。

## Goals / Non-Goals

**Goals:**

- 将 Screenplay Room 作为 Creative Production 的 Spatial 专业子模式，不新增并列主壳。
- 以叙事顺序 + 故事时间双轨和四级语义缩放提供长篇结构感。
- 让所有 durable action 经过 Auctra owner contract、TaskService、expected revision、idempotency 和 receipt。
- 使用统一 design-system、icon registry、i18n、truthful state 和无障碍规则解决当前图谱的视觉/交互分叉。
- 提供真实 Auctra loopback read/mutation/reconcile canary 与 browser evidence。

**Non-Goals:**

- 不把 Auctra 页面 iframe/复制进 Workbench，不读取 `.auctra/**`、SQLite 或 connection file。
- 不在浏览器推理 hierarchy、story time、Scene Contract readiness、allowed action 或 Canon。
- 不做多人 presence、评论协作、完整全稿排版、制片排期、Storyboard/shot 编辑或图片生成。
- 不让 Agent presentation intent、Canvas drag preview 或 local cache 直接成为 owner mutation。
- 不在 `<1024px` 挂载完整 drag/editor renderer。

## Decisions

### 1. Screenplay Room 是 Creative Production 的专业主面

不新增 `/screenplay` route，也不把工作区塞进普通 Pane。`SpatialSurface` 在经过 closed ingress 和 capability negotiation 后，将中央 renderer 切换为 `ScreenplayRoomSurface`；Agent conversation/composer、session、Task/Proposal 和 context rail 仍由现有 shell 持有。

为避免扩大已发布 `SpatialLensKind`，v1 继续使用 `creative_production` Lens，并增加 closed `creativeSurface=screenplay_room` 参数/descriptor。未知值 fail closed；旧 consumer 不理解该 optional 参数时继续显示现有 Creative Production surface。

### 2. Auctra connector 复用 OwnerService，不建旁路 BFF

新增 `service/internal/owners/auctra`，启动时从 `WORKBENCH_AUCTRA_URL` 读取 loopback owner discovery。connector 验证：

- URL 只能是 `localhost/127.0.0.1/[::1]`，拒绝 userinfo/query/fragment/redirect；
- `auctra.workbench.owner.v1` major、schema digest、event digest、auth audience 与 selected operation schema；
- content type、response bytes、safe refs、forbidden fields 和 stable error mapping；
- capability 为 `needs_contract` 时绝不探测 endpoint 推断 available。

读面进入 OwnerService；写面由 TaskService 调用 selected owner operation。浏览器只访问 Workbench BFF/SDK，不接触 Auctra URL 或 bearer token。

### 3. SDK 只发布 normalized Workbench view model

新增 `AuctraScreenplayRoomClient`，包含：

```text
getRoom / getScene / getContextPage / watchRoom
applyStructure / undoStructure / applyStoryTime
saveSceneCard / submitSceneCard
getReceipt / getOperationStatus / reconcileOperation
```

raw owner payload 先经 service connector schema 校验，再映射为 SDK DTO。SDK normalizer 拒绝未知 required enum、路径/URL、超限正文、无 owner/version/digest 的对象，以及 action descriptor drift。optional unknown 字段可忽略；unknown enum 映射为 truthful `unknown`/`needs_contract`，不得猜测。

### 4. 主布局是上下同步双轨与单一 context rail

默认结构模式：

```text
Screenplay Room toolbar
├── Narrative-order track（可拖拽）
├── Story-time track（锚点/关系）
└── Context rail
    ├── Scene
    ├── Graph
    ├── Review
    └── Evidence
```

双轨共享 Scene selection、horizontal viewport 和语义缩放，但 mutation 语义完全分开：上轨拖拽提交 structure patch；下轨拖拽/编辑提交 story-time patch，绝不互相改写。

四级语义缩放：

1. 项目/季或全片：集/幕、Scene 数、时长/状态趋势；
2. 集/幕/Sequence：Scene 紧凑卡与冲突标记；
3. Scene：Scene Card 摘要、人物/地点、story-time、review/blocker；
4. Beat：选中 Scene 内 Beat 子轨、turn/state change 与顺序。

缩放改变 renderer detail，不改变 owner data。筛选/search/focus 只改变 UI projection。

### 5. Scene 卡与图片遵循“内容证据，不是装饰”

默认 Scene 卡只显示：ordinal/title、scene function、primary character/location、story-time label、state delta、review/freshness、blocker count 和 optional authorized thumbnail。完整 goal/obstacle/stakes/turn、knowledge、setup/payoff、evidence 和技术 refs 进入 context rail。

只显示 Auctra projection 标注的 accepted/candidate media role。accepted 可作 40–56px thumbnail；candidate 只在 detail/asset context 中带状态展示。缺图使用首字母 + semantic icon，禁止假人物头像、大图背景铺满卡片和浏览器自动生成。

新增 icon token 映射必须进入受控 Workbench registry，例如 Scene、Beat、Episode/Act、Sequence、Character、Location、Knowledge、Obligation、Setup/Payoff、Time Conflict。新组件不得直接 import 任意 Lucide 图标作为业务语义，也不得接受 server component/icon name。

### 6. 拖拽只 preview，receipt 才确认

pointer move 只更新 local ghost placement；pointer-up 构造 Auctra operation request，经 SDK → TaskService → connector 提交。UI 状态：

```text
idle → dragging → submitting → confirmed
                        ├→ version_conflict
                        ├→ unknown_accept
                        ├→ permission/offline/needs_contract
                        └→ failed
```

`confirmed` 必须来自 owner receipt/refetch。version conflict 保留 local intent summary，刷新 server truth 后显示 compare/reapply 动作；unknown_accept 只允许 original operation reconcile。用户关闭 Pane/切换模式不取消已提交 Task，也不把 ghost 当保存成功。

所有 drag 都有非拖拽替代：Move 菜单、父级选择、before/after position 与归档/恢复按钮。键盘选择不自动 attach composer。

### 7. Context Graph 全量可达但默认聚焦

选择 Scene 后先请求 direct context page，中央/rail 显示人物、地点、知识、义务、setup/payoff 和状态变化。用户可按 domain、search、hop 或“查看全局”继续拉取 cursor page。全量可达不等于首屏全显。

Graph 选择只更新 shared selection 与 timeline occurrence highlights；它不移动/重排 Scene，不创建 Context Pack，也不写 composer。点击“加入上下文”才显式 attach safe refs。

### 8. 专注写作复用正文 owner surface

Scene rail 提供“打开正文”。进入 focus mode 后中央换成单场 Fountain/plain-text editor，顶部保留压缩 timeline strip、Scene title/version/save state 和返回按钮；Graph/Review/Evidence 继续在 context rail。

正文 load/save/submit 复用 Auctra `text.draft.open/save/submit`。浏览器只保留当前未提交 buffer；save 要求 expected version。冲突时保留本地 buffer，显示 server/current diff 入口；reload 前不得宣称恢复。Scene Card 与正文有独立 dirty/version 状态，不能用一次保存覆盖两者。

### 9. Agent 建议保持 proposal-first

Agent 可返回已协商的 `preview_change_set`，UI 在时间线/Scene Card/正文显示 ghost/diff。只有用户显式打开 Review 并接受当前 proposal，ProposalAuthority 才重载 capability、basis、target revision 和 Auctra descriptor，再创建 Task。presentation-only intent 不得写 structure、story time、Scene Card、正文或 composer。

### 10. Responsive、性能与可用性

- `>=1440px`：双轨主面 + 可并排 Scene/Graph context；focus editor 宽度优先。
- `1024–1439px`：双轨主面 + 单 tabbed context rail；仍可创作。
- `<1024px`：不挂载 drag/full editor，改为虚拟化 Scene list、时间摘要、Scene detail、review/approve 和 owner state。
- 200% effective width 使用同一 mobile/review 降级，不产生 page-level overflow。

时间线使用现有 React/CSS/virtualization 能力，不新增 canvas/graph 库。Context Graph 优先复用现有 Spatial/Pixi 或已批准 graph renderer；只有真实性能证据证明不足时才讨论依赖。首屏、拖拽提交前 UI feedback、selection/filter 和 large fixture 都有明确预算与 profiler evidence。

## Risks / Trade-offs

- [Creative Production 已有多个 section，Screenplay Room 再叠加会拥挤] → Screenplay Room 是 closed 专业主面，不与 Show Home/OPC package 长列表同时挂载；通过 surface descriptor 切换。
- [单 room revision 导致频繁 conflict] → v1 明确单人 OPC；保留 local intent compare，真实协作需求出现后再升级分片 revision。
- [Focus editor 与 Agent conversation 争空间] → focus mode 只替换 Spatial 中央 surface，不卸载 conversation/composer；窄屏进入 review-only。
- [全图导致重新拥挤] → direct-first、cursor、domain filter、semantic zoom 和 occurrence highlight；不在 Scene 首屏渲染全量节点。
- [图片缺失令 UI 再次出现廉价 placeholder] → fallback 只用 typography/initial/icon；accepted/candidate role 分层，不造假头像。
- [Owner response 丢失造成重复 mutation] → TaskService 保留 original idempotency/operation identity，unknown_accept reconcile-only。

## Migration Plan

1. 先由 Auctra provider change 生成并验证 owner manifest/OpenAPI/TypeScript、schema digest 与 fixture。
2. Workbench 新增 connector/SDK/registry，但 capability 默认 `needs_contract`，UI 显示 truthful unavailable。
3. 用 provider-free contract fixture 实现 Screenplay Room UI prototype，冻结 1440/1024/390 screenshot 与 interaction acceptance；fixture 明示非 live。
4. 接入真实 loopback Auctra read/events，完成 short-drama/feature projections。
5. 只为 selected structure/scene-card/text operations开启 mutation canary，验证 receipt/status/reconcile/rollback 后再翻转对应 capability。
6. 保持旧 Creative Production/Pane/Spatial renderer 与 Auctra metadata Pane；feature flag 关闭时仅隐藏 Screenplay Room，不删除任何 owner state、Task、receipt 或 layout。

新增 surface 全部 additive，无 deprecation window。rollback 为：关闭 capability/flag、停止 connector dispatch、保留 last-confirmed safe projection 与 owner receipts，并回到旧 Creative Production + Auctra metadata Pane。

## Open Questions

无阻塞性开放问题。精确 card width、zoom threshold、thumbnail crop 和 animation timing 由真实短剧/电影 prototype 决定，但必须落在既有 token、motion、accessibility 和 owner contract 内；不得以视觉调参改变字段语义或写入规则。
