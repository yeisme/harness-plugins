## Why

根级生态要求 DSH 提供 Auctra 文本创作与审阅 Pane。该能力的 Host bridge、Client view、Pane 注册与安装生命周期属于 DSH 插件项目，因此本 change 归 `agent/harness-plugins`；Auctra 仍是 CLI/TUI、Service API、canonical text 与 review receipt 的 owner，Agent candidate 不得自动覆盖 canonical text。

## What Changes

- 在 `@yeisme/dsh-client-ui-pane-domain` 与 `@yeisme/dsh-pane-domain` 中交付 Auctra Pane 注册、渲染、action admission 与安装面。
- 通过 Harness Plugins Host bridge 消费 project/material/outline/text unit、diff、review queue 的脱敏 snapshot + event。
- create candidate、review accept/partial 只提交 Auctra owner action；accept 只走既有 `review accept` / `review partial` 或等价 Service API。
- Scene/unit 通过 `ArtifactRefV1` handoff 到 Eikona/Sonora。
- 禁止轮询与客户端自动 accept。

## Capabilities

### New Capabilities

- `dsh-auctra-pane`：Harness Plugins 拥有的 DSH Pane 适配与交互面，消费 Auctra 投影与审阅合同。

### Modified Capabilities

无。

## Impact

- 实施 owner：`agent/harness-plugins`。
- Canonical domain owner：`cli/auctra`；产品面仍是 CLI/TUI + 已批准 Service API。
- 根 handoff：任务 4.3。
- 插件包：`packages/client/ui-pane-domain/`、`packages/bundle/pane-domain/`。
- Domain dependency：`cli/auctra/internal/app/pane.go` 及其测试。
- 插件证据：`agent/harness-plugins/temp/integration-test-runs/<run-id>/`；Auctra owner 证据保留在 `cli/auctra/temp/integration-test-runs/<run-id>/`。
