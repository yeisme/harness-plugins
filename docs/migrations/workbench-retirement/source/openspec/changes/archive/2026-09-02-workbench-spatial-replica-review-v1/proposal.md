## Why

Anatomia 的视频证据与 Scaena 的 ReplicaStage 将分别拥有正确的 canonical state，但用户仍缺少一个能同时核对源视频、二维证据、三维白模、人物动作、剧本/分镜和 owner receipt 的审阅环境。若浏览器自行拼接 owner payload、保存 join state 或把本地 3D 编辑当作已提交，就会形成第四套不可信真相并绕过 Scaena/Anatomia 的版本、权限和 review 门禁。

本 change 在既有 `/agent` 单一主壳中增加空间复刻专业 Pane family，以 Workbench server-authored safe projection 组合 exact owner refs，并通过唯一 Task/ProposalAuthority/Owner receipt 链完成修正、review、freeze 和 reconcile。

## What Changes

- 新增 experimental、default-off 的 `workbench.spatial_replica_workspace_projection.v1alpha1`，组合 Anatomia evidence、Scaena ReplicaStage、optional Auctra screenplay 与 storyboard safe projections；只携带 exact refs/version/digest、freshness、safe summaries、time/coordinate/scale、allowed actions 和 receipt refs。
- 在现有 versioned Pane registry 中 additive 注册 `agent.spatial-replica.v1`、`agent.spatial-replica-inspector.v1`、`agent.auctra-screenplay.v1`、`agent.scaena-storyboard.v1` 和 `agent.owner-receipts.v1`；不创建第二个 shell、registry、composer、Task client 或 event stream。
- 主 Replica Pane 提供 episode/shot navigation、source player、grayscale/depth/mask/flow/skeleton/camera overlays、同步 3D viewport 和 camera/joint/keyframe/contact/occlusion timeline。
- Inspector 明确区分 `Evidence`、`Candidate`、`Production Override` 和 `Frozen`，显示 capture profile、scale tier、允许 claim、quality、unknown 和 limitations。
- Auctra screenplay 与 Scaena storyboard/ReplicaStage 使用独立 Pane/typed contract；Workbench 不复制 canonical screenplay、storyboard 或 stage state，也不加载 owner 私有页面。
- 空间问答路由到 Anatomia typed inquiry；回答必须显示 Snapshot/bundle lineage、时间范围、坐标/单位、置信度、limitations 和 evidence refs，回答本身不修改 canonical state。
- evidence correction 路由 Anatomia；proxy/keyframe/retarget/completion/review/freeze 路由 Scaena；Agent proposal 仍由 ProposalAuthority，直接用户动作仍经 server revalidation → TaskService → owner receipt/reconcile。
- 浏览器只持有播放游标、overlay、3D camera、selection、Pane layout 和未提交 typed edit draft；导航离开时显式处理 dirty draft，服务器不保存第四套 replica domain state。
- 使用一个 Workbench workspace stream 聚合 safe owner freshness/receipt events；不得为每个 Pane/owner 建立浏览器直连或独立权威流。
- 定义 loading、empty、partial、stale、error、revoked、permission-required、offline、duplicate-action、unknown-accept、limit-reached 和 navigation-away 状态，以及 desktop/tablet/mobile/keyboard/reduced-motion/a11y 行为。
- 不在本 change 中实现 Anatomia/Scaena runtime、生成模型、DCC、replica video、ProductionGraph 晋级或任何 Provider 调用。

## Required Capability Ledger

| Capability | 状态 | canonical owner | visible host | 本轮切片 | 验收证据 |
| --- | --- | --- | --- | --- | --- |
| episode/shot navigation | required | Workbench presentation + owner refs | Replica Pane | deliver-now | component/browser navigation tests |
| synchronized source/evidence playback | required | Anatomia data / Workbench presentation | Replica Pane | deliver-now | VFR/PTS one-frame sync tests |
| synchronized 3D stage viewport | required | Scaena stage / Workbench renderer | Replica Pane | deliver-now | fixture screenshot/performance/a11y mirror |
| evidence/candidate/override/frozen inspector | required | corresponding owner / Workbench composition | Inspector Pane | deliver-now | state and provenance tests |
| camera/joint/keyframe/contact/occlusion timeline | required | Anatomia/Scaena | Replica Pane | deliver-now | scrub/event/keyboard tests |
| Auctra screenplay panel | required | Auctra | Auctra Pane | deliver-now read-only or truthful unavailable | owner contract fixture |
| Scaena storyboard/ReplicaStage panel | required | Scaena | Scaena Pane | deliver-now | owner contract fixture |
| owner receipt timeline | required | TaskService + owners | Receipt Pane | deliver-now | cursor/reconnect/unknown tests |
| evidence correction | required | Anatomia | Inspector/action | deliver-now contract-gated | Task/receipt fixture |
| stage edit/review/freeze | required | Scaena | Inspector/Scaena Pane | deliver-now contract-gated | Task/receipt fixture |
| spatial inquiry | required | Anatomia | Inspector/Agent composer | deliver-now | lineage/limitations fixture |
| persisted cross-device view preference | optional | Workbench presentation | future SavedView | retain-next | separate expected-revision contract |
| replica video generation | required | Scaena | future production flow | moved-owner/retain-next | `scaena-replica-video-generation-v1` |

## Capabilities

### New Capabilities

- `spatial-replica-workspace-projection`: server-side multi-owner safe composition、freshness、exact join、single stream 和 no-fourth-state boundary。
- `spatial-replica-synchronized-review`: source/overlay/3D/timeline synchronization、selection、inquiry 和 stage comparison experience。
- `spatial-replica-owner-actions`: evidence/stage/review/freeze typed actions、expected-version、idempotency、duplicate/unknown/reconcile 和 owner receipt semantics。
- `spatial-replica-owner-panels`: 独立 Auctra screenplay、Scaena storyboard/ReplicaStage 和 owner receipt Pane contracts。
- `spatial-replica-responsive-accessibility`: UI Spec、responsive substitution、DOM accessibility mirror、keyboard/focus/reduced-motion 和 visual evidence requirements。

### Modified Capabilities

无。既有 Agent shell、Pane composition、ProposalAuthority、TaskService、Spatial Surface 和 owner integrations 保持原义；本 change 只通过 additive Pane types、typed facade 和 owner capability states接入。

## Impact

- 预期影响：`api/proto`/`api/schema` additive projection、Go composition service/owner adapters、`packages/task-sdk` typed facade、`apps/web` Pane registry/renderers/player/viewport/timeline/inspector、i18n 与 contract/component/Playwright evidence。
- 前端 3D 预计通过受控本地 viewport adapter 引入 `three` core；Three 类型不得进入 wire contract，依赖和 bundle/performance gate 在 implementation task 中固定。
- 对外合同分类：additive、experimental `v1alpha1`、default-off；无 breaking surface、无旧 Pane/route removal、无 persistence migration requirement。
- Workbench 不保存 owner payload、artifact blob、stage geometry canonical copy、screenplay body、storyboard state、raw prompt、Provider payload、credential 或 private path。
- Scaena/Anatomia/Auctra contract 不可用时对应 Pane/segment 显示 `needs_contract/offline/stale`，其余可验证 segment 继续可读；不以 mock fallback 冒充 ready。

## Scope-change Log

| 决策 | 结果 | 原因 |
| --- | --- | --- |
| 新建并列“Replica Studio” | rejected-now | 违反 `/agent` 单一主壳和 conversation anchor |
| 浏览器直连 Anatomia/Scaena | rejected-now | credential、authority、version 和 audit 边界错误 |
| Workbench 保存 canonical join/ReplicaStage | rejected-now | 会形成第四套 domain truth |
| 手机上的完整 3D 编辑器 | staged/retain-next | `<1024` 使用对象列表、摘要和 owner deep link，避免不可用缩小版 IDE |
| 本地 edit draft | deliver-now ephemeral | 仅未提交 presentation state；submit 后以 owner projection/receipt 为准 |
| 生成复刻视频 | moved-owner → Scaena | 依赖 frozen stage、control passes、rights/quality/production gate |

## Wave-0 Freeze Artifacts

- [details/01-baseline-ownership.md](./details/01-baseline-ownership.md)：0.1 dirty-worktree 基线、并行 change 快照、依赖版本、path lease 与 `api/**` 单一 tracked-file writer。
- [details/02-contract-freeze.md](./details/02-contract-freeze.md)：0.2 字段级合同冻结（proto 字段号/enum/closed pane params/error model/兼容分类）。
- [docs/ui/spatial-replica-review-workspace.md](../../../docs/ui/spatial-replica-review-workspace.md)：0.3 UI Spec（wireframe/component tree/control inventory/state matrix/breakpoint/a11y/screenshot/capability 映射）。
- [details/04-capability-truth-table.md](./details/04-capability-truth-table.md)：0.4 server-owned capability truth table（10 行，default-off + exact-principal cohort）。
- [details/05-p1-fixture-dependency-budget.md](./details/05-p1-fixture-dependency-budget.md)：0.5 P1 fixture 预算、`three` 依赖决议与 bundle 基线。
