# Design

## Context

预览平台（`PreviewRendererRegistry` / `PreviewAccessHandleV1` / `LocalResourcePreviewHost`）在 V3 differentiation lane 已建成：确定性解析（preference → exact MIME → suffix → family → binary 回退）、懒 loader、Open With、fail-closed。本 change 只在其上补格式渲染器，不改合同语义。

## Goals / Non-Goals

- Goals: CSV/TSV、DOCX、XLSX/XLSM、TXT/JSON/MD 源码在 pane 内可预览；生产路径（`dsh-desktop-workbench` → `MediaPreviewPane`）接线；重依赖懒加载；全预算 fail-closed。
- Non-Goals: PDF.js（浏览器原生 iframe 已够）；Markdown 渲染视图（源码视图先行，渲染视图待上游 markdown seam）；Office 编辑；PPTX 渲染（无轻量可信解析器，诚实降级）；owner 侧文档转换服务。

## Decisions

### D1: 重依赖内联懒工厂（mermaid 先例）

DSH Web ModuleLoader 只提供宿主模块，profile node_modules 里的包运行时取不到（ui-mermaid-render tsdown 注释已验证）。因此 `mammoth`/`@e965/xlsx`/`dompurify` 必须 alwaysBundle 内联进 `client.js`，但 `import()` 在 tsdown CJS 输出中保持懒工厂，首次打开对应格式才求值——字节成本（约 +2.5MB 未求值代码）换来零新 seam 与零首屏求值，本地 localhost 场景可接受。

`@e965/xlsx`（SheetJS CE 的 npm 维护 fork，0.20.3）替代 npm `xlsx@0.18.5`（已知 CVE 未在 npm 修复）。

### D2: 本地解析复用网格

CSV/XLSX 不另造表格 UI：解析产物喂 `createPreviewAccessHandle({ resource, table, columns })`，`PreviewTableRenderer` 照常经 `access.readTablePage` 分页。`columns` 为 handle 输入的 additive 可选字段，每页携带；CSV 首行提升为表头列 schema。

### D3: 预算

- 文本：fetch 上限 2MB；渲染按 64KB 窗口增量（`TEXT_WINDOW_MAX` 既有值）。
- CSV/TSV：4MB / 20000 行 / 256 列；超限截断并显示 truncated 提示。
- DOCX：16MB；mammoth 失败/超限 → typed unsupported + 打开/下载。
- XLSX/XLSM：16MB / 每 sheet 10000 行 / 256 列；单元格字符串截断 2000 字符。
- 所有 fetch 绑定选区 AbortController，切换即中止，不闪错误。

### D4: 消毒

mammoth 输出 HTML 经 `DOMPurify.sanitize`（默认 profile + FORBID style/script 注入面）后 `dangerouslySetInnerHTML` 渲染进 `StructuredContentFrame`。消毒失败/空结果 → typed unsupported。不信任任何 Office 内嵌媒体引用，mammoth 默认不内联图片（`convertImage` 丢弃为 alt 文本）。

### D5: 分发与降级

`ActiveMedia` 扩展：kind `text` → 源码视图；kind `document`/`file` 按 mediaType 分流（csv/tsv/xlsx/xlsm→网格，docx→mammoth，其余→降级）。PPTX/DOC/XLS/ODT 统一 typed unsupported 文案 + 打开/下载按钮，不猜格式。

## Risks / Trade-offs

- client.js 体积 +~2.5MB（未求值）：接受，同 mermaid 先例；未来若 DSH 开放多 chunk ModuleLoader 再拆。
- 自维护 RFC4180 解析器：范围小（引号/转义/换行/CRLF/预算），测试锁边角；避免 papaparse 依赖。
- jsdom 测试无法跑真 mammoth/xlsx：mock 懒加载边界，真库由 typecheck+build 锁合同。

## Migration Plan

纯 additive：新渲染器、新 descriptors、新映射。`./table` 入口与既有 owner-paged `yeisme:table` descriptor 不变；旧 change 两个 blocked 任务（file-document 5.3、rich-media 4.3）标注去向指向本 change。

## Open Questions

无阻塞项。Markdown 渲染视图、PPTX 渲染、owner 侧转换服务均明确 retain-next。
