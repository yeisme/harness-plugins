## Why

根级生态要求 DSH 提供 Pinax 笔记与知识图谱 Pane。该能力的 Host bridge、Client view、Pane 注册与安装生命周期属于 DSH 插件项目，因此本 change 归 `agent/harness-plugins`；Pinax 仍拥有 Markdown vault、索引、Git 建议与 CLI/service mutation。Pane 不得手写结构化 metadata。

## What Changes

- 在 `@yeisme/dsh-client-ui-pane-domain` 与 `@yeisme/dsh-pane-domain` 中交付 Pinax Pane 注册、渲染、action admission 与安装面。
- 通过 Harness Plugins Host bridge 消费 vault/inbox/note list、tag/backlink、graph 摘要、history 的脱敏 snapshot + event。
- capture/import/edit/sync 只提交 Pinax CLI/service owner action，结构化字段由 Pinax 生成。
- Note/graph node 通过 `ArtifactRefV1` 进入跨 Pane handoff。
- 禁止轮询与在 Pane 手写 JSON/YAML metadata。

## Capabilities

### New Capabilities

- `dsh-pinax-pane`：Harness Plugins 拥有的 DSH Pane 适配与交互面，消费 Pinax 投影与 mutation 合同。

### Modified Capabilities

无。

## Impact

- 实施 owner：`agent/harness-plugins`。
- Canonical domain owner：`cli/pinax`。
- 根 handoff：任务 4.4。
- 插件包：`packages/client/ui-pane-domain/`、`packages/bundle/pane-domain/`。
- Domain dependency：`cli/pinax/internal/app/pane.go` 及其测试。
- 插件证据：`agent/harness-plugins/temp/integration-test-runs/<run-id>/`；Pinax owner 证据保留在 `cli/pinax/temp/integration-test-runs/<run-id>/`。
