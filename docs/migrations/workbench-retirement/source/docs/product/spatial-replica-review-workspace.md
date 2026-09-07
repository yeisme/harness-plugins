# Spatial Replica Review Workspace 产品需求文档

> 状态：设计基线，未实施
> OpenSpec：`workbench-spatial-replica-review-v1`
> 产品 owner：Yeisme Workbench
> Canonical domain owners：Anatomia（视频证据）、Auctra（剧本）、Scaena（分镜、ReplicaStage、动作与生产编译）

## 1. 产品结论

Spatial Replica Review Workspace 是 Workbench `/agent` 主壳内的一组专业 Pane，不是新的 Replica Studio，也不是第四个空间复刻系统。

它解决的是“跨 owner 同屏核对与受控操作”：用户在一个 episode/shot 上同时查看源视频、灰度/深度/mask/flow/skeleton/camera 证据、Scaena 白模与人物动作、optional Auctra 剧本、分镜状态和 owner receipts，并把修正、review、freeze、reconcile 送回正确 owner。

Workbench 只拥有：

- 页面组合、Pane layout、播放游标、overlay 显隐、3D camera、selection；
- 未提交 typed edit draft；
- server-authored safe projection、Task/proposal/receipt 的展示与恢复；
- 一个 workspace event stream；
- same-origin media preview 和浏览器 renderer。

Workbench 不拥有：

- 视频 evidence、analysis revision 或 EvidenceSnapshot；
- screenplay、storyboard、SceneGEO、ReplicaStage、motion、completion 或 frozen stage；
- Provider/model runtime、生成队列、复刻视频、ProductionGraph/EditTimeline；
- “一比一”或 production-ready 的自行判定。

## 2. Owner-fit 决策

| 能力 | 判定 | canonical owner | Workbench 角色 |
| --- | --- | --- | --- |
| 视频、帧、PTS、灰度、深度、mask、flow、skeleton、camera evidence | split-owner | Anatomia | 同步播放、安全投影、inquiry 与 correction 入口 |
| 剧本 scene/beat/line 与 canonical screenplay | split-owner | Auctra | 独立安全 Pane、版本/currentness、approved actions/deep link |
| 分镜、SceneGEO、ReplicaStage、人物占位、白模、动作 retarget | split-owner | Scaena | 3D/timeline renderer、Inspector、typed actions |
| completion candidate 与 production override | split-owner | Scaena | 比较、选择意图、receipt/currentness 展示 |
| review/freeze | split-owner | 对应 domain owner；ReplicaStage 为 Scaena | confirmation、Task/proposal、owner receipt、reconcile |
| 空间问答 | split-owner | Anatomia inquiry | 输入/答案 UI、证据回链；不保存推理状态 |
| 跨 owner episode 工作区 | fit | Workbench | 安全 exact composition 与统一交互 |
| 复刻视频生成、镜头合成、ProductionGraph promotion | reject-now for Workbench | Scaena | 后续 owner handoff/receipt/deep link |
| 自由 mesh sculpt / DCC | reject-now | 专业 DCC 或未来 Scaena surface | 不在 Workbench 复制 |

## 3. 用户与核心任务

### 3.1 主要用户

- 导演/主创：判断场景、机位、人物占位和动作是否忠于参考视频。
- 分镜/预演艺术家：将 evidence 转成可编辑白模、camera、blocking 和动作约束。
- 动画/动作团队：核对 source motion、target rig retarget、contact 与 occlusion。
- VFX/虚拟制作团队：审阅 metric/scale claim、camera path、control passes 与空间关系。
- 审片/制片负责人：查看版本、quality、limitations、review/freeze receipt 和异常恢复。
- Agent 操作者：在不越权的前提下提出 evidence correction、completion 或 review proposal。

### 3.2 Jobs to be done

1. 当我看到某个视频镜头时，我要知道哪些空间/动作信息来自证据、哪些是补全候选、哪些已经生产覆写、哪些已冻结。
2. 当二维视频与三维白模不一致时，我要在同一 PTS 上对比 source、overlay、camera、actor pose 和 timeline event。
3. 当 evidence 不足时，我要看到 unknown 和 claim limitation，而不是被“看起来合理”的 3D 模型误导。
4. 当我要修正 evidence 或 stage 时，我要确认正确 owner、base version、diff、风险和 receipt，不重复提交。
5. 当 owner offline、stale 或 response 丢失时，我要继续审阅可验证部分，并知道如何 reconcile。

## 4. 产品对象与真相层级

### 4.1 Workspace identity

一个工作区以以下 identity 打开：

```text
workspace_ref
  -> project_ref
  -> episode_ref
  -> shot_ref
  -> source_media_ref + PTS map
```

显示名、列表位置和 Workbench local grouping 都不能代替 owner ref。一个 shot 可以没有 Auctra screenplay，但不能在 `screenplay_driven` 模式下静默忽略已绑定 screenplay version。

### 4.2 四层真相

| 层 | 含义 | 典型内容 | 能否覆盖 Evidence |
| --- | --- | --- | --- |
| Evidence | Anatomia 从视频观察/分析得到的可追溯事实与 unknown | depth、mask、flow、skeleton、camera、contact、occlusion | 否 |
| Candidate | 模型或规则提出、尚未成为生产选择的补全 | occluded geometry、rig candidate、motion completion | 否 |
| Production Override | Scaena 为制作选择的明确覆写 | selected completion、proxy adjustment、retarget settings | 不删除 Evidence；并列显示差异 |
| Frozen | owner review/freeze receipt 确认的版本 | frozen ReplicaStage/motion/control pass manifest | 只冻结该 owner version，不把 unknown 变成已知 |

### 4.3 Claim ladder

Workbench 只显示 owner 声明的 claim，不自行升级：

| Claim tier | 可表达内容 | 最低条件 |
| --- | --- | --- |
| `visual_reference` | 视觉近似、构图/轮廓参考 | source/preview 可追溯 |
| `relative_spatial` | 前后、左右、遮挡、相对大小与相对运动 | 稳定 coordinate frame + evidence quality |
| `metric_approximate` | 带误差/区间的近似距离、尺度、camera movement | calibration/known-scale input + uncertainty |
| `metric_verified` | 在声明范围内可验证的 metric replica | owner-approved capture profile、quality gate、review receipt |
| `production_frozen` | 指定 Scaena stage/motion version 已冻结 | Scaena immutable freeze receipt；不自动代表最终视频质量 |

“一比一复刻”只能作为 `metric_verified` 的用户可见解释，并必须同时显示 claim scope、误差/容差、时间范围、坐标系、证据 lineage 和 limitations。视觉看起来相似、模型生成成功或 GLB 可打开都不满足该条件。

## 5. Episode 工作区信息架构

```text
/agent
├─ Conversation anchor + composer
├─ Episode / shot navigator
├─ Spatial Replica main Pane
│  ├─ Source player + evidence layers
│  ├─ ReplicaStage viewport
│  ├─ PTS/event timeline
│  └─ selection/status strip
├─ Spatial Replica Inspector Pane
├─ Auctra Screenplay Pane
├─ Scaena Storyboard / ReplicaStage Pane
└─ Owner Receipt Pane
```

主 Pane 优先回答“此刻 source 与 stage 是否一致”；Inspector 回答“这个对象/结论是什么、来自哪里、允许做什么”；owner Pane 回答“canonical owner 当前怎么说”；receipt Pane 回答“动作到底发生了吗”。

Pane 是可组合视图，不是多个应用嵌入。Workbench 不 iframe owner 私有页面，也不让 Pane 各自建立 owner connection。

## 6. 核心体验

### 6.1 打开一个 shot

1. 用户从 episode/shot navigator 选择 exact owner ref。
2. Workbench server 获取各 owner safe projection，验证 scope/contract/version/digest。
3. UI 先显示每个 segment 的 loading/current/partial/stale/offline，而不是等待“全有或全无”。
4. Source 与 PTS map ready 后可播放；stage 未 ready 时 3D 区域显示 truthful state。
5. Workspace stream 只推送 safe freshness、availability、Task 与 receipt 更新。

### 6.2 同步审阅

- Source video 是时间主控，confirmed PTS 来自媒体帧 callback。
- Overlays、3D pose、timeline 通过 owner PTS map 解析到同一 interval。
- VFR、cut、gap 或无法确认的帧进入 `sync_degraded`；不使用 `time × fps` 伪造同步。
- 用户可逐帧、跳 event、搜索 actor/joint、选择 overlay/3D object，并在 Inspector 看 provenance。
- Depth preview 只用于显示；数值问答必须使用带 coordinate/unit/provenance 的 numeric artifact。

### 6.3 审阅人物占位、白模与动作

Viewport 首批只负责：

- camera frustum/path；
- ground/scene proxy；
- actor placeholder 与 silhouette/bounds；
- skeleton/rig pose；
- contact、occlusion、constraint/event；
- completion candidate ghost/summary；
- frozen/selected derivative 的只读展示。

它不是自由建模器。P1 编辑使用 typed fields，例如 transform keyframe、proxy dimension、retarget mapping、contact constraint、completion selection；提交前显示 owner、target、base version 与 diff。

### 6.4 空间问答

用户可以问：

- “人物 A 在 00:00:12.400 与桌面的距离是多少？”
- “这个遮挡区的深度是 evidence 还是 completion？”
- “源人物手部何时与门把手建立 contact？”
- “当前 stage 的 camera path 与 evidence camera 差异在哪里？”

答案必须带 Snapshot/bundle lineage、PTS/range、coordinate/unit、confidence、limitations 和 evidence refs。若只能回答相对关系，就不得输出 metric 数值；若 unknown，就明确 unknown。

### 6.5 修正、review 与 freeze

```text
UI intent
  -> current SpatialReplicaActionDescriptor
     (existing ActionDescriptorV1 + owner binding)
  -> visible diff + confirmation
  -> server revalidation
  -> TaskService / ProposalAuthority
  -> canonical owner
  -> owner receipt
  -> projection refresh / reconcile
```

- evidence correction 回到 Anatomia。
- stage/motion/completion/review/freeze 回到 Scaena。
- screenplay mutation 只在 Auctra 发布合同后开放。
- Agent intent 与高风险动作先经过 ProposalAuthority。
- receipt 前只显示 pending，不 optimistic 更新 canonical/Frozen。
- response 丢失时进入 `unknown_accept`，只 reconcile，不自动重提。

## 7. 两种 Scaena 工作模式

### 7.1 `reference_evidence`

- 必须绑定 Anatomia Snapshot/bundle 和 source/PTS identity。
- 可以没有 Auctra screenplay。
- 适合广告/参考片复刻、无剧本素材、动作/机位研究。
- UI 明确标记“Evidence-driven”，不显示 screenplay consistency claim。

### 7.2 `screenplay_driven`

- 同时绑定 Auctra screenplay version 与 Anatomia evidence。
- 可比较剧本意图、source evidence、storyboard 和 ReplicaStage。
- Auctra stale/offline 时保留 stage/evidence read，但禁用依赖 current screenplay 的动作。
- 不得静默退化为 `reference_evidence`。

## 8. Required capability ledger

| Capability | 优先级 | 本切片 | 验收层级 |
| --- | --- | --- | --- |
| episode/shot navigation | required | deliver | component + browser |
| exact multi-owner safe projection | required | deliver | Go/contract/security |
| source/evidence PTS playback | required | deliver | VFR sync fixture |
| synchronized ReplicaStage viewport | required | deliver | component + WebGL lifecycle + browser |
| camera/joint/keyframe/contact/occlusion timeline | required | deliver | virtualization + keyboard |
| four-layer Inspector/claim ladder | required | deliver | truth-state fixtures |
| Anatomia inquiry/correction | required | contract-gated | Task/receipt fixture |
| Scaena edit/review/freeze | required | contract-gated | Task/receipt fixture |
| Auctra screenplay Pane | required | metadata/text 依 owner contract | truthful availability fixture |
| Scaena storyboard/ReplicaStage Pane | required | deliver | owner fixture |
| receipt/reconcile Pane | required | deliver | cursor/gap/unknown fixture |
| persisted cross-device SavedView | optional | retain-next | separate expected-revision change |
| replica video generation | required overall | moved-owner | Scaena future change/runtime gate |

## 9. 场景矩阵

| Scenario id | 用户与 JTBD | 必需 artifacts | Gate/review | Evidence path | Export/handoff | Readiness |
| --- | --- | --- | --- | --- | --- | --- |
| `shot_blocking_reference` | 分镜师从参考视频还原 camera/人物占位 | source、PTS、mask/skeleton/camera、SceneGEO、ReplicaStage | sync、silhouette、contact、review | Anatomia Snapshot → Scaena stage refs | frozen stage/control passes | first-support |
| `screenplay_scene_previs` | 导演核对剧本意图与参考表演 | Auctra screenplay、evidence、storyboard、stage | screenplay version、evidence current、stage review | Auctra + Anatomia + Scaena tuple | Scaena ProductionGraph handoff | first-support |
| `motion_retarget_reference` | 动画师把参考动作映射到 target rig | source skeleton/motion、target rig、retarget settings、contacts | joint mapping、foot/hand contact、unknown | motion evidence → retarget receipt | frozen motion/control pass | exploratory |
| `metric_set_reconstruction` | 虚拟制作团队构建带尺度的场景 | calibrated depth/camera、known scale、stage geometry | metric claim、reprojection、scale tolerance | calibrated Snapshot + quality | metric-scoped stage export | exploratory |
| `camera_matchmove_review` | VFX 核对 camera solve 与代理场景 | camera evidence、feature/quality、proxy geometry | reprojection/currentness | camera bundle → stage camera | camera/control artifacts | exploratory |
| `video_replica_preflight` | 制片判断是否具备复刻视频条件 | frozen stage/motion、rights、quality、control passes | owner runtime/rights/promotion | receipts + manifests | Scaena video-generation change | exploratory; not implemented |

任何 exploratory 场景都复用同一 projection、Pane、Task/proposal、review/evidence 和 handoff 合同，不创建独立产品栈。

## 10. 状态与恢复

| 状态 | 用户看到 | 仍可做 | 禁止 |
| --- | --- | --- | --- |
| loading | owner/segment loading 与已到达部分 | 浏览已确认部分 | 将未加载内容视为 empty |
| partial | 哪些 segment current/offline/stale | 审阅 current segment | 依赖缺失 segment 的 action |
| stale | expected/current version 与 last confirmed | refresh、compare、打开 owner | 用旧 descriptor mutation |
| needs_contract | 缺少的 owner/version/capability | 查看 metadata/dependency | mock fallback 冒充 ready |
| permission_required/revoked | scope 与 recovery | 返回项目/请求权限 | 继续用已打开 dialog submit |
| sync_degraded | source 正常、哪些 layer/3D 无法确认 | 播放、跳到可确认 frame | 插值成 evidence claim |
| view_too_large | stage summary 与预算原因 | object list/deep link | 静默减几何后声称一致 |
| unknown_accept | 原 action、Task/idempotency 与 reconcile | reconcile、查看 receipt | retry 等价 mutation |
| WebGL unavailable | 原因、object/event list | source/timeline/Inspector/review | 空白 canvas 或整体不可用 |

## 11. Responsive 产品策略

- `>=1800px`：conversation + source/3D/timeline + optional Inspector/owner Pane；适合专业同步审阅。
- `1440–1799px`：主 Pane 内 Source/3D tabs + timeline，最多一个辅助 Pane。
- `1024–1439px`：Replica 进入 labelled Sheet，Source/3D/Timeline/Inspector tabs。
- `<1024px`：不挂完整 3D editor；提供 player、event/object list、selection summary、review/reconcile 和 owner deep link。

移动端不是 production edit 环境，但必须能完成审阅、批准、拒绝、reconcile 和查看证据来源。

## 12. Definition of Usable

P1 只有同时满足以下条件才可称为“本地可用纵切”：

1. 一个 deterministic local shot fixture 能在 `/agent` 打开。
2. Anatomia/Scaena/Auctra segment 独立显示 current/partial/offline/needs_contract。
3. VFR source、overlay、3D 与 timeline confirmed drift 不超过一个 source frame，或明确 `sync_degraded`。
4. 用户能通过 keyboard 选择 actor/joint/event，在 Inspector 看到 four-layer truth 与 claim limitation。
5. WebGL failure 后 source/timeline/object list/review 仍可用。
6. 一个 Anatomia correction 和一个 Scaena review/freeze fixture 经 descriptor→Task/proposal→receipt/reconcile 完成，且无 optimistic canonical update。
7. duplicate 与 unknown accept 不产生第二次 owner mutation。
8. 五个 viewport 的响应式、Axe、screenshot 与 resource disposal evidence 完整。
9. 所有 evidence 明确标注 local fixture；没有 Provider、真实 owner runtime 或 production claim。

## 13. 成功信号与非目标指标

首批只采集本地/可控环境指标：

- 打开 shot 到 first usable source / first 3D frame；
- confirmed sync drift；
- selection feedback；
- action conflict/duplicate/unknown reconcile 成功率；
- WebGL/resource cleanup；
- partial/offline 时仍可完成的审阅路径；
- keyboard/Axe/zoom/viewport coverage；
- bundle/heap/frame-time p50/p95。

这些数据用于发现瓶颈，不构成 production SLO。真实用户效率、复刻质量、metric accuracy、rights 和生成成本必须由 owner runtime/canary 单独证明。

## 14. Rollout 与 rollback

Rollout 以 capability 分层：

1. projection read only；
2. source/overlay/timeline；
3. lazy 3D viewport；
4. inquiry 与 owner Panels；
5. Anatomia correction；
6. Scaena stage/motion action；
7. review/freeze；
8. exact-principal local canary。

每层 default-off。Rollback 关闭对应 server capability、停止 workspace stream、清理 browser cache/draft/Three resources，回到普通 `/agent`。既有 Task/proposal/receipt 与 owner canonical state 保留；没有 destructive migration。

## 15. 依赖与未证明项

- Anatomia 必须发布 source/PTS/evidence/inquiry/correction 的 safe contract。
- Scaena 必须发布 ReplicaStage safe projection、action/review/freeze/receipt 和 browser budget。
- Auctra screenplay Pane 展示深度由其 Service API 决定。
- Replica video generation 依赖后续 `scaena-replica-video-generation-v1`，不属于 Workbench。
- 本 PRD 不证明真实 Provider、世界模型、图片/视频模型、真实人物授权、metric 一比一、生产运行或跨 owner live integration。
