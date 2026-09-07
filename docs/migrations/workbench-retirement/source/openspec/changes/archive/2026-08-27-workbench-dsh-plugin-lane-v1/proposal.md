## Why

dsh（deepseek harness）与 Workbench 是互补客户端，但目前两边只有一条已冻结的 `HarnessDshDeepLink` handoff 合同（`workbench.harness.dsh_bridge.v1alpha1`），而 Workbench 侧的插件入口仍是裸实现：composer slash 命令硬编码在前端（`apps/web/src/workbench/agent/conversation/composer.tsx:260-264`），没有 server-authored 合同；"能否接入 dsh 插件/iframe"缺少权威准入真源，只能口头回答。本 change 把 dsh 插件车道收敛为三层准入模型（L0 深链 handoff / L1 server-authored declarative descriptor 与命令目录 / L2 embedded iframe），固化 `docs/design/plugin-ecosystem.md` 红线在本车道的落点，让后续任何接入请求都有 fail-closed 的判定依据。

上游 PRD：`docs/product/workbench-dsh-plugin-lane.md`（判定 `split-owner`：本仓交付合同与 handoff 证据要求，dsh 侧渲染与 Director Pack 归外部仓 `agent/harness-plugins`）。

## What Changes

- 新增 dsh 插件车道三层准入模型：L0/L1/L2 各自的合同范围、交付状态与解锁条件。
- L0：spec 化已冻结的 `HarnessDshDeepLink` 消费语义——closed 安全字段、非法合同 fail closed（不渲染目标、不提供打开动作）、目标端 server 必须重新验证授权、handoff 字段不构成授权事实。
- L1：spec 化 server-authored slash 命令目录合同与 declarative surface descriptor 准入规则（closed schema、forbidden field、availability 永远 `server`、未知值归一 `needs_contract`）；取代 composer.tsx:260-264 的前端硬编码是目标方向，**本期不实现、不改 composer.tsx**。
- L2：embedded iframe 本期 **reject-now**；解锁条件为 `docs/design/plugin-ecosystem.md` §7.2 六前提全部交付并逐项留证。
- 明确跨仓边界：dsh 侧渲染与 Director Pack 属外部仓 `agent/harness-plugins`；本仓只交付合同、准入判定与 handoff 证据要求。

## Capabilities

### New Capabilities

- `workbench-dsh-plugin-lane`: dsh 插件三层车道（L0 深链 handoff、L1 server-authored descriptor/命令目录、L2 embedded iframe 门禁）的准入、消费与 fail-closed 合同。

### Modified Capabilities

无。本 change 只新增车道合同 spec；`HarnessDshDeepLink` 类型本身已在 `packages/task-sdk/src/harness/types.ts` 冻结，不重解释、不扩字段；composer 触发器行为仍由 `workbench-agent-composer-triggers` 承载。

## Impact

本 change 是纯合同/spec 交付，不修改任何运行时代码。后续影响：L1 实现时将新增服务端命令目录投影（Operation 注册走 `service/internal/registry` + `Seal()` 门禁）并把 composer slash 命令从硬编码切换为目录投影消费；L2 解锁前任何 iframe 接入请求一律回答 `needs_contract`。不引入运行时安装 API、服务端下发可执行代码或 fail-open 预留口；不复制 dsh 侧状态机。
