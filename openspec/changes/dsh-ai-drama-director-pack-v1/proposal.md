## Why

Harness Plugins 已有 Pane Workbench、Creator Studio safe projection、Rich Media、artifact composition 和 Ordo Agent Ops，但做剧用户仍缺少一个安装即用、上下文明确、命令清晰的导演工作入口。现有 Creator Studio 偏通用创作聚合，不能单独解决“在 Agent 会话里打开当前剧、按需推进完整生产阶段、处理下一项审查并查看运行证据”的高频路径。

本 change 增加薄 Director Pack，而不是重建 Creator Studio 或扩展 Scaena。Pane 可完成当前项目的端到端做剧流程；专业批量与全局管理仍由 Workbench Show Control Room 承担，领域状态与动作仍回各 owner。

## What Changes

- 新增 /drama 命令族：new、open、plan、generate、review、repair、evidence、handoff。
- 新增做剧 Pane preset：Context、Review、Run 为默认，Story、Visual、Audio 按需打开。
- 通过 Creator Home 的“完整做剧”入口应用 Director preset；Workbench handoff 保持可选。
- 复用 creator-studio-host-projection、creator-studio-pane-experience、creator-studio-artifact-composition、Pane Workbench 和 Rich Media；不创建第二跨 owner gateway。
- 新增 DramaContextV1 与 Workbench presentation handoff，只传 opaque refs、version/revision 和 intent。
- 新增 capability probe、disabled reason、install/uninstall/profile 幂等与兼容降级。
- 新增产品 evidence：命令发现、首次打开、review completion、handoff 和 context recovery 的脱敏事件。
- 不要求 Scaena 新增 projection/action；已有 segment 缺失时相应功能 fail closed。

## Capabilities

### New Capabilities

- dsh-ai-drama-command-surface: /drama 命令、选择器、typed handler、帮助与错误合同。
- dsh-ai-drama-pane-preset: Context/Story/Visual/Audio/Run/Review Pane preset、响应式与 capability probe。
- dsh-ai-drama-context-handoff: DramaContextV1、artifact intents、Workbench deep link、context switch/reconcile。
- dsh-ai-drama-product-evidence: 插件发现、使用、review、handoff 和恢复的脱敏证据。

### Modified Capabilities

无。该 pack 只组合已存在的 Pane、Creator Studio、Rich Media、artifact intent 和 Ordo Agent Ops 规格。

## Impact

- packages/host/ai-drama-director。
- packages/client/ui-ai-drama-director。
- packages/bundle/dsh-ai-drama-director。
- 可能对 packages/sdk/pane-plugin 增加 additive DramaContext/command helper；不得修改现有 owner 语义。
- Workbench consumer handoff：client/yeisme-workbench/openspec/changes/workbench-ai-drama-show-control-room-v1/。

## Non-Goals

- 不创建 scheduler、task ledger、approval ledger、provider runtime 或 domain store。
- 不实现 Workbench 级 Show/Episode 批量管理、跨集比较、专业 Asset Wall 或 Delivery dashboard。
- 不创建第二侧栏、第二 overlay、第二 Creator Studio gateway 或 browser polling fallback。
- 不执行任意 shell、读取 owner 私有数据库或传递 raw prompt/provider payload。
- 不新增 Scaena capability、adapter 或 owning change。
