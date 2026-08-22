## ADDED Requirements

### Requirement: PreviewResource 必须是 owner-safe 资源描述而非文件句柄
系统 MUST 定义可校验的 `PreviewResourceV1` 或等价合同，至少包含 owner、opaque ref、version、bounded title、owner-authorized mediaType/family、capabilities 与 rendition descriptors。合同 MUST NOT 包含绝对路径、provider URL、credential、任意 header、无界正文或远端 component。

#### Scenario: 适配现有 MediaRef
- **WHEN** `dsh-rich-media` 提供已校验的 `MediaRefV1`
- **THEN** Host adapter 无损映射 owner/ref/version/mediaType/metadata/capabilities 到 PreviewResource，且原 `MediaRefV1` validator与consumer继续兼容

#### Scenario: 危险资源描述
- **WHEN** provider 尝试在 descriptor 中提交 `/home/user/file`、`https://provider.example/token=...`、HTML 或 React component id
- **THEN** parser fail closed，资源不得注册、打开或进入Pane persistence

### Requirement: Resource ref 文本不得单独构成 authority
`PreviewResourceRefV1` MUST 只能通过解析它的 owner-scoped `ResourcePreviewHostV1` 使用；浏览器不得根据 ref、title、扩展名或 owner id 拼接路径、URL或RPC authority。

#### Scenario: 恶意复用 ref
- **WHEN** 一个provider把另一个owner的opaque ref交给自己的host adapter
- **THEN** adapter返回typed owner/ref mismatch，不读取资源也不泄露其是否存在

### Requirement: Preview Registry 只能注册本地受信任 renderer
Registry MUST 只接受本地 lazy component factory、受控 renderer id、语义 icon、bounded labels、MIME patterns、families、modes与priority。Projection MUST NOT 注入URL、package specifier、HTML、SVG或任意代码。

#### Scenario: 注册 PDF renderer
- **WHEN**本地bundle注册支持 `application/pdf` 的lazy renderer
- **THEN** registry保存安全metadata和本地factory；PDF.js代码只有在匹配resource真正打开时才加载

#### Scenario: 远端 renderer 声明
- **WHEN** provider提交 `componentUrl`、`script` 或未知required字段
- **THEN** registration被拒绝且不会影响其他renderer或Pane Chrome

### Requirement: Renderer 解析顺序必须确定且可恢复
Registry MUST 按用户有效 Open With 偏好、exact MIME、structured suffix、family、safe binary fallback 的顺序解析。扩展名 MAY 作为owner sniff hint，但 MUST NOT 在客户端成为renderer选择依据。

#### Scenario: 结构化 MIME
- **WHEN** resource mediaType为 `application/vnd.example+json` 且没有exact renderer
- **THEN** registry选择声明 `+json` 或JSON family的兼容renderer，而不是按文件名选择text/html

#### Scenario: 首选 renderer 被卸载
- **WHEN** 用户偏好的renderer随profile dispose/HMR消失
- **THEN** registry忽略失效偏好并重新解析到下一个安全renderer；Tab保持resource identity并显示fallback原因

### Requirement: Open With 偏好必须只保存安全类型映射
Open With MAY 持久化 normalized mediaType/family到renderer id的bounded UI preference；MUST NOT 持久化resource ref、路径、内容、access handle或URL。

#### Scenario: 保存 Open With
- **WHEN** 用户将 `application/json` 改用 Raw Source renderer
- **THEN** 后续JSON资源可复用该renderer偏好，而persistence中不出现具体文件identity或正文

### Requirement: ResourcePreviewHost 必须提供 bounded、可取消、可释放访问
Host MUST 通过typed `inspect/openRendition/readWindow-or-range/release`语义提供内容。所有请求 MUST 支持Abort或等价取消；所有access handle MUST可release。浏览器 MUST NOT使用任意fetch读取provider URL。

#### Scenario: 关闭正在加载的PDF
- **WHEN** 用户在PDF worker、range request或thumbnail load完成前关闭Tab
- **THEN** provider abort请求、dispose worker并release access handle；异步失败不得在已关闭Tab闪现error

#### Scenario: 大型文本首屏
- **WHEN** owner判定文件超过initial text budget
- **THEN** Host只返回bounded text window和cursor/loaded/total/truncated事实，renderer不得把完整文件读入React state

### Requirement: 短时播放/预览源不得进入投影或持久化
如果owner以短时URL、Blob/Object URL、MediaSource或等价handle提供rendition，该值 MUST 仅存在于active access handle内，MUST有expiry/release语义，MUST从日志、evidence、localStorage、IndexedDB与Pane envelope中排除。

#### Scenario: Access URL过期
- **WHEN** 正在查看的媒体access handle过期
- **THEN** provider以同一owner/ref/version重新resolve，并在安全可行时保留page/currentTime；不得从persistence恢复旧URL

### Requirement: Preview 生命周期必须表达 resolving、partial、stale 与 unsupported
Resource view MUST 至少表达 `resolving`、`loading`、`ready`、`partial`、`stale`、`unsupported`、`error`、`offline`。状态 copy MUST 说明用户可执行动作，不得用空白iframe、无限spinner或“0项”冒充结果。

#### Scenario: Resource版本变化
- **WHEN** owner version subscription报告当前resource已更新
- **THEN** view进入stale并提供Refresh/Compare/Keep old view；旧内容继续显示时必须标记旧版本

#### Scenario: 无安全 renderer
- **WHEN** descriptor有效但没有兼容renderer/rendition
- **THEN** view显示metadata、unsupported原因和owner允许的Download/Open externally；不得猜测执行格式

#### Scenario: Partial 数据
- **WHEN** text/table/archive只加载了一个window/page
- **THEN** status显示loaded/total/truncated并提供Load more或owner-side search；不可用的全局操作必须disabled并解释范围

### Requirement: Cache 必须有界且按owner/version隔离
Preview cache MUST 使用owner/ref/version/rendition key与count+byte双上限LRU。Session change、logout、provider dispose与owner invalidation MUST清除相关cache。敏感正文 MUST NOT写入持久浏览器存储。

#### Scenario: 同ref新version
- **WHEN** owner为同一ref返回新version
- **THEN** registry不得把旧version cache当作新内容；旧cache只可供显式Compare并在eviction/dispose时释放

### Requirement: 一个resource view同时只能有一个active renderer host
同一Pane view在renderer switch、mode switch、跨Right/Bottom移动与HMR时 MUST 串行执行old suspend/dispose → new activate；不得同时保留两个会读取、播放或写状态的active renderer。

#### Scenario: 将播放中的媒体移到Bottom
- **WHEN** 用户跨region移动media Tab
- **THEN** old host先pause/suspend并release重复observer，new host再activate；不得出现双音轨或两个range stream

### Requirement: 跨Pane动作必须使用typed resource intents
Reveal in Explorer、Open Parent in Terminal、Compare With、Attach to Conversation、Send to Plan/Artifact、Copy Safe Ref、Download、Open Externally MUST 以owner/ref/version/capability组成的typed intent执行；drag payload MUST NOT包含路径、URL或bytes。

#### Scenario: Attach媒体到会话
- **WHEN** 用户从Media Pane选择Attach to Conversation
- **THEN** provider提交owner-authorized attachment intent，conversation owner决定接受/转换并返回receipt；Pane不直接注入base64或preview URL

### Requirement: 重 renderer 必须独立lazy load并可局部失败
Monaco、PDF.js、WaveSurfer、hls.js与未来3D renderer MUST 位于独立dynamic chunks；基础Rail/Quick Pick/Tab/metadata fallback MUST不依赖它们。Import、worker、CSP或codec失败 MUST只影响当前renderer。

#### Scenario: PDF worker被CSP阻止
- **WHEN** PDF.js worker无法启动
- **THEN** PDF view显示typed compatibility error与Download/Open externally，其他Tabs和Pane管理保持可用且无无限重试

### Requirement: Preview平台卸载必须HMR-safe
Bundle dispose/HMR MUST unregister renderers/providers、abort requests、release handles、workers、streams、MediaSource、object URLs、observers、global listeners与cache entries。Orphaned Tabs MAY保留safe identity等待兼容provider重新注册。

#### Scenario: HMR替换Preview bundle
- **WHEN**旧bundle dispose后新bundle加载
- **THEN** registry中每个renderer id只有一个active registration，DOM无重复portal/player/worker，旧access handle不再产生事件
