## Why

现有文件与选区引用以共享 dock 投影，尚不足以保证多对话草稿隔离、正文中的引用位置与真实结构化发送一致。用户已确认需要在实际 DSH Web 内完成多类型引用，并统一宿主及自有插件的亮暗主题。

## What Changes

- 增量提供按工作区与对话隔离的引用草稿、正文引用标签、分组发现、来源预览与发送快照。
- 文件、目录、选区、历史消息、终端、图片与区域作为内容引用；Agent、技能、工具分别表达协作对象、指引与可用能力，不因提及自动执行。
- 跨面板加入当前主对话时保留来源焦点；正在生成时只写下一条草稿；失败和未知发送结果保留状态。
- 统一引用入口、恢复提示和亮/暗/系统主题，复用现有视觉系统及组件。
- 宿主所需接口使用独立适配补丁；插件协议完成与实际宿主使用验收分开记录，整体完成要求后者通过。

## Capabilities

### New Capabilities

- `dsh-conversation-reference-drafts`: 目标对话、结构化引用、发现与发送生命周期。
- `dsh-reference-theme-experience`: 引用工具条及宿主、自有插件主题一致性。

### Modified Capabilities

无。现有 `dsh-composer-reference` V1 保留，新能力以并行可探测扩展接入。

## Impact

主要涉及 ui-pane-workbench、dsh-desktop-workbench、ui-selection-annotation、ui-interaction-space、ui-visual-kit、ui-surface，以及 upstream-prs 中的宿主输入框适配。不新增调度器、不修改生产配置、不读取真实凭据、不发布或部署；测试使用本地隔离 profile 和可丢弃数据。既有未提交改动全部保留。
