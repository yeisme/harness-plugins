## 1. Authority and compatibility baseline

- [x] 1.1 Record affected stable surfaces, additive migration, old SDK shim/deprecation and rollback boundaries.
- [x] 1.2 Add TaskService-gated spatial change-set operation and canonical PA decision/frozen-fact executor boundary.
- [x] 1.3 Return task/snapshot/receipt for success and replay; add four transport and SDK parity coverage.

## 2. Spatial production composition

- [x] 2.1 Canonicalize <=2k and async layout proposals before they become acceptable.
- [x] 2.2 Bind production Board watcher and closed snapshot/event/resync watch union with old SDK shim.
- [x] 2.3 Bind safe owner/runtime projection adapters and fail closed cross-tenant/expired inputs.
- [x] 2.4 Connect GORM tile/density projection invalidation/rebuild and revision-bound viewport reads.

## 3. Web authority and capability enforcement

- [x] 3.1 Replace direct apply UI with PA decision/Task/receipt presentation and reconcile-only unknown states.
- [x] 3.2 Carry negotiated Agent spatial intent through real session/route guards into Surface; add E2E.
- [x] 3.3 Enforce desktop envelope before query/worker/renderer and probe WebGL2/OffscreenCanvas for explicit degraded fallback.

## 4. Verification and evidence

- [x] 4.1 Add focused unit/integration/component/e2e tests for authority, transport/watch, owner/runtime, Agent intent, desktop gate and index revision.
- [x] 4.2 Run focused Go/TS/typecheck/contract checks and official integration/e2e evidence commands; record only verified task completion.

## 最终实现与验证证据

- 最终门禁：`openspec validate --all --strict` 55/55、`buf lint`、`CGO_ENABLED=0 go test ./service/...`、分段 `go test -race`、`bun run typecheck`、`bun test`（763 pass / 8 skip）、`bun run build`、`bun run test:contract`（463/463）、`bun run --cwd apps/web test`（139 pass / 6 skip）、`bun run test:integration`、`bun run test:e2e` 全部通过。
- 最终独立审阅：无 P0/P1。Task runtime 精确生产形状 `targetKind=task`、`taskRef`、`runRef=""`、`runVersion="1"` 已通过 SDK closed codec；Workflow `validate/publish/start` descriptor 已通过真实 `QuerySurface` composition。
- 脱敏证据：integration `temp/integration-test-runs/20260829225442-ab8775de-c115-4b75-af6a-034f5154166f/`；e2e `temp/integration-test-runs/20260829225549-a34f2f48-61b9-4512-a87a-fce32bb5fc63/`。两者均含 `summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json`、`artifacts/`，且 redaction 通过。

- 2.4 repair：`CGO_ENABLED=0 go test ./service/internal/repository -run 'Test(BoardMutationInvalidatesProjectionIndexHeadInSameCommit|BoardCommitInvalidatesReadySpatialProjectionBeforeNewRevisionBuild|DisplayOnlyBoardCommitPreservesReadySpatialProjectionHead|SpatialProjection)' -count=1` 通过；覆盖 complete grid、revision fence、display-only preserve、parking、backoff、capacity 与 cancellation。
- 2.4 repair：`CGO_ENABLED=0 go test ./service/internal/spatial -run 'TestQuerySurface(FarDensity|Uses|Falls|Composes)' -count=1` 通过；覆盖 ready far 的 canonical counter 为零、最终 Board read resync race、zoom gate 与 degraded fallback。
- 2.4 PostgreSQL：以 disposable local PostgreSQL `WORKBENCH_TEST_POSTGRES_URL` 运行 `CGO_ENABLED=0 go test ./service/internal/repository -run '^TestPostgresBoardViewportCapacityGate$' -count=1 -v` 通过。50k nodes / 75k relations / 1k groups 经真实 job→claim→build→publish 后，HTTP `QuerySpatialSurface` 30 次 warm far read p50 0ms、p95 1ms（≤150ms），返回 80 tiles；GORM statement callback 仅见 `boards`、`board_spatial_projection_heads`、`board_spatial_tiles`，无 `board_nodes`、`board_edges` 或 `board_groups`。同 gate 的 canonical near/medium/far p95 为 0/5/9ms，并记录 named tile-index EXPLAIN。
- 2.4 display-only repair：`CGO_ENABLED=0 go test ./service/internal/repository -run 'Test(DisplayOnlyRebindServesFreshFarSurfaceWithoutWorker|DisplayOnlyBoardCommit|SpatialProjection|BoardCommitInvalidatesReadySpatialProjection)' -count=1 -v` 通过；完整 head 同事务 rebind 到 revision 2 与新 digest，真实 HTTP far Surface 无 worker 即返回 fresh tile provenance；不完整 tile/head 则清除并排队精确 revision rebuild。
- 2.4 publish/commit concurrency repair：以 disposable local PostgreSQL `WORKBENCH_TEST_POSTGRES_URL` 运行 `CGO_ENABLED=0 go test ./service/internal/repository -run '^TestPostgresSpatialProjectionPublishSerializesWithBoardCommit$' -count=1 -v` 通过。两个独立连接证明 publish 持有 exact Board `FOR UPDATE` 后 commit 被阻塞并完成 revision rebind；commit 先完成时旧 publisher 返回 stale，未删除或覆盖新 revision 的 tile/head/job 状态。
- 3.1–3.3（独立前端验收）：`bunx vitest run test/spatial-change-set-review.test.tsx test/spatial-surface-kernel.test.tsx` 19/19；SDK spatial tests 8/8；`apps/web` typecheck 通过；diff check 通过。
- backend cross-layer repair：`orbit.proposal.accept` 仅在 PA flag + Eikona Owner 或 runtime-bound Spatial sealed target 时提升；`spatial.change_set.apply` 标记 internal-only，普通 Task submit 在持久化前拒绝。Spatial proto 以可选字段新增 `owner_segments`、watch `current_revision` 与 `GetSpatialSurfaceRevision`；HTTP `GET /v1/spatial/surfaces:revision?surface_ref=...`、gRPC `GetSpatialSurfaceRevision`、JSON-RPC `workbench.spatial.v1.GetSpatialSurfaceRevision` 读同一授权 Board revision。投影 tile publish 使用 `CreateInBatches(...,256)` 保持单事务且避开 PostgreSQL bind 上限。
- Agent spatial intent 后端：`AgentOutputV1.spatialIntents`、turn list `includeSpatialIntents` 与 directory watch 同为 additive negotiated read projection；服务端 cohort `WORKBENCH_AGENT_SPATIAL_INTENT_COHORT` 未命中或未请求时省略。输出只由 durable safe turn event 的 closed projector 生成，当前 proposal 映射为 `preview_change_set/review`，不含 prompt/provider payload/reasoning，也不自动执行。
- Agent watch evidence：`CGO_ENABLED=0 go test ./service/internal/agent ./service/internal/transport/agentgrpc -run 'Test(ListTurnsProjectsPersistedSafeSpatialIntentOnlyWhenNegotiatedAndEnabled|WatchAgentSessionDirectoryStreamsDurableSQLiteActivity)$' -count=1 -v` 通过。SQLite durable Task event 经真实 gRPC directory watch 在 negotiated cohort 中输出单调 sequence/ref 的 `preview_change_set`；同一事件未协商时 `outputs` 省略，测试断言无 raw prompt/provider payload。
- Runtime overlay discriminator：`SpatialRuntimeProjection.targetKind`/`taskRef` 为 additive closed transport fields。`workflow.validate`/`workflow.publish`/`workflow.start` 只对 `targetKind=workflow` 通过 closed action allowlist，`task` 仅允许 `task.reconcile`。`CGO_ENABLED=0 go test ./service/internal/runtime ./service/internal/spatial ./service/internal/transport/spatialgrpc -run 'Test(RuntimeSpatialOverlaysUseAuthorizedWorkflowAndTaskProjections|ComposeRuntimeOverlaysRejectsActionsForWrongRuntimeTarget|SpatialSnapshotCodecIncludesOnlySafeOwnerSegments)$' -count=1 -v` 通过；真实 `QuerySurface` 组合路径中 draft workflow 保留 validate/publish、published 保留 start，task unknown_accept 只显示 reconcile 且无 fabricated definition。
