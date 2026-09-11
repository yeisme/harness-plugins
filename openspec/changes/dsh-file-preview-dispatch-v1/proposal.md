# dsh-file-preview-dispatch-v1

## Why

dsh web（Desktop Workbench + dsh.explorer）目前从目录树打开一个文件只有两条内容路由：`desktop.file`（文本/Markdown/图片，带编辑与图像区域引用）与 `desktop.media` **单例**媒体库（单次只能显示一个资源，打开第二个媒体文件会顶替第一个）。与此同时，仓库内已经建成但**没有生产接线**的能力有三块：

1. `dsh-rich-media` 预览平台（`PreviewRendererRegistry` 确定性解析 + `LocalResourcePreviewHost` 有界访问 + FileEntry/MediaRef adapters）只有测试消费者；
2. zip 中央目录列表（`archive-listing.ts`，只读 entry 名与未压缩大小，绝不解压）与有界二进制 hex 预览——`.zip`/未知二进制今天在 `desktop.file` 里以「二进制文件不支持文本预览」错误收场；
3. 富媒体渲染器（`MediaPlaybackRenderer` 倍速/逐帧/章节、`MediaImageRenderer` 缩放/平移/旋转）——`desktop.media` 只用裸 `<audio>/<video>/<img>` 元素。

目录树（`dsh.explorer`）行图标也只有 folder/file/git-branch 三种，不区分媒体/PDF/表格/归档/代码类型，用户无法在树里“看出”哪些文件可以可视化预览。

本 change 把这些已建成能力接通为**每文件一个预览视图**的统一分派面，并扩展格式矩阵；不新增媒体存储、鉴权或 rendition owner 语义（仍归 DSH/领域 owner）。

## What Changes

- 新增内容视图 `desktop.preview`（singleton: false、retention: snapshot、resourceKey=entry ref）：每打开一个可预览文件各占一个 Tab，互不顶替。渲染走 `PreviewRendererRegistry`（preference→exact MIME→suffix→family→binary fallback），lazy load 失败逐级降级。
- `dsh-rich-media` 格式矩阵 additive 扩展：音频（flac/opus/aac/aif/aiff/wma/mid/midi）、视频（mkv/avi/flv/mts/m2ts/3gp/ogm）、归档（zip/jar/tar/gz/tgz/bz2/xz/7z/rar → 对应 x- MIME）。
- 新增 renderer descriptors：
  - `yeisme:audio` / `yeisme:video` → `MediaPlaybackRenderer`（owner 授权 object URL，`allowBlobUrl` 显式开启）；
  - `yeisme:archive`（exact MIME: zip 三类）→ zip 中央目录列表（entry 名/未压缩大小/目录标记/截断与 malformed 事实）；
  - `yeisme:binary-hex`（binary family 兜底，优先级低于 exact）→ 有界 hex/ASCII 视图（256B cap + 总大小事实）。
- `dsh-desktop-workbench` 打开路由：文本族（txt/md/code/json/yaml/…）与图片保持 `desktop.file`（编辑器 + 图像区域引用心智不变）；audio/video/pdf/table/document/archive/binary 改开 `desktop.preview`。
- `desktop.media` 单例保留为媒体库投影；恢复 `dsh-web-render-preview` 已冻结的「侧栏 SHALL 始终提供媒体 overlay 入口」合同——`sidebar.footer.action` 注册「媒体」按钮（当前缺失）。
- `dsh.explorer` 树行图标按扩展分类（presentation-only）：image/audio/video/pdf/archive/code/document，扩展名只作视觉提示，不构成 renderer 选择依据。
- 不改 `FileEntryV1`/`MediaRefV1`/`PreviewResourceV1` 合同；不动 `PreviewResourceV1` 字段集与 `PREVIEW_FAMILIES`。

## Dispatch Matrix（打开路由）

| 文件族 | 打开目标 | 渲染器 | 备注 |
| --- | --- | --- | --- |
| 文本/Markdown/代码/JSON/YAML | `desktop.file` | MarkdownText / 语义编辑器 / 源码 | 编辑 + 区域引用不变 |
| 图片 | `desktop.file` | `<img>` + 区域引用 | 本切片不迁移（区域引用事件在位） |
| PDF | `desktop.preview` | `yeisme:pdf`（原生 iframe） | 每文件 Tab |
| 音频/视频 | `desktop.preview` | `yeisme:audio`/`yeisme:video`（MediaPlaybackRenderer） | 每文件 Tab |
| CSV/TSV/XLSX/XLSM/DOCX | `desktop.preview` | `yeisme:csv`/`yeisme:sheet`/`yeisme:docx` | 每文件 Tab |
| zip/jar | `desktop.preview` | `yeisme:archive`（中央目录列表） | 不解压 |
| tar/gz/7z/rar 等 | `desktop.preview` | `yeisme:binary-hex` | 元数据 + hex 诚实视图 |
| 未知二进制 | `desktop.preview` | `yeisme:binary-hex` | 取代「二进制文件不支持文本预览」错误 |
| 超上限（host truncated） | `desktop.preview` | unsupported 态 + 大小事实 | 不膨胀内存 |

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| per-file 预览分派视图 | required | Harness Plugins | deliver-now | vitest + build |
| 格式矩阵扩展（音视频/归档） | required | Harness Plugins | deliver-now | 分类表测试 |
| zip 列表/二进制 hex 诚实视图 | required | Harness Plugins | deliver-now | vitest |
| registry 生产接线 | required | Harness Plugins | deliver-now | 解析顺序测试 |
| 媒体库入口恢复 | required | Harness Plugins | deliver-now | sidebar 注册测试 |
| 树类型图标 | required | Harness Plugins | deliver-now | 图标解析测试 |
| 媒体存储/读取鉴权/rendition | required | DSH/领域 owner | moved behind contract | 既有 owner seam（readBinary） |
| 图片区域引用渲染器统一 | optional | Harness Plugins | retain-next | 图像仍走 desktop.file |

## Capabilities

### New Capabilities

- `dsh-file-preview-dispatch`: 目录树打开→按类型分派的 per-file 预览面合同（路由矩阵、registry 解析、归档/二进制诚实视图、媒体库入口、树类型图标）。

### Modified Capabilities

无。`desktop.file`/`desktop.media` 行为本切片不改合同面（`desktop.media` 侧栏入口是对 `dsh-web-render-preview` 既有 Requirement 的实现补齐，不修改该 spec 文本）。

## Impact

- `packages/bundle/dsh-rich-media/src/client/preview/format-kinds.ts`（additive 行）、`preview/descriptors.tsx`（新 descriptors）、`preview/archive-view.tsx`（新）、`preview/binary-hex.tsx`（新）、`src/client/index.ts`（export）。
- `packages/client/ui-desktop-workbench/src/client/file-preview-dispatch.tsx`（新组件 + export）。
- `packages/bundle/dsh-desktop-workbench/src/client/apply.ts`（视图注册 + 打开路由 + 媒体侧栏按钮）。
- `packages/client/ui-pane-workbench/src/icon.ts` + `src/explorer/tree-ui.tsx`（additive 图标 + 行图标映射）。
- 合同兼容分类：additive、experimental。rollback = 移除 `desktop.preview` 视图注册与路由分支，回到 `desktop.media` 单例路径，无数据迁移。
