## Why

Pane Workbench V2 已有正式 Right/Bottom 宿主和共享 store，但当前用户界面仍像调试原型：Activity Rail 用首字母代替图标，View Picker 是固定大弹窗，Tab 和 Pane 缺少完整管理按钮，文档是单例空页面，Rich Media 仍挂在重复 sidebar 工作台里，终端则未连接真实 PTY。V3 要在保留现有 reducer、布局和 provider 合同的同时，交付接近 VS Code 的紧凑工作区、统一资源预览平台、生产级媒体 Pane 与真实终端体验。

## What Changes

- 重做 `PaneRegionChrome`：使用语义图标、紧凑 toolbar、resource Tab、dirty/preview 状态、关闭按钮、split/move/maximize/more controls、Tooltip、菜单与完整键盘等价路径。
- Activity Rail 不再显示首字母；采用本地 `WorkbenchIcon` 语义层映射 `@vscode/codicons`，并为 active、hover、badge、status 和 disabled 建立稳定视觉状态。
- `+` 改为锚定 Quick Pick：可搜索、分组、显示图标/快捷键/目标区域，支持 Arrow/Enter/Esc，不再用固定居中的大对话框。
- 文件/文档改为 resource-keyed views：单击打开 preview Tab，双击、编辑或 pin 后持久；文件树使用紧凑行、真实类型图标、breadcrumb 和 bounded empty/error/loading state。
- 新增 `PreviewResourceV1`、Resource Preview Host 与本地 renderer registry；`FileEntryV1`、`MediaRefV1`、attachment/artifact refs 通过兼容 adapter 进入同一个 inspect/rendition/range/window/stale/release lifecycle。
- 文件/数据 renderer 覆盖 text/code、Markdown、JSON/YAML/TOML、CSV/TSV、PDF、HTML/SVG、archive、Office conversion artifact 与 binary fallback；复用 DSH Markdown/Shiki/JsonTree/Diff/Virtual primitives，按需加载 Monaco、PDF.js 与 TanStack Table。
- 将 `dsh-rich-media` 改成 `workspace.media-library` + resource-keyed media providers，不再注册 `sidebar.footer.action` 第二工作台；图片支持 zoom/pan/rotate/compare，音频使用 native controls + lazy WaveSurfer，视频使用 native playback + lazy hls.js 与字幕/章节。
- 所有 renderer 使用 owner-authorized MIME/rendition；不从扩展名、绝对路径或任意URL猜测资源，不执行raw HTML/SVG/PDF script/Office macro，不在Pane persistence保存正文、access handle或媒体URL。
- 终端视图使用 xterm.js 与官方 addons，消费 DSH 提供的 typed duplex terminal attachment；支持原始按键、resize、alternate screen、鼠标、bracketed paste、find、links、detach/reconnect/replay、退出状态和显式 kill。
- 终端 Tab 一一对应 DSH PTY resource；关闭 Tab 默认 detach，Trash/Kill 才 terminate。跨区域移动、分屏、最大化或 inactive retention 不得创建第二个 PTY。
- Pane V3 persistence 只保存布局与安全资源引用；不保存 terminal output、命令历史、绝对路径、credential、raw prompt 或领域内容。
- 生产 profile 移除 placeholder terminal；旧 DSH 缺少 V3 seam 时 fail visible，禁止用 HTTP-per-key、轮询或本地 fake console 回退。
- 保留 `PaneWorkbenchClientFace.registerView()`、`openView()`、V2 store 和 split 上限；V1/V2 OpenSpec 历史不改写。

## Capabilities

### New Capabilities

- `pane-workbench-chrome`: Activity Rail、Quick Pick、Pane toolbar、资源 Tab、菜单、图标、状态与可访问交互。
- `resource-preview-platform`: owner-safe resource descriptor、renderer registry、Open With、range/window、partial/stale、cache/disposal与跨Pane handoff。
- `file-document-pane`: resource-keyed 文件/文档导航、preview/pin 生命周期、紧凑内容视图与跨入口打开。
- `media-preview-pane`: Media Library、image/audio/video resource views、图片对比、WaveSurfer/HLS、字幕/转录、响应式与安全生命周期。
- `interactive-terminal-pane`: xterm.js 客户端、DSH PTY attachment、resize、reconnect/replay、关闭语义、安全和性能合同。

### Modified Capabilities

无。V3 复用并 supersede 尚未归档的 `dsh-pane-workspace-docking-v2` 原型 Chrome部分，以及 `dsh-terminal-v1` 的 placeholder retain-next；不修改其历史文件。

## Impact

- Pane shell：`packages/client/ui-pane-workbench/src/**`、相关 bundle、CSS/tokens、component tests 与 browser evidence。
- 文件/文档：`packages/bundle/dsh-file-document/**`、`packages/client/ui-desktop-workbench/**` 的 file/document provider 与打开入口。
- 资源预览：新增/收敛 Host adapter、renderer registry、access handle与shared preview UI；具体包路径在实施时保持与现有 bundle边界一致，不创建远端component host。
- 富媒体：`packages/bundle/dsh-rich-media/**` 从 sidebar workbench迁成Pane providers；保留 `MediaRefV1` public safety contract与chat card adapter。
- 终端：`packages/host/dsh-terminal-host/**`、`packages/bundle/dsh-terminal/**`、desktop provider、transport adapter 与 integration tests。
- 组合：`packages/bundle/dsh-desktop-workbench/**`、`packages/bundle/dsh-workbench-compose/**`、Web profile manifest 和 compatibility checks。
- 新依赖：xterm.js 官方包、VS Code Codicons、lazy `monaco-editor`、`pdfjs-dist`、`wavesurfer.js`、`hls.js`、`@tanstack/react-table`；优先复用 DSH 已有 `@tanstack/react-virtual` 与 UI primitives。必须锁定版本、记录第三方许可，并为每个重renderer保留轻量fallback；WebGL/3D仅按需或retain-next。
- 外部依赖：DSH 提供 additive interactive terminal capability、authenticated duplex transport、PTY resize，以及 owner-scoped preview inspect/rendition/range/window/version/release seam；Harness Plugins 不直接 import DSH 内部 node-pty/fs handle，也不持有PTY、文件或媒体canonical state。
