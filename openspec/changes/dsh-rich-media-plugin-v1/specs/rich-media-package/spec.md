## ADDED Requirements

### Requirement: 富媒体插件 SHALL 以可安装 bundle 提供 Host/Client 面
`@yeisme/dsh-rich-media` SHALL 声明 `dsh.bundle.patch`、`dsh.client.inject` 与 web platform，并通过 `dsh plugin --profile web add @yeisme/dsh-rich-media` 安装。Host 面 SHALL 只向浏览器传安全 MediaRef 投影；Client 面 SHALL 只渲染本地受信任组件。

#### Scenario: 安装富媒体 bundle
- **WHEN** 用户执行 `dsh plugin --profile web add ./packages/bundle/dsh-rich-media`
- **THEN** profile SHALL 包含 `dsh-rich-media` bundle row
- **AND** 卸载 SHALL 移除该 row 且不修改 DSH core 或领域数据

### Requirement: 客户端渲染器 SHALL 走官方 seam
客户端媒体渲染器 SHALL 通过 `conversation.chat.node`、`tool.view` 或 Pane slot 等官方 seam 注册；未确认 seam 前 SHALL NOT 使用 DOM patch、全局 selector 劫持或任意 iframe bridge。所有媒体 URL 必须来自 Host 授权结果。

#### Scenario: 聊天内展示媒体卡片
- **WHEN** 官方聊天节点 seam 可用且 Host 返回安全 MediaRef
- **THEN** 客户端 SHALL 注册 `RichMediaCard` 或等价本地渲染器
- **AND** SHALL NOT 根据 ref 自行拼接文件路径或凭据 URL

### Requirement: Host/Client 生命周期 SHALL effect-scoped 且 HMR-safe
所有 Host/Client registration、listener、stream、媒体播放器与 URL revoke SHALL 由 effect-scoped disposer 管理。重复 mount、HMR、profile 切换或 Pane close SHALL 对称 teardown，不得产生重复连接或播放器泄漏。

#### Scenario: 开发时热更新富媒体插件
- **WHEN** 插件在开发 profile 中热更新
- **THEN** 旧 Host/Client contribution SHALL 全部释放
- **AND** 新版本 SHALL 只保留一组有效 listener 与渲染器

### Requirement: 新公共合同 SHALL 标记 experimental
`@yeisme/dsh-rich-media` 首个公共版本 SHALL 使用 `0.1.0-rc.1` 与 experimental/alpha API 标记。后续 additive optional 字段 MAY 以兼容 RC 演进；删除、重命名、字段必填化或语义复用 MUST 先进入独立 OpenSpec migration。

#### Scenario: 后续新增可选字幕字段
- **WHEN** 媒体合同需要增加 optional subtitle ref
- **THEN** 新字段 SHALL 以安全默认值添加且旧 MediaRef 继续校验通过
- **AND** 不得借 pre-1.0 身份移除现有字段

### Requirement: RichMediaCard SHALL 安全渲染受支持媒体类型
`RichMediaCard` SHALL 对 image/audio/video 使用原生媒体元素，对 PDF 使用 sandbox iframe，对 document/text/file 使用元数据卡片与 Open/Download 动作。所有 `src` SHALL 来自 Host 授权结果；无源时 SHALL 显示元数据降级，不自行构造 URL。

#### Scenario: 媒体库展示 PDF
- **WHEN** Host 返回一个带 `open`/`download` capability 的 PDF MediaRef 和短时 URL
- **THEN** RichMediaCard SHALL 渲染 sandbox iframe 预览
- **AND** 用户 SHALL 能通过显式 Open/Download 动作访问同一短时 URL

### Requirement: Chat 媒体节点 SHALL 通过会话事件折叠
DSH 聊天 SHALL 通过 `media/ref` 会话事件与 `media-ref` Chat 节点渲染媒体卡片。`media/ref` SHALL 携带稳定 mediaId 与已校验 `MediaRefV1`；客户端 Definition SHALL 只按 mediaId 折叠，不扫描事件窗口、不猜测媒体归属。

#### Scenario: 工具或领域 owner 向聊天追加媒体
- **WHEN** Host/领域 owner append `media/ref` 事件
- **THEN** Chat SHALL 在对应位置渲染 `RichMediaCard`
- **AND** 重复打开/回放 SHALL 以同一 mediaId 恢复同一节点
