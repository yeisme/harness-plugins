## Why

Workbench 已能在 Agent timeline 与 Review Pane 中展示 proposal 和 `ActionDescriptorV1`，但当前浏览器提交的 `basisRefs`、通用 expected version 与 UI 投影不足以成为执行授权。若没有服务端可重载、可校验、可对账的 proposal authority，批准按钮只能长期保持 `needs_contract`，用户会看到大量功能页面却无法安全完成真实动作。

## What Changes

- 建立服务端权威的 Agent proposal 记录与版本化决策合同；proposal、basis、目标 Operation、Owner 版本、权限/成本要求和可见范围由服务端保存并在决策时重新加载。
- 将 `accept`、`reject`、`request_changes` 与 `reconcile` 定义为 closed decision；浏览器只提交 proposal ref、expected proposal revision、decision、可选的受限用户说明和 idempotency key，不得提交或覆盖执行参数、Owner endpoint、actor、basis visibility 或目标 Operation。
- 决策先经过 proposal 状态、scope、权限、成本、expected-version、idempotency 与 Owner capability gate；只有 `accept` 可以在全部 gate 通过后通过现有 `TaskService` 创建目标 Task，其他决策只更新 proposal authority，不直接调用 Owner。
- 定义 `unknown_accept` 的 reconcile-only 行为：接受结果不明时禁止重新接受、自动重试、切换 Provider 或伪造终态，只能查询原 Task/Owner receipt 并收敛到可证明结果。
- 为 HTTP REST/SSE、gRPC unary/stream、JSON-RPC 2.0 与 TypeScript SDK 提供同一 proposal read/decide/reconcile 语义、typed conflict/error、事件与安全 receipt 投影。
- Review Pane、timeline、Activity 与 presentation intent 继续只消费服务端投影；打开或聚焦 Pane 不授予 mutation 权限，前端 fixture/mock 成功不晋级 action capability。
- 采用 default-off capability 和独立 action canary；在真实 approved Owner adapter、receipt/reconcile、回滚与浏览器证据完成前保持 `needs_contract`。

## Capabilities

### New Capabilities

- `workbench-agent-proposal-authority`: 定义服务端 proposal 真相、版本化决策、TaskService 执行 gate、幂等、事件、receipt/reconcile、transport parity 与 UI 消费边界。

### Modified Capabilities

无。现有 `workbench-agent-runtime-chat`、`workbench-agent-session-workspace`、`workbench-agent-presentation-intents`、`workbench-task-control-plane` 与 Owner Operation 合同继续保持各自权威；本 change 只补齐它们之间缺失的 proposal decision authority。

## Impact

- 预计影响 Agent proposal proto/JSON Schema/domain/repository/service、forward-only migration、Operation registry、HTTP/gRPC/JSON-RPC transport、`packages/task-sdk` typed facade，以及 Agent timeline/Review Pane 的只读投影和 action gating。
- 所有执行仍进入现有 `TaskService`；不得新增 transport-specific handler、第二套 Task 状态机、浏览器直连 Owner、任意 Operation/URL/shell、Provider 主选择器或第三方插件执行。
- 持久化仅包含 proposal metadata、closed descriptor、safe basis refs、decision/audit 摘要、Task/receipt refs 与幂等记录；不得保存 credential、private path、raw prompt、provider payload、完整 tool args、artifact blob 或 chain-of-thought。
- 交付必须分别证明 contract/focused、四 transport parity、真实 Owner adapter、browser/E2E、canary/rollback 与 deployment/production evidence；低层通过不能替代高层就绪声明。
