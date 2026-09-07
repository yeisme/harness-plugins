## Why

`archive/2026-08-27-workbench-harness-bridge-completion-v1` 的 design「后续任务」节明确要求：五个 Harness 组件挂 `/harness` 路由槽位的工作必须有一个独立的 OpenSpec change 留痕。该工作已在 2026-08-27 实现并验证完毕（代码在 `apps/web/src/workbench/harness/`，component 证据 `temp/integration-test-runs/harness-route-wiring-20260827-r1/` 68/68 pass），但实现先行于 change 工件。本 change 是**追溯性记录**：为已完成且已验证的路由挂接补齐 proposal/design/specs/tasks，使审计链完整；不引入任何新行为，不修改任何代码。

## What Changes

- 追溯记录五个 Harness 组件（`HarnessAssetLibrary`/`HarnessLayoutCanvas`/`HarnessDshBridgeHandoff`/`HarnessSandboxedFrame`/`HarnessActionConfirmation`）挂接 `/harness` 路由的真实槽位，以及 `HarnessSandboxedFrame` 接线 `HarnessBridgeSession` 时序机的既成实现。
- specs 严格按已实现行为撰写：fail-closed 槽位门禁（descriptor catalog 缺失或未批准时渲染 `needs_contract` 占位，不渲染任何供给数据）、descriptor 未批准不渲染（iframe 宿主不挂载、DSH handoff 不产生打开动作、action 确认入口不出现）、bridge 时序机接线（per-load session、exact source window、乱序/漂移 fail-closed 卸载 iframe）。
- tasks.md 全部勾选，附既有证据路径；无新增实现任务。

## Capabilities

### New Capabilities

- `workbench-harness-route-wiring`: `/harness` 路由的 connected 数据流、per-surface 槽位门禁与 iframe bridge 时序机宿主接线。

### Modified Capabilities

无。本 change 只追溯记录，不修改 `workbench-harness-studio-v1` 或 `workbench-harness-bridge` 的任何既有合同。

## Impact

只新增 `openspec/changes/workbench-harness-route-wiring-v1/` 目录下的工件，不改任何代码、测试或其他 change。行为侧零增量：真实 descriptor catalog、action dispatch BFF 合同与 DSH 导航合同继续保持 `needs_contract`，路由默认只接 SDK fake dispatch seam，不伪造 receipt。
