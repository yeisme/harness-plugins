# Spatial Replica Review Workspace UI Spec

> 状态：设计基线，未实施（OpenSpec change `workbench-spatial-replica-review-v1` task 0.3 冻结，2026-09-01）
> Surface：`agent.spatial-replica.v1` 及四个辅助 Pane
> 产品合同：[Spatial Replica Review Workspace PRD](../product/spatial-replica-review-workspace.md)
> 前后端合同：[Spatial Replica Review contract](../interfaces/spatial-replica-review.md)
> OpenSpec：[proposal](../../openspec/changes/archive/2026-09-02-workbench-spatial-replica-review-v1/proposal.md) · [design](../../openspec/changes/archive/2026-09-02-workbench-spatial-replica-review-v1/design.md) · [tasks](../../openspec/changes/archive/2026-09-02-workbench-spatial-replica-review-v1/tasks.md) · [字段级合同冻结](../../openspec/changes/archive/2026-09-02-workbench-spatial-replica-review-v1/details/02-contract-freeze.md) · [capability truth table](../../openspec/changes/archive/2026-09-02-workbench-spatial-replica-review-v1/details/04-capability-truth-table.md) · [fixture/依赖预算](../../openspec/changes/archive/2026-09-02-workbench-spatial-replica-review-v1/details/05-p1-fixture-dependency-budget.md)
> Spec deltas：[workspace-projection](../../openspec/changes/archive/2026-09-02-workbench-spatial-replica-review-v1/specs/spatial-replica-workspace-projection/spec.md) · [synchronized-review](../../openspec/changes/archive/2026-09-02-workbench-spatial-replica-review-v1/specs/spatial-replica-synchronized-review/spec.md) · [owner-actions](../../openspec/changes/archive/2026-09-02-workbench-spatial-replica-review-v1/specs/spatial-replica-owner-actions/spec.md) · [owner-panels](../../openspec/changes/archive/2026-09-02-workbench-spatial-replica-review-v1/specs/spatial-replica-owner-panels/spec.md) · [responsive-accessibility](../../openspec/changes/archive/2026-09-02-workbench-spatial-replica-review-v1/specs/spatial-replica-responsive-accessibility/spec.md)

## 1. 设计目标

空间复刻 UI 必须让用户在一眼内回答五个问题：

1. 我正在看哪个 episode/shot/source/PTS？
2. 当前画面中哪些是 Evidence、Candidate、Production Override、Frozen？
3. 二维证据、三维 stage、动作与 timeline 是否同步？
4. 当前结论允许声称视觉、相对、近似 metric 还是 verified metric？
5. 如果我要修改或批准，它会回到哪个 owner，是否真的成功？

页面模式是 `artifact browser + synchronized player/viewport + evidence timeline + inspector`，嵌入现有 `/agent` shell。它不是 dashboard、DCC、卡片墙或独立 Studio。

## 2. 视觉基线

继承顺序：

1. `docs/product/agent-workbench-blueprint.md`
2. `docs/ui/agent-first-workbench.md`
3. `docs/design/agent-visual-language.md`
4. `docs/design/design-system-unification.md`
5. 本 Pane-specific UI Spec

### 2.1 Surface hierarchy

```text
canvas       --wb-surface-canvas
rail         --wb-surface-rail
pane         --wb-surface-panel
popover      --wb-surface-elevated
selection    --wb-accent-tint + focus ring
```

- Pane container：`--wb-radius-panel`（12px）+ subtle border。
- Button/input：`--wb-radius-control`（10px）。
- Chip/badge：`--wb-radius-sm`（6px）。
- Dialog/Sheet/popover：`--wb-radius-overlay`（14px）。
- Pill 只用于 Switch/小状态，不做大胶囊 CTA。
- 主区域通过分隔线、spacing 与 typography 建层级，不把每个信息块包成圆角卡片。

### 2.2 Color semantics

| 语义 | 表达 |
| --- | --- |
| Evidence | neutral/cyan-tint + `Evidence` 文本 |
| Candidate | amber-tint + `Candidate` 文本 |
| Production Override | blue/accent-tint + `Production Override` 文本 |
| Frozen | green-tint + lock icon + frozen receipt/version |
| Unknown/insufficient | purple/contract tint + explicit unknown text |
| stale/offline/error | 状态色点或细线 + 文本，不铺满大色块 |
| current selection | accent tint + 2px focus/selection outline |

状态不能只靠颜色。所有 layer/object/event 都同时显示 icon、label 或 accessible description。

### 2.3 Typography and density

- Episode/shot/title：UI sans medium。
- PTS、version、digest、refs、coordinate、unit：mono/tabular nums。
- Timeline track 行高：compact 28–32px；可交互 target 仍为 44px 触控盒。
- Inspector label/value 优先两列或 definition list；长 provenance 用可换行 mono，不横向撑开 Pane。
- 默认密度专业、克制；用户不需要“电影感”装饰背景来相信 3D 数据。

### 2.4 禁止模式

- 不创建 hero、欢迎页、渐变宇宙背景或大面积玻璃效果。
- 不使用“一个指标一张卡”的 dashboard wall。
- 不用漂亮的 3D render 掩盖 unknown、stale 或低质量 evidence。
- 不以红绿颜色单独表示通过/失败。
- 不把 owner private page iframe 成 Pane。
- 不在手机上缩放出不可操作的完整 DCC。
- 不在 receipt 前把按钮/模型显示为已完成或已冻结。

## 3. Information architecture

### 3.1 Main Pane regions

```text
SpatialReplicaPane
├── ReplicaScopeBar
│   ├── Episode/Shot breadcrumb + selector
│   ├── mode / composition freshness
│   ├── capture/scale/claim summary
│   └── Pane actions / owner availability
├── ReplicaReviewSplit
│   ├── SourceEvidenceRegion
│   │   ├── SourcePlayer
│   │   ├── LayerToolbar
│   │   └── FrameStatusOverlay
│   └── ReplicaViewportRegion
│       ├── ReplicaViewportCanvas
│       ├── ViewportToolbar
│       ├── ObjectAccessibilityMirror
│       └── ViewportStatusOverlay
├── ReplicaTimelineRegion
│   ├── PlaybackControls / PTS
│   ├── TrackHeader
│   ├── VirtualizedTracks
│   └── EventAccessibilityList
└── ReplicaSelectionStrip
    ├── selected ref / truth badge
    ├── quick metrics/limitations
    └── Open Inspector / Inquiry / Review
```

### 3.2 Auxiliary Pane regions

```text
SpatialReplicaInspectorPane
├── SelectionHeader
├── TruthLayerTabs or stacked sections
├── ProvenanceAndClaim
├── QualityAndLimitations
├── SpatialInquiry
└── TypedDraftAndOwnerActions

AuctraScreenplayPane
├── OwnerTruthHeader
├── Scene/Beat/LineTree
├── CurrentSelectionBinding
└── Review/DeepLink/Availability

ScaenaStoryboardPane
├── OwnerTruthHeader
├── ModeAndBindings
├── Storyboard/SceneGEO/ReplicaStage tabs
├── Motion/Completion/Freeze status
└── AllowedActions

OwnerReceiptsPane
├── ReceiptFilters
├── Workspace/OwnerCursorStatus
├── ReceiptTimeline
└── SelectedReceipt / Reconcile
```

## 4. Wireframes

Wireframe 表示信息优先级，不规定像素级成品。

### 4.1 Wide desktop `>=1800px`

```text
┌──────────────┬────────────────────────────┬────────────────────────────────────────────────────────────┬──────────────────────┐
│ Session rail │ Conversation               │ Spatial Replica main Pane                                  │ Inspector / Owner    │
│              │                            │ ┌──────────────── scope / truth / freshness ──────────────┐ │ Pane                 │
│ Episode A    │ User / Agent turns         │ │ Ep 03 / Sh 017  reference_evidence  relative  current   │ │ Evidence             │
│ ├ Sh 016     │                            │ ├──────────────────────────┬──────────────────────────────┤ │ Candidate            │
│ ├ Sh 017 ●   │                            │ │ SOURCE VIDEO             │ REPLICA STAGE                │ │ Override             │
│ └ Sh 018     │                            │ │ depth · mask · skeleton   │ camera · proxy · actors      │ │ Frozen               │
│              │                            │ │                          │                              │ │                      │
│ Owner status │                            │ │ [frame / limitation]     │ [object / WebGL status]      │ │ Claim / Quality      │
│ Ana current  │                            │ ├──────────────────────────┴──────────────────────────────┤ │ Inquiry              │
│ Sca current  │                            │ │ ▶ 00:00:12.400   camera actor joint contact occlusion   │ │ Draft diff           │
│ Auc offline  │ Composer                   │ │ [virtualized multi-track timeline]                       │ │ Owner actions        │
└──────────────┴────────────────────────────┴────────────────────────────────────────────────────────────┴──────────────────────┘
```

Rules：

- Conversation/composer 保持可见；Replica Pane 不成为独立 shell。
- Source 与 3D 同时可见，timeline 横跨两者，cursor 只有一个 confirmed PTS。
- Inspector/owner Pane 最多再开一个；更多通过 tabs/launcher 切换，hard limit 4。

### 4.2 Standard desktop `1440–1799px`

```text
┌───────────┬──────────────────────────┬───────────────────────────────────────────────┬──────────────────┐
│ Rail      │ Conversation             │ Replica main Pane                             │ Optional aux     │
│           │                          │ Scope / truth / freshness                     │ Inspector OR     │
│           │                          │ [ Source ] [ 3D ] [ Compare if space allows ] │ Owner Pane       │
│           │                          │ active visual region                          │                  │
│           │                          │ timeline                                      │                  │
│           │ Composer                 │ selection strip                               │                  │
└───────────┴──────────────────────────┴───────────────────────────────────────────────┴──────────────────┘
```

- Source/3D 是视图 tab，不改变 owner/current state。
- Timeline 始终保留；Inspector 可在 auxiliary Pane 或主 Pane内 tab 显示。

### 4.3 Tablet `1024–1439px`

```text
┌─────────────────────────────────────────────────────────────┐
│ /agent conversation + composer                              │
│                                                             │
│                     [Open Replica Review]                    │
└─────────────────────────────────────────────────────────────┘

                     labelled right Sheet
┌─────────────────────────────────────────────────────────────┐
│ Spatial Replica · Ep03/Sh017                         [Close] │
│ [Source] [3D] [Timeline] [Inspector] [Owners]               │
│ ─────────────────────────────────────────────────────────── │
│ selected tab content; no page-level horizontal overflow     │
│ fixed compact playback / PTS footer                          │
└─────────────────────────────────────────────────────────────┘
```

- Sheet 有 focus trap、Escape、scroll lock/restore。
- 关闭后 focus 返回真实触发器。
- 3D 只读 adapter 可按 client capability lazy mount。

### 4.4 Mobile `<1024px`

```text
┌──────────────────────────────┐
│ Replica · Sh017       [Close]│
│ current · relative · partial │
├──────────────────────────────┤
│ Source player                │
│ [depth] [mask] [skeleton]    │
│ 00:00:12.400  [−1f] [▶] [+1f]│
├──────────────────────────────┤
│ [Events] [Objects] [Inspect] │
│ Actor A · pelvis · Evidence  │
│ Contact @ 12.400             │
│ Unknown occluded right hand  │
├──────────────────────────────┤
│ Review / Reconcile / Owner ↗ │
└──────────────────────────────┘
```

- 不加载完整 Three editor/canvas。
- Objects 是 DOM list + current pose/relations summary。
- 仍能查看 claim、limitations、receipts，完成批准/拒绝/reconcile。

## 5. Component tree

```text
SpatialReplicaPane
├── ReplicaScopeBar
│   ├── EpisodeShotPicker
│   ├── ReplicaModeBadge
│   ├── OwnerFreshnessGroup
│   ├── ScaleClaimBadge
│   └── ReplicaPaneMenu
├── ReplicaViewTabs
│   ├── SourceEvidenceRegion
│   │   ├── EvidencePlayer
│   │   ├── EvidenceLayerToolbar
│   │   ├── EvidenceLegend
│   │   └── SyncStateBanner
│   ├── ReplicaViewportRegion
│   │   ├── ReplicaViewportMount
│   │   ├── ReplicaViewportToolbar
│   │   ├── ReplicaObjectTree
│   │   └── ViewportFallback
│   └── SideBySideCompareRegion
├── ReplicaTimeline
│   ├── TimelineTransport
│   ├── TimelineTrackList
│   ├── TimelineCanvas
│   └── TimelineEventList
└── ReplicaSelectionStrip

SpatialReplicaInspectorPane
├── InspectorSelectionHeader
├── TruthStack
│   ├── EvidenceSection
│   ├── CandidateSection
│   ├── ProductionOverrideSection
│   ├── FrozenSection
│   └── UnknownSection
├── ClaimAndQualitySection
├── ProvenanceSection
├── SpatialInquirySection
└── ReplicaActionSection
    ├── SpatialReplicaActionDescriptorList
    ├── TypedEditDraft
    ├── DiffReview
    ├── ConfirmationDialog
    └── PendingReceiptStatus
```

State ownership：

- React/query：projection、availability、Task/receipt、current server capability。
- Workspace reducer：PTS、tabs、layer visibility、selection、local camera、draft。
- `ReplicaViewportAdapter`：Three scene/render/picking/disposal；不拥有 domain state。
- Media controller：video element、confirmed PTS callback、seek/frame-step。
- Timeline model：virtualized visible window 与 exact PTS selection。

## 6. Control inventory

| 区域 / control | Primitive | State source | 激活结果 | Keyboard / failure |
| --- | --- | --- | --- | --- |
| Episode/shot picker | Select/Command | projection refs | load exact shot | Arrow/Enter/Escape；stale ref 不猜同名 |
| Owner freshness | Status group | owner segments | 打开 availability detail | button + popover；无 action side effect |
| Mode badge | Badge | Scaena projection | 只读说明 | 不可点击；screenplay stale 明示 |
| Scale/claim badge | Badge/Popover | owner claim scope | 查看单位/误差/限制 | Enter/Space；不自行升级 claim |
| Source play/pause | Button | media controller | 播放/暂停 | Space；media error 保留 frame/status |
| Frame step ±1 | Button | PTS map | 跳 exact adjacent source frame | Arrow shortcut；gap 进入 degraded |
| PTS input/jump | Input + Button | bounded local input | seek exact PTS | invalid 不 seek、不修改 state |
| Layer toggle | Toggle group | local presentation + manifest | 显隐 layer | label 包含 kind/currentness；unavailable disabled |
| Layer opacity | Slider/Input | local presentation | 仅显示改变 | keyboard arrows；不改变 evidence |
| Compare wipe | Slider | local presentation | source/layer visual compare | reduced motion 无动画 |
| Source/3D tabs | Tabs | local presentation | 切换 region | Arrow/Home/End；不 remount session |
| Orbit/pan/zoom | Canvas + toolbar | local camera | 改 display camera | toolbar/keyboard/menu 等价路径 |
| Fit selection/reset view | Button | selected ref/local camera | 定位 display view | unavailable 时解释 |
| Object visibility | Checkbox | local presentation | 显隐 proxy/object | DOM mirror 同步，不影响 owner |
| Object search/list | Combobox/listbox | stage safe objects | select exact owner ref | Enter/Arrow；canvas 不可用仍工作 |
| Timeline scrub | Slider/custom timeline | PTS map | seek confirmed cursor | Arrow/Page/Home/End；有文本值 |
| Track collapse | Button | local presentation | 展开/折叠 track | aria-expanded |
| Event row | Button | event ref/PTS | seek + select + inspect | Enter/Space；focus 可预测 |
| Open Inspector | Button | selected ref | registry open/focus Pane | limit reached 显式选择，不替换 |
| Ask about selection | Input + Button | user text/selected refs | Anatomia inquiry | pending 禁双击；结果证据化 |
| Typed edit field | Input/Select | descriptor schema + draft | 修改 local draft | invalid 保留 draft，不 submit |
| Review diff | Button | draft/base version | 打开 confirmation | descriptor stale 时 disabled |
| Submit direct action | Button/Dialog | current descriptor | server revalidation→Task | receipt 前不 optimistic success |
| Create proposal | Button/Dialog | descriptor/risk policy | ProposalAuthority | approval 不直接 mutation |
| Reconcile | Button | Task/idempotency/receipt | 查原 action | unknown only；不生成新 action |
| Owner deep link | Link descriptor | owner approved link | 新窗口/批准导航 | unsafe host/path 不渲染 |
| Pane close | Button | layout reducer | 处理 draft → close | Escape/return focus；不丢 dirty draft |

## 7. Source evidence region

### 7.1 Player chrome

- Controls 固定在 player 下缘，不覆盖关键 evidence label。
- 左侧：play/pause、frame step、timecode/PTS。
- 中部：scrubber、buffer、gap/segment marks。
- 右侧：playback rate、layer menu、fit/full region（不是浏览器全屏主壳）。
- Confirmed PTS 使用 mono/tabular nums；display timecode 与 exact PTS 可同时展开。

### 7.2 Layer legend

每个 active layer 显示：

```text
[icon] depth · Evidence · relative · current
Snapshot ana:snap:… · PTS 12.000–14.000 · limitation 1
```

- Preview-only 增加 `Display only`。
- Numeric artifact 可在 Inspector 显示 coordinate/unit/quality。
- Stale/partial layer 在 legend 和画面角标同时表达。
- Occluded/unknown 使用纹理/虚线 + 文本，不涂成确定区域。

## 8. 3D viewport

### 8.1 Visual grammar

- Evidence-derived proxy：实线 neutral/cyan edge。
- Candidate：半透明 amber ghost，默认不遮住 Evidence。
- Production Override：accent outline/handle，不用巨大控制 gizmo。
- Frozen：小 lock/version marker，不把整个 viewport 染绿。
- Unknown region：hatch/dashed volume 或缺口，legend 明确。
- Selected object：2px accent outline + DOM selection同步。

### 8.2 P1 viewport tools

- Orbit/pan/zoom、fit all/selection、front/side/top/camera view。
- Source camera / review camera switch。
- Proxy/object visibility 与 actor isolate。
- Skeleton/contact/occlusion/constraint visibility。
- Candidate ghost on/off 与 selected/frozen compare。
- Screenshot 只作为本地 visual evidence；不得包含 private ref/credential。

P1 不提供 mesh sculpt、vertex/face mode、material editor、arbitrary script、production lighting 或自由 rig editing。

### 8.3 WebGL fallback

Viewport 失败时替换为：

- error/currentness summary；
- searchable object tree；
- current pose/joint/relationship list；
- camera/scale/claim summary；
- jump-to-PTS/open Inspector/open owner actions；
- retry renderer（仅 renderer retry，不重提 owner action）。

空白 canvas 不允许。

## 9. Timeline

### 9.1 Track order

默认顺序：

1. Source/cut/gap；
2. Camera；
3. Actors；
4. Skeleton/joints（按 actor 折叠）；
5. Keyframes/motion；
6. Contact/constraint；
7. Occlusion/unknown；
8. Audio markers；
9. Quality/currentness；
10. Task/owner receipts。

用户可折叠/筛选，但 owner event 与 PTS identity 不变。轨道 virtualization 保留可访问 event list，不能只渲染 canvas pixels。

### 9.2 Cursor states

- `requested`：用户 seek target，细虚线。
- `confirmed`：媒体帧 callback 确认，主实线。
- `stage sample`：可验证 pose sample marker。
- `degraded`：当前 source PTS 无 exact layer/stage，对应区域显示 gap。

UI 不把 requested cursor 当 confirmed evidence frame。

## 10. Inspector

### 10.1 Header

```text
Actor A / right_hand
scaena:object:… · stage v17 · PTS 00:00:12.400
[Evidence] [Candidate 2] [Override] [Frozen —]
```

### 10.2 Truth stack

桌面宽 Pane 使用 stacked sections，窄 Pane 使用 Tabs + 永久可见 truth summary。

每层至少显示：

- layer name 与 currentness；
- owner/ref/version；
- PTS/range；
- coordinate/unit/scale；
- evidence/candidate/override/freeze lineage；
- quality/confidence；
- limitations/unknown；
- allowed action。

### 10.3 Claim panel

```text
Claim: relative_spatial
Allowed: left/right/front/behind, approximate motion direction
Not allowed: metric distance, one-to-one replica
Upgrade needs: calibrated scale + current camera solve + review receipt
```

不使用单个“可信度 87%”替代具体 scope、误差与限制。

### 10.4 Typed draft

Draft 区域顺序：

1. action/owner/target；
2. base version/currentness；
3. typed fields；
4. validation；
5. before/after diff；
6. risk/confirmation/Proposal requirement；
7. submit；
8. Task/receipt status。

Draft 始终标记 `Not submitted`。离开/关闭前出现 navigation-away guard；descriptor stale 后字段可读但 submit disabled。

## 11. Owner Panels

### 11.1 Auctra Screenplay

- Header：Auctra / screenplay ref/version/currentness。
- Tree：Scene → Beat → Line，仅显示 owner 允许的 text depth。
- Binding：当前 shot/storyboard/stage 关联 refs。
- Empty/metadata-only/needs_contract 必须是真实状态。
- 不抓取或 iframe 私有页面；approved deep link 独立标示 external owner。

### 11.2 Scaena Storyboard / ReplicaStage

- Header：mode、stage version、review/freeze、quality/currentness。
- Tabs：Storyboard、SceneGEO、ReplicaStage、Motion、Candidates、Receipts。
- `screenplay_driven` 显示 Auctra binding version；stale 时禁用依赖动作。
- `reference_evidence` 显示 evidence binding，不伪造 screenplay。

### 11.3 Receipts

每行显示：

```text
observed 12:40:03.210 · Scaena seq 1842
Freeze stage v17 · unknown_accept / reconcile required
Task wb:task:… · Receipt sca:receipt:…
```

排序可按 observed time 浏览，但 UI 明示非 global transaction order。Gap/late event 有独立 marker。

## 12. State matrix

| State | Main Pane | Inspector/actions | Owner/receipt Pane | Recovery |
| --- | --- | --- | --- | --- |
| loading | stable skeleton + arrived segment | disabled with reason | per-owner loading | wait/cancel navigation |
| empty | source/stage empty explanation | no fabricated selection | owner empty | open owner/create through owner if allowed |
| partial | current regions remain visible | only valid actions | unavailable segment explicit | refresh/open owner |
| stale | last-confirmed banner/version diff | submit disabled | stale owner segment | refresh projection |
| error | bounded error + last-confirmed content（单一 region 故障不遮蔽其他 segment） | dependent actions disabled with reason | pane 级 error + retry read | retry read / open owner deep link；不显示空白或伪造内容 |
| needs_contract | metadata/dependency card | unavailable descriptors | contract/version required | owner handoff/deep link |
| offline | last-confirmed if authorized | no dependent mutation | offline timestamp | retry connection |
| permission_required | no sensitive content | actions removed | bounded permission state | return/request access |
| revoked | clear media/renderer/draft | dialog closes/submit blocked | revoke event | safe focus return |
| sync degraded | source continues; layer/stage gap | limitation visible | evidence/stage currentness | seek confirmed PTS/refresh |
| view too large | viewport summary/object list | safe inspect only | Scaena budget info | owner deep link/reduced approved artifact |
| WebGL unavailable | source + object/event fallback | full truth/review remains | unchanged | retry renderer |
| duplicate action | pending marker | show existing Task | receipt highlighted | open existing Task |
| unknown accept | last-confirmed projection | only reconcile | original Task/receipt/gap | reconcile |
| limit reached | current panes unchanged | no auto replacement | choose close/replace | explicit user choice |
| navigation away | current shot retained | draft guard | unchanged | discard or cancel navigation |
| unsupported_version | pane 显示 unsupported + 合同版本要求 | unavailable descriptors | pane 级 unsupported 状态 | 升级 client / 打开 owner deep link；不隐式降级 renderer |

## 13. Responsive rules

| Breakpoint | Shell/Pane behavior | Replica content | 3D policy |
| --- | --- | --- | --- |
| `>=1800` | main Pane + one auxiliary Pane | source/3D side-by-side + timeline | full review adapter |
| `1440–1799` | main Pane + max one auxiliary | Source/3D tabs + timeline | lazy full review adapter |
| `1024–1439` | labelled Sheet | Source/3D/Timeline/Inspector tabs | read-only if capable |
| `<1024` | full-screen Sheet | player + events/objects/summary/actions | do not mount full editor |

Additional rules：

- 200% zoom 使用 reflow 后的下一档布局，不产生 page-level horizontal overflow。
- Pane content 自身可有 bounded internal scroll；body 不因 timeline/table 拉宽。
- Desktop complementary Pane 不 trap focus；modal Sheet/Dialog trap focus。
- Hard 4 Pane limit 在所有 breakpoint 不变，移动端一次只显示一个 modal Pane。

## 14. Accessibility contract

### 14.1 Landmarks and labels

- Main Pane：`region` + “Spatial replica review”。
- Source player、3D viewport、timeline、Inspector：各自 labelled region。
- Canvas 具有 accessible name/description，并关联 DOM object tree。
- PTS 使用可读 timecode，同时提供 exact value text。
- Status badge 的可访问名包含状态与 owner，例如 “Scaena stage stale, last confirmed …”。

### 14.2 Keyboard

Suggested default shortcuts（最终需检查与 Agent shell 冲突）：

| Key | 行为 |
| --- | --- |
| Space | play/pause（焦点不在 input 时） |
| Left/Right | previous/next source frame |
| Shift+Left/Right | previous/next event |
| Home/End | shot start/end |
| `/` | focus object/event search（不覆盖 composer focus） |
| Enter/Space | activate focused row/control |
| Escape | close current popover/dialog/Sheet，逐层返回 |

Shortcut 必须有菜单/tooltip 可发现；输入框内不抢键。

### 14.3 Focus

- Pane 打开：focus 到 Pane heading 或首个 meaningful control；自动 Follow/stream update 不移动 focus。
- Dialog：initial focus 放在标题后的首个安全 control，不默认放 destructive confirm。
- Dialog/Sheet 关闭：返回真实 trigger；trigger 不存在时回 Agent shell safe heading/Panes launcher。
- Owner revoke 卸载 active Pane：announce reason 后移动到 safe fallback。

### 14.4 Motion

- Pane/tab/focus transition 120–180ms；不以 camera 飞行动画作为必要导航。
- Timeline auto-scroll、camera fit、compare wipe 在 reduced-motion 下即时或最小运动。
- Playback 本身不是装饰 motion，但自动播放必须由用户显式开始。

## 15. Performance and resource budget

P1 fixture：1 shot、1–2 actors、browser-budgeted proxies/camera、最多 10 layer/track groups。

| Metric | Local gate | Failure behavior |
| --- | --- | --- |
| confirmed sync drift | `<= 1 source frame` | `sync_degraded` / test fail |
| selection feedback | visible `<100ms` | optimize picking/DOM update |
| repeated main-thread long task | no repeated `>50ms` during play/scrub | reduce render/timeline work |
| first 3D frame | record env + p50/p95, no production SLO | show loading/fallback |
| frame time | record p50/p95 | LOD/culling/proxy budget |
| bundle | Three in lazy spatial chunk only | block eager import |
| resources | disposed on close/switch/off/loss | block closeout |
| heap | no unbounded growth across repeated shot switches | investigate retained refs |

Stage 超预算时显示 `view_too_large`，不得通过不透明 silent decimation 通过性能 gate。

## 16. Screenshot and browser evidence matrix

| ID | Viewport | State | 必看内容 |
| --- | --- | --- | --- |
| `SR-01` | 1920×1080 | current, selected actor | source+3D+timeline+Inspector、four-layer labels |
| `SR-02` | 1440×900 | partial Auctra offline | Source/3D tab、timeline、owner partial truth |
| `SR-03` | 1280×800 | Sheet, stale stage | labelled Sheet、stale action disabled |
| `SR-04` | 768×1024 | tablet, WebGL failure | object list/timeline/Inspector fallback |
| `SR-05` | 390×844 | mobile substitute | no full 3D、review/reconcile/deep link |
| `SR-06` | 1920×1080 | dirty draft | owner/base version/diff/navigation guard |
| `SR-07` | 1440×900 | unknown accept | last-confirmed + original receipt + reconcile only |
| `SR-08` | 1440×900 | metric claim limited | allowed/not allowed/upgrade evidence |
| `SR-09` | effective zoom 200% | current | no page overflow、all critical controls reachable |
| `SR-10` | 1440×900 | reduced motion + keyboard | visible focus、no animated dependency |

每个 run 记录 fixture/contract version、viewport、browser、command、artifact path、console/network/Axe result。截图不得含 credential、private path、raw prompt、Provider payload 或真实敏感人物素材。

## 17. UI acceptance checklist

- [ ] 空间复刻只作为注册 Pane family 存在，conversation/composer/session 不被替换。
- [ ] Source/overlay/3D/timeline 使用同一 confirmed PTS，degraded 时 truthful。
- [ ] Evidence/Candidate/Production Override/Frozen/unknown 不依赖颜色且不互相覆盖。
- [ ] Claim panel 明确 allowed/not allowed/upgrade needs；不自行宣称一比一。
- [ ] Browser state 只有 presentation/draft；receipt 前无 optimistic canonical change。
- [ ] Auctra/Scaena/receipt Pane 独立显示 owner/version/currentness 与 unavailable state。
- [ ] WebGL loss、view-too-large、mobile 都有完整审阅替代路径。
- [ ] Pane hard limit、dirty draft、revoked focus return、unknown reconcile 可测试。
- [ ] Keyboard、200% zoom、reduced motion、touch、DOM mirror 与 Axe gate 通过。
- [ ] Three lazy chunk、PTS sync、timeline virtualization、resource disposal 与 screenshot evidence 完整。
- [ ] UI 只证明 Workbench local contract/interaction，不暗示真实 owner runtime、Provider 或 production ready。

## 18. Capability → UI region → contract → 测试 映射（task 0.3 冻结）

proposal Required Capability Ledger 中全部 deliver-now 行在此映射到唯一 UI region、合同条款与验收测试；implementation/review 以本表为索引，不在表外的临场模式。

| Capability（deliver-now） | UI region（本 Spec 章节） | Contract（[interfaces](../interfaces/spatial-replica-review.md) / [02-contract-freeze](../../openspec/changes/archive/2026-09-02-workbench-spatial-replica-review-v1/details/02-contract-freeze.md)） | 测试（tasks.md） |
| --- | --- | --- | --- |
| episode/shot navigation | §3.1 `ReplicaScopeBar` / §6 Episode-shot picker | interfaces §4 exact tuple；02 §4 top-level identity + §5 pane params | 3.3 `spatial-replica-navigation` |
| synchronized source/evidence playback | §7 Source evidence region | interfaces §5–6 preview/numeric split + rational time；02 §3 `SpatialReplicaPtsMap` | 4.1 `spatial-replica-pts`、4.2 `-player` |
| synchronized 3D stage viewport | §8 3D viewport | interfaces §8 stage safe projection；02 §4 stage/browser budget | 5.2 `replica-viewport-adapter`、5.6 `e2e:spatial-performance` |
| evidence/candidate/override/frozen inspector | §10 Inspector | interfaces §9 truth contract；02 §2 `SpatialReplicaTruthLayer` | 5.5 `spatial-replica-inspector` |
| camera/joint/keyframe/contact/occlusion timeline | §9 Timeline | interfaces §6 sample resolution；02 §2 `SpatialReplicaTrackKind` | 4.4 `spatial-replica-timeline`、4.5 `-selection` |
| Auctra screenplay panel | §11.1 | interfaces §4 panel contract；02 §4 `ScreenplayPanelProjection`（depth_granted） | 6.2 `auctra-screenplay-pane` |
| Scaena storyboard/ReplicaStage panel | §11.2 | interfaces §8；02 §4 `StoryboardPanelProjection`（mode/binding） | 6.3 `scaena-storyboard-pane` |
| owner receipt timeline | §11.3 | interfaces §12 event/receipt；02 §6.2–6.3 receipt/watch cursor | 6.4 `owner-receipts-pane` |
| evidence correction（Anatomia） | §10.4 typed draft / §6 submit | interfaces §11.1–11.2 wrapper + routes；02 §6.1 wrapper 字段 | 6.5/6.7 go `Action|Descriptor|Route` + `spatial-replica-actions` |
| stage edit/review/freeze（Scaena） | §10.4 + §11.2 allowed actions | 同上 route Scaena；02 §6.2 execute/reconcile（expected version/idempotency） | 6.6 `spatial-replica-draft`、6.7/6.8 reconcile |
| spatial inquiry（Anatomia） | §10 inquiry 区 / §6 Ask about selection | interfaces §10；02 §7 inquiry request/result | 6.1 `spatial-replica-inquiry` |
| （横切）responsive/a11y/evidence | §4/§13/§14/§16 | 04 truth table（default-off 各状态）；05 fixture/性能 gate | 7.1–7.6 playwright matrix |

## 19. 状态与证据口径（per-state 要求）

- 本 Spec §12 状态矩阵共 17 行：覆盖 spec `spatial-replica-responsive-accessibility` 的 16 个必需状态（loading/empty/partial/stale/error/revoked/permission_required/offline/needs_contract/duplicate_action/unknown_accept/limit_reached/navigation_away/sync_degraded/view_too_large/WebGL unavailable）+ spec `spatial-replica-owner-panels` 的 `unsupported_version`；每个状态的“仍可做 / 禁止 / 恢复”三列即 per-state 要求，组件 fixture/story 由 task 7.4 落地，screenshot 映射由 §16 矩阵 + task 7.6 落地。
- 状态名保持 English machine value（`sync_degraded`、`view_too_large` 等），与 [02-contract-freeze](../../openspec/changes/archive/2026-09-02-workbench-spatial-replica-review-v1/details/02-contract-freeze.md) §9 的 region/action 子状态集合一致；中文文案走 i18n catalog（task 7.5）。
