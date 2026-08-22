# DSH Web 富媒体展示插件 V1 方案

> 状态：已转为子项目 OpenSpec
> 正式实现 owner：`agent/harness-plugins/openspec/changes/dsh-rich-media-plugin-v1/`
> 本文保留为背景/社区调研草案，后续以子项目 OpenSpec 与 `@yeisme/dsh-rich-media` 包为准。
> 扩展方向：以 DSH-better-sidebar 为核心的工作台扩展方案见 `docs/design/dsh-workbench-core-expansion-v1.md`。

## 1. 背景与问题

DSH Web 当前内置的媒体展示能力以图片为主：

- `@deepseek-ai/dsh-attachment` 提供图片附件存储/校验/读取；
- `@deepseek-ai/dsh-client-ui-attachment` 提供聊天内图片 Gallery 与 Lightbox；
- Assistant 消息的 `image` block 已能渲染图片。

但缺少统一、可扩展的通用富媒体展示层：

- 音频/视频没有内建播放器；
- PDF/Office 没有预览或文件卡片；
- 聊天消息、ToolView、Sidebar/Pane 之间没有共享的 `MediaRef` 契约；
- 大图集、长视频、音频波形、文档预览没有统一的懒加载/虚拟化/有界缓存策略；
- 缺少社区插件的安全接入规范（URL、iframe、文件路径、远端内容）。

## 2. 社区调研结论

通过公开检索，社区已有相关方向但**没有**一个直接可用的“通用富媒体展示插件”：

| 项目/包 | 能力 | 与本方案关系 |
| --- | --- | --- |
| [dsh-vision-complete](https://github.com/Yts1919/dsh-vision-complete) | 看图 / OCR / 物体检测 / 视频理解 / 语音转写 / 截图直读 | 偏模型多模态输入与理解，不解决通用 UI 播放/预览 |
| [dsh-plugin-aigc-canvas](https://github.com/HuanLinOTO/dsh-plugin-aigc-canvas) | AIGC HTTP 桥、无限画布、ffmpeg 媒体编辑 | 偏生成/编辑，可复用媒体元数据处理思路 |
| [dsh-ds-attach](https://github.com/wqx-txdsyl/dsh-ds-attach) / [dsh-file-upload](https://github.com/HongMing-Huang/dsh-file-upload) / [dsh-files](https://raw.githubusercontent.com/taxueseek/dsh-files/main/README.md) | 附件上传、文件卡片、PDF/DOCX/XLSX/TXT 提取、文件消息展示 | 与“聊天内富媒体/文件展示”最接近，可评估复用或参考 |
| [dsh-file-tree-panel](https://www.npmjs.com/package/dsh-file-tree-panel) / [dsh-file-explorer](https://github.com/joejojoking-cloud/dsh-file-explorer) | 文件树、文件预览、Markdown、语法高亮 | 偏文件管理器，不覆盖音视频播放器 |
| [dsh-workbench](https://www.npmjs.com/package/dsh-workbench) / [dsh-web-ui](https://github.com/CAPTAIN1275/dsh-ui-web) | 工作台/UI 增强 | 可作为 UI 风格参考，不是媒体专用插件 |
| [Deepseek-omnimodal](https://github.com/good-boy4069/Deepseek-omnimodal) | 通过 MCP 接入 Qwen 多模态能力 | 偏模型能力接入，不解决前端展示 |

结论：

1. 建议**自研统一富媒体展示插件**，而不是直接依赖单一社区插件。
2. 可**评估复用**社区成熟组件：文件类型嗅探/文本提取（MarkItDown 等）、文件卡片视觉、PDF.js 等。
3. 若只需要“文件上传 + 文档卡片”的窄场景，可直接评估 `dsh-ds-attach` / `dsh-file-upload`；若需要音视频播放、媒体工作台、跨 Pane 流转，则必须进入本方案。

## 3. 目标 / 非目标

### 目标

- 为 DSH Web 提供统一的 `MediaRefV1` 与媒体渲染器注册机制。
- 支持图片、音频、视频、PDF、Office/文本、未知文件卡片的安全展示。
- 让聊天消息、ToolView、Sidebar/Pane 复用同一套媒体组件。
- 对重媒体做可见性驱动的懒加载、虚拟化、有界缓存和生命周期清理。
- 与现有 DSH Pane 插件生态、`dsh-pane-plugin-ecosystem-v1` 的 ArtifactRef 语义对齐。

### 非目标

- 不重新实现模型多模态输入管线（模型能否“看懂”媒体由 DSH/模型 owner 决定）。
- 不做媒体生成/编辑/转码的 canonical owner；生成任务属于 Eikona、Sonora、Anatomia 等领域 owner。
- 不把远端 HTML/JS/React 组件直接注入浏览器。
- 不手写 DSH 插件结构化 manifest；清单由插件 CLI/工具生成。
- 不把媒体二进制、cookie、token、原始文件路径放进浏览器持久化或 session 日志。

## 4. 产品准入与 owner 边界

建议按 `split-owner` 处理：

- **DSH/Harness Plugins**：拥有媒体展示插件 shell、MediaRef 合同、客户端渲染器注册、通用播放器/预览器。
- **DSH core / attachment owner**：拥有媒体附件存储、读取鉴权、类型校验（现有 `ctx.attachments` 图片能力扩展为通用媒体，或新增 `ctx.media`）。
- **领域 owner**：Eikona 拥有图片生成 gallery，Sonora 拥有音频波形/试听，Anatomia 拥有视频帧/时间线；插件只做安全投影与展示。

## 5. 技术方案

### 5.1 包结构

建议在 `agent/harness-plugins/packages/` 下新增：

```text
packages/
  host/dsh-media-host/         # Host 面：媒体 ref 解析、类型嗅探、URL 授权、事件流
  client/ui-dsh-media/         # Client 面：图片/音视频/PDF/文件卡片渲染器
  preset/dsh-media-preset/     # 组合/预设：注册 Conversation Node、ToolView、Sidebar/Pane
  bundle/dsh-rich-media/       # 可安装 bundle：dsh plugin add @yeisme/dsh-rich-media
```

也可合并为单一 `bundle/dsh-rich-media` 包，内部保留 host/client 分离，参考 `@yeisme/dsh-ordo-agent-ops` 的 unified dual-face 模式。

### 5.2 核心契约：`MediaRefV1`

```ts
interface MediaRefV1 {
  owner: string               // e.g. "dsh", "eikona", "sonora", "anatomia"
  kind: 'image' | 'audio' | 'video' | 'pdf' | 'document' | 'text' | 'file'
  ref: string                 // opaque ref，禁止裸路径
  version: string
  mediaType: string           // mime
  size?: number
  width?: number
  height?: number
  duration?: number           // ms
  poster?: MediaRefV1         // video poster image
  title: string               // safe display title
  summary?: string            // bounded safe summary
  capabilities: readonly MediaCapability[]  // play, download, extractText, ...
}
```

规则：

- 浏览器只拿到安全 ref 和展示元数据，不拿 raw URL / token / 路径。
- 媒体二进制通过 Host 授权的 `resolveMediaUrl(ref)` 按需读取。
- 所有跨 Pane 流转使用 `ArtifactRefV1` 或 `MediaRefV1`，不复制 canonical body。

### 5.3 渲染器注册

Client 插件通过 DSH 既有 seam 注册：

- `conversation.chat.node`：为 `media-card` / `audio-player` / `video-player` / `pdf-preview` 注册聊天节点渲染器；
- `tool.view`：为工具返回的媒体结果注册 ToolView；
- `sidebar` / Pane slot：为媒体工作台/媒体库注册侧栏或 Pane 视图；
- `conversation.chat.assistant-actions`：可选扩展“在新标签打开/下载/交给领域 Pane”等操作。

### 5.4 各媒体类型策略

| 类型 | 展示策略 | 安全/性能 |
| --- | --- | --- |
| image | 复用 `ImageGallery` + `ImageLightbox`；支持多图瓦片、缩放、旋转 | 懒加载；大图限流；EXIF 仅保留必要元数据 |
| audio | `<audio controls>`；可扩展 waveform（Sonora/外部音频库） | 播放器卸载时暂停并释放 URL；大文件 range 读取 |
| video | `<video controls preload="metadata" poster>`；支持字幕/音轨列表 | 仅可见时加载；不自动预载大文件；禁用任意插件 |
| pdf | PDF.js 渲染或 iframe sandbox 预览 | 若用 iframe 必须 `sandbox`；PDF.js worker 走本地包；禁用远程脚本 |
| office/text | 文本提取/转 Markdown 预览 + 原文件卡片 | 提取结果有界；原始二进制不落入聊天 JSON |
| unknown/file | 文件卡片：图标、名称、大小、类型、下载/打开动作 | 类型嗅探优先于扩展名；拒绝不可信 HTML/SVG 内联 |

### 5.5 Host 安全边界

- 新增或扩展 attachment 服务时，只暴露 typed `readMedia(ref, signal)`，不暴露任意文件读取。
- 返回给浏览器的 URL 必须 short-lived、scope 限定、可 revoke。
- 对上传/导入做 content sniffing 和大小/像素/时长限制。
- PDF/Office 预览默认不允许执行宏、脚本、远程资源。
- iframe 一律 `sandbox="allow-scripts allow-same-origin"` 白名单场景，或更严格 `allow-same-origin` 都不给。

### 5.6 生命周期与性能

- 所有媒体播放器/预览器必须 effect-scoped dispose：卸载时 `pause()`、`revokeObjectURL()`、断开 IntersectionObserver。
- 图片解码、波形计算、视频帧、PDF 渲染只在 Pane/卡片可见且尺寸稳定后启动。
- 大列表使用虚拟滚动，媒体缓存按内存预算清理。
- 失败/降级必须有重试入口，不把 loading 当 success。

## 6. 分阶段实施

| 阶段 | 范围 | 验收门 |
| --- | --- | --- |
| Phase 0 | 冻结 `MediaRefV1`、渲染器注册、Host URL 授权、安全边界；完成社区组件评估 | 两个 mock media owner + 一个真实 DSH 文件卡片可跑通 |
| Phase 1 | 文件卡片、PDF/Office/文本预览、图片增强 | 聊天内可展示常见文件；PDF 沙箱预览；无 raw path 泄漏 |
| Phase 2 | 音频/视频播放器、波形/字幕扩展点、媒体库/侧栏 | 音视频可见性加载；播放器卸载不泄漏；键盘/读屏可用 |
| Phase 3 | 与 Pane 生态集成：Eikona gallery、Sonora waveform、Anatomia timeline、ArtifactRef handoff | 跨 Pane 打开/对比/handoff 只走 typed intent |
| Phase 4 | 性能、可访问性、打包发布、conformance | 性能矩阵 + a11y 矩阵 + `openspec validate --strict` 全绿 |

## 7. 验收与测试

- **合同测试**：MediaRefV1 在不同 owner 之间语义一致；unknown required capability fail closed。
- **状态测试**：ready / loading / error / stale / offline / permission_denied / contract_mismatch 全状态可测。
- **UI/可访问性**：键盘播放/暂停、focus 管理、ARIA label、字幕、reduced motion。
- **性能测试**：1,000 张图、长视频、大 PDF、长音频波形均使用虚拟化/有界缓存；首屏不拉全量媒体。
- **安全测试**：恶意文件扩展名、超大文件、不可信 PDF/HTML、iframe 逃逸、URL 越权读取均被拒绝。
- **证据**：集成/组件/e2e 测试写入对应子项目 `temp/integration-test-runs/<run-id>/`。

## 8. 待确认问题

1. 首版范围是“聊天消息内富媒体展示”还是包含“媒体 Pane/工作台”？
2. 是否需要模型读取媒体内容（多模态输入），还是只做人类可见展示？
3. 通用媒体存储放 DSH core（扩展 `ctx.attachments`）还是各领域 owner？
4. 是否支持远端媒体 URL，还是只支持本地/领域托管附件？
5. 优先复用社区文件插件（`dsh-ds-attach` / `dsh-file-upload`）还是完全自研？
6. 是否需要离线缓存/本地播放，还是仅在线流式展示？

## 9. 下一步

1. 确认第 8 节范围问题。
2. 若需要正式设计，用 `openspec new change` 在本仓创建 OpenSpec change。
3. 在 `agent/harness-plugins` 创建 `@yeisme/dsh-rich-media` 骨架，先跑通 Phase 0。
