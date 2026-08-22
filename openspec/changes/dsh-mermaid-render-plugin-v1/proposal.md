## Why

DSH Web 会话里的 assistant markdown 由 `@deepseek-ai/dsh-client-ui-primitives` 的直渲 mdast 管线（`MarkdownText`/`CodeBlock`）渲染。该管线对不可信输出采取封闭策略（DOM 被 fixtures 逐字节钉死），fence 一律落到 `CodeBlock`（`pre > code.language-<lang>`），运行时中没有任何 mermaid 代码，也没有按 fence 语言分发的渲染钩子。结果是：模型输出的 ```mermaid``` 图只能当纯文本代码看，用户必须把源码复制到外部工具才能看到图。

rc.6/rc.7 的公开扩展面里没有 markdown fence 钩子（21 个 `conversation.*` slot 全是区域性的；`conversation.chat.node` 是 keyed shadowing——注册 'assistant' cell 就要复刻整个 assistant 行渲染，AssistantMarkdown 组件也不在导出面）。正确的长期修复是上游 additive seam；在此之前，需要一个不阻塞在 DSH core 发布节奏上的可安装插件。

## What Changes

- 新增 `@yeisme/dsh-client-ui-mermaid-render` client package：在 DSH Web 会话内把已稳定的 ```mermaid``` fence 增量替换为 mermaid.js 渲染的 SVG（本地打包、无 CDN）。
- 新增 `@yeisme/dsh-mermaid-render` bundle（`dsh.bundle.patch` 行），可通过 `dsh plugin --profile web add` 安装。
- 渲染时机与宿主一致：streaming 期间 fence 保持纯文本，仅在内容稳定（settle）后嫁接图；React 重挂载/回滚由观察器自愈。
- 纯增量 DOM：图作为 `pre` 的兄弟 `figure` 插入，源码 `pre` 原地保留（可切换回看），插件卸载完全还原。
- Track 2（本 change 只立规格不改上游）：向 DSH core 提议 `conversation.chat.markdown-fence` keyed-by-lang additive seam； seam 合并后插件把嫁接层换成 slot 注册，mermaid 渲染核心复用。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| mermaid fence → SVG 内联渲染 | required | Harness Plugins | deliver-now | unit tests（graft/stabilize/error/toggle/dispose） |
| streaming 不闪图、settle 后渲染 | required | Harness Plugins | deliver-now | stability timer 单测 |
| 源码零丢失（失败可回看） | required | Harness Plugins | deliver-now | error-path 单测 |
| 本地打包 mermaid（无外部 JS 注入） | required | Harness Plugins | deliver-now | build 产物检查（无 CDN/外部 URL） |
| markdown-fence upstream seam | required | DSH core | handoff（design.md 附录规格） | upstream PR 合并后迁移 |
| dsh 主题/暗色跟随 | optional | Harness Plugins | deliver-now（prefers-color-scheme） | theme 切换单测 |
| 真实浏览器视觉验收 | required | Harness Plugins | retain-next（本会话无浏览器通道） | 手工 runbook + 截图 |

## Capabilities

### New Capabilities
- `dsh-mermaid-render`：会话内 mermaid 图渲染（含安全、降级、生命周期要求）。

### Modified Capabilities
- 无（不改 DSH core，不 shadowing 任何既有 slot）。
