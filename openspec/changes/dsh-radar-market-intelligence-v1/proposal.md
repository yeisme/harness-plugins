## Why

用户希望每日通过 Agent 快读国内外短剧变化，再在 DSH 深看、追踪和查证。现有 personal-radar 的机会列表/文本帧与旧 Workbench handoff 不能直接承担市场时间线、补看与证据问答体验；需要在既有插件边界内增加正式 Web face。

## What Changes

- 复用 host/client/bundle 三层，增加可探测的市场 brief/signal/reader/receipt 安全投影。
- 提供每日快读、阅读补看、观察清单、跨市场对照、周度回顾及证据问答入口。
- 与当前会话关联提问，但读取状态归 Radar；切会话、Pane 重载、Agent 预读不自动标已读。
- 使用统一 Surface/视觉 token/zh-en-pseudo locale、可访问性和窄屏交互。
- 保留旧个人 Radar 能力；不恢复独立 Workbench、不持有领域真源、不新增采集或 Agent runtime。

## Capabilities

### New Capabilities

- `dsh-radar-market-projection`：能力协商、安全投影、动作回执与无本机 CLI 恢复。
- `dsh-radar-market-experience`：快读、补看、追踪、比较、回顾和证据问答的 Web 交互。

### Modified Capabilities

无。新增 market face 使用独立能力，不将旧 dsh.radar.projection.v1 的机会字段改义为市场信号。

## Impact

owner 路径为 packages/host/dsh-personal-radar、packages/client/ui-personal-radar、packages/bundle/dsh-personal-radar 及其测试/文档；不修改其他领域的在途实现。

依赖 [Radar 合同](../../../../../cli/short-drama-radar/openspec/changes/radar-market-observation-and-brief-v1/design.md)；根交接 [radar-global-market-intelligence-v1](../../../../../openspec/changes/radar-global-market-intelligence-v1/design.md)。软件合同可离线验证，真实宿主与真实数据证据必须独立报告。
