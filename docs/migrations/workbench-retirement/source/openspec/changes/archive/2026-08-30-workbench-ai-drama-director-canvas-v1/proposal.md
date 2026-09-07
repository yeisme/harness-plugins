## Why

根级 change `ai-drama-director-workspace-editor-roundtrip-v1` 已把 Workbench 定为建剧、续作、跨集比较、媒体审阅和交付的默认导演工作区，并冻结了 `ai-drama-client-composition` delta（Workbench 默认入口、共享决策箱、兼容窗口）。Workbench 当前的 AI Drama 能力只有 DSH Bridge V2 ingress 消费（`workbench-dsh-ai-drama-bridge-consumer-v1`）与 alpha 导航投影，还没有把 `Show -> Episode -> Scene -> Shot/Asset` 变成 `/agent` Unified Spatial Creative Runtime 内的媒体优先结构化语义画布，也没有共享决策箱 consumer 与外编 handoff 入口。1–5 人漫剧团队需要单一默认入口完成建剧、审阅和交付，因此需要本 owner change 承接根合同的 Workbench 切片。

## What Changes

- 在现有 `/agent` Unified Spatial Creative Runtime 内新增 AI Drama Director Workspace：以 `Show -> Episode -> Scene -> Shot/Asset` 组织可缩放语义关系，镜头缩略图、序列预览与媒体比较为主要视觉层；状态、rights、cost、evidence、readiness 作为与选中对象关联的 overlay/inspector 投影。
- 画布只保存 UI layout、camera、选区与展开状态；所有节点 identity、关系与终态来自 owner 安全投影（Auctra/Scaena/Eikona/Sonora/Ordo/Aigora refs），不成为领域 canonical truth，不从自由节点文本推断缺失领域关系。
- 新增共享决策箱 consumer：消费 owner-authored decision token 的 typed action 与 receipt，Workbench 作为视觉 diff 的主要批准面（费用、版权、canonical accept、外编 apply、final export），与 DSH 共用同一 decision identity；重复提交幂等返回原 receipt 或 stale/already_decided，不创建第二本地批准记录。
- 新增受控外编 handoff：frame-level trim、track edit、transition、effect、color 请求一律导向 Scaena delivery bundle / 外编 action，不在本 capability 实现第二套完整 NLE timeline。
- 新增 UI 与 e2e 证据：语义画布渲染快照、决策箱状态转换 golden、外编 handoff 路径的 Playwright e2e，证据写入 `temp/integration-test-runs/<run-id>/`。
- 不恢复已退役的独立 Show Control Room 路由；不新增浏览器直连 owner、iframe bridge、domain store 或第二套 terminal state；不实现镜头抽卡、Candidate Wall、Production Canvas 的重复生产实现（沿用 Scaena consumer contract 与 server-authored 摘要）。

## Capabilities

### New Capabilities

- `workbench-ai-drama-director-canvas`：`/agent` 内 AI Drama Director Workspace 的媒体优先结构化语义画布、owner 安全投影消费、共享决策箱 consumer、外编 handoff 入口与 UI/e2e 证据合同。

### Modified Capabilities

无。现有 `workbench-ai-drama-show-navigation`、`workbench-ai-drama-owner-projection`、`workbench-ai-drama-review-inbox`、`workbench-dsh-ai-drama-bridge-consumer` 保持原义；Director Workspace 以新 capability 增量引入，不恢复、不改义旧 Show Control Room。

## Impact

- `apps/web/src/workbench/agent/`：Director Workspace 画布、selection overlay、inspector 投影、decision inbox 与 handoff 入口接线（additive）。
- `packages/task-sdk/`：Director Workspace 投影/动作类型（additive exports），不复制 owner 状态机。
- `service/`： Director Workspace 的 owner 投影聚合与 typed action 转发，mutation 仍经 `TaskService` 与 permission/cost/expected-version/idempotency gate。
- 跨仓依赖：Scaena 的 delivery bundle 与 semantic diff 投影（`agent/scaena/openspec/changes/scaena-openchatcut-editor-roundtrip-v1`）、DSH 的 decision token 合同（`agent/harness-plugins/openspec/changes/dsh-ai-drama-exception-director-v1`）；本 change 只消费公开合同，不依赖其内部实现。
- 上游根合同：`openspec/changes/ai-drama-director-workspace-editor-roundtrip-v1`（`ai-drama-client-composition` delta）。
