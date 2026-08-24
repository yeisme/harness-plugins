## Why

`dsh-pane-workbench-interaction-v1` 已冻结 Pane 布局与交互，但生态插件仍缺少可复用的公开协议：插件无法用同一方式声明四个 face、消费可恢复事件、注册可撤销 view，或在 Pane 间安全交接 artifact。此前 `dsh-plugin-package-consolidation-v1` 因复用证据不足明确排除通用 UI kit；现在根级 `dsh-pane-plugin-ecosystem-v1` 已确认 10 个以上 Pane provider，形成新的 scope-change 证据，因此需要一个最小、headless、pre-1.0 的 Pane Platform，而不是继续为每个插件发明独立合同。

准入结论为 `fit + split-owner`：Harness Plugins 适合拥有 Pane protocol、registry、client reducer 和 DSH adapter；领域数据、mutation、approval 与 receipt 继续由 DSH 或 Eikona、Sonora、Auctra、Pinax、Anatomia、Ordo owner 管理。

## What Changes

- 新增 `@yeisme/dsh-pane-protocol`，冻结 `PanePluginDefinitionV1`、`PaneEventEnvelopeV1`、`PaneProjectionStateV1`、`ArtifactRefV1` 与 `ArtifactIntentV1` 的 TypeScript/Zod 合同。
- 在计划中的 `@yeisme/dsh-client-ui-pane-workbench` 中新增 headless registry、effect-scoped disposer、generation reset、event reducer、gap/reconcile 与 source-independent canary。
- 用两个 mock Pane plugin 证明内置/生态注册等价、重复注册拒绝、dispose/HMR 无残留；用真实 `@deepseek-ai/dsh-session-projection` registry 证明 DSH projection 能映射为 Pane snapshot/event。
- 新合同明确标记为 `0.1.0-rc.1` / experimental；本 change 只做 additive public surface，不删除、改名或重解释任何既有 package/export。
- 保留 developer CLI、React chrome、`shell.overlay`、bundle/profile、File/Git/Browser 和领域 Pane 为本 change 后续任务；首切片只先证明协议和无轮询运行时。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| Pane protocol | required | Harness Plugins | deliver-now | schema/type/negative fixtures |
| Plugin registry/dispose | required | Harness Plugins client | deliver-now | duplicate/HMR/dispose tests |
| Snapshot + event reducer | required | Harness Plugins client | deliver-now | duplicate/gap/reset/reconcile tests |
| Typed artifact handoff | required | Harness composition | deliver-now | validation/idempotency tests |
| 真实 DSH projection adapter canary | required | DSH + Harness Plugins | deliver-now | session projection integration test |
| Pane layout/chrome | required | `dsh-pane-workbench-interaction-v1` | retain-next | component/browser evidence |
| Developer CLI/manifest generation | required | Harness Plugins | retain-next | init/validate/pack test |
| Domain Pane providers | required | 各领域 owner | moved behind contract | 各 owner OpenSpec |

## Capabilities

### New Capabilities

- `pane-plugin-sdk`: 四面插件定义、registry、生命周期、generation 与兼容性准入。
- `pane-event-runtime`: snapshot/event fold、去重、gap/reconcile、freshness 与 action receipt 收敛。
- `pane-artifact-handoff`: ArtifactRef/Intent 校验、跨 Pane action admission 和幂等恢复。
- `pane-platform-canary`: mock plugin 与真实 DSH session projection 的首切片 conformance。

### Modified Capabilities

无。本 change 新增 pre-1.0 additive surface，不修改既有 Ordo、composition preview 或 DSH package 合同。

## Impact

- 新 owner package：`packages/host/pane-protocol/`。
- 扩展目标 package：`packages/client/ui-pane-workbench/`，与 `dsh-pane-workbench-interaction-v1` 共用，不另建第二 client engine。
- 本切片不修改 `packages/bundle/ordo-agent-ops/`、旧 compatibility shim、根 package 版本或任何领域 owner。
- 根级 handoff：`/workspaces/yeisme-agent/openspec/changes/dsh-pane-plugin-ecosystem-v1/`。
- 合同兼容分类：全新、additive、experimental；稳定起点尚未宣布。rollback 为移除新 package/feature registration，不涉及数据迁移。
