# Ordo × DeepSeek Harness Agent Ops 插件与可视化设计

[English](README.md) | 中文

本 change 冻结 Ordo canonical control facts 到 DeepSeek Harness（DSH）Web 与 Workbench Harness Studio 的插件合同、双端信息架构、交互状态和跨项目 handoff。

## 设计结论

- Owner-fit：`split-owner`。
- Ordo 是 run、task、attempt、session、lease、approval、verification、evidence 和 closeout 的唯一调度事实 owner。
- DSH Web 提供单租户 runtime 内的轻量值班台；Workbench 提供完整多租户 Agent Ops Studio。
- `agent/harness-plugins` 候选仓库拥有宿主 adapter、manifest、打包和 conformance，但不拥有第二 scheduler。
- V1 先交付安全观察、事件、审批收件箱和 reconcile；真实 launch/re-dispatch/cancel 在持久 reservation 与 fencing 权威接通后再开放。

## 产物

- [proposal.md](proposal.md)：问题、能力账本、边界和交付切片。
- [design.md](design.md)：合同、状态机、DSH/Workbench 可视化和安全设计。
- [tasks.md](tasks.md)：DSH 实现任务与 Ordo/Workbench/Harness Plugins handoff。
- [specs/ordo-agent-operations-plugin/spec.md](specs/ordo-agent-operations-plugin/spec.md)：Ordo Agent Ops 投影、事件和动作合同。
- [specs/dsh-ordo-host-adapter/spec.md](specs/dsh-ordo-host-adapter/spec.md)：DSH Cordis host/client/profile 接入合同。
- [specs/ordo-visualization-experience/spec.md](specs/ordo-visualization-experience/spec.md)：DSH 轻量视图与 Workbench 完整 Studio 体验合同。

## 关系

本 change 是 DSH 子项目内的 Ordo Agent Ops 实现规格；它依赖根仓库 `enterprise-harness-platform-v1` 提供的身份、多租户控制面、插件供应链和通用 action/receipt 规范，但不复制这些 owner 的 canonical state。

## 当前 local slice

- Host Remote 在构造时捕获 server-injected `ordoAgentOpsExpectedContext`；缺失或非法时返回不含 facts 的 `needs_contract`，后续 Context key replacement 不改变当前实例的绑定。
- owner snapshot 在跨出 Host 前经过 strict schema、opaque ref、safe text、count/context、unknown-field 与非 ready/stale facts 校验；ready/stale 只有与固定 expected context 精确匹配才可透传，缺失、敏感或漂移数据降级为不含 facts 的 `contract_mismatch`，owner 读取异常降级为 `offline`。
- compact client 保持 single-flight、generation reset/dispose 与 late-result 丢弃，并基于 `snapshotRef`/`snapshotVersion` 维护 snapshot 轴 cursor：重复 version 幂等忽略，ref 轮换或 version 回退时以 `owner_cursor_drift` fail closed 且不展示 facts，下一次读取从权威 snapshot 重建 cursor 完成 reconcile；事件流 cursor、事件序号 gap 检测、ToolView、mutation 和 Workbench re-authenticated deep link 仍未实现。
- 验证命令：`CI=true pnpm exec tsc -p packages/host/ordo-agent-ops/tsconfig.json --noEmit`、`CI=true pnpm exec vitest run packages/host/ordo-agent-ops/tests/gateway.spec.ts`（10/10）、`CI=true pnpm exec vitest run packages/client/ui-ordo-agent-ops/tests/controller.client.spec.ts packages/client/ui-ordo-agent-ops/tests/browser-plugin.client.spec.tsx packages/host/ordo-agent-ops/tests/gateway.spec.ts`（21/21）和 `pnpm exec openspec validate ordo-dsh-plugin-visualization-v1 --strict --no-interactive`；这些是 focused/local 或 browser/consumer 证据，不是 Ordo owner、provider/deployment 或 production 证据。AccessTicketBinding 到 expected context 的完整组合、OAuth、cloud agent、sandbox 和 durable revocation 仍是 owner-gated。
