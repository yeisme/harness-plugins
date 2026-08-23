## Why

根级 `dsh-pane-plugin-ecosystem-v1` 要求 DSH 提供 Sonora Pane（waveform、subtitle、take、review、rights、cost），但不复制音频 canonical state。该能力的用户界面、Host bridge、Pane 注册与安装生命周期属于 DSH 插件项目，因此本 change 归 `agent/harness-plugins`；Sonora 仍只提供 async job、SSE 通知、approval、workspace projection 与 owner receipt。

## What Changes

- 在 `@yeisme/dsh-client-ui-pane-domain` 与 `@yeisme/dsh-pane-domain` 中交付 Sonora Pane 注册、渲染、action admission 与安装面。
- 通过 Harness Plugins Host bridge 消费 take/job/waveform peaks/subtitle/rights/cost 的脱敏 snapshot + push event，并映射 `PaneEventEnvelopeV1`。
- preview cost/rights 后的 render 或 accept take 只提交 Sonora owner action，并等待 approval/receipt。
- Artifact 通过 `ArtifactRefV1` / `ArtifactIntentV1` 进入跨 Pane handoff。
- 禁止客户端轮询。SSE 只作可修复通知，权威状态仍是 Sonora 读接口。
- 不在 Harness Plugins 复制 Sonora 数据库、job ledger、音频库或领域规则。

## Capabilities

### New Capabilities

- `dsh-sonora-pane`：Harness Plugins 拥有的 DSH Pane 适配与交互面，消费 Sonora snapshot/event/action 合同。

### Modified Capabilities

无。不改既有 job/event/approval requirement。

## Impact

- 实施 owner：`agent/harness-plugins`。
- Canonical domain owner：`cli/sonora`。
- 根 handoff：`openspec/changes/dsh-pane-plugin-ecosystem-v1/` 任务 4.2。
- 协议解释者：`@yeisme/dsh-pane-protocol@0.1.0-rc.1`。
- 插件包：`packages/client/ui-pane-domain/`、`packages/bundle/pane-domain/`。
- Domain dependency：`cli/sonora/internal/workspace/pane.go` 及其测试。
- 插件证据：`agent/harness-plugins/temp/integration-test-runs/<run-id>/`；Sonora owner 证据保留在 `cli/sonora/temp/integration-test-runs/<run-id>/`。
