## Why

六个相互依赖的 DSH change 已分别冻结 Pane、Ordo、composition preview、命令和 package consolidation 能力，但当前 ecosystem change 只有 README，没有可验证 delta 或执行任务。需要补齐一个只负责 profile composition、owner handoff 和最终 conformance 的 umbrella change，避免在多个子 change 中重复实现安装状态、canonical state 或 release authority。

## What Changes

- 新增 DSH plugin ecosystem 的组合要求：统一 Ordo root、独立 composition preview、Pane Workbench 与官方 profile overlay 的安装/卸载一致性。
- 冻结 Harness Plugins、DSH core/client、Ordo 和领域 owner 的边界；umbrella 不拥有任何 domain state、scheduler、approval、receipt 或 browser store。
- 记录官方 `dsh plugin manifest init|validate|pack` CLI handoff，由 DSH CLI owner 实现入口，Harness Plugins 提供可校验的 manifest contract。
- 增加 local packed-profile conformance、duplicate-row、unload/HMR、safe projection 和 evidence closeout 验收。

## Admission Decision

结论：`split-owner`。Harness Plugins 拥有 bundle、safe projection、Pane protocol 和 package conformance；DSH core/client 拥有官方 CLI、Web shell、client slot 和 `ui-agent-preset`；Ordo 拥有 canonical run/task/action/receipt state。

## Non-Goals

- 不创建第二个 profile/package registry、scheduler、task ledger、lease、approval ledger 或 release authority。
- 不把 DSH core/client 的实现复制到 Harness Plugins。
- 不执行 npm publish、git push、生产 profile 变更或外部 deployment。

## Rollback

Umbrella rollback 为移除新增 profile rows、bundle references 和 additive CLI/client registration；现有旧 Ordo leaf shim 和既有 DSH `dsh plugin --profile <name> add|remove` 命令保持可用。
