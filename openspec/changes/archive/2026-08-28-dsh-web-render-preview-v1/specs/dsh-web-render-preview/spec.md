## ADDED Requirements

### Requirement: 会话与文件 Markdown SHALL 共用 mermaid hydrate
系统 SHALL 把已稳定的 mermaid fence 渲染为净化 SVG，且聊天会话与侧栏文件预览共用同一套 `MermaidRenderer` 与 SVG 白名单。源码 MUST 保留可回看。streaming 期间 MUST NOT 出图。

#### Scenario: 会话 settle 后出图
- **WHEN** assistant 消息含 mermaid fence 且内容稳定
- **THEN** fence 位置渲染净化 SVG
- **AND** 原代码块可一键回看

#### Scenario: 文件 Markdown 预览出图
- **WHEN** 用户在 overlay 打开 Markdown 文件且正文含 mermaid fence
- **THEN** 预览根上的 fence 被 hydrate 为 SVG
- **AND** 其它语言 fence 仍为转义后的代码块

#### Scenario: 渲染失败回源
- **WHEN** mermaid 源非法或渲染抛错
- **THEN** 显示原代码块与错误提示
- **AND** 不丢源码、不白屏

#### Scenario: kill-switch
- **WHEN** `localStorage['dsh-mermaid']` 为 `off`
- **THEN** 不加载 mermaid 运行时、不改变任何消息或文件预览 DOM

### Requirement: 侧栏 SHALL 始终提供媒体 overlay 入口
Desktop Workbench SHALL 注册唯一 kind `desktop.media`，并在 `sidebar.footer.action` 提供「媒体」按钮。点击 SHALL `openView` 现有 overlay，MUST NOT 创建第二套 sidebar 工作台。无 `dsh.mediaHost` 时入口仍在，面板 SHALL 显示诚实空态。

#### Scenario: 无 host 空态
- **WHEN** `dsh.mediaHost` 不存在
- **THEN** 侧栏仍显示「媒体」
- **AND** 打开后显示空态，说明当前会话没有可预览媒体投影
- **AND** 不得从路径或任意 URL 猜测列表

#### Scenario: 有 host 预览
- **WHEN** owner 提供已校验 `MediaRefV1` 与短时 URL
- **THEN** overlay 列出媒体并按 kind 渲染 image/audio/video/PDF
- **AND** 关闭或 dispose 释放 object URL

### Requirement: Explorer 与聊天卡片 SHALL 打开同一 overlay
image/audio/video/pdf 资源 SHALL 打开 `desktop.media`。文本与 Markdown SHALL 打开 `desktop.file`。聊天 `RichMediaCard` SHALL 提供「在窗格打开」。

#### Scenario: Explorer 打开图片
- **WHEN** 用户在文件树单击图片条目且存在授权 preview URL
- **THEN** 系统打开 `desktop.media` overlay 并显示该图
- **AND** 不把文件系统路径交给浏览器

#### Scenario: 聊天卡片打开窗格
- **WHEN** 用户点击媒体卡片的「在窗格打开」且 `paneWorkbench` 可用
- **THEN** 系统 `openView({ kind: desktop.media })`
- **AND** 缺 pane 时该动作不渲染或禁用并说明原因

### Requirement: FileOpenPane SHALL 预览授权媒体
当 Host 给出短时 preview URL 时，FileOpenPane SHALL 用 native image/audio/video 或 sandbox PDF iframe 预览。无 URL 或 kind 不支持时 SHALL 显示元数据或诚实不支持状态。

#### Scenario: 授权音频预览
- **WHEN** 打开 audio 文件且 `resolvePreviewUrl` 返回短时 URL
- **THEN** 渲染 native audio controls
- **AND** 不自行拼接 URL

#### Scenario: 无授权二进制
- **WHEN** 打开非文本文件且没有 preview URL
- **THEN** 显示不支持内嵌预览
- **AND** 不 fetch 任意地址
