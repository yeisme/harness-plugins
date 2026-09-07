## Why

`workbench-harness-studio-v1` 冻结了 Harness Studio 的消费者合同，但仍有三笔纯本地内部债未还清：DSH compact bridge 的 `HarnessDshDeepLink` 合同只有类型定义和组件内联检查，缺少与现有 harness 信封校验对称的运行时校验函数；`harness-bridge.v1` postMessage 桥只有无状态逐消息入站校验，没有 handshake→ready→view.request 时序、`view.response` 应答语义和宿主→插件发送路径；`diagnostic.report` 只有浏览器侧校验，服务端没有汇聚端点（即使是 fail-closed 骨架）。这些都可以在本地还清，不依赖任何 owner 合同就绪。

## What Changes

- 新增 `validateHarnessDshDeepLink` 运行时校验：closed 字段集、forbidden 字段名扫描、合同版本精确匹配、opaque ref/handoffNonce 格式、deep-link 与 embedded 模式互斥约束，全部 fail-closed。
- 新增 `harness-bridge.v1` 发送侧最小合同：`view.response` 应答消息（只回应已挂起的 `view.request`）、`HarnessBridgeSession` 时序校验（handshake→ready→view.request，乱序 fail-closed）、宿主→插件发送路径构造器；既有四种入站消息的行为保持不变，不引入 action/navigation 跨桥。
- 新增 `diagnostic.report` 服务端汇聚端点设计，并在 `service/internal/transport/harnesshttp/` 落地 fail-closed 骨架：POST 接收脱敏诊断信封，默认仍回 `needs_contract`，无真实存储，拒绝敏感字段与超限 body。
- 设计文档记录后续任务：五个 Harness 组件（HarnessAssetLibrary/HarnessLayoutCanvas/HarnessDshBridgeHandoff/HarnessIframeHost/HarnessActionConfirmation）挂路由；本 change 不实施。

## Capabilities

### New Capabilities

- `workbench-harness-bridge`: DSH deep-link 运行时校验、iframe bridge 时序与发送侧合同、diagnostic.report 服务端汇聚边界。

### Modified Capabilities

无。本 change 不修改 `workbench-harness-studio-v1` 已有的 context/plugin-surface/production-projection 合同，只补齐其本地未还清的桥接债务。

## Impact

影响 `packages/task-sdk/src/harness/`（validate.ts、iframe.ts）与其 bun 测试、`service/internal/transport/harnesshttp/`（handler 与测试）。不新增浏览器直连 owner、不保存 owner payload、不引入真实诊断存储；缺服务端合同的环节继续保持 `needs_contract`。五组件挂路由仅作为设计文档中的后续任务记录，不在本 change 实施。
