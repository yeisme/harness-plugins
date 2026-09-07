## 1. DSH deep-link 校验

- [x] 1.1 在 `packages/task-sdk/src/harness/validate.ts` 新增 `validateHarnessDshDeepLink`：closed 字段集、forbidden 字段名扫描、合同版本精确匹配、opaque ref/nonce 格式、deep-link 与 embedded 模式互斥（embedded 约束有界正整数尺寸 + 布尔 fullscreen），全部 fail-closed，复用现有 `HarnessGateError` 取值。
- [x] 1.2 新增 bun 测试覆盖：合法 deep-link/embedded 通过；版本漂移、未知字段、敏感字段名、空/非法 ref、URL 形态 target、模式与 embedded 约束错配、非法 nonce 全部 fail-closed。 **Evidence (2026-08-27)**: `packages/task-sdk/test/harness-dsh-deeplink.test.ts` 7/7 pass。

## 2. Bridge 发送侧与时序

- [x] 2.1 在 `packages/task-sdk/src/harness/iframe.ts` 新增 `HarnessBridgeSession` 时序校验（`createHarnessBridgeSession`/`acceptHarnessBridgeInbound`）：handshake→ready→view.request 顺序，diagnostic.report 握手后任意时刻，乱序/重复 fail-closed；复用 `validateHarnessBridgeMessage`，四种既有入站消息行为不变（既有 `harness-iframe-bridge.test.ts` 12/12 无修改通过）。
- [x] 2.2 新增 `view.response` 应答语义与宿主→插件发送路径（`createHarnessViewResponse`/`sendHarnessViewResponse`）：只应答 pending 的 viewRef、一次请求一次应答、pending 有界（64）；不引入 action/navigation 跨桥。
- [x] 2.3 新增 bun 测试覆盖时序接受/乱序拒绝、view.response 关联与一次性、发送 seam 的 targetOrigin 约定。 **Evidence (2026-08-27)**: `packages/task-sdk/test/harness-bridge-session.test.ts` 8/8 pass。

## 3. diagnostic.report 服务端汇聚骨架

- [x] 3.1 `service/internal/transport/harnesshttp/handler.go` 新增 POST `/v1alpha1/harness/diagnostics`：body 4 KiB 上限、closed 信封 `DisallowUnknownFields` 解码、敏感字段名拒绝、版本/diagnosticCode 格式校验，通过后回 `needs_contract`（`harness_diagnostics_not_configured`），无存储；GET 端点与其他方法行为不变。
- [x] 3.2 扩展 `handler_test.go`：合法诊断信封回 needs_contract、敏感字段/未知字段/超限 body/版本漂移/非法 code 全部拒绝，既有 GET 端点无回归。 **Evidence (2026-08-27)**: `CGO_ENABLED=0 go test ./internal/transport/harnesshttp/...` ok（7 个测试函数）；`./internal/runtime/...` ok 无回归。

## 4. 验收

- [x] 4.1 `openspec validate workbench-harness-bridge-completion-v1 --strict` 通过。 **Evidence (2026-08-27)**: valid。
- [x] 4.2 `bun test packages/task-sdk`（411/411 pass）、`CGO_ENABLED=0 go test ./service/internal/transport/harnesshttp/...`（ok）、`bun run typecheck`（绿）通过。 **Evidence (2026-08-27)**：全部本地执行通过。本 change 只交付本地合同原语与 fail-closed 骨架；真实 descriptor catalog、diagnostics 汇聚存储与 owner handoff 仍为 `needs_contract`，不作为 production 证据。

## 后续任务（不在本 change）

- 五组件（HarnessAssetLibrary/HarnessLayoutCanvas/HarnessDshBridgeHandoff/HarnessIframeHost/HarnessActionConfirmation）挂 `/harness` 路由槽位：依赖 owner descriptor catalog 合同，需独立 change 与 handoff 证据；无合同槽位保持 `needs_contract`。
