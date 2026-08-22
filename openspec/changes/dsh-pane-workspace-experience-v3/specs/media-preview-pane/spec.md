## ADDED Requirements

### Requirement: Rich Media 必须迁移为 Pane providers
`dsh-rich-media` MUST 保留 `MediaRefV1` 安全合同与兼容chat card，但V3 production profile MUST注册 `workspace.media-library` singleton navigator与non-singleton media resource views，MUST NOT再注册 `sidebar.footer.action` 第二工作台。

#### Scenario: 打开媒体库
- **WHEN** 用户从Activity Rail、Quick Pick或typed command打开Media Library
- **THEN** Workbench激活唯一media navigator；DSH canonical sidebar保持不变且页面中不存在第二套Rich Media Workbench

#### Scenario: 旧profile残留sidebar contribution
- **WHEN** compose检测到V3 Pane provider与deprecated sidebar contribution同时可用
- **THEN** V3 compatibility check禁止重复contribution并报告profile迁移要求，不得同时播放或加载同一媒体

### Requirement: Media Library 必须有界、可搜索且虚拟化
Media Library MUST 提供grid/list、search、kind/owner/status filter、sort、pagination或Load more，并只渲染viewport附近thumbnail rows/cards。Local filter只作用于已加载descriptor时 MUST明确范围；全局query需要owner capability。

#### Scenario: 大型媒体库
- **WHEN** owner返回数千个media descriptors
- **THEN** UI使用virtualized grid/list与bounded thumbnail concurrency，DOM/decoder数量保持有界并显示loaded/total

#### Scenario: 无全局搜索能力
- **WHEN** 当前列表只加载部分资源且owner未提供search capability
- **THEN** search标记为“在已加载项目中搜索”，不得暗示覆盖完整媒体库

### Requirement: Media cards 必须展示可扫描的真实状态
Thumbnail/card MUST 显示语义kind icon、title、duration或dimensions、owner/status与selected/focus状态；不得用首字母、decorative cards或颜色作为唯一信息。Broken/expired thumbnail MUST保留metadata与Retry。

#### Scenario: Thumbnail加载失败
- **WHEN** thumbnail rendition过期或解码失败
- **THEN** card保留title/type/duration、显示typed failure与Retry，selection和打开动作不依赖图片成功

### Requirement: 图片Pane必须提供生产级查看工具
Image renderer SHALL 支持Fit、Fill、Actual Size、zoom、pan、rotate、background切换、metadata与Reset。Raster original/thumbnail MUST来自owner rendition；SVG MUST不inline且不得执行active content。

#### Scenario: 查看超大图片
- **WHEN** original超过owner decoded-pixel或byte budget
- **THEN** owner提供bounded rendition/tiles或拒绝original，renderer显示当前resolution与Open/Download original动作；不得无界解码导致页面冻结

#### Scenario: 缺少替代文本
- **WHEN** owner未提供图片描述
- **THEN** image使用safe title作为最小accessible label，并在Inspector中标记“未提供替代文本”，不得凭空生成语义描述

### Requirement: 图片对比必须保持两个资源身份
Image Compare first-support MUST 提供Side by Side、Swipe与Opacity Overlay，并显示两侧owner/ref/version/title。Compare view MUST是resource-keyed Pane，可split/move/maximize，且不覆盖canonical sidebar。

#### Scenario: 对比两个不同版本
- **WHEN** 用户从stale image选择Compare with latest
- **THEN** compare view固定old/new version labels，切换mode不改变两份identity，关闭compare不替换原Tab

### Requirement: 音频Pane必须以可访问播放控件为基础
Audio renderer MUST以native media semantics或等价accessible controls提供play/pause、seek、current/total time、speed、volume与focusable timeline。WaveSurfer MAY按需增加waveform、Timeline与Regions，但waveform MUST NOT是唯一控制或状态表达。

#### Scenario: 无WaveSurfer或peaks
- **WHEN** lazy import失败、owner未提供peaks或资源超过浏览器decode budget
- **THEN** native audio playback仍可用，UI说明waveform unavailable而不是阻塞播放

#### Scenario: 键盘seek
- **WHEN** 用户聚焦timeline并使用方向键/PageUp/PageDown
- **THEN** 播放位置按定义变化并以文本时间可感知，waveform颜色不是唯一反馈

### Requirement: 长音频必须优先使用owner预计算peaks
超过owner/deployment waveform budget的audio MUST使用owner-provided bounded pre-decoded peaks或不显示waveform。Renderer MUST NOT为了生成波形先将完整长音频解码到Web Audio内存。

#### Scenario: 两小时录音
- **WHEN** owner只提供playback source而没有precomputed peaks
- **THEN** Audio Pane显示native player与transcript入口，waveform区域不启动full decode并给出可理解说明

### Requirement: 音频字幕、转录与marker必须是owner renditions
Transcript、captions、chapters、markers/regions MUST来自owner-authorized rendition或typed metadata。V3 MAY显示/导航它们，但 MUST NOT把媒体编辑、裁切或annotation mutation伪装为已支持。

#### Scenario: 点击转录时间点
- **WHEN** transcript cue带有有效时间范围且用户激活
- **THEN** player跳转到对应时间并保持焦点/当前cue可感知；无有效时间时只显示文本不猜测位置

### Requirement: 视频Pane必须支持progressive playback与字幕章节
Video renderer MUST提供play/pause、seek、time、speed、volume、captions、chapters、poster、fit与paused frame step。媒体 MUST不autoplay；inactive view MUST默认pause并保留bounded currentTime。

#### Scenario: 切换到其他Tab
- **WHEN** video正在播放且其view变为inactive/hidden
- **THEN** provider暂停播放、停止非必要decode/repaint并保存component-local currentTime；重新激活时不自动播放，除非用户再次操作

### Requirement: HLS 必须native-first并按需使用hls.js
对HLS source，renderer MUST先使用平台native HLS capability；只有浏览器支持MSE且native HLS不可用时才lazy load hls.js。Manifest、segments、subtitle/audio tracks MUST由owner授权。DRM MUST不进入V3。

#### Scenario: Safari类native HLS平台
- **WHEN** browser对resource mediaType/source支持native HLS
- **THEN** renderer直接使用native video，不加载hls.js重复pipeline

#### Scenario: MSE平台
- **WHEN** browser无usable native HLS但hls.js支持当前MSE环境
- **THEN** renderer加载hls.js，显示adaptive/track状态并对recoverable network error提供Retry；dispose时destroy实例

#### Scenario: 无HLS能力
- **WHEN** browser既无native HLS也无兼容MSE
- **THEN** view显示unsupported与Download/Open externally（若owner允许），不得无限加载或转码于浏览器

### Requirement: 媒体链接、字幕与metadata必须经过安全策略
Renderer MUST NOT直接打开provider URL、任意scheme、字幕中的HTML或metadata中的链接。URL/file-like actions MUST经过owner/Workbench policy并使用typed intents。

#### Scenario: 字幕包含链接样式文本
- **WHEN** caption cue包含 `javascript:` 或看似文件路径的文本
- **THEN** renderer按纯文本显示，除非用户显式激活且owner policy解析为允许的typed action

### Requirement: Media playback与资源生命周期必须唯一且可释放
一个media view同时 MUST只有一个active playback/decoder instance。Pane move、split host、maximize、inactive、close、provider dispose与HMR MUST串行pause/suspend/dispose，并释放WaveSurfer、hls.js、MediaSource、object URLs、observers与listeners。

#### Scenario: 跨region移动播放中的音频
- **WHEN** 用户把Audio Tab从Right移动到Bottom
- **THEN** old host先pause/suspend，new host再激活同一resource；不得出现两路声音或两个WaveSurfer实例

#### Scenario: 关闭Media Tab
- **WHEN** 用户关闭正在加载或播放的media view
- **THEN** provider abort load、pause、release access handle与renderer资源；Pane state只保留其他safe views

### Requirement: Media Inspector 必须是普通Pane而非第二Details owner
EXIF、codec、dimensions、duration、transcript、evidence与owner metadata MAY通过 `workspace.resource-inspector` 或当前view的可折叠区域展示。它 MUST不替代或侵占DSH canonical Tool Details，也不得持有领域canonical state。

#### Scenario: 打开Inspector
- **WHEN** 用户在Media Pane选择Show Metadata
- **THEN** Workbench打开/聚焦resource-linked Inspector Pane或窄屏Sheet；关闭Inspector不关闭media resource

### Requirement: 媒体Pane必须适配Right、Bottom与390px Sheet
Right宽Pane MAY显示thumbnail/metadata secondary column；窄Right、Bottom浅高度与390px Sheet MUST折叠secondary surfaces，保留主canvas/player、核心controls与Pane management。Coarse pointer targets MUST至少44px。

#### Scenario: Bottom浅高度视频
- **WHEN** video位于高度不足320px的Bottom region
- **THEN** UI优先显示letterboxed video与单行核心controls，chapters/metadata进入More或临时Sheet，不产生纵向巨型空白

### Requirement: 媒体状态必须可访问且不只依赖颜色
Buffering、paused、playing、selected、compare side、stale、lower-quality、caption active与error MUST有文本/ARIA表达。Waveform、timeline和compare controls MUST键盘可用；live announcement MUST节流。

#### Scenario: Screen reader播放音频
- **WHEN** 用户使用辅助技术打开Audio Pane
- **THEN** 可感知title、duration、play state、current time、control labels、waveform availability与transcript入口，无需理解canvas颜色

### Requirement: 3D与媒体编辑必须保留为显式retain-next
`@google/model-viewer`、video/audio同步A/B、裁切、转码、annotation mutation、background playback、PiP与browser Fullscreen API MUST NOT成为V3 acceptance。它们需要独立owner、安全、GPU/codec与产品证据。

#### Scenario: 打开glTF资源
- **WHEN**当前profile未注册经批准的3D renderer
- **THEN** resource显示metadata/Download/Open externally或unsupported，V3不得静默加载model-viewer/three.js
