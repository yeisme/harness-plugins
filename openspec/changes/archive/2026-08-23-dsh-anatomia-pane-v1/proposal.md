## Why

根级生态要求 DSH 提供 Anatomia 多模态理解 Pane（source、job、timeline、shot/scene、transcript/OCR、observation/evidence）。该能力的 Host bridge、Client view、Pane 注册与安装生命周期属于 DSH 插件项目，因此本 change 归 `agent/harness-plugins`；Anatomia 仍拥有 job、analysis、observation 与 evidence，partial 不得冒充 complete。

## What Changes

- 在 `@yeisme/dsh-client-ui-pane-domain` 与 `@yeisme/dsh-pane-domain` 中交付 Anatomia Pane 注册、渲染、action admission 与安装面。
- 通过 Harness Plugins Host bridge 消费 source queue、timeline、shot/scene、transcript/OCR、observation 的脱敏 snapshot + event。
- analyze、inspect evidence、revision 只提交 Anatomia owner action；partial 状态显式可见。
- Evidence/frame/clip 通过 `ArtifactRefV1` 进入跨 Pane handoff。
- 禁止轮询；partial 不得显示为 complete。

## Capabilities

### New Capabilities

- `dsh-anatomia-pane`：Harness Plugins 拥有的 DSH Pane 适配与交互面，消费 Anatomia 投影合同。

### Modified Capabilities

无。

## Impact

- 实施 owner：`agent/harness-plugins`。
- Canonical domain owner：`agent/anatomia`。
- 根 handoff：任务 4.5。
- 插件包：`packages/client/ui-pane-domain/`、`packages/bundle/pane-domain/`。
- Domain dependency：`agent/anatomia/internal/application/pane.go` 及其测试。
- 插件证据：`agent/harness-plugins/temp/integration-test-runs/<run-id>/`；Anatomia owner 证据保留在 `agent/anatomia/temp/integration-test-runs/<run-id>/`。
