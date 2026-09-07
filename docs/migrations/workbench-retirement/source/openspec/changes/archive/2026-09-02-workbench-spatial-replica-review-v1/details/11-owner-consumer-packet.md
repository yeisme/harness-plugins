# 9.5 Owner consumer feedback packet（Anatomia / Auctra / Scaena）

日期：2026-09-01。前提：9.2 最终门禁 + 9.3 独立审阅（`10-independent-review.md`）已通过。
范围声明：本 packet 是 **Workbench 消费方对三个 owner 侧的对接需求说明**，只引用本 change 的本地合同冻结、浏览器/安全 evidence 与未证明项；**不含、不代办**任何外部 owner 仓实施、Provider 调用或 production 晋级。所有引用的 run-id 均为 local fixture/loopback 层级（`details/09-closeout-evidence.md` §1），不声明任何外部 owner 已验证。

## 0. Workbench 消费边界（对所有 owner 一致）

- Workbench 只消费 **server-authored read-only safe projection**（`workbench.spatial_replica_workspace_projection.v1alpha1`）：exact refs / version / digest / freshness / safe summaries / time+coordinate+scale / allowed actions / receipt refs（proposal.md Impact）。**不复制 canonical**：不保存 screenplay body、storyboard graph、ReplicaStage geometry、dense evidence、artifact blob；无 DB migration、无第四套 domain state（design §2；9.3 §1.1 复核通过）。
- 浏览器永不直连 owner：只经 same-origin BFF + Workbench composition service；owner credential / private locator / 内部 host 不出 server（9.3 §1.5）。owner media 只以 server 签发的 `wb:preview:*` opaque ref（15min TTL）出现。
- mutation 永远回到 owner canonical：typed action → server revalidation → 既有 TaskService → owner receipt/reconcile；`unknown_accept` 只 reconcile 不重投（9.3 §1.4）。Workbench 侧永远不发自由格式 stage edit。
- owner 合同不可用时对应 segment/Pane truthful `needs_contract`/`offline`/`stale`，不以 mock 冒充 ready；其余 segment 不受遮蔽（design §3/§11）。
- 合同兼容性口径：additive、experimental `v1alpha1`、default-off；capability 由 Workbench server env 独立开关（十个 `WORKBENCH_SPATIAL_REPLICA_*_ENABLED` + exact-principal cohort `WORKBENCH_SPATIAL_REPLICA_COHORT`，details/04）。

## 1. Anatomia（source evidence + spatial inquiry）

| 项 | 值 |
| --- | --- |
| 需要的合同 | `anatomia.spatial_evidence_projection.v1`（fixture 占位名，`contract.go:63-70` 冻结）+ `anatomia.spatial_inquiry.v1`（inquiry 合同，`composition.go:384`）+ correction receipt 合同 `anatomia.correction.receipt.v1` |
| 当前状态 | **needs_contract**：由 deterministic fixture adapter（`service/internal/adapters/spatialreplica_fixture.go`）供给，无真实 owner runtime |
| 阻断效应 | 缺失时 anatomia segment truthful `needs_contract`；source player/overlay/evidence 层与 inquiry 入口不可用，scaena segment 不受遮蔽 |
| 独立 change | Anatomia owner 仓发布真实 public contract + adapter（owner=Anatomia；Workbench 只消费已发布合同） |

字段要求（`SpatialReplicaSourceProjection`，proto 327-336）：
- `source_ref` + `duration`（rational）；**`pts_map` 必须是 owner exact PTS map**（`frame_policy` 唯一合法值 `owner_pts_map`）：`timebase`、显式 `segments`（cut/gap 成段）、`discontinuities`、`inline_frame_intervals` 或 `frame_intervals_ref`——Workbench 禁止 `time×fps` 推算帧号（9.3 §1.3）。
- `layers[]`（≤10）：grayscale/depth/mask/flow/skeleton/camera/quality 七类 closed kind；每层 `snapshot_ref`/`bundle_ref`、`pts_coverage[]`、`scale_tier`、`currentness`、`limitations`；**numeric artifact 与 preview rendition 必须分立**（`NumericArtifactRef` 需 coordinate frame+unit+lineage，缺即 claim-limited；preview ref 进数值 API 一律拒绝）。
- media locator（server-only，不入 wire）：approved https origin 内、无 query/fragment/userinfo；Workbench 侧再换 opaque preview ref。
- freshness：`readiness`（available/degraded/offline/needs_contract/permission_required/contract_mismatch）+ `currentness`（current/last_confirmed/stale/revoked/unknown）+ `last_confirmed_at_unix_ms` + `owner_cursor`——三态独立表达，Workbench 绝不互相推断。
- identity 回执（`IdentityClaims`）：project/episode/shot/source ref 逐字段 exact 相等参与跨 owner 闭合，display name 永不参与 join。
- inquiry（`AskSpatialReplica`）：答案必须带 Snapshot/bundle lineage、PTS range、coordinate/unit、confidence/uncertainty、limitations、evidence refs；metric 证据不足时明确拒答米制；回答不 mutation。
- capability flags：`spatialReplicaProjectionRead`（根）+ `spatialReplicaMediaPreview` + `spatialReplicaInquiry` + `spatialReplicaAnatomiaCorrection`（Workbench 侧开关，owner 无需自设）。
- **owner 需要后续提供**：①真实 `anatomia.spatial_evidence_projection.v1` 合同与 projection endpoint（版本/摘要/freshness 语义对齐上表）；②media origin allowlist 配置项（Workbench env `WORKBENCH_SPATIAL_REPLICA_MEDIA_ORIGINS` 需要 owner 公布批准的 https origin 列表；多 origin 场景建议 owner 侧直接回绝对 URL，见 10-independent-review P2-2）；③inquiry 合同的真实实现（fixture 只回 deterministic 结果）；④correction receipt 通道。

预算（details/05 §2，owner 投影生成时须自限）：evidence layers ≤10、joints/actor ≤25、projection response 总量 ≤256 KiB（超限 Workbench 判 `contract_mismatch`）、inquiry question ≤512 chars。

## 2. Scaena（ReplicaStage / storyboard / stage mutation / review-freeze）

| 项 | 值 |
| --- | --- |
| 需要的合同 | `scaena.replica_stage_projection.v1`（fixture 占位名）+ stage/review/freeze receipt 合同 `scaena.stage.receipt.v1`/`scaena.review.receipt.v1`/`scaena.freeze.receipt.v1` |
| 当前状态 | **needs_contract**：deterministic fixture adapter 供给 |
| 阻断效应 | 缺失时 scaena segment truthful `needs_contract`；3D viewport/storyboard Pane/stage mutation/review-freeze descriptor 不可用，anatomia source 审阅不受遮蔽 |
| 独立 change | Scaena owner 仓发布 ReplicaStage public projection 合同 + stage mutation/review/freeze Task 通道（含 expected-version/idempotency/receipt）；replica video 生成已另册（`scaena-replica-video-generation-v1`，moved-owner） |

字段要求（`SpatialReplicaStageProjection`，proto 400-418）：
- `stage_ref`/`stage_version`/`mode`；**`evidence_binding_segment` 必须指向 anatomia source segment 的 resource_ref**（Workbench 闭合 source identity，不一致即 identity_mismatch）；optional `screenplay_binding_segment`。
- `coordinate_frame`：P1 冻结 right_handed/+Y up/look -Z + `unit` + `capture_profile_ref`（缺失则 Workbench 把 claim ladder 收紧到 layout_only、禁 metric 结论）。
- `scale_tier`（unknown/relative/metric_approximate/metric_verified）+ `claim_scopes[]`（quantity/unit/tolerance/evidenceRefs/excludedRegionRefs）——**`metric_verified` 之外的任何视觉相似性不构成验收**。
- `objects[]`（browser-budgeted primitive graph，总量 ≤64，fixture 24）：closed object kind + truth_layer（evidence/candidate/production_override/frozen）+ `pts_range` + `budget_cost`；`browser_budget`（declaredCost/maxPrimitives）超限 Workbench 显式 `view_too_large`，不静默降采样。
- `motion`（keyframes/curve ≤32）、`candidates[]`（≤4，selected 标记 + provenanceRefs + quality）、`frozen`（frozenRef/stageVersion/receiptRef）、`derivatives[]`（GLB 等，lazy 加载，私有路径不入 wire）。
- mutation 通道：action descriptor 由 **Workbench server 合成并 revalidate**（`scaena.stage.proxy.revise`/`keyframe.revise`/`retarget.submit`/`completion.select`/`review.submit`/`freeze.submit`），owner 侧必须接受 typed Task：expected owner version + idempotency key + closed input JSON（≤16 KiB）+ receipt 回流 + `unknown_accept` reconcile-only 语义；review/freeze 强制 confirmation。
- freshness：同 §1 三态独立语义；review/freeze 状态迁移经 receipt 事件（owner cursor）进 workspace stream，Workbench 不复制 Scaena production state machine。
- capability flags：`spatialReplicaProjectionRead` + `spatialReplicaViewport3d` + `spatialReplicaStageMutation` + `spatialReplicaReviewFreeze`（后者依赖前者，details/04 行 6/7）+ `spatialReplicaScaenaPane`。
- **owner 需要后续提供**：①真实 `scaena.replica_stage_projection.v1` 合同（建议直接给 browser-budgeted primitive graph 或 versioned safe artifact manifest——design Open Question 已列，二选一由 Scaena 决定后回写）；②stage mutation/review/freeze 的 typed Task endpoint + receipt/reconcile 通道；③stage media/derivative 的 approved https origin（入 Workbench media allowlist）；④deep-link host 批准（见 §4）。

## 3. Auctra（screenplay safe projection）

| 项 | 值 |
| --- | --- |
| 需要的合同 | `auctra.screenplay_projection.v1`（fixture 占位名） |
| 当前状态 | **needs_contract**：deterministic fixture adapter 供给；可选 segment（optional Auctra screenplay safe projection） |
| 阻断效应 | 缺失时 auctra segment truthful `needs_contract`，Pane 呈 metadata/deep-link-only；主 Replica Pane 与其他 owner 不受影响 |
| 独立 change | Auctra owner 仓按已发布 Service API 冻结 screenplay safe projection 深度（design Open Question：scene/beat/line 层级以 Auctra 已发布 Service API 为准；合同不足先 metadata/deep-link） |

字段要求（`SpatialReplicaScreenplayPanelProjection`，proto 435-445）：
- `screenplay_ref`/`screenplay_version` + `depth_granted`（episode/scene/beat/line/METADATA_ONLY closed 枚举；METADATA_ONLY 时 nodes 为空）；`nodes[]` ≤500（`node_ref`/depth/parent/order_key/`safe_text` ≤2000 chars）——**只携带 owner 授权的 safe text，永不携带 canonical screenplay body**。
- `deep_link`：`url_template` 必须 https、host ∈ 冻结 allowlist、path 前缀受 host 绑定、无 query/fragment/userinfo/port（`contract/deeplink.go`）。
- freshness：同上三态独立语义 + review/currentness。
- capability flags：`spatialReplicaAuctraPane`（依赖 projectionRead）。
- **owner 需要后续提供**：①真实合同实现（safe text 深度授权语义）；②deep-link host/路径前缀批准值（见 §4）。

## 4. Workbench 侧需要 owner 配合的横切配置（非合同字段）

1. **media origin allowlist**：`WORKBENCH_SPATIAL_REPLICA_MEDIA_ORIGINS`（CSV，https 精确 origin）——Anatomia/Scaena 公布各自的 approved origin；owner 侧建议回绝对 URL locator（相对路径 + 多 origin 时 Workbench 绑定不确定，P2-2 follow-up）。
2. **deep-link host 批准**：`DefaultAllowedDeepLinkHosts`（`contract/deeplink.go:11-16`）当前是 `*.internal.yeisme.net` 冻结默认；Auctra（/screenplay/）、Scaena（/stage/）正式接入前须 owner 确认真实 host+path 前缀，禁止运行时接受任意 host。
3. **exact-principal cohort**：十 capability 独立 default-off，cohort（`WORKBENCH_SPATIAL_REPLICA_COHORT`）按 exact principal 开放；owner canary 时需与 Workbench 运维确认 principal 名单与独立开启顺序（projection read → media/viewport/pane → inquiry/action）。
4. **错误码词汇**：三 transport 共用 02 §8 冻结 12-code 表（`contract.go:19-32`）；owner adapter 折叠为 `needs_contract/permission_required/offline/contract_mismatch` 四类 truthful 降级，owner 侧错误原文不回流。

## 5. Evidence 引用（全部 local fixture/loopback 层级，非外部验证）

- 合同冻结：`details/02-contract-freeze.md`（字段号/enum/error model）、`details/04-capability-truth-table.md`（十 capability + cohort + rollback）、`details/05-p1-fixture-dependency-budget.md`（预算表）。
- 浏览器/安全/性能：component run `20260901173934-7826e3b4`（vitest 家族+SDK+security+media proxy）、e2e run `20260901174256-f8fb5ea4`（57 replica Playwright：critical/responsive/zoom/a11y/visual matrix）、8.6 验收 run `20260901174435-0105afe9`；9.2 门禁 run `20260901181913-6cd7c8c0`/`20260901182030-a575d6df`。完整清单见 `details/09-closeout-evidence.md` §1。
- 独立审阅：`details/10-independent-review.md`（五面 PASS、0 P0/P1、3 P2 follow-up）。

## 6. 未证明项重申（09-closeout §6，owner 对接时不得当作已完成）

- Provider / 真实 owner runtime 未接（全部 segment 现为 fixture adapter）。
- Replica video 未做（Scaena 后续 change）。
- 真实视觉相似性 metric 非 Workbench 验收面（owner canary 单独证明）。
- 所有 evidence 为 local fixture/loopback，不证明 production；性能数字为 fixture 口径非 SLO。

## 7. Dependency ledger（验收表）

| Dependency | Owner | Required contract/version | Current status | Blocking effect（缺失时） | 独立 change |
| --- | --- | --- | --- | --- | --- |
| Anatomia evidence projection | Anatomia | `anatomia.spatial_evidence_projection.v1` ≥v1 | needs_contract（fixture） | source/evidence/inquiry 面 needs_contract，不遮蔽 scaena | Anatomia owner change（真实合同+adapter） |
| Anatomia spatial inquiry | Anatomia | `anatomia.spatial_inquiry.v1` | needs_contract（fixture） | inquiry 入口 truthful 禁用 | 同上 |
| Anatomia correction receipt | Anatomia | `anatomia.correction.receipt.v1` | needs_contract（fixture） | correction action descriptor 不可用 | 同上 |
| Scaena ReplicaStage projection | Scaena | `scaena.replica_stage_projection.v1` ≥v1 | needs_contract（fixture） | 3D/storyboard/stage mutation 面 needs_contract | Scaena owner change |
| Scaena stage/review/freeze receipts | Scaena | `scaena.{stage,review,freeze}.receipt.v1` | needs_contract（fixture） | 对应 descriptor 不可用；draft 有编辑无提交目标 | 同上 |
| Replica video generation | Scaena | —（moved-owner） | moved-owner/retain-next | 无（非本 change 面） | `scaena-replica-video-generation-v1` |
| Auctra screenplay safe projection | Auctra | `auctra.screenplay_projection.v1` ≥v1 | needs_contract（fixture，optional segment） | Pane metadata/deep-link-only | Auctra owner change（按已发布 Service API 定深度） |
| Media origin allowlist | Anatomia+Scaena→Workbench 运维 | env `WORKBENCH_SPATIAL_REPLICA_MEDIA_ORIGINS` | 未配置（fixture loopback 不需要） | media preview resolve needs_contract（无批准上游） | Workbench 配置项（owner 公布 origin 后填写） |
| Deep-link host approval | Auctra/Scaena→Workbench 运维 | `DefaultAllowedDeepLinkHosts` 扩展 | 冻结 internal 默认值 | 非 allowlist host 的 deep link 全拒绝（fail closed） | Workbench 合同层小 change（owner 批准值回填） |
