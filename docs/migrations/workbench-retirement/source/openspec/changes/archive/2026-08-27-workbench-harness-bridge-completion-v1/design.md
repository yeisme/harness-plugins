## Context

`workbench-harness-studio-v1` 交付了 Harness Studio 消费者合同：SDK 侧已有对称的运行时校验族（`validateHarnessStudioContext`/`validateHarnessView`/`validateHarnessReceipt` 等，closed 字段、fail-closed）、sandboxed iframe 宿主原语和 `harness-bridge.v1` 无状态入站校验（`validateHarnessBridgeMessage`）、以及 `HarnessDshDeepLink` 类型与 `HarnessDshBridgeHandoff` 组件（组件内只有内联最小检查）。本 change 还清其中三笔纯本地债，不依赖 owner 合同。

## Goals / Non-Goals

- Goals
  - `validateHarnessDshDeepLink` 与现有 harness 信封校验对称：closed 字段集、forbidden 字段名、版本精确匹配、fail-closed。
  - `harness-bridge.v1` 增加 `view.response` 应答语义、handshake→ready→view.request 时序校验和宿主→插件发送路径；既有四种入站消息（`bridge.handshake`/`bridge.ready`/`view.request`/`diagnostic.report`）的逐消息校验行为不变。
  - `diagnostic.report` 服务端汇聚端点设计 + `harnesshttp` fail-closed 骨架。
- Non-Goals
  - 不实施五个组件（HarnessAssetLibrary/HarnessLayoutCanvas/HarnessDshBridgeHandoff/HarnessIframeHost/HarnessActionConfirmation）挂路由（见「后续任务」）。
  - 不引入 action/navigation 跨桥；桥消息仍然没有 payload/credential/URL 字段。
  - 不做真实诊断存储、检索或告警；端点默认 `needs_contract`。
  - 不修改 `openspec/changes/workbench-harness-studio-v1/` 下任何工件。

## Decisions

### D1: `validateHarnessDshDeepLink` 放在 `harness/validate.ts`

与既有校验族同文件、同风格：`HarnessValidation<HarnessDshDeepLink>` 返回、复用 `opaqueRef`/`containsForbiddenHarnessField`/`reject`，复用现有 `HarnessGateError` 取值（`contract_mismatch`/`invalid_descriptor`/`deep_link_denied`），不扩张错误联合。规则：

- 字段集 closed：`contractVersion`/`targetRef`/`sourceSurfaceId`/`resourceRef`/`resourceVersion`/`mode`/`embedded`/`handoffNonce` 之外的键一律拒绝（与 `validateHarnessBridgeMessage` 的 unknown-key fail-closed 对称）。
- `contractVersion` 必须精确等于 `workbench.harness.dsh_bridge.v1alpha1`。
- `targetRef`/`sourceSurfaceId`/`resourceRef` 为 opaque ref；`resourceVersion` 可选但存在时必须 opaque。
- `mode === "embedded"` 时 `embedded` 必须存在且 `maxWidth`/`maxHeight` 为有界正整数（1–4096）、`allowFullscreen` 为布尔；`mode === "deep-link"` 时 `embedded` 必须缺席——两种模式互斥，防止 handoff 语义含糊。
- `handoffNonce` 可选，存在时必须为 32 位小写 hex（与 bridge channel nonce 同源格式）。

### D2: bridge 时序用显式 session 状态机，发送侧只支持 `view.response`

新增 `HarnessBridgeSession`（不可过快照：`channel`、`phase`、`pendingViewRefs` 有界 ≤64）：

- `createHarnessBridgeSession(channel)` → `awaiting_handshake`。
- `acceptHarnessBridgeInbound(session, message, actualOrigin)` 先复用 `validateHarnessBridgeMessage` 逐消息校验，再校验时序：`awaiting_handshake` 只收 `bridge.handshake`；之后允许 `diagnostic.report`；`bridge.ready` 后进入 `ready`；`ready` 阶段收 `view.request`（必须携带非空 `viewRef`，记入 pending）。乱序/重复 handshake/ready 一律 fail-closed（`invalid_event`）。
- `createHarnessViewResponse(session, viewRef)` 仅当 `phase === "ready"` 且 `viewRef` 在 pending 中时成功：构造宿主→插件的 `view.response` 消息（同一 channel 绑定字段，`diagnosticCode: null`），并把该 `viewRef` 移出 pending——一次请求只应答一次，杜绝重放应答。
- 发送路径 `sendHarnessViewResponse(post, session, viewRef)` 接受注入的 `postMessage` seam（`(message, targetOrigin) => void`）；`targetOrigin` 只能为 `"*"`，因为 sandbox 无 `allow-same-origin` 时插件文档是 opaque origin，无法表达精确目标 origin；消息体只含 safe refs 与 per-load nonce，nonce 即能力凭证，插件侧必须自行校验。
- `view.response` 不进 `harnessBridgeMessageTypes` 入站集合：插件永不发送它，入站校验继续拒绝，四种既有消息行为逐字节不变。

### D3: diagnostic 汇聚端点默认 fail-closed、无存储

`service/internal/transport/harnesshttp/` 新增 POST `/v1alpha1/harness/diagnostics`：

- `http.MaxBytesReader` 限制 body（4 KiB）；`DisallowUnknownFields` 解码 closed 信封（`contractVersion`/`installationRef`/`diagnosticCode`/`contextRevision`）；解码失败一律 400 脱敏错误。
- 拒绝任何含敏感字段名（token/secret/credential/authorization/cookie/password/private path/raw payload 等，与 SDK `forbiddenFieldPattern` 对齐）的 body。
- `contractVersion` 必须精确匹配 `workbench.harness_studio.v1alpha1`，`diagnosticCode` 必须匹配 `[a-z][a-z0-9._-]{0,63}`。
- 通过校验后仍回 `needs_contract` 信封（`harness_diagnostics_not_configured`）：汇聚存储合同未发布前不落库、不转发、不回显请求字段。GET 端点行为不变。

### 后续任务（本 change 不实施）

五个 Harness 组件挂路由：`HarnessAssetLibrary`、`HarnessLayoutCanvas`、`HarnessDshBridgeHandoff`（`apps/web/src/workbench/harness/asset-library.tsx`）、`HarnessSandboxedFrame`（HarnessIframeHost，`apps/web/src/workbench/harness/iframe-host.tsx`）、`HarnessActionConfirmation`（`apps/web/src/workbench/harness/action-confirmation.tsx`）目前只被测试渲染，未挂到 `/harness` 路由的真实槽位。后续任务应在其 owner descriptor catalog 合同就绪后，把这些组件接到对应 slot 的 connected 数据流，并为无合同槽位保持 `needs_contract` 占位；该工作需要独立的 OpenSpec change 与 owner handoff 证据。

## Risks / Trade-offs

- `targetOrigin: "*"` 是 sandbox opaque origin 的唯一可行发送方式；缓解：消息无敏感字段、nonce 即能力、插件侧校验、iframe artifact digest 已由 gateway 钉死。
- 时序状态机在 SDK 层是纯函数快照，Web 宿主接线（iframe-host.tsx）留待挂路由任务一并进行；本 change 只交付合同原语与测试。

## Verification

- `openspec validate workbench-harness-bridge-completion-v1 --strict`
- `bun test packages/task-sdk`（新增 DSH deep-link 与 bridge session/view.response 用例）
- `CGO_ENABLED=0 go test ./service/internal/transport/harnesshttp/...`
- `bun run typecheck`
