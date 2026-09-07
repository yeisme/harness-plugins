## Why

Workbench 组合多个 owner 的任务与设计能力，是最需要统一 Local CLI/BYOK runtime 的客户端，但当前 `WorkbenchClient`、Operation registry 和 TaskService 尚未表达 runtime mode、readiness、approval scope、event cursor 与 unknown reconciliation。若 Web 直接连接 owner/broker 或各 pane 自行实现 provider 设置，会绕过 Workbench 的 permission、cost、version 与 idempotency gate。

## What Changes

- 在 `packages/task-sdk` 增加 versioned runtime descriptor/readiness/diagnostic/receipt typed client，并由 `WorkbenchClient` 统一暴露。
- 在 Go `TaskService`/Operation registry 注册 runtime readiness、connection test 与 broker-backed run/event/cancel/reconcile operation。
- 所有 mutation 继续经过 permission、cost、expected-version、idempotency 和 approval scope gate；unknown outcome 不自动重试。
- `connection_test` 先作为独立、默认关闭的 Workbench Operation 晋级；approval 由 Workbench 已持久化并批准的 task gate 派生，caller 不提交或伪造 approval ref。
- Web 只通过 `WorkbenchClient` 展示 mode、owner、capability、readiness、approval 和安全 remediation，不直连 broker/owner、不接收 raw key。
- credential ref 只作为 secret-free reference；credential resolution 与 provider probe 在 owning adapter 内执行，broker 永不 Resolve credential。
- 在共享 broker 未落地前先交付 descriptor/readiness contract，run/event/cancel 保持 unavailable。
- `connection_test` 即使启用也只允许固定 `aigora/aigora.text` binding，并要求当前 broker revision、registry capability 与显式 feature flag 三重成立；缺一项即保持不可见或 fail closed。

## Capabilities

### New Capabilities

- `workbench-client-runtime-adapter`: 定义 Workbench SDK、Go service、Operation registry 与 Web 对统一 Local CLI/BYOK runtime 的组合合同和 promotion gate。

### Modified Capabilities

无。

## Impact

- 预计影响 `packages/task-sdk/**`、`service/internal/{runtime,registry,adapters,app}/**`、`apps/web/**`、协议导出与 conformance/integration tests。
- 依赖 `backend-server/client-runtime`、credentialctl scoped grant 和首个 Aigora owner adapter；依赖缺失时只发布 readiness slice。第二个 owner 只用于后续跨 owner GA 证明，不阻塞 Workbench 的 Aigora first-support 晋级。
- 不复制 Scaena/Auctra/Eikona/Sonora/Aigora 状态，不新增 provider SDK、任意 shell、raw owner payload 或浏览器 session token 读取。
