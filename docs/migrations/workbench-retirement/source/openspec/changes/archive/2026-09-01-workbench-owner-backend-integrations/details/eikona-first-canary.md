# Eikona 首个真实 Owner Canary 对接包

## 1. 选择理由

Eikona 已发布 `/api/v1`、`eikona.asset_handoff.v2`、OpenAPI、Go SDK 和 Workbench handoff handler；Workbench 已有 loopback connector、安全 URI/digest/MIME/review/rights/lineage/evidence 投影与恶意字段过滤测试。它比从零建立 Scaena/Pinax/Sonora connector 更适合验证共享 Owner spine，但只作为首个 canary，不缩减最终多 Owner 范围。

## 2. 当前可证明能力

- Workbench 仅接受 loopback Eikona URL，拒绝 userinfo/query/fragment。
- `GET /api/v1/instance` 合同版本不兼容时返回 `contract_mismatch`。
- projects/assets/handoff 使用 typed safe projection。
- handoff 仅保留 canonical `eikona://artifact/<handle>`、SHA-256、MIME、尺寸、review、rights、lineage/evidence safe refs。
- private path、grant endpoint、token、raw payload 不进入 projection。

当前本地 consumer 复核（2026-08-02）：`tests/owner-contract-canary.test.ts` 与 `service/internal/owners/eikona` 的 focused/race 测试通过，脱敏 component evidence 为 `temp/integration-test-runs/20260802000344-98ad9398-cf17-4dde-93b1-ea163af90aa1/`，`status=passed`、`exit_code=0`、`redaction.total_redactions=0`。该证据覆盖 digest/kill-switch fail-closed、safe handoff projection、event cursor parser 与 raw field redaction；不等同真实 Eikona process、Identity delegation、非空 project/event reconnect 或 mutation canary。

最新隔离真实进程复核（2026-08-02）：当前 Eikona `develop` binary 的 fixture process 通过 `task test:owner-eikona-read-canary` 完成 instance/owner discovery、digest/kill-switch、projects/assets safe read；证据为 `temp/integration-test-runs/20260802001626-5ed25803-fd76-4b1a-b442-9d853d40fbc1/`，`status=passed`、`redaction.total_redactions=0`。该进程明确返回零 project/resource，所以只确认 Phase A read compatibility，不能证明非空 handoff、event reconnect、R1 delegation、mutation 或 production readiness。

本地 Owner transport 复核（2026-08-02）：`task test:owner-transport:component` 通过 Owner service/connector、HTTP、JSON-RPC、gRPC adapter 编译与 fail-closed 测试，以及 typed SDK、race、vet、typecheck；证据为 `temp/integration-test-runs/20260802002142-d4dcfe9b-1cee-4e2e-9e2f-c982b169d90d/`，`status=passed`、`redaction.total_redactions=0`。该门禁只确认 consumer/adapter 本地一致性，不实现 Owner event forwarding，也不提升真实 conformance 或 mutation capability。

事件游标本地 hardening（2026-08-02）：Eikona consumer 现在会按 event ID/cursor 去重重连重放，并在 `seq:N` 出现跳号时返回 `cursorState=gap` 与 `resyncRequired=true`，要求重新列举安全 projection；`task test:owner-eikona-events:component` 证据为 `temp/integration-test-runs/20260802010930-3968d7df-b1f7-4182-b5af-36a776571917/`，`status=passed`、`redaction.total_redactions=0`，并覆盖 focused/race/vet。该行为仍是 consumer 侧保护，不替代真实 Eikona 非空事件、SSE reconnect 或 provider canary。

最新本地复核（2026-08-02）：`task test:owner-eikona-events:component` 在当前 owner transport slice 后重新通过，证据为 `temp/integration-test-runs/20260802024709-fbc8ae6b-b36f-4bce-89cf-a65d7f511bd3/`，`status=passed`、`redaction.total_redactions=0`；该 gate 仍只证明 event ID/cursor 去重、sequence gap resync、safe projection 与 fail-closed parser，不替代真实 Eikona event stream/reconnect 或 provider canary。

最新 Owner transport 本地复核（2026-08-02）：`task test:owner-transport:component` 通过 Owner service/connector、HTTP、JSON-RPC、gRPC adapter、typed SDK、race、vet 与 typecheck，证据为 `temp/integration-test-runs/20260802024709-128e780b-2597-4253-a2c7-ab7070216828/`，`status=passed`、`redaction.total_redactions=0`；该 gate 只证明 consumer/adapter 本地一致性，不实现 Owner event forwarding、R1 delegation、真实 conformance 或 Eikona mutation capability。

Owner JSON-RPC event-stream parity slice（2026-08-02）：修复本地 `/rpc/stream` 对 `workbench.owner.v1alpha1.WatchOwnerEvents` 错误返回 404 的漂移；未绑定 provider 时现在与 HTTP/gRPC 一致返回 `text/event-stream` safe heartbeat，并继续对未知/未授权 owner fail-closed。测试先红后绿，最新 `task test:owner-transport:component` evidence 为 `temp/integration-test-runs/20260802025449-27eb7570-b6a7-4c20-b8bb-31ca787d7e17/`，`status=passed`、`redaction.total_redactions=0`。该 slice 只收口本地 transport semantics，不实现真实 Eikona event forwarding/reconnect。

同一 slice 还将 Owner stream method 误用 unary `/rpc` 的响应固定为 JSON-RPC `not_found`，与其他 stream method 保持一致；最终本地 transport evidence 为 `temp/integration-test-runs/20260802025843-ec5b3f44-1f33-4350-908d-3fa9610942ea/`，`status=passed`、`redaction.total_redactions=0`。

最新 Owner transport component 复核（2026-08-02）：`task test:owner-transport:component` 再次通过，证据为 `temp/integration-test-runs/20260802031320-5fe92813-34c3-47f3-acdb-0198a07212e6/`，`status=passed`、`exit_code=0`、`duration_ms=63077`、`redaction.total_redactions=0`。该结果仍只支持本地 Owner service/HTTP/JSON-RPC/gRPC/SDK 与 fail-closed stream 语义，不实现 R1 delegation、真实 Eikona event/reconnect 或 mutation canary。

Fresh local consumer recheck（2026-08-02）：当前脏工作区再次通过 `task test:owner-transport:component`，证据为 `temp/integration-test-runs/20260802050717-06cb45d7-82c2-49ff-8f54-feb6174684f9/`，`status=passed`、`exit_code=0`、`duration_ms=63620`、`redaction_result.total_redactions=0`；`task test:owner-eikona-events:component` 同步通过，证据为 `temp/integration-test-runs/20260802050842-3abefd1a-c142-4305-aa09-5d4ddc65edcd/`，`status=passed`、`exit_code=0`、`duration_ms=3306`、`redaction_result.total_redactions=0`。两条证据只刷新 Workbench consumer 的四面 transport、safe projection、cursor dedupe/gap resync 与 fail-closed parser；没有 `EIKONA_URL`、非空 project/run、R1 delegation 或 mutation receipt，因此不提升 `3.6`/`4.4`/provider canary。

Freshest local real-process read recheck（2026-08-02 05:37）：使用当前 `dist/eikona` 启动隔离 loopback fixture process `127.0.0.1:28280`，执行 `task test:owner-eikona-read-canary EIKONA_URL=http://127.0.0.1:28280`；instance/owner discovery、digest/kill-switch、projects/assets read 通过，证据为 `temp/integration-test-runs/20260802053730-12820ad1-52c7-4502-a56f-19bdb1d86f4d/`，`status=passed`、`exit_code=0`、`duration_ms=990`、`redaction_result.total_redactions=0`。该真实进程明确返回 `projects=0 resources=0`，只刷新 Phase A process compatibility，不关闭非空 event/reconnect/handoff/tombstone、R1 delegation、mutation 或 provider/production readiness。

Freshest local consumer recheck（2026-08-02 05:33）：`task test:owner-transport:component` 证据为 `temp/integration-test-runs/20260802053331-2589bcc0-90af-4880-bc3b-085e92420533/`，`status=passed`、`exit_code=0`、`duration_ms=64272`、`redaction_result.total_redactions=0`；`task test:owner-eikona-events:component` 证据为 `temp/integration-test-runs/20260802053331-acb31627-ae68-4de8-8420-7d5b863b4941/`，`status=passed`、`exit_code=0`、`duration_ms=3542`、`redaction_result.total_redactions=0`。本次只刷新本地 Owner service/HTTP/JSON-RPC/gRPC/SDK 与 Eikona event cursor/gap/fail-closed 保护；当前仍没有 `EIKONA_URL`、非空 project/run、R1 delegation 或 mutation receipt，故不提升 `3.6`、`4.4` 或 provider canary。

非空本地 process 复核（2026-08-02 05:46）：在隔离 Eikona `serve --demo fixture` output root 中注册 disposable project，并使用 `fixture:image` 生成零成本 run；`task test:owner-eikona-read-canary EIKONA_URL=http://127.0.0.1:28283` 证据为 `temp/integration-test-runs/20260802054637-7d3b5de6-f57b-41c5-90d5-0320915179bb/`，`status=passed`、`duration_ms=1010`、`redaction_result.total_redactions=0`，日志为 `projects=2 resources=1`。这确认真实 process 的非空 project/resource safe projection，但不替代 reconnect/gap、offline/drift、tombstone、Identity delegation、mutation 或 production evidence。

非空 handoff/event canary（2026-08-02 05:48）：新增 `task test:owner-eikona-read-event-canary EIKONA_URL=... EIKONA_RUN_ID=... EIKONA_RESOURCE_HANDLE=...`，对同一隔离 run 调用真实 handoff v2 与 `/runs/<id>/events`；证据为 `temp/integration-test-runs/20260802054817-05776308-b877-4b24-9e85-01be217b2d8d/`，`status=passed`、`duration_ms=982`、`redaction_result.total_redactions=0`，日志为 `events=12`。仅证明一次 non-empty read/handoff/event safe projection，不能晋级 `3.6` 的完整 reconnect/expiry/tombstone/offline 门禁，也不能晋级 mutation/provider。

最新隔离真实进程复核（2026-08-02 08:26–08:27）：使用新的 `serve --demo fixture --drive-runs` 进程注册 disposable Workbench project，并用 `fixture:image` 生成零成本 run。`task test:owner-eikona-read-event-canary` 证据为 `temp/integration-test-runs/20260802082607-e490889f-67bb-4197-b20d-06fe77fd85a5/`，`status=passed`、`redaction_result.total_redactions=0`；Workbench HTTP/JSON-RPC/gRPC runtime read parity 证据为 `temp/integration-test-runs/20260802082635-5a1fe6c2-29a4-4d71-bacb-13b2a379e8d6/`，`status=passed`；typed SDK HTTP/JSON-RPC read 与 receipt/status fail-closed 证据为 `temp/integration-test-runs/20260802082706-d049ba32-5985-48bc-b818-e01ca7d07921/`，`status=passed`、29 assertions、`redaction_result.total_redactions=0`。SDK conformance 测试现在直接构建并管理临时 `workbenchd` binary，且清理后确认 listener 已关闭，避免 `go run` wrapper 孤儿进程污染证据。该复核仍只支持本地真实 process read/handoff/event 与 Workbench consumer/runtime/typed SDK read parity，不关闭 provider event forwarding、R1 delegation、mutation receipt/reconcile/cancel 或 production readiness。

本次发现并修复一个 consumer 边界缺陷：Eikona `/api/v1/assets` 的数组字段名是 `assets`，旧 Workbench `projectSlice` 只解析 `projects/items`，导致真实资源被静默丢弃。新增 `assetSlice` 与 `TestSnapshotProjectsAndAssetsAreSafe` 后，`CGO_ENABLED=0 go test ./service/internal/owners/eikona`、race 和完整 `task test:owner-transport:component` 均通过；修复只影响 read projection，mutation 仍保持 `needs_contract`。

修复后的最新本地证据：`task test:owner-transport:component` 为 `temp/integration-test-runs/20260802054921-b1aae8ff-a9b1-47a5-9389-ad9035f858a7/`（passed，63291ms，redaction 0），`task test:owner-eikona-events:component` 为 `temp/integration-test-runs/20260802054921-57a6de57-1311-4f78-a27d-877d58950458/`（passed，3345ms，redaction 0）。这些仍是 local component evidence，不是 provider/production promotion。

真实 cursor 续接/过期复核（2026-08-02 05:55）：non-empty canary 进一步使用 `limit=3` 验证 page-level `seq:3` 续接，续接页无重复 event ID，并使用真实 `seq:999999` 触发 `EVENT_CURSOR_EXPIRED`；Eikona 返回的 cursor-recovery envelope 不含 `events`，Workbench 现在安全映射为 `expired + resyncRequired=true` 空页。证据为 `temp/integration-test-runs/20260802055557-a2339a7a-5a26-466d-bd8d-21d983c3d806/`，`status=passed`、`duration_ms=942`、`redaction_result.total_redactions=0`，日志为 `events=3 resumed=3 expired=resync`。

事件 parser hardening：当 provider 只提供 page-level cursor 而事件条目没有逐条 cursor 时，不再合成 gap；只有实际存在 event cursor 才启用序列跳号检测。`EVENT_CURSOR_EXPIRED`/`eikona.control_plane.cursor_recovery.v1` 可省略 `events` 数组并保持 fail-closed resync。修复后的 component evidence：`task test:owner-eikona-events:component` 为 `temp/integration-test-runs/20260802055615-839bb30b-9bcf-47b1-b23c-771d9ee8b676/`（passed，3412ms，redaction 0），Owner transport 为 `temp/integration-test-runs/20260802055615-326067d9-dddb-4d3a-b94d-5b7d0c43ca31/`（passed，62553ms，redaction 0）。这些只证明 Workbench parser/adapter 和本地 canary，不晋级 provider reconnect、tombstone、R1 delegation、mutation 或 production。

Workbench runtime read parity（2026-08-02 06:03）：新增 `service/test/ownerconformance/eikona_runtime_test.go` 与 `task test:owner-eikona-runtime-conformance`，在同一真实 Eikona fixture process 上启动 Workbench local runtime，使用本地 bearer session 依次调用 HTTP、`workbench.owner.v1alpha1.*` JSON-RPC、gRPC 的 project/resource read，并比较 safe `projectRef/resourceRef/publicUri` 与 redaction。证据为 `temp/integration-test-runs/20260802060304-cb5ab8db-6205-4506-b79f-94b3e12f844c/`，`status=passed`、`duration_ms=3093`、`redaction_result.total_redactions=0`。这是 Workbench runtime read projection parity，不是 SDK live parity、Owner event forwarding、mutation receipt/reconcile 或 provider/production readiness。

Typed SDK live read + fail-closed receipt/status parity（2026-08-02 06:33）：`tests/conformance/owners/eikona-sdk-live.test.ts` 通过 `WorkbenchClient.http` 与 `WorkbenchClient.jsonRpc` 读取真实 Eikona fixture 的 owner/capabilities/project/resource，并验证 `ListOwnerOperations` 为空、operation/receipt/status 未发布时两种 SDK transport 都返回 `not_found`。测试先发现并修复 HTTP owner receipt/status route 缺口及 JSON-RPC owner error taxonomy 漂移；最新证据为 `temp/integration-test-runs/20260802063334-79bff9a7-88d0-45b8-9270-546c83ebcfb8/`，`status=passed`、`duration_ms=980`、`redaction_result.total_redactions=0`、29 assertions。该 slice 仍不代表 gRPC SDK facade、Owner event forwarding、provider receipt/reconcile/cancel、Identity delegation、provider 或 production 完成。

Freshest isolated local fixture read/event/runtime/SDK evidence（2026-08-02 09:33–09:34）：重新启动隔离 `serve --demo fixture --drive-runs`，注册 disposable project `proj_bda04d101bb1b7d2`，生成含 12 条事件的 run `wb-goal-eikona-h-20260802`，并将批准的本地 PNG 作为 project-scoped asset `img_73183bf4b60a` 导入。`task test:owner-eikona-read-event-canary` 证据为 `temp/integration-test-runs/20260802093326-261568d7-bf8f-4517-8e57-212ccacb0cef/`，`task test:owner-eikona-runtime-conformance` 证据为 `temp/integration-test-runs/20260802093340-1a34ab24-d19e-4127-b9ea-8e6887cea1a2/`，`task test:owner-eikona-sdk-conformance` 证据为 `temp/integration-test-runs/20260802093401-bcc453dd-2d62-494e-85b5-b5d4738619d5/`；三者 `status=passed`、`exit_code=0`、`redaction_result.total_redactions=0`，SDK 29 assertions。该复核只证明本地 fixture non-empty handoff/event cursor、Workbench HTTP/JSON-RPC/gRPC runtime read parity 与 typed SDK HTTP/JSON-RPC fail-closed receipt/status parity；不关闭 `1.3b` live/provider conformance、gRPC SDK facade、R1 delegation、Eikona mutation receipt/reconcile/cancel 或 production gate。

修复后的 Owner transport component recheck（2026-08-02 06:34）：`task test:owner-transport:component` 通过，证据为 `temp/integration-test-runs/20260802063440-684194c0-8c78-47dd-a034-a3393326cc85/`，`status=passed`、`duration_ms=63744`、`redaction_result.total_redactions=0`。该 gate 覆盖 route/error mapping、Owner connector/service、HTTP/JSON-RPC/gRPC adapter、race/vet、typed SDK 与 typecheck；它只证明 Workbench consumer/adapter 的 fail-closed parity，不提升 provider mutation、event forwarding、Identity delegation 或 production readiness。

离线/降级投影修复（2026-08-02 06:45）：新增 `TestSnapshotDegradesWhenAssetReadIsUnavailable`，当 Eikona instance/project discovery 成功但 `/api/v1/assets` 返回暂时性错误时，Workbench 保留项目列表，明确返回 `degraded` health/readiness 和脱敏 diagnostic，不把不完整快照标记为 `available`。完整 `task test:owner-transport:component` 证据为 `temp/integration-test-runs/20260802064513-4fcb1ab8-93ea-44a6-bd62-d56f8914a2ec/`，`status=passed`、`duration_ms=63700`、`redaction_result.total_redactions=0`。这是 consumer 侧 offline/degraded 语义回归，不等同真实 Eikona 进程离线恢复、provider mutation、R1 delegation、PostgreSQL 或 production gate。

Owner snapshot refresh coalescing（2026-08-02）：Workbench `owners.Service` 对每个 owner 使用 per-owner lock + 500ms memory cache 合并并发读取，并在 connector 替换时清理缓存；新增 32 路并发 regression，`go test -race ./service/internal/owners` 与 `task test:owner-transport:component` 证据 `temp/integration-test-runs/20260802101919-95467ceb-8ccf-465a-86df-f88b54de4e16/` 均通过。该修复只限制 consumer read fan-out，不改变 owner authority、event cursor 或 mutation readiness。

Clean current fixture read/runtime/SDK recheck（2026-08-02 10:11–10:18）：隔离 `serve --demo fixture --drive-runs` 注册 disposable project；read/event 使用生成 run 的安全 artifact handle，证据为 `temp/integration-test-runs/20260802101127-27716615-f810-4656-9b10-117e209c0a5f/`；runtime 与 typed SDK 使用 project-scoped imported PNG `img_73183bf4b60a`，证据分别为 `temp/integration-test-runs/20260802101844-82bf6747-817a-4d3a-9e2f-2ec51de90d66/` 与 `temp/integration-test-runs/20260802101831-dbf6ec50-8104-443f-a573-78672de6cd35/`。三者 `status=passed`、`redaction.total_redactions=0`，SDK 29 assertions。重复测试触发 fixture 429 的 failed evidence 保留且不计入通过；外部门控、R1 delegation、mutation receipt/reconcile/cancel 与 production gate 仍未关闭。

Owner resource failure hardening（2026-08-02 10:38）：Eikona `429` 现在映射为 typed `rate_limited`，超时/5xx/未知上游失败映射为 typed `unavailable`；`owners.Service.GetResource` 不再把这两类错误吞掉后回退为 `not_found`，仅对明确的 resource-not-found 保留 snapshot fallback。HTTP 返回 429/503，JSON-RPC 返回 stable code（`-32017`/`-32013`），gRPC 返回 `ResourceExhausted`/`Unavailable`；新增 service、connector、三种 transport 的回归及敏感错误不泄漏测试。`go test -race ./service/internal/owners ./service/internal/owners/eikona ./service/internal/transport/ownerhttp ./service/internal/transport/jsonrpc ./service/internal/transport/ownergrpc` 与 `task test:owner-transport:component` 通过，最新 evidence 为 `temp/integration-test-runs/20260802103736-b890bf9a-0c09-4b20-b7a4-c038493c751a/`（`status=passed`、`duration_ms=65538`、`redaction.total_redactions=0`）。这只改善 consumer fail-closed/error truthfulness，不代表 provider 429 policy、R1 delegation、mutation receipt/reconcile 或 production readiness。

Current local aggregate/focused recheck（2026-08-02 10:52–11:08）：`task test:workflow-transport-parity` 与 `task test:board-transport-parity` 分别在 `temp/integration-test-runs/20260802105227-1f9f230e-244b-4bb9-870d-80339c4e2d03/`、`temp/integration-test-runs/20260802105920-3db519ea-a4e4-408c-8716-233fc24a0f05/` 通过，均 `redaction.total_redactions=0`；Eikona independent SDK 11 tests/32 assertions、pane 15 tests、root typecheck 通过。以上只刷新本地 consumer/transport/UI proof，不替代真实 Eikona provider、R1 delegation、mutation receipt/reconcile 或 production gate。

Owner safe event forwarding slice（2026-08-02 14:41）：新增 `owners.OwnerEventSource` 与有界 `WatchEvents` service seam；Eikona connector 将已通过 parser 的 resumable safe event page 映射为 Workbench `OwnerEvent`，HTTP、JSON-RPC、gRPC 共用该 service 并强制覆盖 owner identity。无绑定 source 保持 heartbeat；resync、缺失 cursor、超限或不安全 projection 进入 typed fail-closed error。`task test:owner-transport:component` evidence 为 `temp/integration-test-runs/20260802144141-e8057848-d8d6-40e2-bfe7-e5eddaf784da/`（passed，68523ms，redaction 0），`task test:owner-eikona-events:component` evidence 为 `temp/integration-test-runs/20260802144141-9cb3967b-b20f-426a-9638-83b859c58e12/`（passed，3627ms，redaction 0）；随后 `CGO_ENABLED=0 go test ./service/... -count=1 -p 1` exit 0，`openspec validate --all --strict` 17/17。`git diff --check` 也通过。这是本地 Workbench consumer/adapter forwarding proof，不是 provider SSE/reconnect/tombstone/offline canary；3.6、R1 delegation、4.4 mutation receipt/reconcile/cancel 与 production readiness 仍保持 open。

这些证据支持 local read 与 Workbench safe event forwarding baseline，但不支持 managed delegation、真实 provider SSE/reconnect canary、generation/review mutation 或 production availability。

## 3. Provider 缺口

Eikona owner 必须按 `owner-provider-receipt-event-contract-freeze.md` 在自己的 OpenSpec 中交付：

1. discovery `contract_id/version/schema_digest/capabilities/limits/observed_at`；
2. stable project/run/asset cursor pagination 与 tombstone/freshness；
3. resumable event endpoint、cursor expired/gap/reconnect 语义；
4. workload/service auth 与 `aud=eikona` delegation 校验；
5. `eikona.generation.submit.v1`、`eikona.review.decide.v1`、`eikona.handoff.prepare.v1` typed mutation；
6. idempotency、expected version、receipt/status/reconcile、cancel acknowledgement；
7. disposable project、no-cost/dry-run 或批准成本上限、kill switch 与 rollback；
8. 发布可复用 Go SDK/version，而不是要求 Workbench 复制私有 transport。

## 4. Workbench Consumer 任务

| Stage | Paths | Acceptance | Verification |
| --- | --- | --- | --- |
| discovery | `service/internal/owners/eikona/**` | 固定 range/digest；drift fail-closed | `CGO_ENABLED=0 go test ./service/internal/owners/eikona/...` |
| read | connector/OwnerService/transports/SDK | project/resource/freshness/tombstone parity | `bun run test:contract` |
| events | connector + owner SSE projection | cursor reconnect/gap/duplicate safe | component evidence |
| delegation | security/adapters | 浏览器 token 丢弃；只用 owner audience | security integration |
| mutation | registry/admission/app | Task/gate/idempotency/receipt/reconcile | Go race + owner canary |
| Pane | apps/web owner panes | ready/stale/offline/unknown_accept rescue | Vitest + Playwright evidence |

## 5. 首个 Canary 用户闭环

```text
选择 tenant/test project
  -> 打开 Eikona project/run/asset Pane
  -> 验证 asset digest/review/rights/freshness
  -> 发起批准的 generation 或 review Task
  -> permission/cost/version/idempotency gate
  -> Eikona receipt + events
  -> Workbench reconcile canonical status
  -> 打开 handoff/evidence Pane
  -> tenant switch/revoke 后清空并 tombstone
```

首个 canary 必须使用显式 test tenant/project，不得自动选择用户普通项目。生成 mutation 若涉及真实成本，必须先提供 dry-run 或批准 cost gate。

## 6. Failure Matrix

| Failure | Workbench behavior | Forbidden behavior |
| --- | --- | --- |
| discovery digest drift | `contract_mismatch` | 继续解析未知字段 |
| Eikona offline | stale/offline，其他 Pane 可用 | 显示缓存为 current |
| cursor expired | 标记 query stale，重新列举 | 猜测缺失事件 |
| delegation invalid | `authentication_required`/`permission_denied` | 转发 Workbench token |
| timeout before dispatch | safe retry allowed by policy | 创建假 receipt |
| timeout after dispatch | `unknown_accept` + reconcile | 自动重复 generation |
| response 丢失且无 receipt | 按原 operation/project/idempotency key执行 receipt lookup | 创建新 key 或重放 mutation |
| cancel unconfirmed | `cancel_requested` | 直接标记 cancelled |
| partial 含 unknown child | 查询 child status并 reconcile | 重试整个 parent operation |
| permission revoked | tombstone + stop new mutation | 继续显示 title/preview |
| rollback | disable Eikona mutation flag，保留 read/diagnostics | 删除 receipts/evidence |

## 7. 晋级门禁

- **Read canary**：real Eikona process、discovery/project/asset/handoff/event、offline/drift、redaction evidence。
- **Mutation canary**：R1 delegation 已 canary；至少一个 generation/review operation 具备 receipt/reconcile/cancel；unknown_accept drill 通过。
- **Daily loop**：Pane、Task、Timeline、Evidence/Handoff、tenant switch/revoke、browser-only-BFF 通过。
- **Available**：staging soak、SLO、security review、cost/rights policy、kill switch/rollback 通过。

任一门禁缺失时 Eikona capability 分项保持 `needs_contract`、`integration_ready` 或 `canary`，不得把 read success 推断为 mutation success。

Fresh current-checkout consumer transport recheck（2026-08-02 15:12–15:13）：`task test:owner-transport:component` 通过，证据为 `temp/integration-test-runs/20260802151247-9ef5b174-a76f-48e8-a58e-6862595c29b6/`，`status=passed`、`duration_ms=65949`、`redaction.total_redactions=0`；Owner read、safe event forwarding、HTTP/JSON-RPC/gRPC、typed SDK、race/vet/typecheck 均通过。该证据仍是 Workbench consumer/adapter component proof，不替代 `3.6` 真实 Eikona process、R1 delegation、`4.4` mutation receipt/reconcile/cancel 或 production gate。
