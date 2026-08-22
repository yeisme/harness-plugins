## Why

根级 `dsh-pane-plugin-ecosystem-v1` 要求 DSH 提供 Eikona Pane（gallery、compare、generate、review、export、handoff），但不复制 Eikona canonical state。该能力的 Host bridge、Client view、Pane 注册与安装生命周期属于 DSH 插件项目，因此本 change 归 `agent/harness-plugins`；Eikona 仍是 run、artifact、project、review 与 receipt 的唯一 owner。

## What Changes

- 在 `@yeisme/dsh-client-ui-pane-domain` 与 `@yeisme/dsh-pane-domain` 中交付 Eikona Pane 注册、渲染、action admission 与安装面。
- 通过 Harness Plugins Host bridge 消费脱敏 run/artifact/gallery snapshot + push events，并映射 `PaneEventEnvelopeV1`。
- generate preview、accept/reject 只提交 Eikona owner action；默认模型 ref 为 `openai/gpt-5.4-image-2`。
- Eikona artifact 通过 `ArtifactRefV1` / `ArtifactIntentV1` 执行 `open`、`compare`、`handoff`、`attach_context`。
- 禁止客户端轮询；缺失 stream 时显示 `offline` 或 `contract_mismatch`。
- 不在 Harness Plugins 复制 Eikona image store、review ledger 或领域规则。

## Capabilities

### New Capabilities

- `dsh-eikona-pane`：Harness Plugins 拥有的 DSH Pane 适配与交互面，消费 Eikona snapshot/event/action 合同。

### Modified Capabilities

None. Existing Eikona run/artifact/review requirements stay unchanged; this change only adds a Pane-facing projection.

## Impact

- 实施 owner：`agent/harness-plugins`。
- Canonical domain owner：`cli/eikona`。
- Root handoff: `/workspaces/yeisme-agent/openspec/changes/dsh-pane-plugin-ecosystem-v1/` task 4.1.
- Protocol interpreter: `@yeisme/dsh-pane-protocol@0.1.0-rc.1`.
- 插件包：`packages/client/ui-pane-domain/`、`packages/bundle/pane-domain/`。
- Domain dependency：`cli/eikona/internal/workspaceprojection/pane.go` 及其测试。
- 插件证据：`agent/harness-plugins/temp/integration-test-runs/<run-id>/`；Eikona owner 证据保留在 `cli/eikona/temp/integration-test-runs/<run-id>/`。
