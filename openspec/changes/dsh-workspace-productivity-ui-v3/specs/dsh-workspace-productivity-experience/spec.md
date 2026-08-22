## ADDED Requirements

### Requirement: 工作区必须保持 DSH canonical 布局边界
系统 MUST 在所有 Pane 打开、分屏、移动、最大化、窄屏 Sheet 与恢复状态下保留 DSH 左侧会话栏；工作区左边界 MUST 不小于 AppFrame 实际 sidebar 右边界。

#### Scenario: 最大化工作区
- **WHEN** 用户最大化任意右侧或底部 Pane group
- **THEN** 系统只隐藏 sidebar 右侧主区域内的其他 surface，且 DSH 左侧会话栏保持 mounted、可见和可交互

#### Scenario: 窄屏投影
- **WHEN** 主区域无法同时满足 conversation、workspace 与 Details 的最小尺寸
- **THEN** DSH 将活动 workspace 投影为 sidebar 右侧 Sheet，且不使用全页 overlay 或固定 sidebar 偏移

### Requirement: 工作区与领域能力必须分离 canonical ownership
系统 MUST 由 DSH 或明确领域 owner 拥有 Agent authority、PTY、文件/媒体字节、MIME sniffing、conversion/rendition、sandbox、进程生命周期与 transport；Harness Plugins MUST 只拥有 Pane layout、presentation、selection、safe resource reference、renderer registry 与浏览器 renderer。

#### Scenario: 打开终端
- **WHEN** Harness Plugins 请求打开或附着 terminal resource
- **THEN** DSH 验证 exact live Agent、profile、sandbox 与 terminal ownership 后返回 typed attachment，Harness Plugins 不直接创建 node-pty process

#### Scenario: 打开文件
- **WHEN** 用户从 Explorer、DSH 左侧栏 action 或 terminal link 打开文件
- **THEN** 所有入口使用 owner-issued opaque resource reference，浏览器不以绝对路径作为 authority 或持久化 identity

### Requirement: Pane 管理必须形成一致且可访问的工作台体验
系统 SHALL 提供语义图标、Activity Rail、可搜索 Quick Pick、resource Tab、每 group 的 split、move、maximize/restore、more 与 close 操作，并为 pointer、keyboard 与 assistive technology 提供等价路径。

#### Scenario: 键盘管理 Pane
- **WHEN** 用户不使用 pointer 操作当前 Pane group
- **THEN** 用户仍可切换/关闭 Tab、打开视图、拆分、移动区域、最大化/恢复，并收到可感知的结果或拒绝原因

#### Scenario: Provider 不可用
- **WHEN** 持久化 Tab 的 provider 未注册或 capability 不匹配
- **THEN** 系统保留可恢复的 orphaned Tab，显示明确 compatibility state，并允许关闭或重试而不加载远端代码

### Requirement: 文件与文档必须使用 resource-keyed Tab 生命周期
系统 MUST 将具体文件与文档作为 resource-keyed content views；单击 SHALL 使用可替换 preview Tab，双击、Enter、编辑或显式 Pin SHALL 转为持久 Tab。

#### Scenario: 连续预览两个文件
- **WHEN** 用户单击文件 A 后再单击文件 B，且文件 A 的 preview Tab 未固定、未编辑
- **THEN** 系统在同一 preview 位置以文件 B 替换文件 A，而不是持续创建单例模块或无界 Tab

#### Scenario: 固定文档
- **WHEN** 用户双击、按 Enter、编辑或 Pin 当前 preview 文档
- **THEN** 系统保留该 resource Tab，后续预览其他资源不得替换它

### Requirement: 文件、文档、数据与媒体必须共享安全 Resource Preview 合同
系统 MUST 使用 owner/ref/version/mediaType/capabilities/renditions 组成的 safe resource descriptor，并由本地 renderer registry 选择视图。`FileEntryV1`、`MediaRefV1` 与既有 attachment ref MUST 通过兼容 adapter 接入，MUST NOT 被破坏性重命名或替换。

#### Scenario: 选择 renderer
- **WHEN** owner 返回 `application/ld+json` resource 且用户没有 Open With 偏好
- **THEN** registry 按 exact/structured-suffix/family 顺序选择本地 JSON renderer；不得根据文件扩展名加载远端 component

#### Scenario: renderer 被卸载
- **WHEN** 当前 resource 的首选 renderer 随 profile dispose/HMR 被移除
- **THEN** Tab 保留 safe identity 并重新解析到兼容 fallback或unsupported状态，且不保留旧 worker、URL或listener

### Requirement: 预览内容访问必须 bounded、可取消且可释放
DSH/领域 owner MUST 提供 typed inspect/rendition/range或window/release 能力；浏览器 MUST NOT 从绝对路径、provider URL 或任意 fetch 取得字节。短时 access handle、Object URL、stream、worker与decoder MUST 在关闭、切换、卸载或取消时对称释放。

#### Scenario: 预览大型文件
- **WHEN** text/table/PDF/audio/video resource 超过 owner 的首屏预算
- **THEN** owner 返回 bounded window、range或stream及 loaded/total/truncated事实，UI显示partial状态并按需继续，不把完整对象写入React state或Pane persistence

#### Scenario: MIME 不匹配
- **WHEN** 扩展名/声明类型与 owner magic-byte sniff 结果不一致
- **THEN** owner返回typed mismatch/suspicious状态或安全fallback，浏览器不得逐个尝试HTML、PDF或媒体renderer

### Requirement: 文件与文档预览必须覆盖明确格式矩阵并诚实降级
系统 SHALL 为 text/code、Markdown、JSON/YAML/TOML、CSV/TSV、PDF 提供 first-support renderer；HTML/SVG、archive、Office/EPUB/notebook 与 unknown binary MUST 使用文档化的安全 rendition或fallback，不得渲染空白 iframe冒充成功。

#### Scenario: 打开 PDF
- **WHEN** owner提供可预览PDF rendition
- **THEN** Harness使用lazy PDF.js worker提供page/search/zoom/fit/rotate/text layer，并禁用scripting、自动附件/外链和表单提交；renderer失败仍保留Download/Open externally

#### Scenario: 打开超大 CSV
- **WHEN** CSV/TSV 无法在浏览器预算内全量解析
- **THEN** owner提供schema与cursor rows，Harness通过virtualized table显示partial数据；不可用的全局sort/filter明确disabled且不得静默只作用于可见行

### Requirement: 媒体库与媒体预览必须作为 Pane providers 交付
系统 SHALL 提供 singleton Media Library navigator 与 non-singleton image/audio/video resource views；V3 production profile MUST NOT 同时注册旧 `sidebar.footer.action` Rich Media Workbench。媒体 Pane MUST 支持 typed Reveal/Compare/Attach/Download/Open intents。

#### Scenario: 预览长音频
- **WHEN** owner提供长音频及预计算waveform peaks
- **THEN** Harness按需加载WaveSurfer显示waveform/timeline并保留可访问原生播放/seek/speed/transcript controls；不得为生成波形先解码完整音频

#### Scenario: 播放 HLS 视频
- **WHEN** 浏览器不支持native HLS但支持MSE，且owner授权manifest/segments
- **THEN** Harness按需加载hls.js并提供字幕/track/adaptive状态；无native HLS/MSE时显示unsupported而不是循环重试

#### Scenario: 图片对比
- **WHEN** 用户选择Compare With另一个兼容image resource
- **THEN** 系统打开resource-keyed compare view，提供side-by-side、swipe或opacity overlay，两个资源的owner/ref/version保持可追踪

### Requirement: 不受信任 active content 必须默认禁用
HTML、SVG、PDF、Office、archive entry与媒体metadata MUST 视为不可信。系统 MUST NOT 在DSH origin执行脚本、宏、任意iframe bridge、外部资源或云viewer；Download/Open externally MUST 是独立owner-authorized动作。

#### Scenario: HTML 文件请求预览
- **WHEN** owner没有提供sanitized/rasterized HTML rendition
- **THEN** Document Pane只显示Source/metadata/Download/Open externally，不把原始HTML插入DOM

### Requirement: 浏览器终端必须连接真实 PTY
系统 MUST 使用 DSH owner-scoped PTY 与原始 VT stream 驱动浏览器终端，并支持交互输入、真实 cols/rows resize、alternate screen、鼠标模式、bracketed paste、exit status、detach 与 reconnect；系统 MUST NOT 以 placeholder console、HTTP-per-key 或轮询冒充真实终端。

#### Scenario: 运行全屏终端程序
- **WHEN** 用户在 interactive terminal profile 中启动使用 alternate buffer 和终端 resize 的程序
- **THEN** xterm renderer 按 PTY VT 输出显示程序，键盘和鼠标事件经 control lease 写回同一 PTY，Pane resize 更新真实 cols/rows

#### Scenario: 移动终端 Pane
- **WHEN** 用户将 terminal Tab 从 Bottom 移到 Right 或进入最大化
- **THEN** 系统保留同一 terminal resource 与 process，且不得创建第二个 shell 或隐式 kill 原 PTY

### Requirement: 人类与 Agent 的终端输入必须仲裁
DSH MUST 为 interactive attachment 提供 observe/control 语义，同一 terminal 同时最多有一个 input controller；active model send 与 browser control MUST NOT 静默交错写入。

#### Scenario: Agent 正在发送命令
- **WHEN** browser attachment 在同一 PTY 存在 active model send 时普通请求 control
- **THEN** DSH 返回 typed busy 状态，浏览器保持 observe，除非用户显式执行接管流程并等待原 operation settle

#### Scenario: 控制连接断开
- **WHEN** 持有 control 的 WebSocket 断开、lease 过期、Agent dispose 或 terminal exit
- **THEN** DSH 释放 control lease，停止接受该 attachment 的输入，并保留或关闭 PTY取决于 owner lifecycle而非 Pane 是否可见

### Requirement: 终端传输必须是独立、认证且可恢复的 duplex channel
DSH MUST 为 terminal attachment 提供独立 authenticated WebSocket；现有 downlink-only event sockets MUST 保持原语义。终端 channel MUST 校验 frame schema、限制 frame 大小、提供 epoch/sequence、bounded replay、ack/backpressure 与 typed error。

#### Scenario: 未认证连接
- **WHEN** 客户端尝试在缺少有效 token 或 trusted host admission 的情况下升级 terminal WebSocket
- **THEN** DSH 在协议协商前拒绝连接，且不泄露 terminal 是否存在

#### Scenario: 重连游标仍在窗口内
- **WHEN** 浏览器以同一 epoch 和仍被保留的 sequence 重新 attach
- **THEN** DSH 只 replay 缺失 delta，然后继续 live output，不重复已确认 frame

#### Scenario: 重连游标已过期
- **WHEN** 客户端游标早于 bounded replay 的最早 sequence
- **THEN** DSH 返回 `resync_required` 或 bounded reset，并明确 `truncated`，不得声称恢复完整历史

### Requirement: 社区依赖必须通过本地语义边界采用
系统 SHALL 优先使用现有DSH Markdown/Shiki/JsonTree/Diff/Image primitives，以及 xterm.js、node-pty、Codicons、PDF.js、WaveSurfer、hls.js、Monaco和TanStack等维护中的社区能力；第三方 icon class、component URL、PTY handle、renderer object或通用WebSocket attach MUST NOT 直接成为跨项目公共合同。重依赖 MUST lazy load并提供轻量fallback。

#### Scenario: 渲染图标
- **WHEN** view provider 声明一个工作台图标
- **THEN** provider 使用本地语义 icon name，Harness wrapper 解析到 Codicon 或安全 fallback，并提供相应许可 notice

#### Scenario: WebGL 不可用
- **WHEN** xterm WebGL addon 初始化失败或 context lost
- **THEN** terminal 自动回退非 WebGL renderer，PTY 与用户输入保持可用

#### Scenario: 重 renderer 加载失败
- **WHEN** Monaco、PDF.js、WaveSurfer或hls.js dynamic import失败
- **THEN** 只有对应view进入typed error/fallback，Pane Chrome、其他Tabs与safe metadata仍可用

### Requirement: V3 必须保持演进兼容并诚实失败
系统 MUST 保持 Pane `registerView/openView`、`FileEntryV1`、`MediaRefV1` 与模型侧 terminal `startSend/read` 的既有语义；新增能力采用 additive capability detection与adapter。缺少 V3 seam 时 Harness Plugins MUST 显示 compatibility state，MUST NOT 回退为 overlay、重复media sidebar、fake terminal或任意URL preview。

#### Scenario: 旧 DSH 加载 V3 bundle
- **WHEN** Harness Plugins 检测不到 interactive terminal capability 或所需 workspace seam
- **THEN** bundle 明确列出缺失 capability 与最低兼容版本，终端动作不可用，但不遮挡 sidebar、不注册 placeholder PTY

#### Scenario: 卸载 V3 bundle
- **WHEN** Pane/terminal bundle dispose 或 HMR 替换
- **THEN** Harness Plugins 释放 slots、listeners、ResizeObserver、renderer registry、workers、streams、object URLs、media instances、xterm renderer 与 browser attachments；DSH/领域owner按各自lifecycle处理资源，且不残留布局预留

### Requirement: 跨项目交付必须提供分层验证证据
DSH 与 Harness Plugins MUST 分别提供 unit/component/integration evidence，并共同完成真实浏览器验证；所有 integration/component/system/e2e run MUST 写入各自 `temp/integration-test-runs/<run-id>/` 且按仓库规则脱敏。

#### Scenario: 真实浏览器验收
- **WHEN** V3 进入最终验证
- **THEN** evidence 覆盖 1440、1243、1024、768、390px、Right/Bottom、split、maximize、Details、Markdown/JSON/CSV/PDF/image/audio/video/HLS/binary fallback、partial/stale、terminal TUI、detach/reconnect、refresh 与 sidebar invariant，并保存 screenshot、ARIA、console/network/performance 摘要和命令输出
