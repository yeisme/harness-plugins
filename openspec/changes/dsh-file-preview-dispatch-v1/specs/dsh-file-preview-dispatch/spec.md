## ADDED Requirements

### Requirement: 打开文件 SHALL 按类型分派到 per-file 预览视图
`dsh-desktop-workbench` SHALL 注册内容视图 `desktop.preview`（singleton: false、retention: snapshot、resourceKey=owner opaque ref）。从 explorer/文档库打开 audio/video/pdf/table/document/archive/binary 文件 SHALL 打开该视图，每文件一个 Tab，MUST NOT 顶替已打开的其他文件预览。文本族与图片 SHALL 保持既有 `desktop.file` 路由（编辑与图像区域引用语义不变）。

#### Scenario: 连续打开两个媒体文件
- **WHEN** 用户在目录树先后打开 `clip.mp4` 与 `voice.mp3`
- **THEN** 工作台 SHALL 出现两个独立 `desktop.preview` Tab，各自持有自己的访问句柄
- **AND** 关闭其中一个 SHALL 只释放该 Tab 的 object URL

#### Scenario: 打开 Markdown 保持编辑器
- **WHEN** 用户打开 `notes.md`
- **THEN** 路由 SHALL 保持 `desktop.file`（MarkdownText/块编辑/语义编辑器路径不变）

#### Scenario: 打开图片保持区域引用
- **WHEN** 用户打开 `cover.png`
- **THEN** 路由 SHALL 保持 `desktop.file`，图像区域引用入口与 composer handoff 不变

### Requirement: 预览视图 SHALL 通过本地 registry 确定性解析渲染器
`desktop.preview` SHALL 把 `FileEntryV1` 经既有 adapter 映射为 `PreviewResourceV1`，经 `PreviewRendererRegistry` 按 preference→exact MIME→suffix→family→binary 顺序解析渲染器；lazy load 失败 SHALL 只降级到下一兼容 descriptor，MUST NOT 按 MIME 试探执行。渲染器消费 owner 授权的有界 `PreviewAccessHandleV1`（`readBinary` 一次性读取 bytes + 短时 object URL，经 `createPreviewAccessHandle` 构造并在卸载/切换时对称 release），MUST NOT 从 ref/title 拼接路径或 URL。

#### Scenario: 解析 zip 到归档渲染器
- **WHEN** 打开 mediaType 为 `application/zip` 的文件
- **THEN** registry SHALL 经 exact MIME 命中 `yeisme:archive`，而非 binary 兜底

#### Scenario: owner 拒绝或超上限
- **WHEN** `readBinary` 返回 undefined（未授权）或 `truncated: true`（超 24MiB 上限）
- **THEN** 视图 SHALL 显示 unsupported/oversized 状态与大小事实，MUST NOT 显示空白或无限 spinner

#### Scenario: 关闭在途加载
- **WHEN** 用户在字节读取完成前关闭 Tab
- **THEN** abort SHALL 取消在途请求，异步失败 MUST NOT 在已关闭 Tab 闪现 error，object URL SHALL 被回收

### Requirement: zip 归档 SHALL 只读中央目录，未知二进制 SHALL 有界 hex 可视化
`yeisme:archive` 渲染器 SHALL 仅解析 zip 中央目录（entry 名、未压缩大小、目录标记），带 entry 数上限、名字长度上限与 malformed/truncated 事实；MUST NOT 解压、执行或读取本地文件数据。`yeisme:binary-hex` 渲染器 SHALL 以有界字节数（256B）显示 hex/ASCII 视图与总大小事实。非 zip 归档（tar/gz/7z/rar）SHALL 走 binary hex 或诚实 unsupported，MUST NOT 伪造列表。

#### Scenario: zip 列表截断
- **WHEN** zip 含 200+ entry
- **THEN** 列表 SHALL 显示前 200 项 + `totalEntries`/`truncated` 事实

#### Scenario: 未知二进制
- **WHEN** 打开无扩展名的二进制文件
- **THEN** 视图 SHALL 显示 256B hex/ASCII 预览与总大小，MUST NOT 显示「二进制文件不支持文本预览」式死路错误

#### Scenario: 损坏的 zip
- **WHEN** 中央目录签名不匹配或 EOCD 缺失
- **THEN** 渲染器 SHALL 降级到 malformed 事实（或 binary hex），MUST NOT 抛未捕获错误

### Requirement: 格式矩阵 SHALL additive 覆盖常见音视频与归档扩展名
`classifyFileEntry` 扩展表 SHALL additive 纳入 flac/opus/aac/aif/aiff/wma/mid/midi（audio）、mkv/avi/flv/mts/m2ts/3gp/ogm（video）、zip/jar/tar/gz/tgz/bz2/xz/7z/rar（document→binary family，zip 族带标准 MIME）。文本族扩展 MUST NOT 因此改路由（仍返回 text kind → `desktop.file`）。

#### Scenario: mkv 路由
- **WHEN** 打开 `capture.mkv`
- **THEN** 分类 SHALL 得到 video family 并路由 `desktop.preview` 播放渲染器

#### Scenario: 文本路由不回归
- **WHEN** 打开 `dump.json`
- **THEN** 分类 kind 仍为 text，路由保持 `desktop.file`

### Requirement: 媒体库入口 SHALL 常驻侧栏
`dsh-desktop-workbench` SHALL 在 `sidebar.footer.action` 注册「媒体」按钮打开既有 `desktop.media` 单例库视图；无 `dsh.mediaHost` 时入口仍在，面板显示既有诚实空态。打开文件路由到 `desktop.preview` 后，`desktop.media` MUST NOT 再作为文件打开的目标视图。

#### Scenario: 无 host 时的库入口
- **WHEN** 未注册 `dsh.mediaHost`
- **THEN** 侧栏「媒体」按钮仍可打开媒体库视图并显示诚实空态

### Requirement: explorer 树 SHALL 按类型显示文件图标
`dsh.explorer` 树行 SHALL 按扩展名/声明 kind 选择 presentation-only 图标（image/audio/video/pdf/archive/code/document/folder/file）；扩展名映射 MUST NOT 成为 renderer 选择或预览授权依据（授权与 family 仍由 owner inspect/classify 决定）。

#### Scenario: 树内识别归档
- **WHEN** 目录树渲染 `bundle.zip`
- **THEN** 行图标 SHALL 为 archive 语义图标（非通用 file）

#### Scenario: 未知扩展
- **WHEN** 渲染 `data.unknownext`
- **THEN** 行图标 SHALL 回退通用 file 图标
