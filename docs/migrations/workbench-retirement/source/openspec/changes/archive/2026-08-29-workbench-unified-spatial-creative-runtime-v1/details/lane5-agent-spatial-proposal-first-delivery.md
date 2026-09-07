# Lane 5 交付报告：5.1–5.5 Agent proposal-first 空间交互

状态：实现 + 接线 + 测试全部完成；验证全绿（见 §5）。未勾选 tasks.md（主 agent 验证后勾选）；未做 git commit。

## 1. 逐任务交付清单（文件级）

### 5.1 AgentSpatialIntentV1 投影（closed codec + capability 门控）

- `apps/web/src/workbench/agent/spatial/spatial-intent-projection.ts`（新）：
  - `projectAgentSpatialIntent`：三道门——capability（surface capability != available → `skipped_no_capability`，**不投影不报错**）→ SDK `normalizeAgentSpatialIntent`（closed strictRecord codec：未知字段/未知 kind/DOM selector/raw URL/非法 ref 一律 `rejected_invalid`）→ expiry（`rejected_expired`）；
  - `projectAgentSpatialIntents`：批次投影，单条失败隔离（不中断会话流）；
  - `spatialCapabilityState`：从 surface 快照派生协商状态；只有 `available` 视为已协商；
  - `isPresentationIntent`：presentation 动作封闭集 `open_lens|focus_ref|highlight_refs|compare_refs|preview_change_set`；`open_runtime_action` 指向命令面，明确在 presentation 域之外。

### 5.2 Spatial intent resolver/dedupe + Follow Pi presentation-only guards

- `apps/web/src/workbench/agent/spatial/spatial-intent-resolver.ts`（新）：
  - `SpatialIntentResolver.resolve`：dedupe 键 `(sessionRef, intentRef, sequence)`，replay/重发收敛 `duplicate`；有界 diagnostics（64 条，Follow Pi resolver 先例）；
  - `canAutoApplySpatialIntent`：**presentation-only guards** `{enabled, draftDirty, reviewActive, modalActive, delivery}` 任一命中即 suggestion-only；`follow_eligible` 才有资格；replay 永不自动应用；
  - **关键裁定（锁定测试）**：`open_runtime_action` 整体拒绝（`rejected_mutation_domain`——持久/命令变更必须走 proposal 或显式用户确认）；`preview_change_set` 虽属 presentation 域但**永远 suggestion-only**——spec 明文「Automatic effects MUST NOT … create a proposal decision」，自动预览不得创建/触发 decision；
  - `updateGuards`：运行期 guards 状态更新（composer/review/modal 随时变化）。

### 5.3 临时 overlay 渲染（零持久状态）

- `apps/web/src/workbench/agent/spatial/spatial-temporary-overlays.ts`（新）：
  - `reduceTemporaryOverlay` 纯 reducer：highlight（64 上限，与 spatial-state 的 boundedUniqueRefs 同预算）/compare（8 上限）/previewOperations（2000 上限，与 change-set 操作上限一致）/lens_preview/focus_ref；`expire` 全清空——零持久状态，不推进 Board revision，不写 canonical 状态；
  - 挂接 3.1 controller 的 temporary overlay 面：`spatial-surface.tsx` 内 `temporaryOverlays` reducer 输出经 `mergedHighlightRefs`（用户/ingress/intent 高亮并集）与 `mergedPreviewOperations` 喂给 PixiSpatialRenderer；
  - **渲染器生命周期修复**：`mergedPreviewOperations` memo 化（inline 新数组会让 renderer effect 的依赖每次渲染变化 → pixi teardown/init 竞态，kernel 测试暴露后已修复）；`SpatialSurface` 卸载时 `expire` 收敛。

### 5.4 change-set Review UI + ProposalAuthority 桥 + runtime 装配

Web 面：

- `apps/web/src/workbench/agent/spatial/change-set-review.tsx`（新）：
  - `useChangeSetReview`：closed 决策状态机 `idle→applying/deciding→done|conflict|unknown`。accept 只走 `applySpatialChangeSet`（服务端 ProposalAuthority 重载冻结事实 + boards 原子事务 + receipt，成功只来自 receipt）；reject/request_changes 走既有 `decideProposal` 合同；conflict 码（revision/idempotency/decision_in_progress/board_version_conflict）→ conflict 态，**不自动重试**；其它失败 → unknown 态，唯一出口 `reconcile`（携带原 decisionRef 身份，`stillUnknown` 如实呈现，绝不伪造成功）；
  - `ChangeSetReviewCard`：bounded proposal 事实（risk/cost/reversible/required decision/operations 数/impact/expiry 预警），决策期间按钮禁用；
  - proposal 为 null → 无动作（浏览器本地预览永远不是 authority）。
- `spatial-surface.tsx`：新增可选 `spatialIntents`/`followPiGuards` props（additive，既有签名与测试不变；缺省 guards 全关 → 一切 intent 只作 suggestion）。

Go 面（PA 桥，proposal-first 的事实冻结与重载）：

- `service/internal/proposalauthority/repository/spatial_store.go`（新）：`workbench_spatial_change_set_facts` 表（含 `SchemaModels()` 注册）——**冻结事实表**。operations 体超出 TargetInput 4096 字节上限，完整冻结在 facts 行（digest 双向锁定）；`SaveSpatialChangeSetFact` 幂等（同 digest no-op，digest 漂移 → `ErrProposalState`，绝不静默覆盖）；`GetSpatialChangeSetFact` 按 (tenant, proposalRef) 读取。
- `service/internal/proposalauthority/bridge/spatial_change_set.go`（新）：`SpatialChangeSetBridge` 同时实现两个 spatial 端口（编译期断言）：
  - `LayoutProposalRegistrar.RegisterLayoutProposal`：>2k 异步 layout plan 注册 canonical proposal（`domain.ValidateProposal` 先行；BasisRef = board + base revision；proposalRef 沿用 spatial 层 digest 派生 ref——三方单一身份：PA 记录/冻结 facts/浏览器持有的 proposalRef 同一 ref）+ 冻结 facts 落库；幂等；绝不改变 Board geometry；
  - `ApplyProposalSource.LoadChangeSet`：accept 时服务端重载冻结事实。fail-closed 矩阵：未知 proposal/跨 tenant → `ErrInvalidArgument`（不泄露存在性）；digest 漂移/JSON 损坏/身份字段不一致 → `ErrInvalidArgument`；PA 记录状态非 `open`（决策终局/在途）→ `ErrInvalidArgument`；过期 → `ErrInvalidArgument`；base revision 漂移 → `boards.ErrRevisionConflict`（与 Authority 预检/事务内 CAS 同一错误词汇）。

### runtime 接线 diff 摘要（`service/internal/runtime/runtime.go`，仅 authority 装配点）

- imports：+`boarddomain`（TokenPolicy 零值）、+`pabridge`、+`parepository`；
- 装配块（boardService 构造后、spatialService 构造前）：`proposalAuthorityServices != nil` 时 → `parepository.NewStore(store.DB())` → `pabridge.NewSpatialChangeSetBridge(paService, paStore)` → `spatial.NewAuthority(AuthorityConfig{Store: store, Authorizer: boardAuthorizer, TargetResolver: boardTargetResolver, ProposalSource: bridge, MaxOperations: 2000, TokenPolicy: boarddomain.TokenPolicy{}, Now: time.Now, NewRef: 序列生成})`；
- `spatial.NewService(boardService, spatialChangeSetAuthority, time.Now)`（flag 关时保持 nil-authority `needs_contract` fail-closed，与既有行为逐字节一致）；构造后 `SetLayoutProposalRegistrar(bridge)` 绑定 >2k 异步注册口；
- 未触碰 tasks.md / Taskfile / docs / spatial 包 / boards 包 / workflow lens / evidence runner。

### 5.5 权威性测试矩阵

- `service/internal/proposalauthority/bridge/spatial_change_set_test.go`（新，真实 SQLite：boards + PA schema 同库、真实 spatial.Authority + boards CommitBoard）：
  - **acceptance 全链**：注册 → apply（revision bump、节点 geometry 落库、receipt）→ 断言原子提交；
  - **replay 无权威**：同 key 同请求 → `Replayed=true` 原 receipt（不二次提交）；同 key 异 revision → LoadChangeSet 事实门先拦截（`board_version_conflict`，Board 不动）；
  - **conflict**：revision 漂移 → `board_version_conflict`，无部分提交；
  - **decision 终局/在途**：superseded 后 apply 重载 → `invalid_argument`（冻结事实不再可执行）；
  - **unknown_accept 语义**：非 open 状态（含 deciding/decision_unknown）一律拒绝——mutation 权威只属于「一次决策 → 一次原子提交」链路，无自动重试入口；
  - **授权先于事实**：deny authorizer → 无任何 Board 突变（浏览器/replay 无权威的服务端证明）；
  - **注册幂等**：同事实重放 no-op；异事实拒绝覆盖；Board 几何在注册路径不变。
- Web：`apps/web/test/spatial-agent-intent.test.ts`（15 用例）+ `apps/web/test/spatial-change-set-review.test.tsx`（9 用例）锁定 §5.1/5.2/5.3/5.4 的全部不变量（capability 门控、closed 拒绝、dedupe、guards 矩阵、conflict/unknown/reconcile-only、receipt-only 成功语义）。

## 2. Design 歧义裁决（含理由）

1. **proposal 身份单一化**：layout plan 的 `proposalRef`（spatial 层 refs+layoutKind+revision digest 派生）同时作为 PA proposal ref 与冻结 facts ref。浏览器、PA、facts 三方同一 ref，杜绝「决策的 proposal ≠ apply 的 proposal」缝隙；幂等注册天然成立。
2. **TargetOperation = `spatial.change_set.apply`（registry 未注册）**：spatial apply 不经 orbit.proposal.accept dispatch（boards 事务不是 Owner Task）。该 token 只用于 PA 审计/描述；identity safety 层对未注册目标 fail closed， sealed accept 不可能经 registry 意外触发第二执行路径。Apply 的权威闸门是 LoadChangeSet 的 open-状态 + revision 门，不是 registry mode。owner-signed sealed-target 场景（workflow 变更等）保持 needs_contract，待 8.x canary。
3. **冻结 facts 表**：PA `MaxTargetInputBytes=4096` 装不下 ≤2000 操作的 change-set。裁量为 canonical proposal（决策/审计真源，TargetInput 只带摘要事实 + factsDigest）+ 独立冻结 facts 行（完整 operations，digest 锁定，同表幂等）。digest 漂移即 fail closed——冻结事实的防篡改强度与 proposal 主表一致。
4. **reject/request_changes 走既有 decideProposal，accept 走 spatial apply**：两者都是 server-authoritative decision——accept 的「决策+执行」合并在 ApplySpatialChangeSet（claim/revalidate/原子事务/receipt/幂等重放全在 authority 链内）；reject/request_changes 是 metadata-only，复用 PA 决策合同（无需 boards 事务）。review 卡未知态只对 reject/request_changes 暴露 reconcile（accept 的 unknown 由 apply 幂等重放语义承担）。
5. **TokenPolicy/MaxOperations**：runtime 接线用 `boarddomain.TokenPolicy{}`（与 boards.NewService 现行装配同源，cloneTokenPolicy 缺省只注入 default style）；`MaxOperations: 2000` 与 SDK/传输契约上界对齐（可收紧不可放宽）。
6. **scope 派生**：v1 Board 无独立 workspace/project 维度，桥以 boardRef 派生稳定 digest token 作 PA scope（同 board proposal 同 scope，授权查询成立）；后续 Board 增加显式维度时单点切换。
7. **preview_change_set 归 presentation 域但 suggestion-only**：既满足「Follow Pi 只允许 presentation 动作」的封闭列举，又不违反「自动效果不得创建 proposal decision」。

## 3. 验证结果（只跑指定命令）

| 命令 | 结果 |
|---|---|
| `apps/web && bunx vitest run test/spatial-agent-intent.test.ts test/spatial-change-set-review.test.tsx test/spatial-surface-kernel.test.tsx` | **33 passed**（15 + 9 + 9，kernel 全绿无回归） |
| `apps/web && bunx vitest run test/agent-route.test.tsx`（回归抽查） | 7 passed |
| `apps/web && bunx tsc --noEmit` | 0 errors |
| `CGO_ENABLED=0 go test ./internal/spatial/... ./internal/proposalauthority/... -count=1` | 全 ok（bridge 含 5 个新 TestSpatialBridge* 全绿；spatial 既有全绿） |
| `CGO_ENABLED=0 go build ./cmd/workbenchd` | OK |
| `CGO_ENABLED=0 go test ./internal/runtime/ -count=1` | ok（接线零回归） |
| `openspec validate workbench-unified-spatial-creative-runtime-v1 --strict` | valid |

## 4. Handoffs / 备注

- **conversation workspace 集成（handoff，超出租约）**：`agent-conversation-workspace.tsx` / `agent-route.tsx` 不在文件租约内。接线面已备好：`SpatialSurface` 新增可选 `spatialIntents`（Agent 输出携带的 raw spatial intent 载荷数组）与 `followPiGuards`（composer/review/modal 运行期状态）；Review 卡（`useChangeSetReview` + `ChangeSetReviewCard`）可挂入 review lens inspector，`decideProposal`/`reconcileProposalDecision` 直接用 `workbenchClient.agent`。缺省行为（不传 props）与现状逐字节一致。
- **租约内最小越界**：`proposalauthority/repository/models.go` 仅在 `SchemaModels()` 追加一行 `&spatialChangeSetFactModel{}`（迁移注册必须，additive）。未触碰 `service/internal/spatial/**`（纯只读消费，无需改动）。
- 工作区内其余未跟踪/修改文件（harness bridge-v2、workflow-lens、harnesshttp 等）属并行 lane，本 lane 未触碰。
