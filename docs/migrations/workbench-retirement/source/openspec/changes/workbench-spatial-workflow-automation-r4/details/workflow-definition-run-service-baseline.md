# Workflow Definition Publish 与 Run Start Service 基线

## 1. 完成范围

截至 2026-08-02，R4 `5.3` 已在 `service/internal/workflows/service/**` 建立 definition publish/start 的集中应用服务边界：

- `CreateDraft` 创建 version `1` draft，并通过 domain DAG/step/registry/checksum validator；
- `UpdateDraft` 对当前 draft 执行 CAS 更新，或从 published/deprecated version 派生单调递增的新 draft；
- `Publish` 校验 expected version/checksum、required scopes、schema refs、capabilities 与 operation contract，再执行 immutable publish；
- `Deprecate` 可按明确 version deprecate published version，即使更高版本 draft 已存在，也不会修改旧 published content 或移动 current draft；
- `StartRun` 只接受 published version，固定 definition version/checksum/step registry digest，并创建 running run、ready root steps 与 pending downstream steps；
- definition mutation 与 run start 都使用 hashed idempotency key、canonical request digest 与原子 `Store` commit/replay 边界；相同请求重放返回原结果，不同 input digest 使用相同 key 时稳定返回 idempotency conflict；
- principal 只从 `security.Principal` context 读取；tenant、action scope、definition required scopes 与 trigger access均 fail-closed；跨 tenant 查询不泄露资源存在性；
- `ContractValidator` 将 schema、capability 与 trigger/input-digest 检查绑定为可组合生产边界，缺少 checker 时不允许 publish/start。

## 2. 并发与不可变性

- 多个不同 idempotency key 并发 publish 同一 draft 时，只有一个 CAS winner，其余返回 version conflict；
- 多个并发 duplicate start 共享一个 durable command identity，只产生一个 pinned run，其余返回 replay；
- published version 在派生新 draft 后保持原 checksum/content/state；
- published version 可在存在更新 draft 时独立 deprecate，current draft 不被覆盖；
- start 前再次校验 published state 与 checksum，deprecated version、checksum drift、invalid input digest 和 tenant mismatch均被拒绝。

## 3. Store 边界

`Store` 负责以下原子事实：

```text
definition mutation replay -> version/state CAS -> immutable version commit
run start replay -> published version/checksum check -> run + initial step set commit
```

`MemoryStore` 仅用于 service contract/race tests，不得被 production runtime 用于宣称 capability available。当前已新增 `GORMStore` 与 additive migration `0021_workflow_definition_run_store`，并由 local runtime 的 definition validation/mutation/read、tenant-scoped list、start/get-run、pause/resume/cancel control、durable `ListRunEvents` 与基于同一 durable source 的 bounded `WatchRunEvents` polling path 使用；`ReconcileRun`、PostgreSQL promotion 与 availability promotion 仍由 `1.5b` 完成。本基线不把 local parity 伪造成 production readiness。

## 4. 验证

```bash
task workflow:definition-service:test
task test:workflow-component SCENARIO=workflow-definition-service
task workflow:definition-validation-runtime:test
task workflow:event-list-runtime:test
task workflow:event-watch-runtime:test
```

Component evidence：

```text
temp/integration-test-runs/20260728121300-30e57a46-1609-40cc-9b36-4a2933fb2846/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

验证覆盖：

- unit：draft/update/publish/deprecate/start、invalid DAG/step、scope/capability/schema/checksum/input digest；
- concurrency：12 路 publish 单 winner、16 路 duplicate start 单 run；
- race：`CGO_ENABLED=1 go test -race ./service/internal/workflows/service -count=20`；
- static：`go vet ./service/internal/workflows/service`。

追加的 durable-store/runtime evidence：

- `CGO_ENABLED=0 go test ./service/internal/repository -count=1`；
- `CGO_ENABLED=1 go test -race ./service/internal/repository ./service/internal/workflows/service ./service/internal/transport/workflowhttp ./service/internal/transport/workflowgrpc ./service/internal/transport/jsonrpc ./service/internal/runtime -count=1`；
- `bun run test:integration` → `temp/integration-test-runs/20260801165530-8afcc656-37e1-4d91-93f4-e9275c6696f7/`，`status=passed`、`redaction=passed`；
- `TestLoopbackRuntimeWorkflowRegistryAndDefinitionReadParity` 与 `TestLoopbackRuntimeWorkflowDefinitionMutationParity` 验证 HTTP、JSON-RPC、gRPC 读取/变更同一 durable definition/run、checksum 与 idempotency；
- `bun test tests/conformance/workflow-sdk-runtime.test.ts` 验证 SDK 启动当前 `workbenchd`、读取同一 session token，并通过 typed HTTP client 完成 validate/create/update/publish/start/get-run/list/pause/resume/cancel/list-events/watch；该命令当前为 27 个断言通过。reconcile、PostgreSQL 和 provider canary 仍未纳入本证据。
- `task test:workflow-list:component` 及 evidence runner `temp/integration-test-runs/20260801194148-a2bf22c1-d624-4a34-91da-62ba6d005582/` 验证 tenant/workspace-scoped keyset `ListDefinitions`/`ListRuns` 的 service、SQLite GORM repository、HTTP、JSON-RPC、gRPC 与本地 runtime parity；SDK 同步通过 `tests/conformance/workflow-sdk-runtime.test.ts` 的 list assertions。该证据为 component/local runtime，`nextPageToken` 为空时按合同省略，`redaction.total_redactions=0`。
- `task test:workflow-run-control-runtime:component` 及 evidence runner `temp/integration-test-runs/20260801200424-991a961c-94bf-48fa-92d3-42ae5d506ea5/` 验证同一 durable run 经 HTTP pause、JSON-RPC resume、gRPC cancel 的版本化状态链；local control adapter 复用 `control.Service` 与 GORM `CommitTransition`，`status=passed`、`redaction.total_redactions=0`。该证据只覆盖 local profile 的 pause/resume/cancel，未覆盖 reconcile、event watch、managed Identity、PostgreSQL 或 provider。
- 当前 `WorkflowControlService` adapter recheck（2026-08-02 07:00）：`task test:workflow-run-control-runtime:component` 证据为 `temp/integration-test-runs/20260802070019-84379472-b17f-4c4f-a1a6-6db2127d2dc7/`，`status=passed`、`duration_ms=21671`、`redaction.total_redactions=0`；确认 local pause/resume/cancel 通过同一 GORM durable state 返回完整 RunRecord，并保持 control metrics。该结果不关闭真实 Owner reconcile、managed publisher/PG/restart、Identity、provider 或 production/browser gate。
- `task test:workflow-definition-validation-runtime:component` 及 evidence runner `temp/integration-test-runs/20260801205000-6ab70fce-5981-4703-b51b-4a6bbb270757/` 验证同一 validation service 经 HTTP、JSON-RPC、gRPC 与 typed SDK 的 valid/invalid 结果 parity；valid draft 不落库，invalid DAG 返回 stable error code，`status=passed`、`redaction.total_redactions=0`。该证据为 local/component profile，未覆盖 watch、reconcile/events、managed Identity、PostgreSQL 或 provider。
- `task test:workflow-event-list-runtime:component` 及 evidence runner `temp/integration-test-runs/20260801210050-d5cab540-ec3c-4c53-b278-1497807141b7/` 验证同一 durable `workflow_events` source 经 HTTP、JSON-RPC、gRPC 与 typed SDK 的 ordered sequence/cursor projection；tenant/run scope、safe source/resource/evidence refs 与 redaction gate 通过，`status=passed`、`redaction.total_redactions=0`。该证据为 local/component profile，未覆盖 `WatchRunEvents`、`ReconcileRun`、managed Identity、PostgreSQL 或 provider。
- `task test:workflow-event-watch-runtime:component` 及 evidence runner `temp/integration-test-runs/20260801213053-e6dfe690-2866-467d-9cec-3a1a84db9573/` 验证同一 durable `workflow_events` source 的 bounded polling watch 经 HTTP SSE、JSON-RPC stream、gRPC server-streaming 与 typed SDK 续传 sequence parity；终态收敛、取消、序列缺口 fail-closed 与 redaction gate 通过，`status=passed`、`redaction.total_redactions=0`。该证据为 local/component profile，未覆盖 `ReconcileRun`、managed publisher、Identity、PostgreSQL 或 provider。
- 最新独立复核（2026-08-02）：`task test:workflow-event-watch-runtime:component` 重新构建 `workbenchd` 并运行同一 SDK lifecycle/event-watch conformance；HTTP SSE、JSON-RPC stream、gRPC server-streaming、typed SDK、race/vet 均通过，证据为 `temp/integration-test-runs/20260802001043-402db250-bcb4-478e-96ef-e41ea6011538/`，`status=passed`、`exit_code=0`、`redaction.total_redactions=0`。该结果仍只证明 local durable runtime，不替代真实 Owner reconcile、managed worker、Identity、PostgreSQL 或 provider。
- `task test:workflow-reconcile-runtime:component` 及 evidence runner `temp/integration-test-runs/20260801233639-8de021e5-fb64-4356-bcb9-08f1000cdae0/` 验证已绑定本地 Workflow runtime 在缺少 external-truth/reconcile adapter 时，经 HTTP、JSON-RPC、gRPC 与 typed SDK 统一返回 `workflow_dependency_unavailable`；完全未绑定仍返回 `workflow_unavailable`，且该 fail-closed seam 不创建 run、receipt 或 event。`status=passed`、`redaction.total_redactions=0`。该证据只收口错误/availability boundary，未实现真实 `ReconcileRun`、managed publisher、Identity、PostgreSQL 或 provider。
- `task test:workflow-runtime-parity:component` 及 evidence runner `temp/integration-test-runs/20260801235013-01f3b5c5-e2a3-4915-b238-9540fc5cb631/` 汇总 definition read/mutation、tenant-scoped list、validation、start/get-run、pause/resume/cancel、durable event list/watch 与 reconcile dependency boundary，经 HTTP、JSON-RPC、gRPC 和 typed SDK 运行；pure-Go、vet、race、build、SDK live 与 redaction 均通过，`status=passed`、`redaction.total_redactions=0`。该 gate 仍是 local/component runtime evidence，不实现真实 Owner reconcile、managed publisher、Identity、PostgreSQL 或 provider。
- `task test:workflow-transport-parity`（2026-08-02）进一步汇总 definition/list/validation/start/run-control/event list/watch、compensation、operator 与 reconcile boundary；HTTP、JSON-RPC、gRPC、typed SDK、race/vet/build 与 redaction gate 均通过，证据为 `temp/integration-test-runs/20260802003707-1eef587f-c4dd-46e6-bcb5-9697c1897fb3/`，`status=passed`、`redaction.total_redactions=0`。该 aggregate 只证明 local/component runtime parity，真实 Owner reconcile、managed publisher/PG/restart、Identity、provider 与 production/browser 仍未闭环。
- `task test:workflow-runtime-parity:component`（2026-08-02）最新独立重跑 definition/read/list/validation/start/run-control、durable event 与 dependency-boundary runtime；HTTP、JSON-RPC、gRPC、typed SDK、pure-Go、vet、race、build 与 redaction gate 均通过，证据为 `temp/integration-test-runs/20260802022255-de06b1ea-4dd1-4385-89e7-ae7b47638aca/`，`status=passed`、`redaction.total_redactions=0`。该结果只收口 local/component runtime parity，不替代真实 Owner reconcile、managed publisher/PG/restart、Identity、provider 或 production/browser gate。
- `task test:workflow-transport-parity`（2026-08-02）在当前 runtime/registry slice 后重新汇总 definition/list/validation/start/run-control/event list/watch、compensation、operator 与 reconcile boundary；HTTP、JSON-RPC、gRPC、typed SDK、race/vet/build 与 redaction gate 均通过，证据为 `temp/integration-test-runs/20260802023803-a9097d9d-bc98-4da4-ace7-850314f6050c/`，`status=passed`、`redaction.total_redactions=0`。该 aggregate 仍只证明 local/component parity，不替代真实 Owner reconcile、managed publisher/PG/restart、Identity、provider 或 production/browser gate。
- `task test:workflow-transport-parity`（2026-08-02）再次复核当前 local aggregate；definition/list/validation/start/run-control/event list/watch、compensation、operator 与 reconcile boundary 的 HTTP、JSON-RPC、gRPC、typed SDK、race/vet/build 与 redaction gate 均通过，证据为 `temp/integration-test-runs/20260802031321-26715927-06a2-4872-8243-77d45e3b455c/`，`status=passed`、`exit_code=0`、`duration_ms=358678`、`redaction.total_redactions=0`。该结果仍只证明 local/component parity，不替代真实 Owner reconcile、managed publisher/PG/restart、Identity、provider 或 production/browser gate。
- `task test:workflow-runtime-parity:component`（2026-08-02）再次通过 definition/read/list/validation/start/run-control、durable event list/watch 与 reconcile dependency boundary 的 HTTP、JSON-RPC、gRPC、typed SDK、pure-Go、vet、race、build 和 redaction gate，证据为 `temp/integration-test-runs/20260802033638-b7dfa942-941d-43ae-a3d9-0c3ce5a3b4e8/`，`status=passed`、`exit_code=0`、`duration_ms=50053`、`redaction.total_redactions=0`。该结果仍只证明 local/component runtime parity，不替代真实 Owner reconcile、managed publisher/PG/restart、Identity、provider 或 production/browser gate。
- 当前 WorkflowControlService 接线后的 fresh runtime recheck（2026-08-02 07:01）：`task test:workflow-runtime-parity:component` 证据为 `temp/integration-test-runs/20260802070156-85f0cbb4-5590-40e7-ab4b-b62a4797bd0c/`，`status=passed`、`duration_ms=50963`、`redaction.total_redactions=0`；确认 local definition/read/list/validation/start/run-control、durable event 与 dependency boundary 仍保持四传输及 SDK parity。该结果不替代真实 Owner reconcile、managed publisher/PG/restart、Identity、provider 或 production/browser gate。

- Fresh reconcile-boundary recheck（2026-08-02 08:43）：`task test:workflow-reconcile-runtime:component` 证据为 `temp/integration-test-runs/20260802084352-1095a9b6-dc43-4167-8d82-97bba9e9ffe5/`，`status=passed`、`duration_ms=16423`、`redaction.total_redactions=0`；已绑定 local Workflow runtime 在缺少 external-truth adapter 时，HTTP、JSON-RPC、gRPC 与 typed SDK 一致返回 `workflow_dependency_unavailable`，未绑定 runtime 仍保持 `workflow_unavailable`。该结果不实现真实 `ReconcileRun`、Owner receipt/reconcile、managed publisher、PostgreSQL 或 production/browser gate。

- Fresh Workflow aggregate after dirty runtime/control edits（2026-08-02 09:00）：`task test:workflow-transport-parity` 证据为 `temp/integration-test-runs/20260802090002-024a9137-ddb9-4961-a5ce-b34c72c78fb6/`，`status=passed`、`duration_ms=358898`、`redaction.total_redactions=0`；definition/list/validation/start/run-control/event list/watch、compensation、operator 与 reconcile-boundary 的 HTTP、JSON-RPC、gRPC、typed SDK、race/vet/build 均通过。该结果只刷新 local/component parity，不替代真实 Owner reconcile、managed publisher/PostgreSQL/restart、Identity、provider 或 production/browser gate。
- Freshest Workflow aggregate after current dirty edits（2026-08-02 09:42）：`task test:workflow-transport-parity` 证据为 `temp/integration-test-runs/20260802093637-a6887e99-3f84-4ecb-ba0c-f76324408eaf/`，`status=passed`、`exit_code=0`、`duration_ms=343262`、`redaction.total_redactions=0`；definition/list/validation/start/run-control/event list/watch、compensation、operator 与 reconcile-boundary 的 HTTP、JSON-RPC、gRPC、typed SDK、race/vet/build 均通过。该结果只刷新当前 dirty Workflow source 的 local/component parity，不替代真实 Owner reconcile、managed publisher/PostgreSQL/restart、Identity、provider 或 production/browser gate。
- Fresh managed-authority wiring slice（2026-08-02 13:43–13:45）：Workflow service 新增 `IdentityAuthorizer`，将 managed authorization 请求投影为 R1 `AllowedActions`（含 tenant/resource/action 校验）；runtime profile selector 仅在 managed 选择该 authorizer，local 仍使用 `ScopeAuthorizer`。TDD red/green、Workflow/Runtime package tests、`go vet` 与 `task test:workflow-runtime-parity:component` 均通过，evidence 为 `temp/integration-test-runs/20260802134439-64b73788-4d8c-4b89-a024-b9081d89c114/`（`status=passed`、`duration_ms=51267`、`redaction.total_redactions=0`）。该证据只证明 authority wiring 与 local regression，不证明 R1 provider/delegation、managed capability、PostgreSQL、Owner 或 production readiness。
- Fresh Workflow runtime gate after managed-authority wiring（2026-08-02 13:57–13:58）：再次执行 `task test:workflow-runtime-parity:component`，证据为 `temp/integration-test-runs/20260802135730-d40e8c0d-4f95-4c4b-bb72-19dd7ef40d92/`，`status=passed`、`duration_ms=50590`、`redaction.total_redactions=0`；当前 dirty source 的 definition/read/list/validation/start、local run-control、durable event 与 dependency-boundary 的 HTTP、JSON-RPC、gRPC、typed SDK、race/vet/build gate 通过。该 evidence 只刷新 local/component proof，不关闭 R1 provider/delegation、managed capability、真实 Owner reconcile、PostgreSQL/restart 或 production/browser gates。
- Fresh parallel local aggregate recheck（2026-08-02 14:06–14:15）：并行执行 `task test:workflow-transport-parity` 与 `task test:board-transport-parity` 均通过；Workflow evidence 为 `temp/integration-test-runs/20260802140612-304d1541-9c40-4d69-adca-a350f4b832de/`（`status=passed`、`duration_ms=341406`、`redaction.total_redactions=0`），Board evidence 为 `temp/integration-test-runs/20260802140612-55f27934-7d0b-4a99-afcc-550d90954163/`（`status=passed`、`duration_ms=534494`、`redaction.total_redactions=0`）。该结果只证明当前 dirty source 的 local/component four-transport parity，不关闭真实 PostgreSQL/restart、managed publisher/worker、Owner reconcile、R1/R2 或 production/browser gates。

- 2026-08-02 07:17 独立复核：`task test:workflow-runtime-parity:component` 证据为 `temp/integration-test-runs/20260802071755-6fcc17da-5008-4fb2-a8e6-714207c935b2/`，`status=passed`、`duration_ms=53684`、`redaction.total_redactions=0`；`task test:workflow-run-control-runtime:component` 证据为 `temp/integration-test-runs/20260802071755-982e0269-449f-403a-8355-95123dec0d1e/`，`status=passed`、`duration_ms=24330`、`redaction.total_redactions=0`。两条独立 gate 确认当前 local durable service 的四传输/SDK parity；完整 `task test:workflow-transport-parity` 同时段因邻近 Aigora 缺少 `OperatorCPAManagementRevisionRevoke` 编译失败，不能记为 aggregate passed。

## 5. 后续边界

- `1.5b`：将尚未绑定的 `ReconcileRun`、Board/Workflow event/query watch 的 managed publisher/restart 语义与 SDK runtime adapter 接入并执行 PostgreSQL parity；当前 Workflow definition validation/mutation、read、tenant-scoped list、start/get-run、local pause/resume/cancel control、`ListRunEvents` 与本地 durable `WatchRunEvents` 已落地，`ReconcileRun` 仅收口了缺失依赖时的统一 fail-closed error boundary，但 `1.5b` 仍保持 open；
- `6.x`：实现 dispatch intent、completion handoff 与 reconcile service；
- `7.x`：实现 pause/resume/cancel/operator mutation 的 authorization、idempotency、audit 与 central transition；
- `8.x`：Web designer/run pane 只能消费服务端 validation/result，不得本地发布或伪造 terminal state。

Fresh current-checkout recheck（2026-08-02 15:12–15:13）：`task test:workflow-runtime-parity:component` 通过，证据为 `temp/integration-test-runs/20260802151247-c5935c5e-471a-4811-9549-9fdf92cedee8/`，`status=passed`、`duration_ms=61777`、`redaction.total_redactions=0`；definition/read/list/validation/start/run-control、durable event 与 dependency-boundary 的 HTTP、JSON-RPC、gRPC、typed SDK、pure-Go、vet、race、build 均通过。该结果只刷新 local/component parity，不关闭真实 PostgreSQL、managed worker、跨进程 restart、Owner reconcile、R1/R2 或 production/browser gate。

Fresh parallel aggregate recheck（2026-08-02 16:52–17:01）：`task test:workflow-transport-parity` 通过，证据为 `temp/integration-test-runs/20260802165206-140d226a-bf30-486e-8a60-0e1fb9e0c8dd/`，`status=passed`、`duration_ms=373996`、`redaction.total_redactions=0`；definition/list/validation/start/run-control/event list/watch、compensation、operator 与 reconcile-boundary 的 HTTP、JSON-RPC、gRPC、typed SDK、race/vet/build 均通过。该证据只刷新 local/component parity，不关闭真实 Owner reconcile、managed publisher/PostgreSQL/restart、R1/R2 或 production/browser gate。
