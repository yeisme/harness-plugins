# 0.4 Server-owned capability truth table（2026-09-01 冻结）

> 对应 task 0.4。本文冻结十个 server-owned capability 的 owner、行为矩阵与 rollback。
> 实现纪律直接继承既有 `service/internal/spatial/capability.go` + `service/internal/runtime/spatial_capabilities.go` 模式：**capability 只来自 server 进程配置（env）**；快照只读暴露给浏览器渲染 truthful 面板，读取不授予任何 capability；flag 取值仅 `true|false|空`，非法取值 startup fail-closed；`Source` 恒为 `server_config`。

## 1. 总规则（fail-closed 不变量）

1. 每个 capability 独立 default-off：`WORKBENCH_<ID>_ENABLED` 未设置 = `not_enabled_by_default`；`false` = `server_config_disabled`；`true` = `ready`；其他值 = startup error。
2. **exact-principal scope**：capability 可用 = `flag ready` **且** principal ∈ exact-principal cohort（CSV env `WORKBENCH_SPATIAL_REPLICA_COHORT`，`splitCSV` 惯例；P1 单 cohort，后续可 additive 细分）。URL、query、localStorage、build flag、HTTP 200、endpoint 可达性**一律不是** enable 路径——任一 browser-only enable path 视为 fail-open（task 0.4 验收语）。
3. capability（server config）≠ owner contract state（`needs_contract/offline`）≠ principal scope（`permission_required`）。三者独立表达，投影层按 §2 每行的矩阵合成，绝不互相推断。
4. revoke/off 收敛行为统一：停 workspace stream、清 projection cache、撤 descriptor、卸 Three renderer；保留 conversation、既有 Pane、Task/proposal/receipt 与 owner canonical state；不删除任何数据（rollback 是 config-only）。
5. readiness enum：`available|degraded|offline|needs_contract|contract_mismatch|permission_required|unavailable`；currentness enum：`current|last_confirmed|stale|revoked|unknown`（见 02-contract-freeze §2）。

## 2. Truth table（10 行）

| # | Capability id（稳定 machine id） | Env flag | Canonical owner / Workbench 边界 | Prereq | enabled | disabled | needs_contract | offline | revoked | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `spatialReplicaProjectionRead` | `WORKBENCH_SPATIAL_REPLICA_PROJECTION_READ_ENABLED` | Workbench composition service 组合 read projection；owner 只提供 safe refs | —（根 capability） | `GetSpatialReplicaWorkspace` 可用；segments 独立 readiness | 全部 replica Pane `unsupported/unavailable`，conversation 不受影响 | 对应 segment 显示 `needs_contract` + contract name/version 要求，其余 segment 照常 | 该 segment `offline` + last-confirmed；不遮蔽其他 current segment | segment `revoked`；action/依赖 Pane 禁用 | flag→false：停 read、清 cache；无迁移 |
| 2 | `spatialReplicaMediaPreview` | `WORKBENCH_SPATIAL_REPLICA_MEDIA_PREVIEW_ENABLED` | BFF same-origin media proxy（task 2.7）；owner credential 不出 server | 1 | source/preview 播放可用；Range 受限 | source player 显示 `needs_contract` 式不可用，timeline/event list 保留 | n/a（属 transport capability；owner 媒体不可达按 `offline`） | proxy 拒绝新请求，在播片段自然结束 | 同 disabled + 清 ref | flag→false：拒新请求、失效 opaque ref |
| 3 | `spatialReplicaViewport3d` | `WORKBENCH_SPATIAL_REPLICA_VIEWPORT_3D_ENABLED` | Workbench renderer（lazy `three` behind `ReplicaViewportAdapter`）；Scaena 只给 safe primitive graph | 1 | viewport 可 lazy mount（仅 `>=1024` 完整形态） | 不加载 3D chunk；DOM object list/summary 替代（`webgl_unavailable` 类同路径） | Scaena stage contract 未发布 → viewport 区域 `needs_contract`，source/timeline 照常 | stage segment `offline` → viewport 显示 last-confirmed + offline | 卸 renderer、释放 GL 资源、退 DOM mirror | flag→false：chunk 永不加载，资源释放 |
| 4 | `spatialReplicaInquiry` | `WORKBENCH_SPATIAL_REPLICA_INQUIRY_ENABLED` | Anatomia typed inquiry read/compute contract；Workbench 只透传+展示 | 1 | `AskSpatialReplica` 可用；答案带 lineage/limitations | inquiry 入口隐藏/禁用，reason `not_enabled_by_default` | Anatomia inquiry contract 未发布 → `needs_contract`，preset 列表只读 | inquiry 返回 `offline`，draft question 保留 session 内 | 停止新 inquiry；已有 result 只读 | flag→false：路由摘除；无持久化 |
| 5 | `spatialReplicaAnatomiaCorrection` | `WORKBENCH_SPATIAL_REPLICA_ANATOMIA_CORRECTION_ENABLED` | Anatomia canonical correction（typed Task）；Workbench 只 descriptor+revalidate | 1 | evidence correction descriptor 出现（仍需 base descriptor ready + principal scope） | 无 correction action；Inspector Evidence 层只读 | Anatomia correction contract 未发布 → descriptor `needs_contract` | descriptor `offline`；已 submit 的 Task 走既有 reconcile | descriptor `revoked`；打开中的 dialog submit 禁用 | flag→false：撤 descriptor；Task/receipt 保留 |
| 6 | `spatialReplicaStageMutation` | `WORKBENCH_SPATIAL_REPLICA_STAGE_MUTATION_ENABLED` | Scaena stage/motion/completion canonical mutation；Workbench ephemeral draft + submit | 1 | proxy/keyframe/retarget/completion descriptor 可用（expected-version+idempotency） | stage 只读；draft 仍可编辑但无 submit target（明示原因） | Scaena mutation contract 未发布 → `needs_contract` | descriptor `offline`；pending Task 走 reconcile | descriptor `revoked`；draft 标 stale，submit 禁用 | flag→false：撤 descriptor；pending Task 不取消（owner 侧收敛） |
| 7 | `spatialReplicaReviewFreeze` | `WORKBENCH_SPATIAL_REPLICA_REVIEW_FREEZE_ENABLED` | Scaena review/freeze canonical；confirmation 强制 | 6（stage mutation 之上） | review/approve/request-changes/freeze 可用；`review_required` confirmation | review/freeze 动作消失；其余 stage 编辑不受影响 | 同 6 行语义 | freeze descriptor `offline`；已 accepted freeze 显示 pending/unknown 收敛 | descriptor `revoked`；Frozen 层不更新 | flag→false：撤 descriptor；已 frozen 版本保留 |
| 8 | `spatialReplicaAuctraPane` | `WORKBENCH_SPATIAL_REPLICA_AUCTRA_PANE_ENABLED` | Auctra screenplay safe projection；Workbench 不存 body | 1 | `agent.auctra-screenplay.v1` 可注册/打开 | Pane catalog 保留条目 + `not_enabled_by_default` reason，不打开 stub | Auctra 未授权正文 → truthful metadata-only + deep link（`needs_contract`） | Pane `offline` + last-confirmed；Replica 主 Pane 照常 | Pane 关闭 + focus 返回 shell；stream 停 | flag→false：Pane 不可开；conversation 不动 |
| 9 | `spatialReplicaScaenaPane` | `WORKBENCH_SPATIAL_REPLICA_SCAENA_PANE_ENABLED` | Scaena storyboard/SceneGEO/ReplicaStage safe projection | 1 | `agent.scaena-storyboard.v1` 可打开；mode/binding/currentness 可见 | 同 8 行模式 | Scaena panel contract 未发布 → `needs_contract` | Pane `offline`；stage-dependent action 禁用 | Pane 关闭 + announce | flag→false：同 8 |
| 10 | `spatialReplicaReceiptStream` | `WORKBENCH_SPATIAL_REPLICA_RECEIPT_STREAM_ENABLED` | Workbench workspace event stream（聚合 owner freshness + Task/receipt） | 1 | `WatchSpatialReplicaWorkspace` 可用；每 workspace ≤1 browser stream | receipts Pane 显示既有 Task 静态读取（无 live），明示 stream 未启用 | n/a（Workbench 自有 capability） | stream 断开 → cursor resume；gap → `resync_required` + snapshot fence | 停 stream、清 cursor；Pane 显示 last-confirmed | flag→false：断流、Pane 降级为静态读 |

行数：**10**。Prereq 链：2–10 全部依赖 1（projection read 是根）；7 依赖 6。Prereq off 时下游按 disabled 处理（不显示为 owner 故障）。

## 3. 与实现面的绑定（wave 2 落点）

- 解析器：`service/internal/spatialreplica/capability.go`（新增，模式对齐 `spatial.ResolveSpatialCanvasCapabilities`）；flag 解析 helper 对齐 `spatialCanvasCapabilityFlagFromEnvironment`；快照 contract version 冻结为 `workbench.spatial_replica_capabilities.v1`。
- wiring：`service/internal/runtime/runtime.go` env 读取（10 个 flag + 1 个 cohort CSV）+ 只读 status handler（`Cache-Control: no-store`）。
- capability id 同时是稳定 reason code 与 SDK capability id（对齐既有 `CapabilityViewportV3` 惯例）。
- descriptor 绑定：`SpatialReplicaActionDescriptorV1.required_capability` 取上表 id（行 4–7）。

## 4. 验收证据（本波为冻结基线，非实现）

- 冻结命令基线（2026-09-01，于 `service/` 执行）：`CGO_ENABLED=0 go test ./internal/config ./internal/runtime -count=1` → `ok internal/config 0.005s`、`ok internal/runtime 48.430s`。此为 0.4 引用的既有 gate 基线（config/runtime 包在 capability wiring 未落地时保持全绿）；capability 行为测试属 task 2.8（`-run 'Capability|Rollback|Shutdown'`）。
- fail-open 复查：当前 truth table 无任何 browser-only enable 路径；cohort/flag 均为 server env。
