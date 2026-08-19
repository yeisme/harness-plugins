## Why

DSH Web 当前只内置图片附件与聊天内图片展示，缺少音频、视频、PDF/Office、文本与通用文件卡片的统一展示层。社区已有 `dsh-vision-complete`、`dsh-ds-attach`、`dsh-file-upload`、`dsh-files` 等方向性插件，但没有一个同时覆盖安全 `MediaRef` 合同、聊天/ToolView/Pane 渲染器注册、重媒体生命周期与跨领域 handoff 的通用插件。Harness Plugins 需要以 `split-owner` 方式提供该展示 shell，而不复制 DSH/领域 owner 的媒体状态。

准入结论为 `split-owner`：Harness Plugins 拥有富媒体展示插件、`MediaRefV1` 合同、客户端媒体渲染器与安全边界；DSH/领域 owner 继续拥有媒体存储、读取鉴权、模型多模态输入与媒体生成/编辑任务。

## What Changes

- 新增 `@yeisme/dsh-rich-media` unified dual-face package，提供 Host/Client 两个插件面、可安装 bundle row 与 `cordis.patch.yml`。
- 冻结 `MediaRefV1` 安全合同：owner、kind、opaque ref、version、mediaType、有界 title/summary、capabilities；禁止 raw path、凭据、任意 URL、无界文本。
- 提供纯 React `RichMediaCard` 客户端组件，作为聊天、ToolView、Pane 渲染器的共同起点；已接入官方 `sidebar.footer.action` slot 形成 Rich Media Workbench，并注册 `media/ref` Chat 媒体节点。
- 以 `DSH-better-sidebar` 为交互参考进行二创：保留“媒体库 / 文件 / 终端 / Git / 浏览器”工作台心智模型，但不复制其源码、DOM patch 或私有 `ctx.betterSidebar` API；当前实现媒体库 Tab，其余 Tab 预留官方 seam。
- Host 面当前为可清理的 no-op，为后续媒体解析/传输服务保留挂载点。
- 明确社区组件评估结论：可复用 `dsh-ds-attach`/`dsh-file-upload` 的文件嗅探/文档提取思路，但不形成源码或运行时依赖。
- 与根级 `dsh-pane-plugin-ecosystem-v1` 的 `ArtifactRefV1`/`ArtifactIntentV1` 对齐，后续媒体 Pane 走 typed handoff。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| MediaRef 合同 | required | Harness Plugins | deliver-now | validation/negative fixtures |
| Host 插件面 | required | Harness Plugins | deliver-now | lifecycle typecheck/test |
| Client 媒体卡片 | required | Harness Plugins | deliver-now | React component/typecheck |
| Rich Media Workbench | required | Harness Plugins | deliver-now | sidebar slot registration/typecheck/build |
| 官方聊天/ToolView/Pane slot 注册 | required | Harness Plugins + DSH | retain-next | 待 seam 确认 |
| 音视频播放器/PDF 预览 | required | Harness Plugins | retain-next | 后续 Phase 2 |
| 媒体存储/多模态输入 | required | DSH/领域 owner | moved behind contract | owner OpenSpec |
| 领域媒体编辑 | required | Eikona/Sonora/Anatomia | moved behind contract | 各 owner OpenSpec |

## Capabilities

### New Capabilities

- `dsh-rich-media-ref`: 安全 `MediaRefV1` 类型、校验与有界字段合同。
- `dsh-rich-media-host`: Host 插件生命周期与后续媒体解析/传输挂载点。
- `dsh-rich-media-client`: 纯 React 媒体卡片与后续渲染器注册入口。

### Modified Capabilities

无。本 change 只新增 additive package，不修改既有 Ordo、Pane Workbench 或 DSH package 合同。

## Impact

- 新 owner package：`packages/bundle/dsh-rich-media/`。
- 依赖关系：依赖 `@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-slots`、React；不 vendoring DSH core。
- 根级 handoff：`/workspaces/yeisme-agent/openspec/changes/dsh-pane-plugin-ecosystem-v1/`。
- 合同兼容分类：全新、additive、experimental；稳定起点尚未宣布。rollback 为移除新 bundle/feature，不涉及数据迁移。
