## Why

根级 change `ai-drama-director-workspace-editor-roundtrip-v1` 已把 DSH/Harness Plugins 收敛为异常优先导演台：默认只呈现当前 context、primary blocker、一个 owner-approved next action 和必要的 Review/Run/Delivery 深链，Workbench 成为媒体优先的默认导演工作区。现有 `dsh-ai-drama-*` 能力（Director Pack first slice、full-show operational panes、Bridge V2）证明投影与 receipt 语义可用，但默认 `director` preset 与导航叙事仍偏向全剧 operational console，两端还没有共用同一 decision token consumer。本 owner change 承接根合同的 DSH 切片：exception-first 默认投影、共享决策 token 消费与旧 full-show panes 的兼容窗口治理。

## What Changes

- 默认 `director` preset 收敛为 Context、Review、Run：只回答“我在哪个 context、当前最重要阻塞是什么、为什么需要我决定、下一项允许动作是什么”；Story、Visual、Audio、Delivery 按需打开，不进入默认叙事。
- `/drama` 命令面默认投影调整为异常优先：阻塞、影响范围、owner reason、一个允许动作与深链；不再要求用户先浏览完整全剧控制台。
- 新增共享 decision token consumer：费用、版权、canonical accept、外编 apply、final export 使用与 Workbench 相同的 owner-authored decision token 与 receipt；DSH 端只做文本化摘要与提交，重复提交幂等返回原 receipt 或 stale/already_decided。
- 旧 full-show operational panes 保留至少两个连续插件发布窗口作为 legacy/advanced 兼容视图：继续读取相同 owner projection，显示 deprecation 文案与 Workbench handoff，不静默删除、不改义、不用于覆盖 owner receipt，并记录使用率。
- DSH → Workbench / 外部编辑器 handoff 沿用 Bridge V2 语义：只传递版本化 `DramaContextRef`、`ArtifactRef`、`ActionIntent`、`ReceiptRef` 与 launch ref，不扩展 raw path、token、credential 或 editor payload。
- 不复制 Workbench 语义画布/scene graph、Scaena `EditRevision`/delivery bundle、Ordo run/task/lease/approval ledger；不建第二调度器、项目数据库或 provider runtime。

## Admission Decision

结论：`fit`（DSH owner 切片）。默认投影收敛、命令面、decision token consumer 与 legacy pane 窗口治理属于 DSH 插件职责；决策背后的 canonical 事实与动作资格仍属各领域 owner（经既有 projection/action 合同）。DSH 不得从展示状态推导或改变任何 owner canonical 状态。

## Required Capability Ledger

| 能力 | 状态 | Canonical owner | 可见宿主 | 交付切片 | 验收证据 |
| --- | --- | --- | --- | --- | --- |
| 异常优先默认投影（context/blocker/next action/深链） | required | DSH | DSH Web/TUI | deliver-now | 有/无阻塞、unknown、partial 的状态 golden |
| 共享 decision token consumer | required | 领域 owner（DSH 仅 consumer） | DSH Web/TUI | deliver-now | 幂等 receipt、stale/already_decided、duplicate decision 契约用例 |
| 旧 full-show panes 兼容窗口与 deprecation | required | DSH | DSH Web | deliver-now（≥2 个发布窗口） | 兼容视图仍读 owner projection、deprecation 文案与 Workbench handoff 呈现 |
| Workbench/editor handoff（Bridge V2 语义） | required | DSH | DSH Web/TUI | deliver-now | 只传 typed refs/launch ref 的 closed-schema 用例 |
| 旧 full-show pane 退役 | retained | DSH | DSH Web | 后续独立 removal change | consumer evidence + deprecation window + rollback |

## Non-Goals

- 不恢复或重设计旧 `show-control` preset 为默认；不新增第二侧栏、第二 overlay 或跨 owner gateway。
- 不复制 Workbench 语义画布/scene graph、Scaena revision/bundle/diff/rebase、Ordo ledger 或 provider runtime。
- 不做 scheduler、writer lease、approval ledger、capacity reservation 或 terminal result。
- unknown/partial/cancel_unknown/stale cursor 只禁用 mutation 并要求 owner reconcile，绝不自动 retry 或替换 writer。
- 结果文本不含 raw prompt、provider payload、private tool args、token、absolute path 或完整思维链。

## Capabilities

### New Capabilities

- `dsh-ai-drama-exception-director`：DSH `/drama` 异常优先默认投影、共享 decision token consumer、Workbench/editor handoff 与旧 full-show panes 兼容窗口治理。

### Modified Capabilities

无。现有 `dsh-ai-drama-operational-panes`、`dsh-ai-drama-context-handoff`、`dsh-ai-drama-show-control-*` 等能力保持原义；exception-first 默认与兼容窗口治理以新 capability 增量引入，旧 pane 退役由后续独立 removal change 处理。

## Impact

- `packages/client/dsh-ai-drama-director`（或等价既有插件包）：默认 preset 收敛、异常优先投影渲染、decision token 提交与 receipt 刷新、legacy pane deprecation 标记。
- `packages/host/`：decision token 安全投影与 typed action 转发；host 边界只传 opaque ref、有界摘要、版本、freshness、evidence ref、server-authored action。
- 跨仓依赖：Workbench Director Workspace（`client/yeisme-workbench/openspec/changes/workbench-ai-drama-director-canvas-v1`）为 Workbench handoff 目标；Scaena round-trip（`agent/scaena/openspec/changes/scaena-openchatcut-editor-roundtrip-v1`）为外编 diff 的 decision source；本 change 只消费公开合同，不依赖内部实现。
- 上游根合同：`openspec/changes/ai-drama-director-workspace-editor-roundtrip-v1`（`ai-drama-client-composition` delta）。
