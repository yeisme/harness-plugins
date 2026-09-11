# dsh-file-preview-dispatch-v1 Design

## Context

- 生产打开路径只有 `desktop.file`（文本/图片，438 行 LegacyFileOpenPane + SemanticFileEditor）与 `desktop.media` 单例（MediaPane + MediaPreviewPane 库视图）。
- `dsh-rich-media` 预览平台（registry/access/adapters/sources/descriptors，见 `dsh-pane-workspace-experience-v3` 的 `resource-preview-platform` handoff spec 与 `dsh-workspace-productivity-ui-v3` preview-parity-audit）只有测试消费者——本 change 是它的首个生产接线。
- zip 中央目录解析（`preview/archive-listing.ts`）与 hex 二进制视图语义（`dsh-file-document/binary-preview.ts`，256B cap）已存在，均未接入桌面打开路径。
- 上游 official preview seam（PreviewResourceV1 Agent Note）仍缺位（09-09 复核 alpha 0.1.5-alpha.1 0 命中）；本 change 全部走本地 owner（`/yeisme-files/api` `fs.binaryV2`），不依赖上游。

## Goals / Non-Goals

**Goals**

1. 每文件一个预览 Tab（`desktop.preview`，singleton: false），多文件并存、独立生命周期。
2. registry 确定性解析成为生产分派路径（preference→exact→suffix→family→binary）。
3. zip 列表 / 二进制 hex / 音视频富渲染进入桌面打开路径；消灭「二进制文件不支持文本预览」死路。
4. 格式矩阵 additive 扩展（音视频/归档扩展名）。
5. `desktop.media` 回归纯媒体库 + 侧栏常驻入口（补齐 `dsh-web-render-preview` 已冻结 Requirement 的实现缺口）。
6. explorer 树类型图标（presentation-only）。

**Non-Goals**

- 不动图片路由（区域引用事件协议在 `desktop.file`；渲染器统一留 retain-next，见 mediaRef 统一 lane）。
- 不动文本族路由（编辑器/语义编辑器心智）。
- 不新增 rendition/thumbnail/waveform owner 语义、不做 version subscription（等上游 official seam，见 productivity-ui-v3 2.4 解锁条件）。
- 不实现 live watch（fs-watch 上游 PR 未合入，followups 1.1 已定）。
- 不解压归档内容、不支持 Office 转换（PPTX/DOC 等保持既有诚实降级）。

## Decisions

### D1: 新视图 `desktop.preview` 而非改造 `desktop.media`

`desktop.media` 的库语义（列表 + 选中 + seeded/chat 媒体汇聚）与 per-file Tab 语义不同；singleton 由 spec（`dsh-web-render-preview`「唯一 kind desktop.media」）冻结。新 kind 是 additive 注册，rollback 干净。

### D2: 分派面组件放 `ui-desktop-workbench`，bundle 只接线

组件 `FilePreviewDispatchPane`（client 包）消费 `@yeisme/dsh-rich-media/client` 的导出（registry/host/adapters/descriptors 需从 client index 导出——本 change 补 export，additive）。`dsh-desktop-workbench/src/client/apply.ts` 只注册视图与路由，与 FileOpenPane 的分工一致。

### D3: 访问路径 = pane 侧 `readBinary` + `createPreviewAccessHandle`

分派面自己调用 `fileHost.readBinary(entry)`（24MiB 上限、truncated 事实、version——事实先于渲染进入状态机），成功后构造 handle：

- objectUrl 由 `createPreviewAccessHandle` 的 `disposeSecrets` 自动 revoke（blob: 前缀），Tab 卸载/切换时 `release('close')` 对称释放；
- bytes 供 archive/hex 经 `readByteRange`（BYTE_RANGE_MAX 256KiB 分段）读取；
- PDF/音视频渲染器消费非枚举 `access.url`；
- oversized（truncated）→ 不构造 handle，视图显示大小事实的 unsupported 态（不构造 24MiB+ 内存）。

（不采用 `LocalResourcePreviewHost` 的 source.open 路径：它无法把 truncated/size 事实带进状态机，且会造成二次读取；host 的 fence/session 语义对 pane 单句柄场景没有增量价值，留给多句柄消费者。）

### D4: 归档渲染走 exact-MIME descriptor，不扩 `PREVIEW_FAMILIES`

`PREVIEW_FAMILIES` 保持 8 类不动（已发布合同面）。zip 三类 MIME（application/zip、x-zip-compressed、java-archive）注册 `yeisme:archive`（families ['binary'] + mediaTypes exact）——exact 阶段先于 family 阶段，稳定压过 `yeisme:binary-hex` 与 binary-notice。非 zip 归档自然落到 binary-hex。

### D5: hex 视图在 rich-media 内自实现（不 import dsh-file-document）

`dsh-file-document` 与 `dsh-rich-media` 是平行 bundle 包，无依赖边；hex dump 是 ~40 行有界纯函数 + 表格渲染，语义与 `formatBinaryPreview`（256B cap）对齐并注释互指。避免为一个小工具引入跨 bundle 依赖（bundle 依赖只能由组合层 desktop-workbench 持有）。

### D6: 播放渲染器显式 `allowBlobUrl: true`

`rejectUnsafePlayback` 默认拒绝 blob: URL（防任意注入）。本路径的 object URL 是 owner 授权句柄（readBinary → 本地 Blob），经 `MediaPlaybackRenderer({ allowBlobUrl: true })` 显式放行，unsafe 检查（javascript:/track kind 白名单）继续生效。

### D7: 树图标映射放 `ui-pane-workbench`（零新依赖）

presentation-only 扩展名→图标映射（~30 行常量表），复用 `classifyFileEntry` 会引入 client→bundle 依赖，不值得；渲染授权仍由 owner inspect/classify 决定，图标只是视觉提示（spec 明确 extension 不构成 renderer authority）。

### D8: 文本/图片路由不变

`mediaKindOf` 返回 undefined（text kind）→ `desktop.file`；image → `desktop.file`（区域引用）。只有 classified kind ∈ {audio, video, pdf, document} 或 entry.kind ∈ {archive, binary, document, pdf} 走 `desktop.preview`。

## Risks / Trade-offs

- **readBinary 24MiB 上限对大音视频**：维持既有上限与诚实 oversized 态；range/rendition 流式等 official seam（unlock 后接入）。
- **每文件 Tab 的内存**：object URL 与 bytes 句柄随 Tab 关闭释放；`retention: 'snapshot'` + pane 泄漏守卫（`paneStateContainsAccessSecrets`）已覆盖投影边界。
- **树图标误判**（扩展名与实际类型不符）：只影响图标，不影响预览路径（family 由 owner classify 决定）；无功能风险。

## UI Contract

（按 `docs/design/dsh-unified-panel-visual-system.md` §12）

- Surface classification: **embed**（`desktop.preview` 是 pane-workbench 内容视图，经 `@yeisme/dsh-client-ui-surface` Surface 呈现；renderer 内容沿用 rich-media 既有 embed token 面）
- Surface kind: workspace（内容区，单 SurfaceContextBar）
- First / second / third visual priority: 1) 资源内容（渲染器主体）；2) 状态事实条（loading/unsupported/oversized/malformed 的 reason + 大小/版本）；3) ContextBar 动作（打开/下载沿用 renderer 内既有动作，不新增 chrome）
- Existing components reused: `Surface`/`SurfaceContextBar`/`SurfaceState`、`MediaPlaybackRenderer`、`MediaCsvRenderer`/`MediaSheetRenderer`/`MediaDocxRenderer`、pdf iframe（`yeisme:pdf`）、archive/hex 新表格复用 `--vk-*` token 与 monospace 刻度
- Cards that earn existence: 归档 entry 列表与 hex 视图不是卡片，是数据表格；无新增装饰性卡片
- Primary scroll owner: 渲染器主体（viewer 区域）；ContextBar 与状态条固定

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 媒体/文档渲染 | SurfaceState loading「正在打开文件…」 | N/A（文件必非空） | 读取失败 reason（alert） | 渲染器主体 | truncated 文本/表格按渲染器既有 partial 态 | owner 未授权 → unsupported + reason |
| zip 列表 | 同上 | 空归档 →「归档内没有条目」 | malformed → 事实 + binary-hex 降级 | entry 表格 | >200 entry → truncated 事实 | 非 zip 归档不出现本渲染器 |
| binary hex | 同上 | 0 字节 → 事实 | 同上 | hex/ASCII 表 | 仅前 256B → truncated 事实 | N/A |
| 超上限 | — | — | — | — | oversized 态 + 文件大小 + 打开/下载指引 | 预览主体禁用 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| hex/表格单列横滚，播放器全宽，ContextBar 收窄为图标+标题 | 表格出横滚（既有 table 容器行为） | 主体居中最大 920px 文档阅读宽度沿用 |

### Accessibility

- Keyboard path: Tab 聚焦 ContextBar 动作 → 渲染器主体（播放器原生控件键盘）；Esc 沿用 pane Tab 关闭
- Focus owner/return: Surface 内自管；关闭 Tab 焦点回 pane chrome（既有行为）
- Visible labels and accessible names: `aria-label` 用文件名；状态条 `role="status"/"alert"`；hex 表 `role="table"` 语义 + 表头
- Reduced motion and coarse pointer: 播放器/图像沿用 MediaPlaybackRenderer/MediaImageRenderer 既有处理；本面新增 UI 无动画

### Visual Exceptions

- 无。hex/归档表格颜色全部 `--vk-*`（背景 `--vk-bg-layer-1`、边 `--vk-border-l1`、十六进制文本 `--vk-text-secondary`），monospace 字号沿用 `--dsh-wb-font-size` 基准。

## Testing

- `dsh-rich-media`：format-kinds 分类表（新扩展→kind/MIME、文本不回归）；descriptors 解析顺序（zip exact 压过 binary、family 阶段、loadBest 降级）；archive-view（正常/空/截断/malformed→hex 降级）；binary-hex（cap、totalBytes 事实）。
- `ui-desktop-workbench`：FilePreviewDispatchPane——resolve→render 流（registry 解析 + access 注入）、owner 拒绝/超上限的 unsupported 态、unmount 释放（object URL revoke）、abort 不闪 error。
- `dsh-desktop-workbench`：file-preview-mapping 扩展——mkv/flac/zip/未知二进制的路由断言（`desktop.preview`）、md/json 仍 undefined（desktop.file）、侧栏「媒体」按钮注册存在。
- `ui-pane-workbench`：iconForRow 扩展名→图标断言（zip→archive、png→image、ts→code、unknown→file）。
- 仓库门：`pnpm run typecheck && pnpm run test && pnpm run build && pnpm run check:bundles && pnpm run check:plugins && pnpm run check:surfaces`；`test:visual` 只跑不更新无关基线；`openspec validate dsh-file-preview-dispatch-v1 --strict --no-interactive`。

## Rollout / Rollback

- rollout：随 `dsh-desktop-workbench` / `dsh-rich-media` 下一次 bundle 发布；无数据迁移。
- rollback：移除 `desktop.preview` 视图注册与 openFile 分支（回到 `desktop.media` 单例路由），移除侧栏媒体按钮；rich-media 侧全是 additive export，可独立保留。
