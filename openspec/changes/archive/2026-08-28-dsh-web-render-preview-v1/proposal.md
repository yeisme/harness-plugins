# dsh-web-render-preview-v1

## Why

DSH Web 已有 mermaid 嫁接插件和富媒体卡片，但没有连成同一条用户路径：聊天里的 \`\`\`mermaid 可以出图，侧栏打开 Markdown 文件却只显示无语言 class 的代码块；媒体 pane 被 `dsh.mediaHost` 门挡住，官方 DSH 几乎没有该服务，侧栏因此没有媒体入口。用户现在需要会话 mermaid、文件预览 mermaid、以及侧栏 overlay 富媒体预览同时可用。

## What Changes

- 抽出共享 `hydrateMermaidFences(root)`：聊天 MutationObserver 与 `FileOpenPane` Markdown 预览共用同一套 `MermaidRenderer` + SVG 净化。
- `renderMarkdown()` 给 mermaid fence 打上 `language-mermaid`，其它语言仍转义为普通 code。
- Desktop Workbench **始终**注册 `desktop.media` overlay view，并在 `sidebar.footer.action` 增加「媒体」入口；无 `dsh.mediaHost` 时显示诚实空态，不猜 URL。
- Explorer 的 image/audio/video/pdf 走媒体预览 view；文本/Markdown 仍走 `desktop.file`。
- `FileOpenPane` 在有授权 URL 时用 native audio/video 与 sandbox PDF iframe 预览。
- 聊天 `RichMediaCard` 增加「在窗格打开」，`openView({ kind: desktop.media })`。
- 修 mermaid kill-switch 文档（以 `dsh-mermaid` 为准）；figure 样式走 visual-kit token。

不恢复 V1 五 Tab 第二工作台。不引入 PDF.js / Office / WaveSurfer / hls.js 静态依赖。不 fork DSH core。

## Boundary Decision

`split-owner`：Harness Plugins 拥有展示壳、hydrate API、pane 入口与安全投影渲染。DSH / 领域 owner 继续拥有 markdown 源、附件存储、文件、媒体二进制与鉴权。缺 seam 时 fail-closed。

## Capabilities

### New Capabilities

- `dsh-web-render-preview`：会话与文件 Markdown 的共享 mermaid hydrate、侧栏 overlay 媒体入口、Explorer/聊天打开预览的合同。

### Modified Capabilities

无。不改已归档 `dsh-mermaid-render` 主 spec，不改写仍开放的 `dsh-rich-media-plugin-v1` 历史任务。

## Impact

- 改动：`packages/client/ui-mermaid-render/`、`packages/bundle/dsh-mermaid-render/`、`packages/bundle/dsh-rich-media/`、`packages/bundle/dsh-desktop-workbench/`、`packages/client/ui-desktop-workbench/`。
- 不新增独立 bundle；不 shadowing `conversation.chat.node` 的 `assistant` cell。
- 完成门：相关包 typecheck/test/build + `openspec validate dsh-web-render-preview-v1 --strict --no-interactive`。官方 `dsh web` Playwright 不是完成门。
