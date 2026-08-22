## Why

V2 已把 Pane Workbench 从遮挡整页的 overlay 迁入 DSH 正式右侧/底部布局，但当前 Chrome、文件/文档打开方式、媒体工作台和终端仍停留在原型阶段：字母充当图标、视图选择器像大弹窗、Pane 缺少完整管理入口，文件预览只有 image/PDF/text 分支，富媒体仍挂在重复侧栏工作台里，终端也只是行式占位交互。现在需要在不复制 DSH 左侧栏、不改变 canonical owner 的前提下，把工作区提升为接近 VS Code 的生产力界面，并形成可扩展的文件、文档、数据与媒体预览平台。

本 change 的产品准入结论为 `split-owner`：DSH 上游（deepseek-ai/deepseek-harness；2026-08-20 起 monorepo 不再维护 `client/deepseek-harness` 源码 fork，core seam 经本仓 `upstream-prs/` 上游 PR 通道交付）拥有 PTY、Agent authority、进程生命周期、浏览器 duplex transport 和根布局；`agent/harness-plugins` 拥有 Pane Chrome、资源标签、文件/文档视图、xterm.js 客户端和视图组合。本 change 只冻结 DSH 上游与 Harness Plugins 的跨 owner 边界与 handoff，不承载具体实现任务。

## What Changes

- 建立 V3 工作区体验合同：保留 DSH canonical 左侧栏与 V2 Right/Bottom docking，统一 Activity Rail、Pane header、资源 Tab、Quick Pick、图标、菜单、Tooltip、键盘和可访问状态。
- 文件与文档从单例“大预览页”改为 resource-keyed Pane：单击预览、双击或编辑后固定、可多标签打开，并通过 DSH 左侧栏 additive 入口或工作区 Explorer 打开，不创建第二套会话侧栏。
- 新增统一 Resource Preview 平台：owner-issued `PreviewResourceV1`、本地 renderer registry、Open With、版本/stale、bounded partial、range/stream、Abort/release 与安全 fallback；`FileEntryV1`、`MediaRefV1` 通过兼容适配进入同一预览生命周期。
- 文件预览覆盖 text/code、Markdown、JSON/YAML/TOML、CSV/TSV、PDF、HTML/SVG、archive、Office conversion artifact 与 unknown binary；小文本复用 DSH Shiki/Markdown/JsonTree/Diff primitives，大型代码/对比按需加载 Monaco，PDF 使用 PDF.js worker，表格使用 TanStack Table/Virtual。
- 媒体预览改为 Pane providers：媒体库 navigator + resource-keyed image/audio/video views，支持缩放/旋转/适配、图片对比、WaveSurfer 波形/时间轴、原生媒体 controls、HLS.js、自带字幕/章节与 owner-provided transcript；不再注册第二套 `sidebar.footer.action` Rich Media Workbench。
- 预览字节始终由 DSH 或领域 owner 授权：MIME sniffing、短时 access handle、范围读取、缩略图/海报/波形峰值与转换产物都保持 owner-owned；浏览器不从扩展名、绝对路径或任意 URL 猜测内容。
- 终端从 placeholder 升级为真实交互式 PTY：浏览器使用 xterm.js，DSH 增加独立 authenticated duplex WebSocket、原始 VT stream、resize、signal、detach/reconnect 与有界 replay；保留模型侧既有 `startSend/read` 行式接口。
- 采用社区生态而非自研终端渲染器：xterm.js 官方 addons、现有 node-pty，以及 VS Code Codicons；通过本地语义 wrapper 隔离第三方类名和版本。
- 明确终端关闭语义：关闭 Pane 默认只 detach，显式 Kill/Trash 才终止 PTY；Pane 移动、分屏、隐藏和最大化不得重建 shell。
- 建立 terminal authority、frame protocol、backpressure、reconnect、链接打开、粘贴保护、窄屏 Sheet 和性能/无障碍验收。
- 新 V3 supersede `dsh-terminal-v1` 的 placeholder、`dsh-pane-workspace-docking-v2` 的原型 Chrome 部分，以及 `dsh-rich-media-plugin-v1` 的重复侧栏工作台 placement；不改写 V1/V2 已完成历史，也不改变 V2 的正式布局所有权或 `MediaRefV1` 已发布合同。
- 不引入新的 docking runtime、浏览器 Fullscreen API、浮窗、第二文件状态 owner、第二终端生命周期 owner或客户端任意 shell argv 通道。

## Capabilities

### New Capabilities

- `dsh-workspace-productivity-experience`: DSH 与 Harness Plugins 之间关于 Pane 管理、统一资源预览、文件/文档/数据/媒体 renderer、真实 PTY 终端、社区依赖、所有权、兼容与验证的跨项目合同。

### Modified Capabilities

无。V3 通过新的跨项目 capability 建立 handoff；实施 requirement 进入本仓 `openspec/changes/dsh-pane-workspace-experience-v3/`，DSH 公共 seam 通过对应 Agent Note 冻结。

## Impact

- 设计 owner：`openspec/changes/dsh-workspace-productivity-ui-v3/`（本 change）。
- 实施 handoff：`openspec/changes/dsh-pane-workspace-experience-v3/`（本仓）。
- DSH 实施 owner：上游 `deepseek-ai/deepseek-harness` 的 `packages/terminal/**`、`packages/subprocess/**`、`packages/fs/**`、client resource access/transport 与 UI primitive seam；本地 fork 退役后经本仓 `upstream-prs/`（patch 系列 + 双语 Agent Note 草案）以 PR 交付，记录 duplex terminal、resource preview、range/stream、authority 与兼容不变量。
- Harness Plugins 影响：`packages/client/ui-pane-workbench`、`packages/client/ui-desktop-workbench`、`packages/host/dsh-terminal-host`、resource preview host/registry、`packages/bundle/dsh-terminal`、`packages/bundle/dsh-file-document`、`packages/bundle/dsh-rich-media`、compose/profile 与测试。
- 新增浏览器依赖候选：`@xterm/xterm`、`@xterm/addon-fit`、`@xterm/addon-search`、`@xterm/addon-web-links`、`@xterm/addon-serialize`、`@xterm/addon-unicode11`、可选 lazy `@xterm/addon-webgl`、`@vscode/codicons`。PTY 继续复用 DSH 已有 `node-pty` pin，不在本 change 中降级或替换。
- 新增预览依赖候选：lazy `monaco-editor`、`pdfjs-dist`、`wavesurfer.js`、`hls.js`、`@tanstack/react-table`；列表/长内容优先复用 DSH 已使用的 `@tanstack/react-virtual`，Markdown/Shiki/JsonTree/Diff/ImageGallery 优先复用现有 DSH primitives。`@google/model-viewer` 仅保留为 3D retain-next。
- 兼容边界：Pane `registerView()` / `openView()` 与模型侧 terminal `startSend/read` 保持兼容；新增交互能力采用 additive capability detection。旧 DSH 缺少交互 seam 时必须显示明确 compatibility state，不回退为假终端。
