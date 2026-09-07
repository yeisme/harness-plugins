## Why

Workbench 需要把 Gateway 的运行状态、后端、工具、审批、活动与运维动作纳入统一 owner operations 体验，但现有客户端没有版本化专用 facade。若由浏览器拼接 Gateway 路由或转发原始 JSON，会泄露 credential、复制权限规则并形成第二控制面。

## What Changes

- 为 `WorkbenchClient` 增加 additive `gateway` 专用 facade，并冻结 `workbench.gateway.v1alpha1` 客户端合同。
- 通过 Browser → BFF → `workbenchd` → Gateway adapter 消费 Gateway `console/contract` 与 `console/summary`；浏览器不持有 Gateway credential。
- 增加 Overview、Backends、Approvals、Activity 四个 operator 页面及完整 loading/empty/error/offline/unavailable/down/stale/permission 状态。
- 把 `gateway.approval.decide`、`gateway.tools.refresh`、`gateway.runtime.reload` 注册为 Task operations，复用 permission、revision、idempotency、audit、receipt 与 `unknown_accept` reconciliation。
- 增加 desktop/tablet/mobile、键盘导航、焦点、状态公告、对比度、reduced motion、合同/集成/E2E/evidence 验收。
- 明确禁止 generic `/v1/**` proxy、浏览器直连 Gateway、token UI、registry/policy editor、tool playground、artifact body 与 P0 restart。

## Capabilities

### New Capabilities

- `workbench-gateway-console`: Workbench 专用 Gateway facade、daemon adapter、四个 operator 页面、typed states、allowlisted Task operations、安全边界和验证证据。

### Modified Capabilities

无。

## Impact

- `packages/task-sdk` 增加 additive `WorkbenchClient.gateway` typed client，不改变现有 Task/Design facade。
- `service/internal/adapters`、registry、Task application service 与 transports 增加 Gateway owner adapter 和 allowlisted operations。
- `apps/web/server` 增加 BFF projection；`apps/web` 增加 Gateway operator routes/components/query states。
- 依赖 Gateway owner change `mcp/gateway/openspec/changes/gateway-workbench-console-contract/`；不复制其 canonical schema、scope 或 mutation 规则。
