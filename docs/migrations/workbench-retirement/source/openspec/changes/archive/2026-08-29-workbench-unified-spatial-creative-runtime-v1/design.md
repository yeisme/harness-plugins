## Context

Workbench 当前拥有五条彼此重叠的空间/创作路径：Project Canvas 使用本地 React Flow 投影，Spatial Board 使用 R4 BoardService viewport，Context Map 是只读 Pane，Workflow Console 单独设计和运行 DAG，Show Control Room 则是独立 route 与页面壳。它们重复维护选择、视口、加载/空/不可用状态、深链和 Review 入口，且旧 Show route 违反 `/agent` 单一主壳蓝图。

R4 已提供 Board typed graph、near/medium/far LOD、viewport query、durable WorkflowDefinition/Run、scheduler/worker/lease、approval、receipt 与 reconcile 基础。本 change 不重建这些 authority，而是在其上增加统一 spatial composition、50k viewport contract、桌面 renderer、Agent proposal interaction 与 creative production Lens。

稳定边界包括：`workbench.board.v1alpha1`、Workflow SDK/API、`AgentPresentationIntentV1`、Show projection/action contracts、ProposalAuthority、TaskService 和 Owner public contracts。旧 `/show-control-room` Web route 是用户明确要求立即删除的 breaking UI surface；其它合同必须 additive 演进。

## Goals / Non-Goals

**Goals:**

- `/agent` 成为唯一桌面主壳，提供 Conversation、Split、Spatial Focus 三种布局模式，conversation/composer 永远保留。
- 用一个 Spatial Surface state/controller 组合 Board、Owner safe projection、Workflow、Run、Review 与 Evidence。
- 单 Board 在 approved PostgreSQL/Chromium baseline 下支持 50k nodes、75k relations、1k groups，同时保持有界 query、GPU primitives 与 DOM mounts。
- Agent 只拥有 presentation suggestion；持久 spatial change 必须经过 canonical proposal、decision、Task 和 receipt。
- 在画布中完成 typed Workflow authoring、validation、publish、start、pause、resume、cancel、reconcile，但不建立第二执行引擎。
- 创作生产成为 first-support Lens；CEO decision 与 project delivery 作为共享 kernel 的 exploratory scenario。
- 删除独立 Show Control Room Web route 与旧壳；保留稳定 Show SDK/service contracts 作为组合来源。

**Non-Goals:**

- 手机、平板 Web UI、responsive substitutions、移动截图或移动 E2E。
- CRDT、多人实时共同编辑、跨租户 Board、任意 shell/script/network step、无界循环。
- 浏览器直连 Auctra、Eikona、Scaena、Ordo、Aigora 或读取 Owner 私有数据。
- 在 Workbench 复制 Show/Episode/Shot/Asset、production acceptance、rights、delivery 的 canonical state machine。
- 让一次 UI plan 伪装成 Board、Workflow 与多个 Owner 的跨服务原子事务。
- 引入 Rust、cgo、Electron 或 Tauri。

## Decisions

### 1. 单一 Spatial Surface composition

新增 `SpatialSurfaceSnapshotV1` 作为服务端合成的安全快照。它包含 Board revision、Lens descriptor、viewport tiles、owner projection provenance、runtime overlays、capability/freshness 与 cursor，不包含 Owner raw payload、artifact bytes、任意 URL、credential、private path、prompt 或 provider payload。

Web 只维护 camera、selected refs、active Lens、temporary overlay、focus return 与未提交 draft。Board、Workflow、Run、Review、Owner readiness 和 receipt 全部来自 typed server projection。Project Canvas、Context Map 和旧 Show page 不再维护独立对象/viewport owner。

Alternatives：

- 保留双 Canvas：迁移较小，但继续重复状态和测试，拒绝。
- 浏览器拼接 Board 与 Owner payload：会让 browser 决定 provenance/freshness，拒绝。

### 2. Additive contract identities

新增以下 identities，不修改 existing v1 closed enums：

- `workbench.spatial_surface.v1`
- `workbench.spatial_viewport.v2`
- `workbench.spatial_lens.v1`
- `workbench.agent_spatial_intent.v1`
- `workbench.spatial_change_set.v1`
- `workbench.spatial_runtime_projection.v1`

新增 shared methods：`QuerySpatialSurface`、`WatchSpatialSurface`、`PlanSpatialLayout`、`ApplySpatialChangeSet`。HTTP、gRPC、JSON-RPC 和 SDK 使用同一 registry descriptor、closed schema、canonical error、idempotency 与 receipt。

`AgentPresentationIntentV1` 保持不变；Agent output 通过 optional negotiated `spatialIntents` 携带新合同，旧 client 可忽略该 optional projection。现有 Board/Workflow/Show exported APIs 不删除、不改签名。

### 3. Generic Board registry v2

Spatial composition 使用 generic node classes：`subject`、`asset`、`work_item`、`decision`、`evidence`、`workflow_definition`、`workflow_run`、`delivery`、`note`。Owner entity kind（show、episode、scene、shot、candidate）只存在于 safe projection descriptor，不成为 Workbench canonical domain enum。

Registry v2 是独立 snapshot/digest；v1 Board consumers 保持原 registry。v2 mutation 只有在 server、SDK 和 Web digest 一致时 available。Owner hierarchy relation 作为 immutable projected relation；用户组织关系才成为 Board edge。

### 4. Proposal-first spatial mutations

`AgentSpatialIntentV1` 只允许 `open_lens|focus_ref|highlight_refs|compare_refs|preview_change_set|open_runtime_action`。自动处理仅限 live foreground 的 open/highlight presentation，并沿用 Follow Pi 的 dirty composer、active review、modal、scope、expiry 与 dedupe guard；不得移动 keyboard focus。

持久变更流程：

```text
Agent suggestion
  -> PlanSpatialLayout / canonical proposal creation
  -> SpatialChangeSetProposalV1 + diff/impact/reversibility
  -> user decision
  -> ProposalAuthority server revalidation
  -> TaskService ApplySpatialChangeSet
  -> BoardService atomic commit
  -> receipt / reconcile
```

单个 Board change-set 在一笔 GORM transaction 内验证 expected revision、operation bounds、registry digest、scope、permission、idempotency 与 inverse metadata。Workflow draft/run/Owner action 不放入同一 Board transaction；UI 可分组展示，但每步保留独立 Task 与 receipt。

### 5. Full Workflow controls without a second runtime

Workflow Lens 使用现有 immutable typed DAG、step registry 和 WorkflowClient。React Flow 只渲染当前 definition 或 selected subgraph，支持 typed ports、input bindings、validation markers 和 keyboard alternatives。

Spatial Runtime control 只发出已有或 additive ActionDescriptor-backed commands：validate、publish、start、pause、resume、cancel、reconcile。Capability、risk、cost、approval、expected version 和 available actions 由 server projection决定。Run overlay 订阅一个 selected run stream；gap 后重取 snapshot，`unknown_accept` 进入 reconcile-only。

### 6. Hybrid renderer and worker boundary

新增 renderer adapter：

```text
SpatialSurfaceController
  -> viewport/tile store
  -> worker bridge (decode/index/cluster/hit-test/layout)
  -> WebGL renderer (far/medium)
  -> bounded DOM/React Flow overlay (near/selected/workflow/review)
  -> accessible object list
```

PixiJS v8 stable Sprite/Graphics/Text primitives 是默认 WebGL backend。`ParticleContainer` 只存在于 default-off benchmark flag，不进入 release-required path。OffscreenCanvas 可用时转移 worker rendering；不可用时使用主线程 WebGL renderer，但保持 tile/primitive/DOM hard limit并投影 `degraded`。WebGL context loss 后丢弃 browser render cache，从 latest canonical snapshot 重建。

DOM rich nodes hard limit 200。React Flow 开启 only-visible rendering，custom node/edge、callbacks、options 全部 memoized；selection 单独存储，不能订阅完整 nodes array。Interactive layout 最多 2k selected nodes；更大请求进入 async `PlanSpatialLayout` proposal。

### 7. Viewport v2 and persistence

`SpatialViewportQueryV2` 使用 surface ref、expected revision、bounds、zoom bucket、LOD、filter、tile cursor、max primitives。Response 返回 bounded tiles、clusters、projected relations、provenance、density、next cursor 和 revision；page/tile 超限 fail closed，不允许 client 请求全量 canonical detail。

在现有 Board projection/index 基础上添加 GORM-managed tile/density index model与 additive migration。普通 repository query 使用 GORM；只有 migration、approved PostgreSQL EXPLAIN/capacity test 可使用参数化 SQL exception。写入仍由 Board commit/outbox 驱动 index invalidation/rebuild，不允许 Web 维护权威 tile。

Capacity baseline：50k nodes、75k relations、1k groups。far/medium/near PostgreSQL p95 budget 分别为 150/150/400ms；warm first frame ≤1.2s、cold ≤2.5s、pan/zoom p95 frame ≤20ms、highlight latency ≤50ms。性能报告必须记录 reference hardware、browser、fixture、cold/warm 与 rows/allocations，不把本地数字宣传为 production SLO。

### 8. Creative Production Lens migration

现有 Show projection client、entry validator、Create Show proposal、Show Home、Episode、Review、Run/Evidence 与 Delivery components 迁入 `workbench/agent/spatial/lenses/creative-production/**`，通过 `SpatialSurfaceSnapshotV1` 或现有 typed Show facade 读取安全事实。

`/show-control-room` route、route parser、独立 page grid、mobile/tablet CSS 和 route-specific E2E 在本 change 删除。Agent/Project/DSH ingress 改为 `/agent` + closed `SpatialEntryIntentV1`；DSH payload 继续是不可信提示，server 必须重验 context revision。旧 URL 不 redirect、不渲染 fallback。

稳定 `WorkbenchShowControlRoomClient` 与 Go showcontrol contracts 保留，标记为 legacy composition source；本 change 不移除其 exported symbols。未来 contract consolidation 需要独立 deprecation change。

### 9. Desktop-only product boundary

Spatial Surface release capability 只在 desktop viewport 与 pointer/keyboard capability 组合满足时 available。项目不新增 mobile/tablet layout、Sheet、touch editing 或 mobile tests。窄 viewport 显示明确的 desktop-required unavailable state，不尝试提供响应式替代产品。

未来移动应用必须是独立 implementation owner，通过 Spatial/Workflow/Proposal APIs、events 和 typed deep links 消费，不复用 Web component 或将 domain state 下沉到客户端。

## Risks / Trade-offs

- [50k renderer complexity] → renderer adapter、hard budgets、50k fixture、Chromium trace gate；不让 React DOM 承担全图。
- [PixiJS dependency/API drift] → 锁定 v8 range、只使用 stable primitives、adapter 隔离，ParticleContainer default-off。
- [WebGL/worker incompatibility] → bounded degraded backend、capability projection、context-loss recovery；不静默宣称 50k ready。
- [Route removal breaks bookmarks/out-of-repo DSH] → 同 change 更新全部仓内 producer，proposal 明确 breaking；发布前搜索旧 URL 为零。外部 consumer 未知，发布说明必须列出新 typed ingress。
- [Board/Workflow mixed plan appears atomic] → UI 明示 step/receipt boundaries，Board atomic change-set 与 Workflow/Owner actions 分开结算。
- [Owner projection drift] → segment-level strict codec、provenance/version/freshness、contract mismatch fail closed。
- [R4 promotion gaps] → 新 UI capability 可 fixture/first-support，但 production readiness 必须依赖 R4 PostgreSQL/worker/Owner/staging gates。
- [Desktop-only conflicts with old responsive blueprint] → 本 capability 显式 desktop-only；现有 Agent conversation shell 的 mobile行为不在本 change 删除，只有 Spatial Surface 与旧 Show page 不提供移动实现。

## Migration Plan

1. 新增 OpenSpec、contract identities、SDK codecs 和 capability negotiation；旧 surfaces 继续工作。
2. 新增 service composition/query/layout/change-set operations、GORM projection index与 parity tests。
3. 在 `/agent` default-off flag 下接入 Spatial Surface、renderer、worker、five Lens 和 creative projection。
4. 接入 Agent spatial intent、ProposalAuthority decision 与 Workflow runtime controls；运行 focused contract/component/integration gates。
5. 更新 Agent、Project、DSH producers 到 new typed ingress，确认仓内 `/show-control-room` 入口引用为零。
6. 删除旧 route/page/style/tests，默认启用 desktop Spatial capability；保留旧 SDK/service contracts。
7. 执行 50k PostgreSQL/Chromium、a11y、安全、context-loss、reconcile 与 full project gates。

Rollback：关闭 Spatial feature flag，恢复删除前的 `/show-control-room` route/component wiring，继续使用未删除的 Board/Workflow/Show SDK/service contracts；additive DB index/table 可留存且不影响旧 runtime。若 v2 registry/viewport drift，capability 降为 `needs_contract`，不回退到 client allowlist。

## Open Questions

无。实现默认使用 PixiJS stable primitives、desktop-only capability、immediate old-route removal、50k logical capacity 和 proposal-first authority；任何改变这些决策的请求需要更新本 change。
