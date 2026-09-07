## Context

V1 的 spatial facade 已有 closed codecs、Board atomic commit 与 ProposalAuthority facts，但接受 UI 仍直接调用 spatial apply，runtime 未完整绑定 watcher/owner/runtime ports，导致已通过局部测试的能力不能证明 production authority 闭环。本 remediation 只扩展 Workbench 组合层；Owner truth、Workflow runtime、Approval 和 receipt 仍各自权威。

能力 ledger：Spatial composition/Review/desktop gate 为 `fit`；Owner projection、Workflow/Task/Approval/receipt 为 `split-owner`；移动 Web、CRDT、浏览器直连 Owner、任意代码执行为 `reject-now`。

## Goals / Non-Goals

**Goals:**

- 所有可接受 spatial proposal 均有 PA frozen facts、decision、Task 和 Board receipt；Board mutation 只在 Task executor 内发生。
- apply 成功、replay、conflict、unknown/decision_unknown 与 reconcile 保持可观察、四 transport parity 和旧 SDK 兼容。
- production watcher/projection/Agent intent/desktop renderer/tile index 都有真实装配和测试证据。
- 仅 additive 契约与 additive GORM migration；无 raw business SQL。

**Non-Goals:**

- 不迁移 Owner canonical state，不增加移动 Web UI/触摸分支，不引入 CRDT、Rust/cgo/Electron/Tauri，也不宣称跨服务原子事务。

## Decisions

1. **Task-gated executor。** PA accept 创建唯一 Task，Task handler 加载 frozen spatial facts 并调用现有 atomic `Authority`。替代「UI 调 apply」与「PA 直接 commit」；前者无决策审计，后者绕开 Task receipt。`orbit.proposal.accept` 是公开 catalog entry，只有 PA flag 与至少一个真实 selected safe target contract 同时就绪才提升为可提交；该 target 可以是 Owner contract，也可以是同一 runtime 已绑定、仅由 sealed decision 调度的 Spatial executor。不存在真实 target 时保持 unavailable；`spatial.change_set.apply` 本身不能经公共 Task submit 调用。
2. **Additive response/watch evolution。** `taskRef`、canonical snapshot、receipt 与 closed `SpatialWatchEventV1` 通过新可选字段/方法加入；旧 `watchSpatialSurface` 继续映射 snapshot/resync，标记为 compatibility shim 一个 release。
3. **布局统一注册。** <=2k layout 仍可即时生成 preview，但只有 registrar 成功后才返回可接受 proposal；不能注册时返回 preview-only，UI 不提供 Accept。
4. **Safe projection ports。** runtime bootstrap 只绑定经过 typed adapter 过滤的 owner/runtime refs、provenance、descriptors、receipt/evidence；拒绝 raw payload、跨租户和过期 descriptor。
5. **Capability-first mounting。** route 先判 desktop media envelope；不满足则不请求 surface、不创建 worker/WebGL。renderer 首帧独立探测 WebGL2 与 OffscreenCanvas，任一缺失为 `degraded` bounded fallback。
6. **Projection index as derived state。** 0039/0040 additive migration 增加 `board_spatial_projection_jobs`、`board_spatial_projection_heads` 与 retry/parking 字段；Board commit 在同一事务为 geometry、membership 或 density mutation 删除旧 head 并 upsert required revision job，绝不在 Board 事务中全量 rebuild，也不复用 `board_outbox` consumer。density-neutral display-only mutation 必须尝试对 complete head 做同事务 revision rebind：所有 matching tiles 和 head 更新到新 revision，digest 由旧 digest 与新 revision 确定性派生；任一 head/count/digest/row 条件不完整即删除 head/ambiguous tiles 并排队新 revision job，绝不保留不可读旧 head 或 stale pending job。独立 worker 在事务外先 Count 限制 50k nodes/75k relations/1k groups，再以分批 GORM 读取构建完整 far grid；publish transaction 必须先对 exact active Board row 持有 GORM `FOR UPDATE` 锁，再校验 revision+lease 并批量替换 tiles/head，因此 publish-first 会让 commit 随后 rebind，commit-first 则使旧 publish 在任何删除/写入前以 stale 退出。超过 tile/capacity 的有效 Board 进入持久 `parked`，瞬态失败以 `next_attempt_at` 指数退避，下一 density revision 才重置 pending。far、zoom bucket 0、无复杂 filter 的 viewport 在 canonical `QueryViewport` 之前读取 index，并以最终授权 Board read 作为线性化点；head revision、完整网格 coverage、持久化 tile 总数和 digest 任一不匹配即走 bounded canonical fallback 并标为 `degraded`，不得返回旧 revision。`128` 只限制单次 viewport tile read，完整 Board projection 另有可审计的 `4096` tile 上限；medium/near 始终读取 canonical details。
7. **Negotiated Agent spatial intent。** 已持久化的安全 turn event 只在客户端显式请求、服务端 exact cohort 允许且 output projector 通过 closed validation 时，才派生 `AgentSpatialIntentV1`。它是 `AgentOutputV1.spatialIntents` 的可选 read projection，并通过已有 turn list 与 session-directory watch 的 HTTP/gRPC/JSON-RPC surface 输出；默认省略。当前 reference proposal event 只生成 `preview_change_set` + `review` Lens，不能执行、持久化或替代 `AgentPresentationIntentV1`，且不读取 raw prompt/provider payload/hidden reasoning。
8. **Runtime projection discriminator。** `SpatialRuntimeProjection.targetKind` 为 closed `workflow|task`。workflow 必须携带 definition ref/version（run 时再携带 run ref/version）；task 必须携带 task ref 与 task version，definition 字段恒为空。Surface composer 以 target kind 关闭式校验 action：仅 workflow 可携带 `workflow.validate`/`workflow.publish`/`workflow.start`/pause/resume/cancel，task 仅可 `task.reconcile`。Draft definition 的服务器描述符仅暴露 `workflow.validate`/`workflow.publish`，published definition 暴露 `workflow.start`；它们继续调用既有 WorkflowService 合同，run 的 pause/resume/cancel/reconcile 仍由既有 WorkflowControl/Task authority 决定，未知 task 仅可 `task.reconcile`。

## Risks / Trade-offs

- [Task executor wiring 增加延迟] → UI 展示 decision、Task、receipt 三个步骤，不声称同步提交完成。
- [旧 SDK 只认识 snapshot watch] → shim 将新 union 投影为旧 snapshot/resync；一个发布周期后再评估弃用。
- [projection index 滞后] → 以 Board revision 绑定，revision 不匹配时不返回陈旧 tile。
- [derived projection worker 暂未完成] → far viewport 走 bounded canonical fallback 并标为 `degraded`；不将缓存命中伪装成 ready，也不阻塞 Board commit。
- [desktop capability 检测差异] → 声明 `desktop-required`，不静默装载降级编辑器。

## Migration Plan

1. 先以 additive migration/operation/event fields 部署；旧 read/watch/apply response 可继续解析。
2. 启用 authority wiring canary：只有 PA+Task executor+board watcher 完整时 expose executable action；缺任一项为 `needs_contract`。
3. 更新 Web/SDK consumer 到 decision-first path，旧 watch shim 保留一个 release 并附 deprecation note。
4. 回滚：关闭 remediation authority/renderer/index feature wiring，保留 Board、PA、Task 和旧 SDK read/watch 合同；索引表为派生数据不影响 canonical Board。

## Open Questions

- 现有 Task operation registry 是否可在不扩宽 stable v1 enum 的前提下注册 `spatial.change_set.apply`；若不能，保持 action descriptor `needs_contract`，不得回退浏览器 mutation。
