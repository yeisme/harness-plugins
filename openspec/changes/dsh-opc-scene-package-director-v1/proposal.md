# DSH OPC 场景生产导演入口

## Why

个人 OPC 在真实制作中最常遇到的不是“没有更多按钮”，而是无法快速知道当前场景包卡在哪、下一步是否会产生付费副作用、以及 Workbench 与 DSH 是否会给出相同的动作结果。DSH 已有 /drama、Review、Evidence、Delivery 和 Handoff 入口，但这些入口需要围绕同一 Scaena 场景包摘要形成异常优先的闭环。

## What Changes

- 在既有 /drama 入口增加 Scaena OPC 场景包安全摘要 consumer。
- 默认显示 show、episode、scene、stage、primary blocker、one primary action、gate 状态、partial/stale/offline/unknown 标签与 Workbench 深链。
- 复用 /drama review、/drama evidence、/drama delivery、/drama handoff 展示结构审阅、证据、交付和后续接管信息。
- 所有 mutation 继续使用 Scaena server-authored action；DSH 只提交 typed action、展示 receipt/reconcile，不执行任意 shell、provider 或本地包组装。
- DSH 与 Workbench 必须消费同一 summary/action/receipt identity；布局和入口语言可以不同。

## Non-Goals

- 不新增 DSH core fork、scheduler、task ledger、writer lease、approval ledger 或 terminal result。
- 不把 DSH 变成 Scaena package、ProductionGraph、readiness、asset、receipt、manifest 或 grant 的 owner。
- 不直连 Auctra、Eikona、Sonora、provider 或 Scaena 私有数据库。
- 不自动 retry unknown/partial/stale/cancel_unknown，不自动换模型、预算、画幅或质量档。
- 不新增行为 telemetry、聊天 provider bridge、多人权限或持久化产品状态。

## Impact

- packages/client/ui-ai-drama-director：增加摘要、异常卡片和 handoff 组合。
- packages/host / typed adapter：消费 Scaena safe projection、action、receipt 和 grant refs。
- packages/sdk：增加可验证的 DSH-local view model 与 redacted contract fixtures。
- openspec：与根 change 及 Workbench owner change 进行 cross-entry conformance。
